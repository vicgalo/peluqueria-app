"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    // 👉 REDIRIGE AL INICIO (HOME)
    router.push("/");
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center">
      <form
        onSubmit={onLogin}
        className="w-full max-w-sm border rounded-xl bg-white p-5 space-y-3"
      >
        <h1 className="text-xl font-semibold">Acceso</h1>

        <input
          className="w-full border rounded-md p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border rounded-md p-2"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <button className="w-full bg-black text-white rounded-md p-2">
          Entrar
        </button>

        <p className="text-xs text-zinc-500">
          Si no entras, revisa que el usuario exista en Supabase → Authentication
          → Users.
        </p>
      </form>
    </main>
  );
}
