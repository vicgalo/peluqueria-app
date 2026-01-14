"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function NavItem({
  href,
  label,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  pathname: string;
  onClick?: () => void;
}) {
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
        active ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-100",
      ].join(" ")}
    >
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cierra el menú móvil al cambiar de ruta
  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header móvil */}
      <div className="md:hidden sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            className="border rounded-xl px-3 py-2 bg-white"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div className="font-semibold">Peluquería</div>
        </div>
      </div>

      {/* Drawer móvil */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl p-4 flex flex-col">
            <div className="flex items-center gap-3 pb-4 border-b">
              <img src="/icon-192.png" alt="Logo" className="h-10 w-10 rounded-xl" />
              <div>
                <div className="font-semibold">Peluquería</div>
                <div className="text-xs text-zinc-500">Gestión</div>
              </div>
              <button className="ml-auto text-zinc-500" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <nav className="py-4 space-y-1">
              <NavItem href="/" label="Inicio" pathname={pathname} onClick={() => setOpen(false)} />
              <NavItem href="/agenda" label="Agenda" pathname={pathname} onClick={() => setOpen(false)} />
              <NavItem href="/citas" label="Citas" pathname={pathname} onClick={() => setOpen(false)} />
              <NavItem href="/clientes" label="Clientes" pathname={pathname} onClick={() => setOpen(false)} />
              <NavItem href="/servicios" label="Servicios" pathname={pathname} onClick={() => setOpen(false)} />
              <NavItem href="/caja" label="Caja" pathname={pathname} onClick={() => setOpen(false)} />
            </nav>

            <button
              className="mt-auto border rounded-xl px-3 py-2 hover:bg-zinc-50"
              onClick={logout}
            >
              Salir
            </button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar escritorio */}
        <aside className="hidden md:flex w-64 min-h-screen border-r bg-white p-4 flex-col">
          <div className="flex items-center gap-3 pb-4 border-b">
            <img src="/icon-192.png" alt="Logo" className="h-10 w-10 rounded-xl" />
            <div>
              <div className="font-semibold">Peluquería</div>
              <div className="text-xs text-zinc-500">Gestión</div>
            </div>
          </div>

          <nav className="py-4 space-y-1">
            <NavItem href="/" label="Inicio" pathname={pathname} />
            <NavItem href="/agenda" label="Agenda" pathname={pathname} />
            <NavItem href="/citas" label="Citas" pathname={pathname} />
            <NavItem href="/clientes" label="Clientes" pathname={pathname} />
            <NavItem href="/servicios" label="Servicios" pathname={pathname} />
            <NavItem href="/caja" label="Caja" pathname={pathname} />
          </nav>

          <button
            className="mt-auto border rounded-xl px-3 py-2 hover:bg-zinc-50"
            onClick={logout}
          >
            Salir
          </button>
        </aside>

        {/* Contenido */}
        <div className="flex-1">
          {/* Header escritorio */}
          <div className="hidden md:block sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-zinc-500">
                {pathname === "/" ? "Inicio" : pathname.replace("/", "").toUpperCase()}
              </div>
              <div className="text-sm text-zinc-400">Peluquería</div>
            </div>
          </div>

          <main className="mx-auto max-w-6xl px-4 md:px-6 py-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
