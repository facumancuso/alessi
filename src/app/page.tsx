import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/icons';
import { LifeBuoy, LogIn } from 'lucide-react';

export default function Home() {
  const whatsappNumber = '2645468801';
  const whatsappMessage = 'Hola, necesito ayuda con el sistema de gestión de turnos.';
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <Logo className="h-12 w-12 text-primary mx-auto" />
          <CardTitle className="text-2xl font-headline">
            Sistema de Gestión de Turnos
          </CardTitle>
          <CardDescription className="text-lg font-bold text-primary">
            Alessi Hairdressing
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild size="lg">
            <Link href="/login">
              <LogIn className="mr-2 h-5 w-5" />
              Iniciar Sesión
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <LifeBuoy className="mr-2 h-5 w-5" />
              Soporte Técnico
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
