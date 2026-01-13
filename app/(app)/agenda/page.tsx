"use client";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./agenda.css";

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ───────────── Localización ES ───────────── */
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

/* ───────────── Festivos 2026 (nacionales) ───────────── */
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const HOLIDAYS_2026: { date: string; name: string }[] = [
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

/* ───────────── Tipos ───────────── */
type Client = { id: string; full_name: string; phone: string | null };

type Service = {
  id: string;
  name: string;
  default_duration_min: number; // total
  active_duration_min: number; // activo
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
  services: { name: string; active_duration_min: number | null } | null;
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/* ───────────── Helpers ───────────── */
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

function startOfDayOnly(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function parseHHMM(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return { hh, mm };
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventT[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Crear (modal principal)
  const [createSlot, setCreateSlot] = useState<null | { start: Date; end: Date }>(
    null
  );
  const [createClientId, setCreateClientId] = useState<string>("__new__");
  const [createClientName, setCreateClientName] = useState("");
  const [createServiceId, setCreateServiceId] = useState<string>("__new__");
  const [createServiceName, setCreateServiceName] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Editar
  const [editEvent, setEditEvent] = useState<EventT | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<Row["status"]>("reserved");
  const [editPaid, setEditPaid] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] =
    useState<Row["payment_method"]>(null);

  const [saving, setSaving] = useState(false);

  // Móvil: selector día + hora + servicio
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePickOpen, setMobilePickOpen] = useState(false);
  const [mobileDay, setMobileDay] = useState<Date | null>(null);
  const [mobileStartHHMM, setMobileStartHHMM] = useState("09:00");
  const [mobileDuration, setMobileDuration] = useState<number>(30); // total
  const [mobileActive, setMobileActive] = useState<number>(30); // activo
  const [mobileServiceId, setMobileServiceId] = useState<string>(""); // opcional

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const eventStyleGetter = useMemo(
    () => (event: any) => {
      if (event?.isHoliday)
        return { className: "is-holiday-event text-white rounded-md" };

      const s = event?.raw?.status;
      const paid = event?.raw?.paid;

      let bg = "bg-gray-900";
      if (s === "done") bg = "bg-green-700";
      if (s === "cancelled") bg = "bg-gray-500";
      if (s === "no_show") bg = "bg-red-700";
      if (paid) bg = "bg-blue-700";

      return { className: `${bg} text-white rounded-md` };
    },
    []
  );

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function loadLists() {
    const [cRes, sRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, phone")
        .order("full_name", { ascending: true }),
      supabase
        .from("services")
        .select("id, name, default_duration_min, active_duration_min, default_price")
        .order("name", { ascending: true }),
    ]);

    if (cRes.error) console.error(cRes.error);
    if (sRes.error) console.error(sRes.error);

    setClients((cRes.data ?? []) as Client[]);
    setServices((sRes.data ?? []) as Service[]);
  }

  async function loadAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select(
        `id, start_time, end_time, client_id, service_id, price, notes, status, paid, payment_method,
         clients(full_name),
         services(name, active_duration_min)`
      )
      .order("start_time", { ascending: true });

    if (error) console.error(error);

    const rows = (data ?? []) as unknown as Row[];

    setEvents(
      rows.map((r) => ({
        id: r.id,
        title: `${r.clients?.full_name ?? "Cliente"} · ${
          r.services?.name ?? "Servicio"
        }`,
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

  async function getOrCreateClientId(): Promise<string> {
    if (createClientId !== "__new__") return createClientId;
    const name = createClientName.trim();
    if (!name) throw new Error("Indica el nombre del cliente.");
    const { data, error } = await supabase
      .from("clients")
      .insert({ full_name: name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async function getOrCreateServiceId(): Promise<string> {
    if (createServiceId !== "__new__") return createServiceId;
    const name = createServiceName.trim();
    if (!name) throw new Error("Indica el nombre del servicio.");
    const { data, error } = await supabase
      .from("services")
      .insert({
        name,
        default_duration_min: 30,
        active_duration_min: 30,
        default_price: 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  function openMobilePickerForDate(date: Date) {
    const d0 = startOfDayOnly(date);
    setMobileDay(d0);
    setMobileServiceId("");
    setMobileDuration(30);
    setMobileActive(30);
    setMobileStartHHMM("09:00");
    setMobilePickOpen(true);
  }

  function openCreateFromDayAndTime(day: Date, hhmmStr: string, totalMin: number) {
    const { hh, mm } = parseHHMM(hhmmStr);
    const start = new Date(day);
    start.setHours(hh, mm, 0, 0);
    const end = addMinutes(start, totalMin);
    setCreateSlot({ start, end });
    setCreateErr(null);
  }

  async function createAppointment() {
    if (!createSlot) return;
    setCreateErr(null);
    setSaving(true);

    try {
      const clientId = await getOrCreateClientId();
      const serviceId = await getOrCreateServiceId();

      const p = createPrice.trim() ? Number(createPrice.replace(",", ".")) : null;
      if (p !== null && Number.isNaN(p)) throw new Error("Precio inválido.");

      const { error } = await supabase.from("appointments").insert({
        start_time: createSlot.start.toISOString(),
        end_time: createSlot.end.toISOString(),
        client_id: clientId,
        service_id: serviceId,
        price: p,
        notes: createNotes.trim() ? createNotes.trim() : null,
        status: "reserved",
        paid: false,
        payment_method: null,
      });

      if (error) throw new Error(error.message);

      setCreateSlot(null);
      setCreateClientId("__new__");
      setCreateClientName("");
      setCreateServiceId("__new__");
      setCreateServiceName("");
      setCreatePrice("");
      setCreateNotes("");

      await loadLists();
      await loadAppointments();
    } catch (e: any) {
      setCreateErr(e?.message ?? "Error al crear la cita.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editEvent) return;
    setSaving(true);

    try {
      const p = editPrice.trim() ? Number(editPrice.replace(",", ".")) : null;
      if (p !== null && Number.isNaN(p)) throw new Error("Precio inválido.");

      const start = new Date(editStart);
      const end = new Date(editEnd);
      if (Number.isNaN(start.getTime())) throw new Error("Hora inicio inválida.");
      if (Number.isNaN(end.getTime())) throw new Error("Hora fin inválida.");
      if (end <= start) throw new Error("La hora fin debe ser posterior a inicio.");

      const { error } = await supabase
        .from("appointments")
        .update({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          price: p,
          notes: editNotes.trim() ? editNotes.trim() : null,
          status: editStatus,
          paid: editPaid,
          payment_method: editPaid ? editPaymentMethod : null,
        })
        .eq("id", editEvent.id);

      if (error) throw new Error(error.message);

      setEditEvent(null);
      await loadAppointments();
    } catch (e: any) {
      alert(e?.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment() {
    if (!editEvent) return;
    const ok = confirm("¿Eliminar cita? (No se puede deshacer)");
    if (!ok) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", editEvent.id);
      if (error) throw new Error(error.message);
      setEditEvent(null);
      await loadAppointments();
    } catch (e: any) {
      alert(e?.message ?? "Error al eliminar.");
    } finally {
      setSaving(false);
    }
  }

  /* ───────────── Disponibilidad por minutos ACTIVOS ───────────── */
  const busyIntervals = useMemo(() => {
    if (!mobileDay) return [];
    const day = startOfDayOnly(mobileDay);

    const todays = events.filter((e) => sameDay(e.start, day));

    return todays.map((e) => {
      const activeMinFromService = e.raw.services?.active_duration_min ?? null;
      const totalMin = Math.max(1, Math.round((e.end.getTime() - e.start.getTime()) / 60000));
      const activeMin = Math.min(activeMinFromService ?? totalMin, totalMin);
      return {
        start: new Date(e.start),
        end: addMinutes(new Date(e.start), activeMin), // solo bloquea activo
      };
    });
  }, [events, mobileDay]);

  const availableStartTimes = useMemo(() => {
    if (!mobileDay) return TIME_OPTIONS;

    const day = startOfDayOnly(mobileDay);
    const businessEnd = new Date(day);
    businessEnd.setHours(20, 0, 0, 0);

    const activeToBlock = Math.max(1, Math.min(mobileActive, mobileDuration));

    const isFree = (hhmmStr: string) => {
      const { hh, mm } = parseHHMM(hhmmStr);
      const start = new Date(day);
      start.setHours(hh, mm, 0, 0);

      const endTotal = addMinutes(start, mobileDuration);
      const endActive = addMinutes(start, activeToBlock);

      if (endTotal > businessEnd) return false;

      for (const b of busyIntervals) {
        if (start < b.end && endActive > b.start) return false;
      }
      return true;
    };

    return TIME_OPTIONS.filter(isFree);
  }, [mobileDay, mobileDuration, mobileActive, busyIntervals]);

  useEffect(() => {
    if (!mobilePickOpen) return;
    if (!mobileDay) return;
    if (availableStartTimes.length === 0) return;

    if (!availableStartTimes.includes(mobileStartHHMM)) {
      setMobileStartHHMM(availableStartTimes[0]);
    }
  }, [availableStartTimes, mobilePickOpen, mobileDay, mobileStartHHMM]);

  const mobileEndLabel = useMemo(() => {
    if (!mobileDay) return "";
    const day = startOfDayOnly(mobileDay);
    const { hh, mm } = parseHHMM(mobileStartHHMM);
    const start = new Date(day);
    start.setHours(hh, mm, 0, 0);
    const end = addMinutes(start, mobileDuration);
    return format(end, "HH:mm");
  }, [mobileDay, mobileStartHHMM, mobileDuration]);

  const mobileActiveLabel = useMemo(() => {
    if (!mobileDay) return "";
    const day = startOfDayOnly(mobileDay);
    const { hh, mm } = parseHHMM(mobileStartHHMM);
    const start = new Date(day);
    start.setHours(hh, mm, 0, 0);
    const end = addMinutes(start, Math.max(1, Math.min(mobileActive, mobileDuration)));
    return format(end, "HH:mm");
  }, [mobileDay, mobileStartHHMM, mobileDuration, mobileActive]);

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Agenda (por horas)</h1>
      </div>

      {isMobile && (
        <div className="border rounded-xl bg-white p-3 flex items-center gap-2">
          <div className="text-sm text-zinc-600">
            En móvil: toca un día para crear, o toca una cita para editarla.
          </div>
          <button
            className="ml-auto bg-black text-white rounded-md px-3 py-2"
            onClick={() => openMobilePickerForDate(new Date())}
          >
            Nueva cita
          </button>
        </div>
      )}

      <div className="border rounded-xl p-2 bg-white">
        <Calendar
          localizer={localizer}
          culture="es"
          messages={messages}
          events={[
            ...HOLIDAYS_2026.map((h) => ({
              id: `holiday-${h.date}`,
              title: `🎉 ${h.name}`,
              start: new Date(`${h.date}T00:00:00`),
              end: new Date(`${h.date}T23:59:59`),
              allDay: true,
              isHoliday: true,
            })),
            ...events,
          ]}
          defaultView={Views.WEEK}
          views={[Views.DAY, Views.WEEK, Views.MONTH]}
          popup
          step={15}
          timeslots={4}
          selectable
          longPressThreshold={10}
          onSelectSlot={(slotInfo: any) => {
            // Si clicas sobre un hueco: crear
            if (isMobile) return openMobilePickerForDate(slotInfo.start as Date);
            setCreateSlot({ start: slotInfo.start as Date, end: slotInfo.end as Date });
            setCreateErr(null);
          }}
          onSelectEvent={(ev: any) => {
            // Si clicas una cita existente: editar
            if (ev?.isHoliday) return;

            const e = ev as EventT;
            setEditEvent(e);
            setEditStart(toLocalInputValue(e.start));
            setEditEnd(toLocalInputValue(e.end));
            setEditPrice(e.raw.price?.toString() ?? "");
            setEditNotes(e.raw.notes ?? "");
            setEditStatus(e.raw.status);
            setEditPaid(!!e.raw.paid);
            setEditPaymentMethod(e.raw.payment_method ?? null);
          }}
          onDrillDown={(date) => {
            // En móvil, tocar un día en vista mes -> abrir picker
            if (isMobile) openMobilePickerForDate(date as Date);
          }}
          min={new Date(1970, 1, 1, 9, 0)}
          max={new Date(1970, 1, 1, 20, 0)}
          eventPropGetter={(event) => eventStyleGetter(event)}
          dayPropGetter={(date) => {
            const d = isoDate(date);
            if (HOLIDAY_SET.has(d)) return { className: "is-holiday" };
            if (date.getDay() === 0) return { className: "is-sunday" };
            return {};
          }}
          style={{ height: "78vh" }}
        />
      </div>

      {/* Modal selector móvil (crear) */}
      {mobilePickOpen && mobileDay && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl shadow-2xl ring-1 ring-black/10 bg-white p-4 space-y-3">
            <h2 className="font-semibold">Nueva cita (móvil)</h2>

            <div className="text-sm text-zinc-700">
              Día: <b>{format(mobileDay, "EEEE dd/MM/yyyy", { locale: es })}</b>
            </div>

            <div>
              <label className="text-sm font-medium">Servicio</label>
              <select
                className="w-full border rounded-md p-2 bg-white"
                value={mobileServiceId}
                onChange={(e) => {
                  const v = e.target.value;
                  setMobileServiceId(v);

                  const s = services.find((x) => x.id === v);
                  if (s) {
                    setMobileDuration(s.default_duration_min);
                    setMobileActive(s.active_duration_min ?? s.default_duration_min);
                  } else {
                    setMobileDuration(30);
                    setMobileActive(30);
                  }
                }}
              >
                <option value="">(Opcional) Sin servicio</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · total {s.default_duration_min} · activo{" "}
                    {s.active_duration_min ?? s.default_duration_min}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-600 mt-1">
                La disponibilidad se calcula con el <b>tiempo activo</b> del servicio.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Hora inicio</label>
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={mobileStartHHMM}
                  onChange={(e) => setMobileStartHHMM(e.target.value)}
                  disabled={availableStartTimes.length === 0}
                >
                  {availableStartTimes.length === 0 ? (
                    <option value="">Sin huecos</option>
                  ) : (
                    availableStartTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Duración total</label>
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={String(mobileDuration)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMobileDuration(v);
                    setMobileActive((a) => Math.min(a, v));
                  }}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {availableStartTimes.length === 0 ? (
              <div className="text-sm text-red-600">
                No hay huecos disponibles para esa duración/activo en este día.
              </div>
            ) : (
              <div className="text-sm text-zinc-700 space-y-1">
                <div>
                  Fin total: <b>{mobileEndLabel}</b>
                </div>
                <div>
                  Bloqueo activo hasta: <b>{mobileActiveLabel}</b>{" "}
                  <span className="text-zinc-500">(puedes atender a otra persona después)</span>
                </div>
                <div>
                  Huecos: <b>{availableStartTimes.length}</b>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button className="flex-1 border rounded-md p-2" onClick={() => setMobilePickOpen(false)}>
                Cancelar
              </button>
              <button
                className="flex-1 bg-black text-white rounded-md p-2"
                disabled={availableStartTimes.length === 0}
                onClick={() => {
                  if (mobileServiceId) {
                    setCreateServiceId(mobileServiceId);
                    const s = services.find((x) => x.id === mobileServiceId);
                    if (s) setCreatePrice(String(s.default_price ?? ""));
                  } else {
                    setCreateServiceId("__new__");
                  }

                  openCreateFromDayAndTime(new Date(mobileDay), mobileStartHHMM, mobileDuration);
                  setMobilePickOpen(false);
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {createSlot && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-4 space-y-3 shadow-2xl ring-1 ring-black/10">
            <h2 className="font-semibold">Nueva cita</h2>
            <p className="text-sm text-zinc-600">
              {format(createSlot.start, "EEE dd/MM HH:mm", { locale: es })} →{" "}
              {format(createSlot.end, "HH:mm", { locale: es })}
            </p>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={createClientId}
                  onChange={(e) => setCreateClientId(e.target.value)}
                >
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
                  <input
                    className="w-full border rounded-md p-2"
                    placeholder="(opcional)"
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                  />
                </div>
                <div className="text-sm text-zinc-500 flex items-end">
                  (El bloqueo usa “activo” del servicio)
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notas</label>
                <textarea
                  className="w-full border rounded-md p-2"
                  rows={3}
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                />
              </div>
            </div>

            {createErr && <p className="text-sm text-red-600">{createErr}</p>}

            <div className="flex gap-2">
              <button className="flex-1 border rounded-md p-2" disabled={saving} onClick={() => setCreateSlot(null)}>
                Cancelar
              </button>
              <button className="flex-1 bg-black text-white rounded-md p-2" disabled={saving} onClick={createAppointment}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-4 space-y-3 shadow-2xl ring-1 ring-black/10">
            <h2 className="font-semibold">Editar cita</h2>

            <div className="text-sm text-zinc-600">
              <div>
                <span className="font-medium">Cliente:</span>{" "}
                {editEvent.raw.clients?.full_name ?? "-"}
              </div>
              <div>
                <span className="font-medium">Servicio:</span>{" "}
                {editEvent.raw.services?.name ?? "-"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Inicio</label>
                <input
                  className="w-full border rounded-md p-2"
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fin</label>
                <input
                  className="w-full border rounded-md p-2"
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Precio</label>
                <input
                  className="w-full border rounded-md p-2"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                >
                  <option value="reserved">Reservada</option>
                  <option value="done">Realizada</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="no_show">No show</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notas</label>
              <textarea
                className="w-full border rounded-md p-2"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            <div className="border rounded-md p-3 bg-zinc-50 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editPaid}
                  onChange={(e) => setEditPaid(e.target.checked)}
                />
                Pagada
              </label>

              {editPaid && (
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={editPaymentMethod ?? ""}
                  onChange={(e) =>
                    setEditPaymentMethod((e.target.value || null) as any)
                  }
                >
                  <option value="">Selecciona método…</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="bizum">Bizum</option>
                </select>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 border rounded-md p-2"
                disabled={saving}
                onClick={() => setEditEvent(null)}
              >
                Cerrar
              </button>
              <button
                className="flex-1 border rounded-md p-2"
                disabled={saving}
                onClick={deleteAppointment}
              >
                Eliminar
              </button>
              <button
                className="flex-1 bg-black text-white rounded-md p-2"
                disabled={saving}
                onClick={saveEdit}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
