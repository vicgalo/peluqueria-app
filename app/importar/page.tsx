"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ParsedContact = { full_name: string; phone: string | null };

function parseVCF(text: string): ParsedContact[] {
  const cards = text.split("END:VCARD");
  const out: ParsedContact[] = [];

  for (const card of cards) {
    const lines = card.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.some(l => l.startsWith("BEGIN:VCARD"))) continue;

    const fn = (lines.find(l => l.startsWith("FN:")) || "").replace("FN:", "").trim();
    const telLine =
      lines.find(l => l.startsWith("TEL:")) ||
      lines.find(l => l.startsWith("TEL;")) ||
      "";
    const phone = telLine ? telLine.split(":").slice(1).join(":").trim() : null;

    if (fn) out.push({ full_name: fn, phone: phone || null });
  }

  return out;
}

export default function ImportarPage() {
  const [fileName, setFileName] = useState("");
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState<ParsedContact[]>([]);
  const [all, setAll] = useState<ParsedContact[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onPick(file?: File | null) {
    setMsg("");
    setPreview([]);
    setAll([]);
    setCount(0);
    if (!file) return;

    setFileName(file.name);
    const text = await file.text();
    const parsed = parseVCF(text);

    setAll(parsed);
    setCount(parsed.length);
    setPreview(parsed.slice(0, 10));
  }

  async function onImport() {
    setLoading(true);
    setMsg("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/login";
        return;
      }

      if (all.length === 0) {
        setMsg("No hay contactos para importar.");
        return;
      }

      // Inserta en batches para evitar límites si son muchos
      const batchSize = 200;
      for (let i = 0; i < all.length; i += batchSize) {
        const chunk = all.slice(i, i + batchSize).map(c => ({
          full_name: c.full_name,
          phone: c.phone,
          instagram: null,
          notes: null,
          // NO ponemos owner_id: lo pone el trigger + RLS
        }));

        const { error } = await supabase.from("clients").insert(chunk);
        if (error) throw new Error(error.message);
      }

      setMsg(`✅ Importados ${all.length} contactos en tu usuario.`);
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Error importando."}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Importar contactos</h1>

      <div className="border rounded-xl bg-white p-4 space-y-3">
        <p className="text-sm text-zinc-600">
          Sube un archivo <b>.vcf</b> (vCard). Se importará solo en el usuario con el que has iniciado sesión.
        </p>

        <input type="file" accept=".vcf,text/vcard" onChange={(e) => onPick(e.target.files?.[0])} />

        {fileName && (
          <div className="text-sm text-zinc-700">
            Archivo: <b>{fileName}</b> · Contactos detectados: <b>{count}</b>
          </div>
        )}

        {preview.length > 0 && (
          <div className="text-sm">
            <div className="font-medium mb-2">Vista previa (10):</div>
            <ul className="list-disc pl-5 text-zinc-700">
              {preview.map((c, i) => (
                <li key={i}>
                  {c.full_name} {c.phone ? `· ${c.phone}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className="bg-black text-white rounded-md px-3 py-2" onClick={onImport} disabled={loading}>
          {loading ? "Importando..." : "Importar a Clientes"}
        </button>

        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </main>
  );
}
