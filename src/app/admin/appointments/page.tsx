
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
import { Button } from "@/components/ui/button";
import { getAppointments } from "@/lib/data";
import { completeAppointment, deleteAppointment, exportAppointments } from "@/lib/actions";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Download, Calendar as CalendarIcon, Filter, Loader2, Trash2 } from "lucide-react";
import { useTransition, useState, useEffect, useMemo } from "react";
import type { Appointment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppDashboardButton } from "@/components/whatsapp-dashboard-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "../user-context";

function CompleteButton({ appointmentId, onComplete }: { appointmentId: string, onComplete: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    const handleClick = () => {
        startTransition(async () => {
            await completeAppointment(appointmentId);
            toast({ title: "Turno completado", description: "El turno se ha marcado como completado." });
            onComplete();
        });
    }
    
    return (
        <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
            <Check className="mr-2 h-4 w-4" />
            {isPending ? "Completando..." : "Completado"}
        </Button>
    )
}

function DeleteButton({ appointmentId, onDeleted }: { appointmentId: string, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        if (!window.confirm('¿Eliminar este turno? Esta acción no se puede deshacer.')) {
            return;
        }

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
    if (status === 'confirmed') return 'Confirmado';
    if (status === 'waiting') return 'En espera';
    if (status === 'in_progress') return 'En proceso';
    if (status === 'completed') return 'Terminado';
    if (status === 'cancelled') return 'Cancelado';
    if (status === 'no-show') return 'No asistió';
    if (status === 'facturado') return 'Facturado';
    return status;
};

export default function AppointmentsPage() {
    const { currentUser } = useCurrentUser();
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [date, setDate] = useState<Date>(new Date());
    const [isExporting, startExportTransition] = useTransition();
    const { toast } = useToast();
    
    const fetchAppointments = () => {
        getAppointments().then(setAllAppointments);
    };
    
    useEffect(() => {
        fetchAppointments();
    }, []);

    const filteredAppointments = useMemo(() => {
        return allAppointments
            .filter(appt => {
                const apptDate = new Date(appt.date);
                
                return apptDate.getFullYear() === date.getFullYear() &&
                       apptDate.getMonth() === date.getMonth() &&
                       apptDate.getDate() === date.getDate();
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [allAppointments, date]);

    const filteredConfirmedAppointments = useMemo(
        () => filteredAppointments.filter(appt => appt.status === 'confirmed'),
        [filteredAppointments]
    );

    const canDeleteAppointments = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente' || currentUser?.role === 'Recepcion';

    const canManageExports = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente';

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
                toast({ title: 'Exportación completa', description: 'Los datos de los turnos se han descargado.' });
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error de exportación', description: 'No se pudieron exportar los datos.' });
            }
        });
    };

    return (
        <div className="space-y-6">
        <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle>Turnos Confirmados</CardTitle>
                    <CardDescription>Aquí puedes ver todos los turnos confirmados y marcarlos como completados.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-muted-foreground" />
                        <Label>Filtrar por fecha:</Label>
                    </div>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full md:w-[280px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={es} />
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
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Fecha y Hora</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredConfirmedAppointments.length > 0 ? filteredConfirmedAppointments.map((appt) => (
                            <TableRow key={appt.id}>
                                <TableCell>
                                    <div className="font-medium">{appt.customerName}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {appt.customerEmail}
                                    </div>
                                </TableCell>
                                <TableCell>{(Array.isArray(appt.serviceNames) ? appt.serviceNames.join(', ') : appt.serviceNames)}</TableCell>
                                <TableCell>
                                    {format(new Date(appt.date), "PPP p", { locale: es })}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <WhatsAppDashboardButton appointment={appt} />
                                    <CompleteButton appointmentId={appt.id} onComplete={fetchAppointments} />
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No hay turnos confirmados para esta fecha.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {canDeleteAppointments && (
        <Card>
            <CardHeader>
                <CardTitle>Eliminar Turnos</CardTitle>
                <CardDescription>Sección rápida para eliminar turnos del día seleccionado sin entrar a cada ficha.</CardDescription>
            </CardHeader>
            <CardContent>
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
                        {filteredAppointments.length > 0 ? filteredAppointments.map((appt) => (
                            <TableRow key={`delete-${appt.id}`}>
                                <TableCell>{format(new Date(appt.date), "p", { locale: es })}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{appt.customerName}</div>
                                    <div className="text-sm text-muted-foreground">{appt.customerEmail}</div>
                                </TableCell>
                                <TableCell>{(Array.isArray(appt.serviceNames) ? appt.serviceNames.join(', ') : appt.serviceNames)}</TableCell>
                                <TableCell>
                                    <Badge variant={appt.status === 'cancelled' ? 'destructive' : appt.status === 'completed' || appt.status === 'facturado' ? 'secondary' : 'outline'}>
                                        {getStatusLabel(appt.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DeleteButton appointmentId={appt.id} onDeleted={fetchAppointments} />
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
