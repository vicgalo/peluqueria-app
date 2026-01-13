"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

type Row = {
  id: string;
  start_time: string;
  price: number | null;
  paid: boolean;
  payment_method: "cash" | "card" | "bizum" | null;
  status: "reserved" | "done" | "cancelled" | "no_show";
};

export default function CajaPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function load() {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, start_time, price, paid, payment_method, status")
      .order("start_time", { ascending: false });

    if (error) console.error(error);
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    (async () => {
      await guardAuth();
      await load();
      setLoading(false);
    })();
  }, []);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const monthKey = format(new Date(), "yyyy-MM");

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.paid && r.status !== "cancelled");
    const today = paid.filter((r) => (r.start_time ?? "").startsWith(todayKey));
    const month = paid.filter((r) => (r.start_time ?? "").startsWith(monthKey));

    const sum = (xs: Row[]) => xs.reduce((acc, r) => acc + (r.price ?? 0), 0);

    const byMethod = (xs: Row[]) => ({
      cash: xs.filter(x => x.payment_method === "cash").reduce((a, r) => a + (r.price ?? 0), 0),
      card: xs.filter(x => x.payment_method === "card").reduce((a, r) => a + (r.price ?? 0), 0),
      bizum: xs.filter(x => x.payment_method === "bizum").reduce((a, r) => a + (r.price ?? 0), 0),
    });

    return {
      todayTotal: sum(today),
      monthTotal: sum(month),
      todayMethods: byMethod(today),
      monthMethods: byMethod(month),
    };
  }, [rows, todayKey, monthKey]);

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Caja</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded-xl bg-white p-4">
          <div className="text-sm text-zinc-500">Hoy</div>
          <div className="text-2xl font-semibold">{stats.todayTotal.toFixed(2)} €</div>
          <div className="text-sm text-zinc-600 mt-2">
            Efectivo: {stats.todayMethods.cash.toFixed(2)} € · Tarjeta: {stats.todayMethods.card.toFixed(2)} € · Bizum: {stats.todayMethods.bizum.toFixed(2)} €
          </div>
        </div>

        <div className="border rounded-xl bg-white p-4">
          <div className="text-sm text-zinc-500">Este mes</div>
          <div className="text-2xl font-semibold">{stats.monthTotal.toFixed(2)} €</div>
          <div className="text-sm text-zinc-600 mt-2">
            Efectivo: {stats.monthMethods.cash.toFixed(2)} € · Tarjeta: {stats.monthMethods.card.toFixed(2)} € · Bizum: {stats.monthMethods.bizum.toFixed(2)} €
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 text-sm text-zinc-500">Últimos cobros (pagadas)</div>
        <div className="divide-y">
          {rows
            .filter(r => r.paid)
            .slice(0, 30)
            .map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3">
                <div className="text-sm text-zinc-600 w-40">
                  {format(new Date(r.start_time), "dd/MM HH:mm")}
                </div>
                <div className="flex-1 text-sm text-zinc-700">
                  {r.payment_method ?? "—"} · {r.status}
                </div>
                <div className="font-medium">{(r.price ?? 0).toFixed(2)} €</div>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
