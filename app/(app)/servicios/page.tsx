"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Service = {
  id: string;
  name: string;
  default_duration_min: number;
  active_duration_min: number;
  default_price: number;
  is_active?: boolean;
};

export default function ServiciosPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Form crear (✅ ahora VACÍO)
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(""); // antes "30"
  const [active, setActive] = useState("");   // antes "30"
  const [price, setPrice] = useState("");

  // Editar
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eDuration, setEDuration] = useState(""); // string para input
  const [eActive, setEActive] = useState("");
  const [ePrice, setEPrice] = useState("");

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function load() {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, default_duration_min, active_duration_min, default_price, is_active")
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

  function resetCreateForm() {
    setName("");
    setDuration("");
    setActive("");
    setPrice("");
  }

  async function addService() {
    const n = name.trim();
    if (!n) return alert("Nombre requerido.");

    const total = Number(duration);
    const act = Number(active);
    const p = price.trim() ? Number(price.replace(",", ".")) : 0;

    if (!duration.trim() || Number.isNaN(total) || total <= 0) return alert("Duración total inválida.");
    if (!active.trim() || Number.isNaN(act) || act <= 0) return alert("Duración activa inválida.");
    if (act > total) return alert("La duración activa no puede ser mayor que la total.");
    if (Number.isNaN(p) || p < 0) return alert("Precio inválido.");

    const { error } = await supabase.from("services").insert({
      name: n,
      default_duration_min: total,
      active_duration_min: act,
      default_price: p,
      is_active: true,
    });

    if (error) return alert(error.message);

    resetCreateForm();
    await load();
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setEName(s.name);
    setEDuration(String(s.default_duration_min ?? ""));
    setEActive(String(s.active_duration_min ?? s.default_duration_min ?? ""));
    setEPrice(String(s.default_price ?? 0));
  }

  async function saveEdit() {
    if (!editId) return;

    const n = eName.trim();
    if (!n) return alert("Nombre requerido.");

    const total = Number(eDuration);
    const act = Number(eActive);
    const p = ePrice.trim() ? Number(ePrice.replace(",", ".")) : 0;

    if (!eDuration.trim() || Number.isNaN(total) || total <= 0) return alert("Duración total inválida.");
    if (!eActive.trim() || Number.isNaN(act) || act <= 0) return alert("Duración activa inválida.");
    if (act > total) return alert("La duración activa no puede ser mayor que la total.");
    if (Number.isNaN(p) || p < 0) return alert("Precio inválido.");

    const { error } = await supabase
      .from("services")
      .update({
        name: n,
        default_duration_min: total,
        active_duration_min: act,
        default_price: p,
      })
      .eq("id", editId);

    if (error) return alert(error.message);

    setEditId(null);
    await load();
  }

  async function delService(id: string) {
    // ⚠️ Por FK, si hay citas usando este servicio, no se puede borrar.
    // Recomendación: desactivar en vez de borrar (lo haremos luego si quieres).
    const ok = confirm("¿Eliminar servicio? (Si está usado en citas, no se podrá borrar)");
    if (!ok) return;

    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return alert(error.message);

    await load();
  }

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Servicios</h1>

      {/* Crear */}
      <div className="border rounded-2xl bg-white p-4 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombre del servicio</label>
            <input
              className="w-full border rounded-md p-2"
              placeholder="Ej: Corte mujer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Duración total (min)</label>
            <input
              className="w-full border rounded-md p-2"
              placeholder="Ej: 60"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Duración activa (min)</label>
            <input
              className="w-full border rounded-md p-2"
              placeholder="Ej: 20"
              inputMode="numeric"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Precio (€)</label>
            <input
              className="w-full border rounded-md p-2"
              placeholder="Ej: 18"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <p className="text-sm text-zinc-600">
          <b>Duración total</b> = lo que dura la cita (incluye exposición).{" "}
          <b>Duración activa</b> = lo que te bloquea de verdad (aplicar/aclarar/peinar).
        </p>

        <div className="flex gap-2">
          <button className="bg-black text-white rounded-md px-3 py-2" onClick={addService}>
            Añadir servicio
          </button>
          <button className="border rounded-md px-3 py-2" onClick={resetCreateForm}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
        <div className="p-3 text-sm text-zinc-500">{items.length} servicios</div>
        <div className="divide-y">
          {items.map((s) => (
            <div key={s.id} className="p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-zinc-600">
                  Total: {s.default_duration_min} min · Activo: {s.active_duration_min ?? s.default_duration_min} min · Precio: {s.default_price} €
                </div>
              </div>

              <button className="border rounded-md px-3 py-1" onClick={() => startEdit(s)}>
                Editar
              </button>
              <button className="border rounded-md px-3 py-1" onClick={() => delService(s.id)}>
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal editar (✅ con labels claros) */}
      {editId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-4 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center">
              <h2 className="font-semibold">Editar servicio</h2>
              <button className="ml-auto text-zinc-500" onClick={() => setEditId(null)}>
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Nombre</label>
                <input
                  className="w-full border rounded-md p-2"
                  placeholder="Ej: Tinte raíz"
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Precio (€)</label>
                <input
                  className="w-full border rounded-md p-2"
                  placeholder="Ej: 25"
                  inputMode="decimal"
                  value={ePrice}
                  onChange={(e) => setEPrice(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Duración total (min)</label>
                <input
                  className="w-full border rounded-md p-2"
                  placeholder="Ej: 60"
                  inputMode="numeric"
                  value={eDuration}
                  onChange={(e) => setEDuration(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Duración activa (min)</label>
                <input
                  className="w-full border rounded-md p-2"
                  placeholder="Ej: 20"
                  inputMode="numeric"
                  value={eActive}
                  onChange={(e) => setEActive(e.target.value)}
                />
              </div>
            </div>

            <p className="text-sm text-zinc-600">
              La duración activa no puede superar la total.
            </p>

            <div className="flex gap-2">
              <button className="flex-1 border rounded-md p-2" onClick={() => setEditId(null)}>
                Cancelar
              </button>
              <button className="flex-1 bg-black text-white rounded-md p-2" onClick={saveEdit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
