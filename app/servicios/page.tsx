"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Service = {
  id: string;
  name: string;
  default_duration_min: number;
  default_price: number;
};

export default function ServiciosPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function load() {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, default_duration_min, default_price")
      .order("name", { ascending: true });
    if (error) console.error(error);
    setItems((data ?? []) as Service[]);
  }

  useEffect(() => {
    (async () => {
      await guardAuth();
      await load();
      setLoading(false);
    })();
  }, []);

  async function addService() {
    const n = name.trim();
    if (!n) return;
    const d = Number(duration);
    const p = price.trim() ? Number(price.replace(",", ".")) : 0;
    if (Number.isNaN(d) || d <= 0) return alert("Duración inválida");
    if (Number.isNaN(p) || p < 0) return alert("Precio inválido");

    await supabase.from("services").insert({
      name: n,
      default_duration_min: d,
      default_price: p,
    });

    setName(""); setDuration("30"); setPrice("");
    await load();
  }

  async function delService(id: string) {
    const ok = confirm("¿Eliminar servicio?");
    if (!ok) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Servicios</h1>

      <div className="border rounded-xl bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded-md p-2" placeholder="Nombre (corte, color...)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Duración (min)"
            value={duration} onChange={(e) => setDuration(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Precio por defecto"
            value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <button className="bg-black text-white rounded-md px-3 py-2" onClick={addService}>
          Añadir servicio
        </button>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 text-sm text-zinc-500">{items.length} servicios</div>
        <div className="divide-y">
          {items.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-zinc-600">
                  {s.default_duration_min} min · {Number(s.default_price).toFixed(2)} €
                </div>
              </div>
              <button className="border rounded-md px-3 py-1" onClick={() => delService(s.id)}>
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
