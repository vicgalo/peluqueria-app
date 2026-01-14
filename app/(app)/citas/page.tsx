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

export default function CitasPage() {
  const [loading, setLoading] = useState(true);
  const [ymd, setYmd] = useState(formatYMD(new Date()));
  const [items, setItems] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

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

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Citas</h1>
          <p className="text-sm text-zinc-600">
            Busca por fecha y verás todas las citas programadas ese día.
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
              <div key={a.id} className="p-3">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{time}</div>
                  <div className="text-xs text-zinc-500 ml-auto">
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

                {a.notes ? (
                  <div className="text-sm text-zinc-500 mt-1">{a.notes}</div>
                ) : null}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="p-4 text-sm text-zinc-500">
              No hay citas para esa fecha.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
