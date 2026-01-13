"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
};

type AppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  price: number | null;
  paid: boolean;
  payment_method: "cash" | "card" | "bizum" | null;
  status: "reserved" | "done" | "cancelled" | "no_show";
  notes: string | null;
  services: { name: string } | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function pmLabel(pm: AppointmentRow["payment_method"]) {
  if (pm === "cash") return "Efectivo";
  if (pm === "card") return "Tarjeta";
  if (pm === "bizum") return "Bizum";
  return "-";
}

function statusLabel(s: AppointmentRow["status"]) {
  if (s === "reserved") return "Reservada";
  if (s === "done") return "Realizada";
  if (s === "cancelled") return "Cancelada";
  if (s === "no_show") return "No show";
  return s;
}

export default function ClienteDetallePage() {
  const params = useParams();
  const raw = (params as any)?.id;

  // Puede venir string | string[] | undefined
  const clientId = Array.isArray(raw) ? raw[0] : raw;

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [apps, setApps] = useState<AppointmentRow[]>([]);
  const [err, setErr] = useState<string>("");

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function loadAll(id: string) {
    const cRes = await supabase
      .from("clients")
      .select("id, full_name, phone, instagram, notes")
      .eq("id", id)
      .single();

    if (cRes.error) throw new Error(cRes.error.message);
    setClient(cRes.data as Client);

    const aRes = await supabase
      .from("appointments")
      .select("id, start_time, end_time, price, paid, payment_method, status, notes, services(name)")
      .eq("client_id", id)
      .order("start_time", { ascending: false });

    if (aRes.error) throw new Error(aRes.error.message);
    setApps((aRes.data ?? []) as unknown as AppointmentRow[]);
  }

  useEffect(() => {
    (async () => {
      await guardAuth();

      if (!clientId || clientId === "undefined" || clientId === "null") {
        setErr("ID de cliente no encontrado.");
        setLoading(false);
        return;
      }

      if (!isUuid(String(clientId))) {
        setErr(`ID inválido: ${String(clientId)}`);
        setLoading(false);
        return;
      }

      try {
        await loadAll(String(clientId));
      } catch (e: any) {
        setErr(e?.message ?? "Error cargando cliente.");
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  const totalGastado = useMemo(() => apps.reduce((acc, a) => acc + (a.price ?? 0), 0), [apps]);
  const totalPagado = useMemo(() => apps.filter((a) => a.paid).reduce((acc, a) => acc + (a.price ?? 0), 0), [apps]);

  if (loading) return <div className="p-4">Cargando…</div>;

  if (err) {
    return (
      <main className="space-y-3">
        <div className="flex items-center gap-2">
          <button className="border rounded-md px-3 py-1 bg-white" onClick={() => (window.location.href = "/clientes")}>
            ← Volver
          </button>
          <h1 className="text-xl font-semibold">Cliente</h1>
        </div>
        <div className="border rounded-xl bg-white p-4 text-red-700">{err}</div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="space-y-3">
        <div className="flex items-center gap-2">
          <button className="border rounded-md px-3 py-1 bg-white" onClick={() => (window.location.href = "/clientes")}>
            ← Volver
          </button>
          <h1 className="text-xl font-semibold">Cliente</h1>
        </div>
        <div className="border rounded-xl bg-white p-4">No encontrado.</div>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="border rounded-md px-3 py-1 bg-white" onClick={() => (window.location.href = "/clientes")}>
          ← Volver
        </button>
        <h1 className="text-xl font-semibold">{client.full_name}</h1>
      </div>

      <div className="border rounded-xl bg-white p-4 space-y-2">
        <div className="text-sm text-zinc-700">
          <div><span className="text-zinc-500">Teléfono:</span> <b>{client.phone ?? "-"}</b></div>
          <div><span className="text-zinc-500">Instagram:</span> <b>{client.instagram ?? "-"}</b></div>
          {client.notes && (
            <div className="mt-2">
              <span className="text-zinc-500">Notas:</span> <div className="text-zinc-700">{client.notes}</div>
            </div>
          )}
        </div>

        <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-zinc-50 p-3">
            <div className="text-zinc-500">Citas</div>
            <div className="text-lg font-semibold">{apps.length}</div>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <div className="text-zinc-500">Total (precio)</div>
            <div className="text-lg font-semibold">{totalGastado.toFixed(2)} €</div>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <div className="text-zinc-500">Total pagado</div>
            <div className="text-lg font-semibold">{totalPagado.toFixed(2)} €</div>
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 text-sm text-zinc-500">Historial de citas</div>
        {apps.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">Este cliente aún no tiene citas.</div>
        ) : (
          <div className="divide-y">
            {apps.map((a) => {
              const start = new Date(a.start_time);
              const end = new Date(a.end_time);
              return (
                <div key={a.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="font-medium">
                      {format(start, "EEE dd/MM/yyyy", { locale: es })} · {format(start, "HH:mm")}–{format(end, "HH:mm")}
                    </div>
                    <div className="text-sm text-zinc-600">· {a.services?.name ?? "Servicio"}</div>
                  </div>

                  <div className="mt-1 text-sm text-zinc-700 flex flex-wrap gap-x-4 gap-y-1">
                    <div><span className="text-zinc-500">Precio:</span> <b>{(a.price ?? 0).toFixed(2)} €</b></div>
                    <div><span className="text-zinc-500">Pagada:</span> <b>{a.paid ? "Sí" : "No"}</b></div>
                    <div><span className="text-zinc-500">Método:</span> <b>{a.paid ? pmLabel(a.payment_method) : "-"}</b></div>
                    <div><span className="text-zinc-500">Estado:</span> <b>{statusLabel(a.status)}</b></div>
                  </div>

                  {a.notes && <div className="mt-2 text-sm text-zinc-600">{a.notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
