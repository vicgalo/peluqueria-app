"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function CrearUsuarioPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function crear() {
    setLoading(true);
    setMsg(null);

    // Obtener sesión actual
    const { data: sessionData, error: sessionError } =
      await supabaseBrowser.auth.getSession();

    const token = sessionData?.session?.access_token;

    if (sessionError || !token) {
      setLoading(false);
      setMsg("No estás logueado. Inicia sesión y vuelve a intentarlo.");
      return;
    }

    // Llamar a la API protegida
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMsg(data.error || "Error al crear el usuario");
    } else {
      setMsg("Usuario creado ✅ Ya puedes iniciar sesión con él.");
      setEmail("");
      setPassword("");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Crear usuario</h1>

      <p style={{ fontSize: 14, opacity: 0.8 }}>
        Crea un nuevo usuario con email y contraseña para usar la app.
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="Contraseña (mín. 6 caracteres)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={crear} disabled={loading}>
          {loading ? "Creando…" : "Crear usuario"}
        </button>

        {msg && (
          <p style={{ fontSize: 14, marginTop: 8 }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
