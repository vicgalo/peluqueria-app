"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ParsedContact = { full_name: string; phone: string | null };

function normalizePhoneES(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 9) return `34${digits}`;
  return digits;
}

function parseVCF(text: string): ParsedContact[] {
  const cards = text.split("END:VCARD");
  const out: ParsedContact[] = [];

  for (const card of cards) {
    const lines = card
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.some((l) => l.startsWith("BEGIN:VCARD"))) continue;

    const fn = (lines.find((l) => l.startsWith("FN:")) || "").replace("FN:", "").trim();

    const telLine =
      lines.find((l) => l.startsWith("TEL:")) ||
      lines.find((l) => l.startsWith("TEL;")) ||
      "";

    const phone = telLine ? telLine.split(":").slice(1).join(":").trim() : null;

    if (fn) out.push({ full_name: fn, phone: phone || null });
  }

  return out;
}

async function fetchExistingPhoneNorms(norms: string[]) {
  // Obtiene los phone_norm existentes en tu usuario (RLS lo limita)
  const existing = new Set<string>();

  const chunkSize = 500;
  for (let i = 0; i < norms.length; i += chunkSize) {
    const chunk = norms.slice(i, i + chunkSize);
    const { data, error } = await supabase.from("clients").select("phone_norm").in("phone_norm", chunk);
    if (error) throw new Error(error.message);
    (data ?? []).forEach((r: any) => {
      if (r.phone_norm) existing.add(r.phone_norm);
    });
  }

  return existing;
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

      // 1) Normalizamos teléfonos y limpiamos duplicados dentro del archivo
      let noPhone = 0;
      let dupInFile = 0;

      const seen = new Set<string>(); // phone_norm
      const cleaned: { full_name: string; phone: string | null; phone_norm: string | null }[] = [];

      for (const c of all) {
        const full_name = c.full_name.trim();
        const phoneVal = (c.phone || "").trim() || null;
        const norm = phoneVal ? normalizePhoneES(phoneVal) : null;

        if (!norm) {
          noPhone++;
          cleaned.push({ full_name, phone: phoneVal, phone_norm: null });
          continue;
        }

        if (seen.has(norm)) {
          dupInFile++;
          continue;
        }

        seen.add(norm);
        cleaned.push({ full_name, phone: phoneVal, phone_norm: norm });
      }

      // 2) Detectar cuáles ya existen en BD (por phone_norm)
      const norms = cleaned.map((x) => x.phone_norm).filter(Boolean) as string[];
      const existing = norms.length ? await fetchExistingPhoneNorms(norms) : new Set<string>();

      let dupInDb = 0;
      const toInsert = cleaned.filter((x) => {
        if (!x.phone_norm) return true; // sin teléfono -> permitimos
        if (existing.has(x.phone_norm)) {
          dupInDb++;
          return false;
        }
        return true;
      });

      // 3) Insertar en batches (si hay carrera y salta unique, fallback a uno-a-uno)
      let inserted = 0;
      let failed = 0;

      const batchSize = 200;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const chunk = toInsert.slice(i, i + batchSize).map((c) => ({
          full_name: c.full_name,
          phone: c.phone,
          instagram: null,
          notes: null,
          phone_norm: c.phone_norm, // trigger también lo rellena
        }));

        const { error } = await supabase.from("clients").insert(chunk);

        if (!error) {
          inserted += chunk.length;
          continue;
        }

        // Si hay error de unique (23505) o cualquier otro, intentamos insertar uno a uno para no parar
        for (const one of chunk) {
          const { error: e2 } = await supabase.from("clients").insert(one);
          if (!e2) {
            inserted++;
          } else {
            if ((e2 as any)?.code === "23505") {
              // duplicado (probablemente carrera)
              dupInDb++;
            } else {
              failed++;
            }
          }
        }
      }

      const totalParsed = all.length;
      const totalAttempt = toInsert.length;

      setMsg(
        [
          `✅ Importación completada.`,
          `Detectados: ${totalParsed}`,
          `Importados: ${inserted}`,
          `Saltados (duplicado en archivo): ${dupInFile}`,
          `Saltados (ya existían): ${dupInDb}`,
          `Sin teléfono: ${noPhone}`,
          failed ? `Fallos: ${failed}` : null,
          `Intentados (tras filtrar duplicados): ${totalAttempt}`,
        ]
          .filter(Boolean)
          .join(" · ")
      );
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
          <br />
          Detecta duplicados por teléfono (normalizado) y los salta.
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
