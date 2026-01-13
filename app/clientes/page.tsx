"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function initialLetter(name: string) {
  const s = (name || "").trim();
  if (!s) return "#";
  const ch = s[0].toUpperCase();
  // Permitimos letras típicas en ES
  return /[A-ZÁÉÍÓÚÜÑ]/.test(ch) ? ch : "#";
}

function normalizeForSearch(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // sin acentos
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

  // Scroll por letras
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const indexRef = useRef<HTMLDivElement | null>(null);

  // Índice arrastrable
  const [dragging, setDragging] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string>("");

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
    let q = supabase.from("clients").select("id, full_name, phone").eq("phone_norm", phoneNorm).limit(1);
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
    const s = normalizeForSearch(q.trim());
    if (!s) return items;
    return items.filter((c) => {
      const a = normalizeForSearch(c.full_name ?? "");
      const b = normalizeForSearch(c.phone ?? "");
      const d = normalizeForSearch(c.instagram ?? "");
      return a.includes(s) || b.includes(s) || d.includes(s);
    });
  }, [items, q]);

  const groups = useMemo(() => {
    const map = new Map<string, Client[]>();
    for (const c of filtered) {
      const key = initialLetter(c.full_name || "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      const isHashA = a === "#";
      const isHashB = b === "#";
      if (isHashA && !isHashB) return 1;
      if (!isHashA && isHashB) return -1;
      return a.localeCompare(b, "es");
    });

    return keys.map((k) => ({
      key: k,
      items: (map.get(k) ?? []).sort((x, y) => (x.full_name || "").localeCompare(y.full_name || "", "es")),
    }));
  }, [filtered]);

  const indexLetters = useMemo(() => groups.map((g) => g.key), [groups]);

  function scrollToLetter(letter: string) {
    const el = sectionRefs.current[letter];
    if (!el) return;
    setActiveLetter(letter);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // burbuja iOS
    setTimeout(() => setActiveLetter(""), 700);
  }

  // Mapea posición Y dentro del índice a letra
  function letterFromClientY(clientY: number): string | null {
    const container = indexRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const y = clientY - rect.top;

    const count = indexLetters.length;
    if (count <= 0) return null;

    const itemH = rect.height / count;
    const idx = Math.max(0, Math.min(count - 1, Math.floor(y / itemH)));
    return indexLetters[idx] ?? null;
  }

  function beginDrag(clientY: number) {
    if (indexLetters.length <= 1) return;
    setDragging(true);
    const L = letterFromClientY(clientY);
    if (L) scrollToLetter(L);
  }

  function moveDrag(clientY: number) {
    if (!dragging) return;
    const L = letterFromClientY(clientY);
    if (L) scrollToLetter(L);
  }

  function endDrag() {
    setDragging(false);
    // activeLetter se limpia por timeout en scrollToLetter
  }

  // Listeners globales mientras arrastras
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      moveDrag(e.clientY);
    }
    function onMouseUp() {
      endDrag();
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches?.[0]) moveDrag(e.touches[0].clientY);
    }
    function onTouchEnd() {
      endDrag();
    }

    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("touchcancel", onTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [dragging, indexLetters]);

  if (loading) return <div className="p-4">Cargando…</div>;

  return (
    <main className="space-y-3 relative">
      {/* Header iOS */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-zinc-500">Peluquería</div>
          <h1 className="text-2xl font-semibold tracking-tight">Contactos</h1>
        </div>
        <div className="text-sm text-zinc-500">{filtered.length}</div>
      </div>

      {/* Buscar iOS */}
      <div className="sticky top-0 z-10 bg-zinc-50 pt-1">
        <div className="bg-white border border-zinc-200 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-sm">
          <span className="text-zinc-400">🔎</span>
          <input
            className="w-full outline-none text-sm"
            placeholder="Buscar…"
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

      {/* Lista agrupada estilo iOS */}
      <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm">
        {groups.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">No hay contactos.</div>
        ) : (
          <div>
            {groups.map((g, gi) => (
              <div key={g.key} ref={(el) => { sectionRefs.current[g.key] = el; }}>
                {/* Cabecera sección */}
                <div className="px-4 py-2 bg-zinc-50 text-[11px] font-semibold text-zinc-600 border-t border-zinc-200">
                  {g.key}
                </div>

                {/* Filas */}
                <div className="divide-y divide-zinc-200">
                  {g.items.map((c) => {
                    const initial = (c.full_name?.trim()?.[0] ?? "?").toUpperCase();
                    return (
                      <div
                        key={c.id}
                        className="px-4 py-3 flex items-center gap-3 active:bg-zinc-100 cursor-pointer"
                        onClick={() => goToClient(c.id)}
                      >
                        {/* Avatar iOS */}
                        <div className="h-10 w-10 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-semibold text-zinc-700">
                          {initial}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.full_name}</div>
                          <div className="text-sm text-zinc-600 truncate">
                            {c.phone ?? ""}{c.instagram ? ` · ${c.instagram}` : ""}
                          </div>
                        </div>

                        {/* Acciones compactas */}
                        <div className="flex gap-2">
                          <button
                            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(c);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white"
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

                {/* Separación suave entre secciones */}
                {gi === groups.length - 1 ? null : <div className="h-1 bg-white" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Índice lateral iOS: arrastrable */}
      {indexLetters.length > 1 && (
        <div className="fixed right-2 top-1/2 -translate-y-1/2 z-20 select-none">
          <div
            ref={indexRef}
            className="flex flex-col items-center justify-center gap-0.5 bg-white/70 backdrop-blur border border-zinc-200 rounded-full px-2 py-2 shadow"
            style={{ touchAction: "none" }} // clave para drag en móvil
            onMouseDown={(e) => {
              e.preventDefault();
              beginDrag(e.clientY);
            }}
            onTouchStart={(e) => {
              const t = e.touches?.[0];
              if (!t) return;
              beginDrag(t.clientY);
            }}
          >
            {indexLetters.map((L) => (
              <button
                key={L}
                className="text-[11px] leading-none text-zinc-600 hover:text-black px-1 py-[2px]"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToLetter(L);
                }}
                aria-label={`Ir a ${L}`}
              >
                {L}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Burbuja letra activa */}
      {activeLetter && (
        <div className="fixed inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="h-24 w-24 rounded-2xl bg-black/70 text-white flex items-center justify-center text-4xl font-bold shadow-2xl">
            {activeLetter}
          </div>
        </div>
      )}

      {/* FAB + */}
      <button
        onClick={openCreate}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-black text-white text-3xl leading-none flex items-center justify-center shadow-xl z-20"
        aria-label="Nuevo contacto"
      >
        +
      </button>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-3 py-2 rounded-full shadow-lg z-20"
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
              <input className="border border-zinc-200 rounded-xl p-2" placeholder="Nombre y apellidos" value={cFullName} onChange={(e) => setCFullName(e.target.value)} />
              <input className="border border-zinc-200 rounded-xl p-2" placeholder="Teléfono (opcional)" value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
              <input className="border border-zinc-200 rounded-xl p-2" placeholder="Instagram (opcional)" value={cInstagram} onChange={(e) => setCInstagram(e.target.value)} />
              <input className="border border-zinc-200 rounded-xl p-2" placeholder="Notas (opcional)" value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
            </div>

            {cMsg && <div className="text-sm text-zinc-700">{cMsg}</div>}

            <div className="flex gap-2">
              <button className="flex-1 border border-zinc-200 rounded-xl p-2" onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button className="flex-1 bg-black text-white rounded-xl p-2" onClick={createClient}>
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
              <input className="border border-zinc-200 rounded-xl p-2" value={eFullName} onChange={(e) => setEFullName(e.target.value)} />
              <input className="border border-zinc-200 rounded-xl p-2" value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="Teléfono (opcional)" />
              <input className="border border-zinc-200 rounded-xl p-2" value={eInstagram} onChange={(e) => setEInstagram(e.target.value)} placeholder="Instagram (opcional)" />
              <input className="border border-zinc-200 rounded-xl p-2" value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Notas (opcional)" />
            </div>

            {eMsg && <div className="text-sm text-zinc-700">{eMsg}</div>}

            <div className="flex gap-2">
              <button
                className="flex-1 border border-zinc-200 rounded-xl p-2"
                onClick={() => {
                  setEditOpen(false);
                  setEditClient(null);
                }}
              >
                Cancelar
              </button>
              <button className="flex-1 bg-black text-white rounded-xl p-2" onClick={saveEdit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
