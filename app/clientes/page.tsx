"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
};

export default function ClientesPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [notes, setNotes] = useState("");

  async function guardAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href = "/login";
  }

  async function load() {
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, phone, instagram, notes")
      .order("full_name", { ascending: true });
    if (error) console.error(error);
    setItems((data ?? []) as Client[]);
  }

  useEffect(() => {
    (async () => {
      await guardAuth();
      await load();
      setLoading(false);
    })();
  }, []);

  async function addClient() {
    if (!fullName.trim()) return;
    await supabase.from("clients").insert({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      instagram: instagram.trim() || null,
      notes: notes.trim() || null,
    });
    setFullName(""); setPhone(""); setInstagram(""); setNotes("");
    await load();
  }

  async function delClient(id: string) {
    const ok = confirm("¿Eliminar cliente?");
    if (!ok) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <div className="border rounded-xl bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded-md p-2" placeholder="Nombre y apellidos"
            value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Teléfono (opcional)"
            value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Instagram (opcional)"
            value={instagram} onChange={(e) => setInstagram(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Notas (opcional)"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="bg-black text-white rounded-md px-3 py-2" onClick={addClient}>
          Añadir cliente
        </button>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 text-sm text-zinc-500">{items.length} clientes</div>
        <div className="divide-y">
          {items.map((c) => (
            <div key={c.id} className="p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{c.full_name}</div>
                <div className="text-sm text-zinc-600">
                  {c.phone ?? ""} {c.instagram ? `· ${c.instagram}` : ""}
                </div>
                {c.notes && <div className="text-sm text-zinc-500 mt-1">{c.notes}</div>}
              </div>
              <button className="border rounded-md px-3 py-1" onClick={() => delClient(c.id)}>
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
