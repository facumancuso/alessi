
'use client';
import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, XCircle, Calendar, Tag, Clock } from 'lucide-react';
import { getAppointmentById } from '@/lib/data';
import { cancelBooking } from '@/lib/actions';
import type { Appointment } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function CancelPage({ params }: { params: { id: string } }) {
    const [appointment, setAppointment] = useState<Appointment | null | undefined>(undefined);
    const [isCancelled, setIsCancelled] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        getAppointmentById(params.id).then(setAppointment);
    }, [params.id]);

    const handleCancel = () => {
        startTransition(async () => {
            const result = await cancelBooking(params.id);
            if (result.success) {
                setIsCancelled(true);
                toast({
                    title: "Turno cancelado",
                    description: result.message,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.message,
                });
            }
        });
    };

    if (appointment === undefined) {
        return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (appointment === null) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card>
                    <CardHeader>
                        <CardTitle>Turno no encontrado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>No se pudo encontrar el turno solicitado.</p>
                        <Button asChild className="mt-4"><Link href="/">Volver al inicio</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (appointment.status === 'cancelled' || isCancelled) {
         return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="w-full max-w-md">
                    <CardHeader className="items-center text-center">
                        <XCircle className="h-16 w-16 text-destructive mb-4" />
                        <CardTitle className="text-2xl font-headline">Turno ya cancelado</CardTitle>
                        <CardDescription>Este turno ya ha sido cancelado. El horario ha sido liberado.</CardDescription>
                    </CardHeader>
                     <CardContent>
                         <Button asChild className="w-full bg-accent hover:bg-accent/90"><Link href="/">Reservar un nuevo turno</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const appointmentDate = new Date(appointment.date);

    return (
        <div className="flex items-center justify-center min-h-screen bg-secondary/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline">Cancelar Turno</CardTitle>
                    <CardDescription>¿Estás seguro de que deseas cancelar tu turno?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant="destructive">
                        <AlertTitle>Detalles del Turno a Cancelar</AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                            <p className="flex items-center gap-2"><Tag className="h-4 w-4" /> {(appointment.serviceNames || []).join(', ')}</p>
                            <p className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {format(appointmentDate, 'eeee, dd MMMM yyyy', { locale: es })}</p>
                            <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> {format(appointmentDate, 'p', { locale: es })} hs</p>
                        </AlertDescription>
                    </Alert>
                    <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer. El horario se liberará para otros clientes.</p>
                    <div className="flex gap-2">
                        <Button variant="outline" className="w-full" asChild>
                            <Link href="/">No, volver</Link>
                        </Button>
                        <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, cancelar turno"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
