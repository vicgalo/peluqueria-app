"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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
  if (digits.length === 9) return `34${digits}`;
  return digits;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default function ClientesPage() {
  const router = useRouter();

  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  // Crear
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [notes, setNotes] = useState("");

  // Editar
  const [editOpen, setEditOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [eFullName, setEFullName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eInstagram, setEInstagram] = useState("");
  const [eNotes, setENotes] = useState("");
  const [eMsg, setEMsg] = useState("");

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

  async function checkDuplicatePhone(phoneNorm: string, excludeId?: string) {
    let q = supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("phone_norm", phoneNorm)
      .limit(1);

    if (excludeId) q = q.neq("id", excludeId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data && data.length > 0 ? data[0] : null;
  }

  async function addClient() {
    setMsg("");
    const name = fullName.trim();
    if (!name) return;

    const phoneValue = phone.trim();
    const phoneNorm = phoneValue ? normalizePhoneES(phoneValue) : null;

    if (phoneNorm) {
      const dup = await checkDuplicatePhone(phoneNorm);
      if (dup) {
        setMsg(`⚠️ Este teléfono ya existe: ${dup.full_name} (${dup.phone ?? ""})`);
        return;
      }
    }

    const { error } = await supabase.from("clients").insert({
      full_name: name,
      phone: phoneValue || null,
      instagram: instagram.trim() || null,
      notes: notes.trim() || null,
      phone_norm: phoneNorm,
    });

    if (error) {
      setMsg(
        (error as any)?.code === "23505"
          ? "⚠️ Ya existe un cliente con ese teléfono."
          : `❌ Error: ${error.message}`
      );
      return;
    }

    setFullName("");
    setPhone("");
    setInstagram("");
    setNotes("");
    setMsg("✅ Cliente añadido.");
    await load();
  }

  function openEdit(c: Client) {
    setEditClient(c);
    setEFullName(c.full_name ?? "");
    setEPhone(c.phone ?? "");
    setEInstagram(c.instagram ?? "");
    setENotes(c.notes ?? "");
    setEMsg("");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editClient) return;
    setEMsg("");

    const name = eFullName.trim();
    if (!name) {
      setEMsg("⚠️ El nombre es obligatorio.");
      return;
    }

    const phoneValue = ePhone.trim();
    const phoneNorm = phoneValue ? normalizePhoneES(phoneValue) : null;

    if (phoneNorm) {
      const dup = await checkDuplicatePhone(phoneNorm, editClient.id);
      if (dup) {
        setEMsg(`⚠️ Ese teléfono ya lo tiene: ${dup.full_name} (${dup.phone ?? ""})`);
        return;
      }
    }

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: name,
        phone: phoneValue || null,
        instagram: eInstagram.trim() || null,
        notes: eNotes.trim() || null,
        phone_norm: phoneNorm,
      })
      .eq("id", editClient.id);

    if (error) {
      setEMsg(
        (error as any)?.code === "23505"
          ? "⚠️ Ya existe otro cliente con ese teléfono."
          : `❌ Error: ${error.message}`
      );
      return;
    }

    setEditOpen(false);
    setEditClient(null);
    await load();
    setMsg("✅ Cliente actualizado.");
  }

  async function delClient(id: string) {
    const ok = confirm("¿Eliminar cliente?");
    if (!ok) return;
    await supabase.from("clients").delete().eq("id", id);
    await load();
  }

  function goToClient(id: any) {
    const safe = typeof id === "string" ? id : String(id ?? "");
    if (!safe || safe === "undefined" || safe === "null") return;
    if (!isUuid(safe)) return; // evita navegar con valores raros
    router.push(`/clientes/${safe}`);
  }

  const count = useMemo(() => items.length, [items]);

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Clientes</h1>

      {/* Crear */}
      <div className="border rounded-xl bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded-md p-2" placeholder="Nombre y apellidos" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Instagram (opcional)" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
          <input className="border rounded-md p-2" placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button className="bg-black text-white rounded-md px-3 py-2" onClick={addClient}>
          Añadir cliente
        </button>

        {msg && <div className="text-sm text-zinc-700">{msg}</div>}
      </div>

      {/* Lista */}
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 text-sm text-zinc-500">{count} clientes</div>
        <div className="divide-y">
          {items.map((c) => (
            <div
              key={c.id}
              className="p-3 flex items-start gap-3 hover:bg-zinc-50 cursor-pointer"
              onClick={() => goToClient(c.id)}
            >
              <div className="flex-1">
                <div className="font-medium">{c.full_name}</div>
                <div className="text-sm text-zinc-600">
                  {c.phone ?? ""} {c.instagram ? `· ${c.instagram}` : ""}
                </div>
                {c.notes && <div className="text-sm text-zinc-500 mt-1">{c.notes}</div>}
              </div>

              <div className="flex gap-2">
                <button
                  className="border rounded-md px-3 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(c);
                  }}
                >
                  Editar
                </button>
                <button
                  className="border rounded-md px-3 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    delClient(c.id);
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Editar */}
      {editOpen && editClient && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Editar cliente</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-md p-2" value={eFullName} onChange={(e) => setEFullName(e.target.value)} />
              <input className="border rounded-md p-2" value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="Teléfono (opcional)" />
              <input className="border rounded-md p-2" value={eInstagram} onChange={(e) => setEInstagram(e.target.value)} placeholder="Instagram (opcional)" />
              <input className="border rounded-md p-2" value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Notas (opcional)" />
            </div>

            {eMsg && <div className="text-sm text-zinc-700">{eMsg}</div>}

            <div className="flex gap-2">
              <button className="flex-1 border rounded-md p-2" onClick={() => setEditOpen(false)}>
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
