import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Peluquería",
  description: "Gestión de peluquería",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen bg-zinc-50">
          <header className="border-b bg-white">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
              <div className="font-semibold">Peluquería</div>

              <nav className="flex gap-3 text-sm">
                <a className="hover:underline" href="/agenda">Agenda</a>
                <a className="hover:underline" href="/clientes">Clientes</a>
                <a className="hover:underline" href="/servicios">Servicios</a>
                <a className="hover:underline" href="/caja">Caja</a>
                <a className="hover:underline" href="/importar">Importar</a>
              </nav>

              <div className="ml-auto text-sm text-zinc-500">Local</div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
