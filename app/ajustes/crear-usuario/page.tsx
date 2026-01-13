"use client";
import { useState } from "react";

export default function CrearUsuarioPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function crear() {
    setLoading(true);
    setMsg(null);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) setMsg(data.error || "Error");
    else setMsg("Usuario creado ✅ Ya puedes iniciar sesión con él.");
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Crear usuario</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={crear} disabled={loading}>
        {loading ? "Creando…" : "Crear usuario"}
      </button>

      {msg && <p>{msg}</p>}
    </div>
  );
}
