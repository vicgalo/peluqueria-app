"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HomeAppPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6 text-zinc-600">Cargando…</div>;

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/icon-192.png"
          alt="Peluquería"
          width={96}
          height={96}
          className="rounded-3xl shadow"
          priority
        />
        <h1 className="text-2xl font-semibold">Peluquería</h1>
        <p className="text-sm text-zinc-500">Gestión de agenda, clientes y servicios</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-xl px-4">
        <Link href="/agenda" className="rounded-2xl border bg-white p-4 hover:bg-zinc-50">
          <div className="font-semibold">Agenda</div>
          <div className="text-xs text-zinc-500 mt-1">Calendario y citas</div>
        </Link>
        <Link href="/clientes" className="rounded-2xl border bg-white p-4 hover:bg-zinc-50">
          <div className="font-semibold">Clientes</div>
          <div className="text-xs text-zinc-500 mt-1">Contactos</div>
        </Link>
        <Link href="/servicios" className="rounded-2xl border bg-white p-4 hover:bg-zinc-50">
          <div className="font-semibold">Servicios</div>
          <div className="text-xs text-zinc-500 mt-1">Tiempos y precios</div>
        </Link>
        <Link href="/caja" className="rounded-2xl border bg-white p-4 hover:bg-zinc-50">
          <div className="font-semibold">Caja</div>
          <div className="text-xs text-zinc-500 mt-1">Ingresos y pagos</div>
        </Link>
      </div>
    </main>
  );
}
