import type { Metadata } from 'next';
import { Outfit, DM_Sans } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Alessi Hairdressing - Gestión de Turnos Online',
  description: 'Administra tu agenda, acepta reservas y pagos online. Simplifica la gestión de tu negocio.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${dmSans.variable}`}>
      <head>
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
