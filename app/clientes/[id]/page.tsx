"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

type ClientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
};

export default function EditarClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      setMsg("");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone, instagram, notes")
        .eq("id", id)
        .single();

      if (error) {
        setMsg("❌ No se pudo cargar el cliente (¿existe o es de otro usuario?).");
        setLoading(false);
        return;
      }

      const c = data as ClientRow;
      setFullName(c.full_name ?? "");
      setPhone(c.phone ?? "");
      setInstagram(c.instagram ?? "");
      setNotes(c.notes ?? "");
      setLoading(false);
    })();
  }, [id, router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      const normalizedPhone = phone.trim() ? phone.replace(/\s+/g, "") : null;

      const { error } = await supabase
        .from("clients")
        .update({
          full_name: fullName.trim(),
          phone: normalizedPhone,
          instagram: instagram.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);

      setMsg("✅ Cliente actualizado");
      // opcional: volver a clientes
      // router.push("/clientes");
    } catch (err: any) {
      setMsg(`❌ ${err?.message ?? "Error guardando"}`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("¿Seguro que quieres eliminar este cliente?")) return;

    setSaving(true);
    setMsg("");

    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw new Error(error.message);

      router.push("/clientes");
    } catch (err: any) {
      setMsg(`❌ ${err?.message ?? "Error eliminando"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando…</p>;

  return (
    <main className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Editar cliente</h1>
        <button
          className="ml-auto text-sm underline"
          onClick={() => router.push("/clientes")}
        >
          Volver
        </button>
      </div>

      <form onSubmit={onSave} className="space-y-3 border rounded-xl bg-white p-4">
        <div>
          <label className="block text-sm font-medium">Nombre</label>
          <input
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Teléfono</label>
          <input
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="600123123"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Instagram</label>
          <input
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@peluqueria..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Notas</label>
          <textarea
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-black text-white rounded-md px-3 py-2"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>

          <button
            type="button"
            className="border rounded-md px-3 py-2"
            onClick={() => router.push("/clientes")}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="ml-auto border rounded-md px-3 py-2 text-red-600"
            onClick={onDelete}
            disabled={saving}
          >
            Eliminar
          </button>
        </div>

        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </main>
  );
}
