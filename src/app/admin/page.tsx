
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
import { completeAppointment, deleteAppointment, exportAppointments, markAppointmentWaiting, startAppointment } from '@/lib/actions';
import { format, isToday, isFuture, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useTransition, useMemo } from "react";
import type { Appointment, User } from "@/lib/types";
import { WhatsAppDashboardButton } from "@/components/whatsapp-dashboard-button";
import { useCurrentUser } from "./user-context";
import { Loader2, Play, Check, Clock, User as UserIcon, Scissors, Download, Trash2, Filter, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { sortEmployeesByAgendaOrder } from "@/lib/employee-order";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";

interface NextAppointmentCardProps {
    appointment: Appointment;
    role?: User['role'];
    onArrive: (id: string) => void;
    onStart: (id: string) => void;
    onComplete: (id: string) => void;
    isProcessing: boolean;
}

function NextAppointmentCard({ appointment, role, onArrive, onStart, onComplete, isProcessing }: NextAppointmentCardProps) {
    const appointmentDate = new Date(appointment.date);
    const canMarkArrival = (role === 'Recepcion' || role === 'Gerente' || role === 'Superadmin') && appointment.status === 'confirmed';
    const canStart = (role === 'Peluquero' || role === 'Gerente' || role === 'Superadmin') && appointment.status === 'waiting';
    const canComplete = (role === 'Peluquero' || role === 'Gerente' || role === 'Superadmin') && appointment.status === 'in_progress';

    return (
        <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <UserIcon className="h-4 w-4 text-muted-foreground"/>
                    {appointment.employeeName}
                </div>
                <div className="space-y-1.5">
                    <p className="flex items-center gap-2 text-base font-bold text-foreground"><Clock className="h-4 w-4"/> {format(appointmentDate, "p", { locale: es })}</p>
                    <Button variant="link" asChild className="h-auto p-0">
                        <Link href={`/admin/clients/${encodeURIComponent(appointment.customerEmail)}`} className="flex items-center gap-2 text-sm font-medium">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground"/> {appointment.customerName}
                        </Link>
                    </Button>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Scissors className="h-3.5 w-3.5"/> {(Array.isArray(appointment.serviceNames) ? appointment.serviceNames.join(', ') : appointment.serviceNames)}</p>
                </div>
            </div>
            {(canMarkArrival || canStart || canComplete) && (
                <div className="flex w-full flex-wrap gap-2">
                    {canMarkArrival && (
                        <Button className="h-8 w-full text-xs" variant="outline" onClick={() => onArrive(appointment.id)} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Clock className="h-4 w-4" />}
                            <span className="ml-2">En espera</span>
                        </Button>
                    )}
                    {canStart && (
                    <Button className="h-8 w-full text-xs" variant="outline" onClick={() => onStart(appointment.id)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4" />}
                        <span className="ml-2">Iniciar</span>
                    </Button>
                    )}
                    {canComplete && (
                    <Button className="h-8 w-full text-xs" onClick={() => onComplete(appointment.id)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                        <span className="ml-2">Finalizar</span>
                    </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function DeleteButton({ appointmentId, onDeleted }: { appointmentId: string, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        if (!window.confirm('¿Eliminar este turno? Esta acción no se puede deshacer.')) return;
        startTransition(async () => {
            const result = await deleteAppointment(appointmentId);
            if (result.success) {
                toast({ title: 'Turno eliminado', description: 'El turno fue eliminado correctamente.' });
                onDeleted();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };

    return (
        <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Eliminar
        </Button>
    );
}

const getStatusLabel = (status: Appointment['status']) => {
    const map: Record<string, string> = {
        confirmed: 'Confirmado', waiting: 'En Espera', in_progress: 'En Proceso',
        completed: 'Finalizado', cancelled: 'Cancelado', 'no-show': 'No Presentado', facturado: 'Facturado'
    };
    return map[status] ?? status;
};

const getStatusVariant = (status: Appointment['status']): "default" | "secondary" | "destructive" | "outline" => {
    if (status === 'in_progress' || status === 'waiting') return 'default';
    if (status === 'completed' || status === 'facturado') return 'secondary';
    if (status === 'cancelled' || status === 'no-show') return 'destructive';
    return 'outline';
};

export default function DashboardPage() {
    const { currentUser } = useCurrentUser();
    const { toast } = useToast();
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [allEmployees, setAllEmployees] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, startTransition] = useTransition();
    const [isExporting, startExportTransition] = useTransition();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchPageData = () => {
        setLoading(true);
        Promise.all([getAppointments(), getUsers()]).then(([appointments, users]) => {
            setAllAppointments(appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            setAllEmployees(sortEmployeesByAgendaOrder(users.filter(u => u.role === 'Peluquero' && u.isActive)));
            setLoading(false);
        });
    };

    useEffect(() => { fetchPageData(); }, [currentUser]);

    const selectedDateAppointments = useMemo(() =>
        allAppointments.filter(appt => isSameDay(new Date(appt.date), selectedDate)),
        [allAppointments, selectedDate]
    );

    const todayAppointments = useMemo(() =>
        allAppointments.filter(appt => isToday(new Date(appt.date))),
        [allAppointments]
    );

    const nextAppointmentsByEmployee = useMemo(() => {
        const nextAppointments: Record<string, Appointment> = {};
        const activeStatuses: Appointment['status'][] = ['confirmed', 'waiting', 'in_progress'];
        allEmployees.forEach(employee => {
            const nextAppt = todayAppointments.find(appt =>
                (appt.assignments || []).some(a => a.employeeId === employee.id) &&
                activeStatuses.includes(appt.status) &&
                (appt.status !== 'confirmed' || isFuture(new Date(appt.date)))
            );
            if (nextAppt && !nextAppointments[nextAppt.id]) {
                nextAppointments[nextAppt.id] = nextAppt;
            }
        });
        return Object.values(nextAppointments);
    }, [todayAppointments, allEmployees, now]);

    const handleArrival = (id: string) => {
        startTransition(async () => {
            await markAppointmentWaiting(id);
            toast({ title: "Cliente en espera", description: "Empleados notificados en el panel." });
            fetchPageData();
        });
    };

    const handleStart = (id: string) => {
        startTransition(async () => {
            await startAppointment(id);
            toast({ title: "Turno iniciado" });
            fetchPageData();
        });
    };

    const handleComplete = (id: string) => {
        startTransition(async () => {
            await completeAppointment(id);
            toast({ title: "Turno completado" });
            fetchPageData();
        });
    };

    const handleExport = () => {
        startExportTransition(async () => {
            try {
                const csvData = await exportAppointments();
                const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'turnos.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'Exportación completa' });
            } catch {
                toast({ variant: 'destructive', title: 'Error de exportación' });
            }
        });
    };

    const currentRole = currentUser?.role;
    const canDeleteAppointments = currentRole === 'Superadmin' || currentRole === 'Gerente' || currentRole === 'Recepcion';
    const canManageExports = currentRole === 'Superadmin' || currentRole === 'Gerente';
    const viewingToday = isToday(selectedDate);
    const summary = useMemo(() => {
        const source = selectedDateAppointments;
        return {
            total: source.length,
            confirmed: source.filter(a => a.status === 'confirmed').length,
            waiting: source.filter(a => a.status === 'waiting').length,
            inProgress: source.filter(a => a.status === 'in_progress').length,
        };
    }, [selectedDateAppointments]);

    if (loading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="salon-shell myday-shell space-y-5 pb-10">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Turnos</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{summary.total}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confirmados</p>
                    <p className="mt-1 text-xl font-bold text-sky-700">{summary.confirmed}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">En espera</p>
                    <p className="mt-1 text-xl font-bold text-amber-700">{summary.waiting}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">En proceso</p>
                    <p className="mt-1 text-xl font-bold text-emerald-700">{summary.inProgress}</p>
                </div>
            </div>

            {/* Próximos turnos por peluquero — solo hoy */}
            {viewingToday && (
                <Card className="rounded-lg border bg-card shadow-sm">
                    <CardHeader className="px-4 py-3.5">
                        <CardTitle>Próximos Turnos por Peluquero</CardTitle>
                        <CardDescription>Visualiza el siguiente turno para cada peluquero y gestiona su estado.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                        {nextAppointmentsByEmployee.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {nextAppointmentsByEmployee.map(appt => (
                                    <NextAppointmentCard
                                        key={appt.id}
                                        appointment={appt}
                                        role={currentRole}
                                        onArrive={handleArrival}
                                        onStart={handleStart}
                                        onComplete={handleComplete}
                                        isProcessing={isProcessing}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                                <p>No hay más turnos confirmados para hoy.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Agenda del día con selector de fecha */}
            <Card className="rounded-lg border bg-card shadow-sm">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-4 py-3.5">
                    <div>
                        <CardTitle>Agenda</CardTitle>
                        <CardDescription>
                            Turnos para el {format(selectedDate, 'PPP', { locale: es })}.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Label>Fecha:</Label>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full md:w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(selectedDate, "PPP", { locale: es })}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus locale={es} />
                            </PopoverContent>
                        </Popover>
                        {canManageExports && (
                            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Exportar
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
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
                            {selectedDateAppointments.length > 0 ? selectedDateAppointments.map((appt) => (
                                <TableRow key={appt.id} className={cn(appt.status === 'in_progress' && 'bg-primary/10 font-bold')}>
                                    <TableCell>{format(new Date(appt.date), "p", { locale: es })}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{appt.customerName}</div>
                                    </TableCell>
                                    <TableCell>{Array.isArray(appt.serviceNames) ? appt.serviceNames.join(', ') : appt.serviceNames}</TableCell>
                                    <TableCell>{appt.employeeName}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(appt.status)} className={cn(appt.status === 'waiting' && 'animate-pulse')}>
                                            {getStatusLabel(appt.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {appt.status === 'confirmed' && <WhatsAppDashboardButton appointment={appt} />}
                                        {(currentRole === 'Recepcion' || currentRole === 'Gerente' || currentRole === 'Superadmin') && appt.status === 'confirmed' && (
                                            <Button size="sm" variant="outline" onClick={() => handleArrival(appt.id)} disabled={isProcessing}>
                                                <Clock className="mr-2 h-4 w-4" /> En espera
                                            </Button>
                                        )}
                                        {(currentRole === 'Peluquero' || currentRole === 'Gerente' || currentRole === 'Superadmin') && appt.status === 'waiting' && (
                                            <Button size="sm" variant="outline" onClick={() => handleStart(appt.id)} disabled={isProcessing}>
                                                <Play className="mr-2 h-4 w-4" /> Iniciar
                                            </Button>
                                        )}
                                        {(currentRole === 'Peluquero' || currentRole === 'Gerente' || currentRole === 'Superadmin') && appt.status === 'in_progress' && (
                                            <Button size="sm" onClick={() => handleComplete(appt.id)} disabled={isProcessing}>
                                                <Check className="mr-2 h-4 w-4" /> Finalizar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        No hay turnos para esta fecha.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Eliminar turnos */}
            {canDeleteAppointments && (
                <Card className="rounded-lg border bg-card shadow-sm">
                    <CardHeader className="px-4 py-3.5">
                        <CardTitle>Eliminar Turnos</CardTitle>
                        <CardDescription>Eliminación rápida de turnos del día seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Servicio</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedDateAppointments.length > 0 ? selectedDateAppointments.map((appt) => (
                                    <TableRow key={`del-${appt.id}`}>
                                        <TableCell>{format(new Date(appt.date), "p", { locale: es })}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{appt.customerName}</div>
                                            <div className="text-sm text-muted-foreground">{appt.customerEmail}</div>
                                        </TableCell>
                                        <TableCell>{Array.isArray(appt.serviceNames) ? appt.serviceNames.join(', ') : appt.serviceNames}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(appt.status)}>{getStatusLabel(appt.status)}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DeleteButton appointmentId={appt.id} onDeleted={fetchPageData} />
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No hay turnos para eliminar en esta fecha.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
