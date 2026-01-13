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
  const [toast, setToast] = useState<string>("");

  // Buscar
  const [q, setQ] = useState("");

  // Modal CREAR
  const [createOpen, setCreateOpen] = useState(false);
  const [cFullName, setCFullName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cInstagram, setCInstagram] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cMsg, setCMsg] = useState("");

  // Modal EDITAR
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

  function goToClient(id: any) {
    const safe = typeof id === "string" ? id : String(id ?? "");
    if (!safe || safe === "undefined" || safe === "null") return;
    if (!isUuid(safe)) return;
    router.push(`/clientes/${safe}`);
  }

  function openCreate() {
    setCFullName("");
    setCPhone("");
    setCInstagram("");
    setCNotes("");
    setCMsg("");
    setCreateOpen(true);
  }

  async function createClient() {
    setCMsg("");
    const name = cFullName.trim();
    if (!name) {
      setCMsg("⚠️ El nombre es obligatorio.");
      return;
    }

    const phoneValue = cPhone.trim();
    const phoneNorm = phoneValue ? normalizePhoneES(phoneValue) : null;

    if (phoneNorm) {
      const dup = await checkDuplicatePhone(phoneNorm);
      if (dup) {
        setCMsg(`⚠️ Este teléfono ya existe: ${dup.full_name} (${dup.phone ?? ""})`);
        return;
      }
    }

    const { error } = await supabase.from("clients").insert({
      full_name: name,
      phone: phoneValue || null,
      instagram: cInstagram.trim() || null,
      notes: cNotes.trim() || null,
      phone_norm: phoneNorm,
    });

    if (error) {
      setCMsg(
        (error as any)?.code === "23505"
          ? "⚠️ Ya existe un cliente con ese teléfono."
          : `❌ Error: ${error.message}`
      );
      return;
    }

    setCreateOpen(false);
    setToast("✅ Contacto creado.");
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
    setToast("✅ Contacto actualizado.");
    await load();
  }

  async function delClient(id: string) {
    const ok = confirm("¿Eliminar contacto?");
    if (!ok) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) alert(error.message);
    setToast("🗑️ Contacto eliminado.");
    await load();
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const a = (c.full_name ?? "").toLowerCase();
      const b = (c.phone ?? "").toLowerCase();
      const d = (c.instagram ?? "").toLowerCase();
      return a.includes(s) || b.includes(s) || d.includes(s);
    });
  }, [items, q]);

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-3">
      {/* Header estilo iOS */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contactos</h1>
        <div className="text-sm text-zinc-500">{filtered.length}</div>
      </div>

      {/* Buscar */}
      <div className="sticky top-0 z-10 bg-zinc-50 pt-1">
        <div className="bg-white border rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-zinc-400">🔎</span>
          <input
            className="w-full outline-none text-sm"
            placeholder="Buscar por nombre, teléfono o Instagram…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="text-zinc-400" onClick={() => setQ("")} aria-label="Limpiar">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Lista tipo iPhone */}
      <div className="border rounded-2xl bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">No hay contactos.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((c) => {
              const initial = (c.full_name?.trim()?.[0] ?? "?").toUpperCase();
              return (
                <div
                  key={c.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 cursor-pointer"
                  onClick={() => goToClient(c.id)}
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center font-semibold text-zinc-700">
                    {initial}
                  </div>

                  {/* Texto */}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.full_name}</div>
                    <div className="text-sm text-zinc-600 truncate">
                      {c.phone ?? ""}{c.instagram ? ` · ${c.instagram}` : ""}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2">
                    <button
                      className="text-sm border rounded-md px-2 py-1 bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(c);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-sm border rounded-md px-2 py-1 bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        delClient(c.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB + */}
      <button
        onClick={openCreate}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-black text-white text-3xl leading-none flex items-center justify-center shadow-xl"
        aria-label="Nuevo contacto"
      >
        +
      </button>

      {/* Toast simple */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-3 py-2 rounded-full shadow-lg"
          onClick={() => setToast("")}
        >
          {toast}
        </div>
      )}

      {/* Modal Crear */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Nuevo contacto</h2>
              <button className="text-zinc-500" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-md p-2" placeholder="Nombre y apellidos" value={cFullName} onChange={(e) => setCFullName(e.target.value)} />
              <input className="border rounded-md p-2" placeholder="Teléfono (opcional)" value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
              <input className="border rounded-md p-2" placeholder="Instagram (opcional)" value={cInstagram} onChange={(e) => setCInstagram(e.target.value)} />
              <input className="border rounded-md p-2" placeholder="Notas (opcional)" value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
            </div>

            {cMsg && <div className="text-sm text-zinc-700">{cMsg}</div>}

            <div className="flex gap-2">
              <button className="flex-1 border rounded-md p-2" onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button className="flex-1 bg-black text-white rounded-md p-2" onClick={createClient}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editOpen && editClient && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Editar contacto</h2>
              <button
                className="text-zinc-500"
                onClick={() => {
                  setEditOpen(false);
                  setEditClient(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-md p-2" value={eFullName} onChange={(e) => setEFullName(e.target.value)} />
              <input className="border rounded-md p-2" value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="Teléfono (opcional)" />
              <input className="border rounded-md p-2" value={eInstagram} onChange={(e) => setEInstagram(e.target.value)} placeholder="Instagram (opcional)" />
              <input className="border rounded-md p-2" value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Notas (opcional)" />
            </div>

            {eMsg && <div className="text-sm text-zinc-700">{eMsg}</div>}

            <div className="flex gap-2">
              <button
                className="flex-1 border rounded-md p-2"
                onClick={() => {
                  setEditOpen(false);
                  setEditClient(null);
                }}
              >
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
