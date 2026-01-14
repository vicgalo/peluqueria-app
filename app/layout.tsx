import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Peluquería",
  description: "Gestión de peluquería",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png" }, { url: "/icon-512.png" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Peluquería",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Nombre bajo el icono en iOS */}
        <meta name="apple-mobile-web-app-title" content="Peluquería" />

        {/* Splash screens iOS (mínimo recomendado) */}
        {/* iPhone 11 (828x1792) */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/iphone11-828x1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />

        {/* iPhone 11 landscape */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/iphone11-1792x828.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        />
      </head>
      <body className="bg-zinc-50">{children}</body>
    </html>
  );
}
