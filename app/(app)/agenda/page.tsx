"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addDays, addMinutes, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays, subMonths, subWeeks, addMonths, addWeeks } from "date-fns";
import { es } from "date-fns/locale";

import "react-big-calendar/lib/css/react-big-calendar.css";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { parse, getDay } from "date-fns";

type Client = { id: string; full_name: string; phone: string | null };
type Service = {
  id: string;
  name: string;
  default_duration_min: number;
  active_duration_min: number;
  default_price: number;
};

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

function startOfDayOnly(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseHHMM(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return { hh, mm };
}
function buildTimeOptions(startHour = 9, endHour = 20, stepMin = 15) {
  const out: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      if (h === endHour && m > 0) break;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}
const TIME_OPTIONS = buildTimeOptions(9, 20, 15);
const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120];

/* Localizer para semana (react-big-calendar) */
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

export default function AgendaPage() {
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"month" | "week">("month");

  const [cursorMonth, setCursorMonth] = useState<Date>(startOfMonth(new Date()));
  const [cursorWeek, setCursorWeek] = useState<Date>(new Date());

  const [selectedDay, setSelectedDay] = useState<Date>(startOfDayOnly(new Date()));

  const [events, setEvents] = useState<EventT[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Crear cita (modal)
  const [createOpen, setCreateOpen] = useState(false);
  const [createDay, setCreateDay] = useState<Date>(startOfDayOnly(new Date()));
  const [createStartHHMM, setCreateStartHHMM] = useState("09:00");
  const [createDuration, setCreateDuration] = useState<number>(30);

  const [createClientId, setCreateClientId] = useState<string>("__new__");
  const [createClientName, setCreateClientName] = useState("");
  const [createServiceId, setCreateServiceId] = useState<string>("__new__");
  const [createServiceName, setCreateServiceName] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function loadLists() {
    const [cRes, sRes] = await Promise.all([
      supabase.from("clients").select("id, full_name, phone").order("full_name", { ascending: true }),
      supabase
        .from("services")
        .select("id, name, default_duration_min, active_duration_min, default_price")
        .order("name", { ascending: true }),
    ]);
    setClients((cRes.data ?? []) as Client[]);
    setServices((sRes.data ?? []) as Service[]);
  }

  async function loadAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select(
        `id, start_time, end_time, client_id, service_id, price, notes, status, paid, payment_method,
         clients(full_name),
         services(name)`
      )
      .order("start_time", { ascending: true });

    if (error) console.error(error);

    const rows = (data ?? []) as unknown as Row[];
    setEvents(
      rows.map((r) => ({
        id: r.id,
        title: `${r.clients?.full_name ?? "Cliente"} · ${r.services?.name ?? "Servicio"}`,
        start: new Date(r.start_time),
        end: new Date(r.end_time),
        raw: r,
      }))
    );
  }

  useEffect(() => {
    (async () => {
      await guardAuth();
      await loadLists();
      await loadAppointments();
      setLoading(false);
    })();
  }, []);

  // Eventos del día seleccionado (lista inferior)
  const dayEvents = useMemo(() => {
    const day = startOfDayOnly(selectedDay);
    return events
      .filter((e) => sameDay(e.start, day))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events, selectedDay]);

  // Construir grid del mes (tipo iPhone)
  const monthGridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursorMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursorMonth), { weekStartsOn: 1 });

    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursorMonth]);

  function openCreateForDay(day: Date) {
    setCreateErr(null);
    setCreateDay(startOfDayOnly(day));
    setCreateStartHHMM("09:00");
    setCreateDuration(30);

    setCreateClientId("__new__");
    setCreateClientName("");
    setCreateServiceId("__new__");
    setCreateServiceName("");
    setCreatePrice("");
    setCreateNotes("");

    setCreateOpen(true);
  }

  async function getOrCreateClientId(): Promise<string> {
    if (createClientId !== "__new__") return createClientId;
    const name = createClientName.trim();
    if (!name) throw new Error("Indica el nombre del cliente.");
    const { data, error } = await supabase.from("clients").insert({ full_name: name }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async function getOrCreateServiceId(): Promise<string> {
    if (createServiceId !== "__new__") return createServiceId;
    const name = createServiceName.trim();
    if (!name) throw new Error("Indica el nombre del servicio.");
    const { data, error } = await supabase
      .from("services")
      .insert({ name, default_duration_min: 30, active_duration_min: 30, default_price: 0 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async function createAppointment() {
    setCreateErr(null);
    setSaving(true);
    try {
      const clientId = await getOrCreateClientId();
      const serviceId = await getOrCreateServiceId();

      const p = createPrice.trim() ? Number(createPrice.replace(",", ".")) : null;
      if (p !== null && Number.isNaN(p)) throw new Error("Precio inválido.");

      const { hh, mm } = parseHHMM(createStartHHMM);
      const start = new Date(createDay);
      start.setHours(hh, mm, 0, 0);
      const end = addMinutes(start, createDuration);

      const { error } = await supabase.from("appointments").insert({
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        client_id: clientId,
        service_id: serviceId,
        price: p,
        notes: createNotes.trim() ? createNotes.trim() : null,
        status: "reserved",
        paid: false,
        payment_method: null,
      });

      if (error) throw new Error(error.message);

      setCreateOpen(false);
      await loadLists();
      await loadAppointments();
    } catch (e: any) {
      setCreateErr(e?.message ?? "Error al crear la cita.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Agenda</h1>

        <div className="ml-auto flex gap-2">
          <button
            className={[
              "px-3 py-2 rounded-xl text-sm border",
              view === "month" ? "bg-black text-white border-black" : "bg-white",
            ].join(" ")}
            onClick={() => setView("month")}
          >
            Mes
          </button>
          <button
            className={[
              "px-3 py-2 rounded-xl text-sm border",
              view === "week" ? "bg-black text-white border-black" : "bg-white",
            ].join(" ")}
            onClick={() => setView("week")}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Vista MES (tipo iPhone) */}
      {view === "month" && (
        <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center">
            <button
              className="border rounded-xl px-3 py-2 bg-white"
              onClick={() => setCursorMonth((m) => subMonths(m, 1))}
            >
              ◀
            </button>
            <div className="flex-1 text-center font-semibold">
              {format(cursorMonth, "MMMM yyyy", { locale: es })}
            </div>
            <button
              className="border rounded-xl px-3 py-2 bg-white"
              onClick={() => setCursorMonth((m) => addMonths(m, 1))}
            >
              ▶
            </button>
          </div>

          {/* Cabecera días */}
          <div className="grid grid-cols-7 text-xs text-zinc-500 px-2 pt-2">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <div key={d} className="text-center py-2 font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Grid del mes */}
          <div className="grid grid-cols-7 gap-px bg-zinc-200">
            {monthGridDays.map((d, idx) => {
              const inMonth = d.getMonth() === cursorMonth.getMonth();
              const isSelected = sameDay(d, selectedDay);
              const hasEvents = events.some((e) => sameDay(e.start, d));
              const isToday = sameDay(d, new Date());

              return (
                <button
                  key={idx}
                  className={[
                    "bg-white min-h-[56px] p-2 text-left",
                    inMonth ? "" : "opacity-40",
                    isSelected ? "ring-2 ring-black" : "",
                  ].join(" ")}
                  onClick={() => setSelectedDay(startOfDayOnly(d))}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={[
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm",
                        isToday ? "bg-black text-white" : "text-zinc-900",
                      ].join(" ")}
                    >
                      {format(d, "d")}
                    </span>

                    {hasEvents && (
                      <span className="inline-flex w-2 h-2 rounded-full bg-zinc-900" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lista inferior del día seleccionado */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-2">
              <div className="font-semibold">
                {format(selectedDay, "EEEE dd/MM/yyyy", { locale: es })}
              </div>
              <button
                className="ml-auto w-10 h-10 rounded-full bg-black text-white text-2xl leading-none shadow active:scale-95"
                aria-label="Nueva cita"
                onClick={() => openCreateForDay(selectedDay)}
              >
                +
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {dayEvents.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No hay citas para este día.
                </div>
              ) : (
                <div className="divide-y rounded-xl border overflow-hidden">
                  {dayEvents.map((e) => {
                    const time = `${format(e.start, "HH:mm")}–${format(e.end, "HH:mm")}`;
                    return (
                      <div key={e.id} className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{time}</div>
                          <div className="ml-auto text-xs text-zinc-500">
                            {e.raw.price != null ? `${e.raw.price} €` : "—"}
                            {e.raw.paid ? " · Pagada" : ""}
                          </div>
                        </div>
                        <div className="text-sm text-zinc-700 mt-1">
                          {e.raw.clients?.full_name ?? "Cliente"} · {e.raw.services?.name ?? "Servicio"}
                        </div>
                        {e.raw.notes ? (
                          <div className="text-sm text-zinc-500 mt-1">{e.raw.notes}</div>
                        ) : null}
                        <div className="text-xs text-zinc-400 mt-2">
                          (Para editar/eliminar: Menú <b>Citas</b>)
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vista SEMANA elegante (react-big-calendar) */}
      {view === "week" && (
        <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center">
            <button
              className="border rounded-xl px-3 py-2 bg-white"
              onClick={() => setCursorWeek((d) => subWeeks(d, 1))}
            >
              ◀
            </button>
            <div className="flex-1 text-center font-semibold">
              Semana de {format(startOfWeek(cursorWeek, { weekStartsOn: 1 }), "dd/MM", { locale: es })} –{" "}
              {format(endOfWeek(cursorWeek, { weekStartsOn: 1 }), "dd/MM", { locale: es })}
            </div>
            <button
              className="border rounded-xl px-3 py-2 bg-white"
              onClick={() => setCursorWeek((d) => addWeeks(d, 1))}
            >
              ▶
            </button>
          </div>

          <div className="p-2">
            <Calendar
              localizer={localizer}
              culture="es"
              messages={messages}
              date={cursorWeek}
              onNavigate={(d) => setCursorWeek(d)}
              defaultView={Views.WEEK}
              view={Views.WEEK}
              views={[Views.WEEK]}
              events={events}
              step={15}
              timeslots={4}
              selectable
              onSelectSlot={(slot) => {
                // Crear desde una franja en semana:
                const start = slot.start as Date;
                setSelectedDay(startOfDayOnly(start));
                openCreateForDay(start);
                // prefill hora en el modal:
                setCreateStartHHMM(format(start, "HH:mm"));
              }}
              onSelectEvent={() => {
                // En agenda NO editamos (se hace en Citas)
                alert("Para editar o eliminar una cita, ve al menú “Citas”.");
              }}
              min={new Date(1970, 1, 1, 9, 0)}
              max={new Date(1970, 1, 1, 20, 0)}
              style={{ height: "70vh" }}
            />
          </div>
        </div>
      )}

      {/* Modal CREAR */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Nueva cita</h2>
              <button className="ml-auto text-zinc-500" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>

            <p className="text-sm text-zinc-600">
              Día: <b>{format(createDay, "EEEE dd/MM/yyyy", { locale: es })}</b>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Hora inicio</label>
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={createStartHHMM}
                  onChange={(e) => setCreateStartHHMM(e.target.value)}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Duración</label>
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={String(createDuration)}
                  onChange={(e) => setCreateDuration(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Cliente</label>
              <select className="w-full border rounded-md p-2 bg-white" value={createClientId} onChange={(e) => setCreateClientId(e.target.value)}>
                <option value="__new__">+ Nuevo cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
              {createClientId === "__new__" && (
                <input
                  className="mt-2 w-full border rounded-md p-2"
                  placeholder="Nombre del cliente"
                  value={createClientName}
                  onChange={(e) => setCreateClientName(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Servicio</label>
              <select
                className="w-full border rounded-md p-2 bg-white"
                value={createServiceId}
                onChange={(e) => {
                  const v = e.target.value;
                  setCreateServiceId(v);
                  const s = services.find((x) => x.id === v);
                  if (s) setCreatePrice(String(s.default_price ?? ""));
                }}
              >
                <option value="__new__">+ Nuevo servicio…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {createServiceId === "__new__" && (
                <input
                  className="mt-2 w-full border rounded-md p-2"
                  placeholder="Nombre del servicio"
                  value={createServiceName}
                  onChange={(e) => setCreateServiceName(e.target.value)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Precio</label>
                <input className="w-full border rounded-md p-2" value={createPrice} onChange={(e) => setCreatePrice(e.target.value)} />
              </div>
              <div className="text-sm text-zinc-500 flex items-end">
                (Editar/eliminar se hace en <b>Citas</b>)
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notas</label>
              <textarea className="w-full border rounded-md p-2" rows={3} value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
            </div>

            {createErr && <p className="text-sm text-red-600">{createErr}</p>}

            <div className="flex gap-2">
              <button className="flex-1 border rounded-md p-2" disabled={saving} onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button className="flex-1 bg-black text-white rounded-md p-2" disabled={saving} onClick={createAppointment}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
