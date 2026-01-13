"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <div className="p-4">Cargando…</div>;

  return (
    <main className="min-h-[70vh] flex items-center justify-center">
      <div className="text-center space-y-5">
        <img
          src="/icon-192.png"
          alt="Logo"
          className="mx-auto h-28 w-28 rounded-3xl shadow"
        />

        <div>
          <h1 className="text-2xl font-semibold">Peluquería</h1>
          <p className="text-zinc-500">Gestión rápida y sencilla</p>
        </div>

        {/* Opcional: accesos rápidos bonitos */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/agenda"
            className="rounded-xl bg-black text-white px-4 py-2"
          >
            Ir a agenda
          </Link>
          <Link
            href="/clientes"
            className="rounded-xl border bg-white px-4 py-2 hover:bg-zinc-50"
          >
            Buscar cliente
          </Link>
        </div>
      </div>
    </main>
  );
}

  