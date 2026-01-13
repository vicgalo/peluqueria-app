"use client";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/app/agenda/agenda.css";

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ─────────────────────────────
   Localización en español
───────────────────────────── */
const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const messages = {
  allDay: "Todo el día",
  previous: "Anterior",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Cita",
  noEventsInRange: "No hay citas en este rango.",
  showMore: (total: number) => `+ Ver ${total} más`,
};

/* ─────────────────────────────
   Festivos nacionales 2026
───────────────────────────── */
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "Año Nuevo" },
  { date: "2026-01-06", name: "Reyes Magos" },
  { date: "2026-04-03", name: "Viernes Santo" },
  { date: "2026-05-01", name: "Fiesta del Trabajo" },
  { date: "2026-08-15", name: "Asunción de la Virgen" },
  { date: "2026-10-12", name: "Fiesta Nacional de España" },
  { date: "2026-11-01", name: "Todos los Santos" },
  { date: "2026-11-02", name: "Traslado Todos los Santos" },
  { date: "2026-12-06", name: "Día de la Constitución" },
  { date: "2026-12-07", name: "Traslado Constitución" },
  { date: "2026-12-08", name: "Inmaculada Concepción" },
  { date: "2026-12-25", name: "Navidad" },
];

const HOLIDAY_SET = new Set(HOLIDAYS_2026.map((h) => h.date));

/* ─────────────────────────────
   Tipos
───────────────────────────── */
type Client = { id: string; full_name: string; phone: string | null };
type Service = { id: string; name: string; default_duration_min: number; default_price: number };

type Row = {
  id: string;
  start_time: string;
  end_time: string;
  client_id: string;
  service_id: string;
  price: number | null;
  notes: string | null;
  status: "reserved" | "done" | "cancelled" | "no_show";
  paid: boolean;
  payment_method: "cash" | "card" | "bizum" | null;
  clients: { full_name: string } | null;
  services: { name: string } | null;
};

type EventT = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  raw: Row;
};

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventT[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [editEvent, setEditEvent] = useState<EventT | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");

  /* ─────────────────────────────
     Estilos de eventos
  ───────────────────────────── */
  const eventStyleGetter = useMemo(
    () => (event: any) => {
      if (event?.isHoliday) {
        return { className: "is-holiday-event text-white rounded-md" };
      }

      let bg = "bg-gray-900";
      if (event.raw?.status === "done") bg = "bg-green-700";
      if (event.raw?.status === "cancelled") bg = "bg-gray-500";
      if (event.raw?.status === "no_show") bg = "bg-red-700";
      if (event.raw?.paid) bg = "bg-blue-700";

      return { className: `${bg} text-white rounded-md` };
    },
    []
  );

  /* ─────────────────────────────
     Festivos como eventos
  ───────────────────────────── */
  const holidayEvents = useMemo(() => {
    return HOLIDAYS_2026.map((h) => {
      const start = new Date(`${h.date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      return {
        id: `holiday-${h.date}`,
        title: `🎉 ${h.name}`,
        start,
        end,
        allDay: true,
        isHoliday: true,
      };
    });
  }, []);

  /* ─────────────────────────────
     Cargar datos
  ───────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) window.location.href = "/login";

      const c = await supabase.from("clients").select("id, full_name, phone");
      const s = await supabase.from("services").select("id, name, default_duration_min, default_price");

      setClients((c.data ?? []) as Client[]);
      setServices((s.data ?? []) as Service[]);

      const { data: a } = await supabase
        .from("appointments")
        .select(`id, start_time, end_time, price, notes, status, paid, payment_method, clients(full_name), services(name)`);

      setEvents(
        ((a ?? []) as Row[]).map((r) => ({
          id: r.id,
          title: `${r.clients?.full_name ?? "Cliente"} · ${r.services?.name ?? "Servicio"}`,
          start: new Date(r.start_time),
          end: new Date(r.end_time),
          raw: r,
        }))
      );

      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-3">
      <h1 className="text-xl font-semibold">Agenda</h1>

      <div className="border rounded-xl p-2 bg-white">
        <Calendar
          localizer={localizer}
          culture="es"
          messages={messages}
          events={[...holidayEvents, ...events]}
          defaultView={Views.WEEK}
          views={[Views.DAY, Views.WEEK, Views.MONTH]}
          popup
          selectable
          step={15}
          timeslots={4}
          style={{ height: "78vh" }}
          eventPropGetter={eventStyleGetter}
          dayPropGetter={(date) => {
            const d = isoDate(date);
            if (HOLIDAY_SET.has(d)) return { className: "is-holiday" };
            if (date.getDay() === 0) return { className: "is-sunday" };
            return {};
          }}
          onSelectEvent={(ev: any) => {
            if (ev?.isHoliday) return;
            const e = ev as EventT;
            setEditEvent(e);
            setEditStart(toLocalInputValue(e.start));
            setEditEnd(toLocalInputValue(e.end));
            setEditPrice(e.raw.price?.toString() ?? "");
            setEditNotes(e.raw.notes ?? "");
          }}
        />
      </div>
    </main>
  );
}
