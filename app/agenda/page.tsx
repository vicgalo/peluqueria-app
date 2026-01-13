"use client";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/app/agenda/agenda.css"; // 👈 CSS elegante (créalo en el paso 2)

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // lunes
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

  // Crear
  const [createSlot, setCreateSlot] = useState<null | { start: Date; end: Date }>(null);
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
  const [editPaymentMethod, setEditPaymentMethod] = useState<Row["payment_method"]>(null);
  const [saving, setSaving] = useState(false);

  const eventStyleGetter = useMemo(
    () => (event: any) => {
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
      supabase.from("clients").select("id, full_name, phone").order("full_name", { ascending: true }),
      supabase.from("services").select("id, name, default_duration_min, default_price").order("name", { ascending: true }),
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
      .insert({ name, default_duration_min: 30, default_price: 0 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
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
      if (!(start instanceof Date) || Number.isNaN(start.getTime())) throw new Error("Hora inicio inválida.");
      if (!(end instanceof Date) || Number.isNaN(end.getTime())) throw new Error("Hora fin inválida.");
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
    const { error } = await supabase.from("appointments").delete().eq("id", editEvent.id);
    if (error) alert(error.message);
    setEditEvent(null);
    await loadAppointments();
    setSaving(false);
  }

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Agenda (por horas)</h1>
        <button
          className="ml-auto border rounded-md px-3 py-1 bg-white"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          Salir
        </button>
      </div>

      <div className="border rounded-xl p-2 bg-white">
        <Calendar
          localizer={localizer}
          culture="es"
          messages={messages}
          events={events}
          defaultView={Views.WEEK}
          views={[Views.DAY, Views.WEEK, Views.MONTH]}
          popup
          step={15}
          timeslots={4}
          selectable
          onSelectSlot={(slot) => {
            setCreateSlot({ start: slot.start as Date, end: slot.end as Date });
            setCreateErr(null);
          }}
          onSelectEvent={(ev: any) => {
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
          min={new Date(1970, 1, 1, 9, 0)}
          max={new Date(1970, 1, 1, 20, 0)}
          eventPropGetter={(event) => eventStyleGetter(event)}
          style={{ height: "78vh" }}
        />
      </div>

      {/* Modal CREAR */}
      {createSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-4 space-y-3">
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
                  (Puedes arrastrar para elegir duración)
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

      {/* Modal EDITAR */}
      {editEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Editar cita</h2>

            <div className="text-sm text-zinc-600">
              <div>
                <span className="font-medium">Cliente:</span> {editEvent.raw.clients?.full_name ?? "-"}
              </div>
              <div>
                <span className="font-medium">Servicio:</span> {editEvent.raw.services?.name ?? "-"}
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
                <input className="w-full border rounded-md p-2" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
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
              <textarea className="w-full border rounded-md p-2" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>

            <div className="border rounded-md p-3 bg-zinc-50 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editPaid} onChange={(e) => setEditPaid(e.target.checked)} />
                Pagada
              </label>

              {editPaid && (
                <select
                  className="w-full border rounded-md p-2 bg-white"
                  value={editPaymentMethod ?? ""}
                  onChange={(e) => setEditPaymentMethod((e.target.value || null) as any)}
                >
                  <option value="">Selecciona método…</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="bizum">Bizum</option>
                </select>
              )}
            </div>

            <div className="flex gap-2">
              <button className="flex-1 border rounded-md p-2" disabled={saving} onClick={() => setEditEvent(null)}>
                Cerrar
              </button>
              <button className="flex-1 border rounded-md p-2" disabled={saving} onClick={deleteAppointment}>
                Eliminar
              </button>
              <button className="flex-1 bg-black text-white rounded-md p-2" disabled={saving} onClick={saveEdit}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

