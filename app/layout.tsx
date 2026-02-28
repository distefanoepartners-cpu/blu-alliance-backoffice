import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563EB',
}

export const metadata: Metadata = {
  title: "Blu Alliance - Backoffice",
  description: "Sistema di gestione prenotazioni marittime Blu Alliance",
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Blu Alliance',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: `
          // Registra SW minimale (per installabilità PWA) e pulisci cache vecchie
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(function(reg) {
              console.log('[SW] Registrato');
            }).catch(function(err) {
              console.log('[SW] Errore:', err);
            });
            // Pulisci cache residue di next-pwa
            caches.keys().then(function(names) {
              names.forEach(function(name) { 
                if (name.startsWith('workbox-') || name.startsWith('next-')) {
                  caches.delete(name);
                }
              });
            });
          }
        `}} />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}