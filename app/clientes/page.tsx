"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  phone_norm?: string | null;
};

function normalizePhoneES(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  // Si son 9 dígitos, asumimos ES y prefijamos 34
  if (digits.length === 9) return `34${digits}`;
  return digits;
}

export default function ClientesPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

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
      .select("id, full_name, phone, instagram, notes, phone_norm")
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
    setMsg("");
    const name = fullName.trim();
    if (!name) return;

    const phoneValue = phone.trim() || null;
    const phoneNorm = phoneValue ? normalizePhoneES(phoneValue) : null;

    // 1) Detección de duplicado en app (solo si hay teléfono)
    if (phoneNorm) {
      const { data: dup, error: dupErr } = await supabase
        .from("clients")
        .select("id, full_name, phone")
        .eq("phone_norm", phoneNorm)
        .limit(1);

      if (dupErr) {
        console.error(dupErr);
      } else if (dup && dup.length > 0) {
        setMsg(`⚠️ Este teléfono ya existe: ${dup[0].full_name} (${dup[0].phone ?? ""}).`);
        return;
      }
    }

    // 2) Insert
    const { error } = await supabase.from("clients").insert({
      full_name: name,
      phone: phoneValue,
      instagram: instagram.trim() || null,
      notes: notes.trim() || null,
      // phone_norm lo pone el trigger (pero si no existiera, igual lo calculamos aquí)
      phone_norm: phoneNorm,
    });

    if (error) {
      // Si salta el unique index
      if ((error as any)?.code === "23505") {
        setMsg("⚠️ No se ha guardado: ya existe un cliente con ese teléfono.");
      } else {
        setMsg(`❌ Error: ${error.message}`);
      }
      return;
    }

    setFullName("");
    setPhone("");
    setInstagram("");
    setNotes("");
    setMsg("✅ Cliente añadido.");
    await load();
  }

  async function delClient(id: string) {
    const ok = confirm("¿Eliminar cliente?");
    if (!ok) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) alert(error.message);
    await load();
  }

  const count = useMemo(() => items.length, [items]);

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <div className="border rounded-xl bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded-md p-2"
            placeholder="Nombre y apellidos"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="border rounded-md p-2"
            placeholder="Teléfono (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="border rounded-md p-2"
            placeholder="Instagram (opcional)"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
          />
          <input
            className="border rounded-md p-2"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button className="bg-black text-white rounded-md px-3 py-2" onClick={addClient}>
          Añadir cliente
        </button>

        {msg && <div className="text-sm text-zinc-700">{msg}</div>}
        <div className="text-xs text-zinc-500">
          Tip: detecta duplicados aunque escribas el teléfono con espacios o guiones. Si pones 9 dígitos, asume España (+34).
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 text-sm text-zinc-500">{count} clientes</div>
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
