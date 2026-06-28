import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Cinzel } from 'next/font/google';
import PushRegistrar from './components/PushRegistrar';

// FFXIV-style engraved-caps display serif for headings (used only by the
// ffxiv-* themes; exposed as a CSS variable).
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#09090b',
};

export const metadata: Metadata = {
  title: 'Zorean Hypertrophy',
  description: 'Science-based hypertrophy tracking',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zorean Hypertrophy',
  },
  icons: {
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cinzel.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Apply saved theme + nav style before paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{
          __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;if(localStorage.getItem('navIcons')==='1')document.documentElement.dataset.navIcons='1';}catch(e){}`
        }} />
      </head>
      <body className="bg-zinc-950 text-white antialiased">
        <PushRegistrar />
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `
        }} />
      </body>
    </html>
  );
}