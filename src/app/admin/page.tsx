
'use client'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAppointments, getUsers } from "@/lib/data";
import { format, isToday, isFuture, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useTransition, useMemo } from "react";
import type { Appointment, User } from "@/lib/types";
import { WhatsAppDashboardButton } from "@/components/whatsapp-dashboard-button";
import { useCurrentUser } from "./user-context";
import { Loader2, Play, Check, Clock, User as UserIcon, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startAppointment, completeAppointment } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface NextAppointmentCardProps {
    appointment: Appointment;
    onStart: (id: string) => void;
    onComplete: (id: string) => void;
    isProcessing: boolean;
    canManageStatus: boolean;
}

function NextAppointmentCard({ appointment, onStart, onComplete, isProcessing, canManageStatus }: NextAppointmentCardProps) {
    const appointmentDate = new Date(appointment.date);
    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border p-4 rounded-lg">
            <div className="space-y-2">
                <p className="flex items-center gap-2 font-bold text-base"><UserIcon className="h-5 w-5 text-primary"/> {appointment.employeeName}</p>
                <div className="pl-7 space-y-1">
                    <p className="flex items-center gap-2 font-semibold text-lg"><Clock className="h-5 w-5"/> {format(appointmentDate, "p", { locale: es })}</p>
                    <Button variant="link" asChild className="p-0 h-auto -ml-1">
                        <Link href={`/admin/clients/${encodeURIComponent(appointment.customerEmail)}`} className="flex items-center gap-2 text-base">
                            <UserIcon className="h-4 w-4 text-muted-foreground"/> {appointment.customerName}
                        </Link>
                    </Button>
                    <p className="flex items-center gap-2 text-sm"><Scissors className="h-4 w-4 text-muted-foreground"/> {(Array.isArray(appointment.serviceNames) ? appointment.serviceNames.join(', ') : appointment.serviceNames)}</p>
                </div>
            </div>
            {canManageStatus && (
                <div className="flex gap-2 w-full md:w-auto self-end">
                    <Button className="w-full" variant="outline" onClick={() => onStart(appointment.id)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4" />}
                        <span className="ml-2">Iniciar</span>
                    </Button>
                    <Button className="w-full" onClick={() => onComplete(appointment.id)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                        <span className="ml-2">Finalizar</span>
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    const { currentUser } = useCurrentUser();
    const { toast } = useToast();
    const [dailyAppointments, setDailyAppointments] = useState<Appointment[]>([]);
    const [allEmployees, setAllEmployees] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

     useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000); // Actualiza cada minuto
        return () => clearInterval(timer);
    }, []);

    const fetchPageData = () => {
        setLoading(true);
        Promise.all([
            getAppointments(),
            getUsers()
        ]).then(([allAppointments, allUsers]) => {
            const todayAppointments = allAppointments
                .filter(appt => isToday(new Date(appt.date)))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            setDailyAppointments(todayAppointments);
            setAllEmployees(allUsers.filter(u => u.role === 'Peluquero' && u.isActive));
            setLoading(false);
        });
    }

    useEffect(() => {
        fetchPageData();
    }, [currentUser]);

    const nextAppointmentsByEmployee = useMemo(() => {
        const nextAppointments: Record<string, Appointment> = {};

        allEmployees.forEach(employee => {
            const nextAppt = dailyAppointments.find(appt => 
                (appt.assignments || []).some(a => a.employeeId === employee.id) &&
                appt.status === 'confirmed' && 
                isFuture(new Date(appt.date))
            );
            if (nextAppt) {
                if (!nextAppointments[nextAppt.id]) {
                    nextAppointments[nextAppt.id] = nextAppt;
                }
            }
        });

        return Object.values(nextAppointments);
    }, [dailyAppointments, allEmployees, now]);


    const handleStartAppointment = (id: string) => {
        startTransition(async () => {
            await startAppointment(id);
            toast({ title: "Turno iniciado", description: "El turno ha sido marcado como 'En Proceso'." });
            fetchPageData();
        });
    }

    const handleCompleteAppointment = (id: string) => {
        startTransition(async () => {
            await completeAppointment(id);
            toast({ title: "Turno completado", description: "El turno ha sido marcado como 'Finalizado'." });
            fetchPageData();
        });
    }
    
    type DisplayStatus = 'Confirmado' | 'En Espera' | 'En Proceso' | 'Finalizado' | 'Cancelado' | 'No Presentado' | 'Facturado';

    const getDisplayStatus = (appt: Appointment): DisplayStatus => {
        const minutesToAppt = differenceInMinutes(new Date(appt.date), now);

        if (appt.status === 'completed') return 'Finalizado';
        if (appt.status === 'cancelled') return 'Cancelado';
        if (appt.status === 'no-show') return 'No Presentado';
        if (appt.status === 'facturado') return 'Facturado';
        if (appt.status === 'waiting') return 'En Proceso';

        if (appt.status === 'confirmed' && minutesToAppt <= 15 && minutesToAppt > -60) {
            // Consideramos 'En Espera' desde 15 mins antes hasta 60 mins después de la hora del turno si no ha iniciado
            return 'En Espera';
        }
        
        return 'Confirmado';
    };


    const getStatusVariant = (status: DisplayStatus): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'En Proceso': return 'default';
            case 'En Espera': return 'default';
            case 'Finalizado': return 'secondary';
            case 'Facturado': return 'secondary';
            case 'Cancelado': return 'destructive';
            case 'No Presentado': return 'destructive';
            default: return 'outline';
        }
    }


    const canManageStatus = currentUser?.role !== 'Recepcion';

    if (loading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Próximos Turnos por Peluquero</CardTitle>
                    <CardDescription>Visualiza el siguiente turno para cada peluquero y gestiona su estado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {nextAppointmentsByEmployee.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {nextAppointmentsByEmployee.map(appt => (
                                <NextAppointmentCard 
                                    key={appt.id}
                                    appointment={appt}
                                    onStart={handleStartAppointment}
                                    onComplete={handleCompleteAppointment}
                                    isProcessing={isProcessing}
                                    canManageStatus={canManageStatus}
                                />
                            ))}
                        </div>
                    ) : (
                         <div className="text-center text-muted-foreground p-4 border rounded-lg">
                            <p>No hay más turnos confirmados para hoy.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Agenda del Día</CardTitle>
                    <CardDescription>Aquí puedes ver todos los turnos para hoy, {format(new Date(), 'PPP', { locale: es })}.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hora</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Servicio</TableHead>
                                <TableHead>Peluquero</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dailyAppointments.length > 0 ? dailyAppointments.map((appt) => {
                                const displayStatus = getDisplayStatus(appt);
                                return (
                                <TableRow key={appt.id} className={cn(displayStatus === 'En Proceso' && 'bg-primary/10 font-bold')}>
                                    <TableCell>
                                        {format(new Date(appt.date), "p", { locale: es })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{appt.customerName}</div>
                                    </TableCell>
                                    <TableCell>{(Array.isArray(appt.serviceNames) ? appt.serviceNames.join(', ') : appt.serviceNames)}</TableCell>
                                    <TableCell>{appt.employeeName}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(displayStatus)} className={cn(displayStatus === 'En Espera' && 'animate-pulse')}>
                                            {displayStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {appt.status === 'confirmed' && <WhatsAppDashboardButton appointment={appt} />}
                                        {canManageStatus && appt.status === 'waiting' && (
                                            <Button size="sm" onClick={() => handleCompleteAppointment(appt.id)} disabled={isProcessing}>
                                                <Check className="mr-2 h-4 w-4" />
                                                Finalizar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                                )
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        No hay turnos para hoy.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
