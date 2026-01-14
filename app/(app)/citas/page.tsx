"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Row = {
  id: string;
  start_time: string;
  end_time: string;
  price: number | null;
  notes: string | null;
  status: "reserved" | "done" | "cancelled" | "no_show";
  paid: boolean;
  payment_method: "cash" | "card" | "bizum" | null;
  clients: { full_name: string } | null;
  services: { name: string } | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYMDToLocalDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CitasPage() {
  const [loading, setLoading] = useState(true);
  const [ymd, setYmd] = useState(formatYMD(new Date()));
  const [items, setItems] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // editor
  const [edit, setEdit] = useState<Row | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<Row["status"]>("reserved");
  const [editPaid, setEditPaid] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState<Row["payment_method"]>(null);
  const [saving, setSaving] = useState(false);

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function loadForDate(date: Date) {
    setMsg(null);
    const from = startOfDay(date).toISOString();
    const to = endOfDay(date).toISOString();

    const { data, error } = await supabase
      .from("appointments")
      .select(
        `id, start_time, end_time, price, notes, status, paid, payment_method,
         clients(full_name),
         services(name)`
      )
      .gte("start_time", from)
      .lte("start_time", to)
      .order("start_time", { ascending: true });

    if (error) {
      console.error(error);
      setMsg(error.message);
      setItems([]);
      return;
    }

    setItems((data ?? []) as unknown as Row[]);
  }

  useEffect(() => {
    (async () => {
      await guardAuth();
      await loadForDate(parseYMDToLocalDate(ymd));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerLabel = useMemo(() => {
    const d = parseYMDToLocalDate(ymd);
    return format(d, "EEEE dd/MM/yyyy", { locale: es });
  }, [ymd]);

  function openEdit(a: Row) {
    setEdit(a);
    setEditStart(toLocalInputValue(new Date(a.start_time)));
    setEditEnd(toLocalInputValue(new Date(a.end_time)));
    setEditPrice(a.price != null ? String(a.price) : "");
    setEditNotes(a.notes ?? "");
    setEditStatus(a.status);
    setEditPaid(!!a.paid);
    setEditPaymentMethod(a.payment_method ?? null);
  }

  async function saveEdit() {
    if (!edit) return;
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
        .eq("id", edit.id);

      if (error) throw new Error(error.message);

      setEdit(null);
      await loadForDate(parseYMDToLocalDate(ymd));
    } catch (e: any) {
      alert(e?.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEdit() {
    if (!edit) return;
    const ok = confirm("¿Eliminar cita? (No se puede deshacer)");
    if (!ok) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", edit.id);
      if (error) throw new Error(error.message);

      setEdit(null);
      await loadForDate(parseYMDToLocalDate(ymd));
    } catch (e: any) {
      alert(e?.message ?? "Error al eliminar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Citas</h1>
          <p className="text-sm text-zinc-600">
            Busca por fecha y toca una cita para <b>editar</b> o <b>eliminar</b>.
          </p>
        </div>
      </div>

      <div className="border rounded-2xl bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-sm font-medium">Fecha</label>
            <input
              type="date"
              className="w-full border rounded-md p-2 bg-white"
              value={ymd}
              onChange={(e) => setYmd(e.target.value)}
            />
            <div className="text-xs text-zinc-600 mt-1">
              Seleccionada: <b>{headerLabel}</b>
            </div>
          </div>

          <button
            className="bg-black text-white rounded-md px-3 py-2"
            onClick={() => loadForDate(parseYMDToLocalDate(ymd))}
          >
            Buscar
          </button>
        </div>

        {msg && <div className="text-sm text-red-600">{msg}</div>}
      </div>

      <div className="border rounded-2xl bg-white overflow-hidden">
        <div className="p-3 text-sm text-zinc-500">{items.length} cita(s)</div>
        <div className="divide-y">
          {items.map((a) => {
            const start = new Date(a.start_time);
            const end = new Date(a.end_time);
            const time = `${format(start, "HH:mm")}–${format(end, "HH:mm")}`;

            return (
              <button
                key={a.id}
                className="w-full text-left p-3 bg-white hover:bg-zinc-50 active:bg-zinc-50"
                onClick={() => openEdit(a)}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{time}</div>
                  <div className="ml-auto text-xs text-zinc-500">
                    {a.status === "reserved"
                      ? "Reservada"
                      : a.status === "done"
                      ? "Realizada"
                      : a.status === "cancelled"
                      ? "Cancelada"
                      : "No show"}
                    {a.paid ? " · Pagada" : ""}
                  </div>
                </div>

                <div className="font-medium mt-1">
                  {a.clients?.full_name ?? "Cliente"} · {a.services?.name ?? "Servicio"}
                </div>

                <div className="text-sm text-zinc-600 mt-1">
                  {a.price != null ? `${a.price} €` : "—"}
                  {a.payment_method ? ` · ${a.payment_method}` : ""}
                </div>

                {a.notes ? <div className="text-sm text-zinc-500 mt-1">{a.notes}</div> : null}
              </button>
            );
          })}

          {items.length === 0 && (
            <div className="p-4 text-sm text-zinc-500">No hay citas para esa fecha.</div>
          )}
        </div>
      </div>

      {/* Modal editar/eliminar */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Editar cita</h2>
              <button className="ml-auto text-zinc-500" onClick={() => setEdit(null)}>
                ✕
              </button>
            </div>

            <div className="text-sm text-zinc-600">
              <div>
                <span className="font-medium">Cliente:</span> {edit.clients?.full_name ?? "-"}
              </div>
              <div>
                <span className="font-medium">Servicio:</span> {edit.services?.name ?? "-"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Inicio</label>
                <input className="w-full border rounded-md p-2" type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Fin</label>
                <input className="w-full border rounded-md p-2" type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Precio</label>
                <input className="w-full border rounded-md p-2" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
                <select className="w-full border rounded-md p-2 bg-white" value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
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
              <button className="flex-1 border rounded-md p-2" disabled={saving} onClick={() => setEdit(null)}>
                Cerrar
              </button>
              <button className="flex-1 border rounded-md p-2" disabled={saving} onClick={deleteEdit}>
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
