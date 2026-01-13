import "./globals.css";

export const metadata = {
  title: "Peluquería",
  description: "Gestión de peluquería",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-zinc-50">{children}</body>
    </html>
  );
}
