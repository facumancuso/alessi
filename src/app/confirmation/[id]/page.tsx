
import Link from 'next/link';
import { CheckCircle, Calendar, Clock, User, Mail, Tag, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAppointmentById, getServiceById } from '@/lib/data';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, Service } from '@/lib/types';

type ConfirmationAppointment = Omit<Appointment, 'date'> & { date: Date };

function generateGoogleCalendarLink(appointment: ConfirmationAppointment, services: Service[]) {
    if (!appointment || !services || services.length === 0) return '';

    const startTime = new Date(appointment.date);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const endTime = new Date(startTime.getTime() + totalDuration * 60000);

    const
        formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');

    const url = new URL('https://www.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', `Turno: ${services.map(s => s.name).join(', ')}`);
    url.searchParams.set('dates', `${formatDate(startTime)}/${formatDate(endTime)}`);
    url.searchParams.set('details', `Detalles del turno:\nCliente: ${appointment.customerName}\nServicio: ${services.map(s => s.name).join(', ')}\n\nConfirmado a través de Alessi Hairdressing.`);
    url.searchParams.set('location', 'Alessi Hairdressing');

    return url.toString();
}


export default async function ConfirmationPage({ params }: { params: { id: string } }) {
    const appointmentData = await getAppointmentById(params.id);
    if (!appointmentData) {
        notFound();
    }
    
    // Re-create the date object on the server component
        const appointment: ConfirmationAppointment = {
        ...appointmentData,
        date: new Date(appointmentData.date)
    };

        const serviceIds = appointmentData.serviceIds?.length
            ? appointmentData.serviceIds
            : (appointmentData.assignments?.map(a => a.serviceId) ?? []);

        const services = await Promise.all(serviceIds.map(id => getServiceById(id))).then(res => res.filter(Boolean) as Service[]);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
    const calendarLink = generateGoogleCalendarLink(appointment, services);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="items-center text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-3xl font-headline">¡Tu turno está confirmado!</CardTitle>
          <CardDescription>
            El pago fue exitoso. Hemos enviado un email de confirmación a {appointment.customerEmail}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3 bg-background">
                <h3 className="font-semibold text-lg">Detalles de la Reserva</h3>
                <div className="flex items-center gap-3"><User className="h-5 w-5 text-primary" /><p>{appointment.customerName}</p></div>
                <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-primary" /><p>{appointment.customerEmail}</p></div>
                <div className="flex items-center gap-3"><Tag className="h-5 w-5 text-primary" /><p>{services.map(s => s.name).join(', ')} (${totalPrice / 100})</p></div>
                <div className="flex items-center gap-3"><Calendar className="h-5 w-5 text-primary" /><p>{format(appointment.date, 'eeee, dd MMMM yyyy', { locale: es })}</p></div>
                <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-primary" /><p>{format(appointment.date, 'p', { locale: es })} hs</p></div>
            </div>

            <Button asChild className="w-full">
                <a href={calendarLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2" />
                    Agregar a Google Calendar
                </a>
            </Button>
            
            <p className="text-sm text-muted-foreground text-center">
                Si necesitas cancelar o reprogramar, contáctanos.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/cancel/${appointment.id}`}>Cancelar Turno</Link>
                </Button>
                <Button className="w-full bg-accent hover:bg-accent/90" asChild>
                    <Link href="/">Reservar Otro Turno</Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

    