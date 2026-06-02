// app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'Hypertrophy Tracker',
  description: 'Science-based hypertrophy tracking',
  manifest: '/manifest.json',
  themeColor: '#09090b',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hypertrophy',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}