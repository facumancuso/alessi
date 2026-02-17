
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
    CardFooter,
  } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAppointments } from "@/lib/data";
import { revertAllClientAppointments, billAllClientAppointments } from "@/lib/actions";
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Undo2, DollarSign, Loader2 } from "lucide-react";
import { useTransition, useState, useEffect, useMemo } from "react";
import type { Appointment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { BillingDetailModal } from "@/components/billing-detail-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ITEMS_PER_PAGE = 10;

interface BillingGroup {
    id: string;
    customerName: string;
    customerEmail: string;
    date: Date;
    appointments: Appointment[];
    appointmentIds: string[];
    totalServices: number;
}

function RevertButton({ appointmentIds, onRevert }: { appointmentIds: string[], onRevert: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        startTransition(async () => {
            await revertAllClientAppointments(appointmentIds);
            toast({ title: "Turno/s revertido/s", description: "El grupo de turnos ha vuelto a la lista de 'Por Cobrar'." });
            onRevert();
        });
    }

    return (
        <Button size="sm" variant="ghost" onClick={handleClick} disabled={isPending}>
            <Undo2 className="mr-2 h-4 w-4" />
            {isPending ? "Revirtiendo..." : "Revertir"}
        </Button>
    )
}

function BillButton({ appointmentIds, onBill }: { appointmentIds: string[], onBill: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        startTransition(async () => {
            await billAllClientAppointments(appointmentIds);
            toast({ title: "Turno/s Facturado/s", description: "El grupo de turnos se ha movido a la lista de 'Cobrados'." });
            onBill();
        });
    }

    return (
        <Button size="sm" onClick={handleClick} disabled={isPending}>
            <DollarSign className="mr-2 h-4 w-4" />
            {isPending ? "Facturando..." : "Facturar"}
        </Button>
    )
}

function AppointmentsTable({ 
    groups, 
    onRowClick, 
    actionButton,
    emptyMessage 
}: { 
    groups: BillingGroup[], 
    onRowClick: (group: BillingGroup) => void,
    actionButton: (group: BillingGroup) => React.ReactNode,
    emptyMessage: string,
}) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groups.length > 0 ? groups.map((group) => (
                    <TableRow key={group.id} onClick={() => onRowClick(group)} className="cursor-pointer">
                        <TableCell>
                            <div className="font-medium">{group.customerName}</div>
                            <div className="text-sm text-muted-foreground">
                                {group.customerEmail}
                            </div>
                        </TableCell>
                        <TableCell>{group.totalServices} servicio(s)</TableCell>
                        <TableCell>
                            {format(group.date, "PPP", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                           {actionButton(group)}
                        </TableCell>
                    </TableRow>
                )) : (
                     <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            {emptyMessage}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

function PaginatedAppointmentList({ 
    groups, 
    onRowClick,
    actionButtons,
    emptyMessage,
    isLoading
 }: { 
    groups: BillingGroup[],
    onRowClick: (group: BillingGroup) => void,
    actionButtons: { [key: string]: (group: BillingGroup) => React.ReactNode },
    emptyMessage: string,
    isLoading: boolean,
}) {
    const [currentPage, setCurrentPage] = useState(1);
    
    const totalPages = Math.ceil(groups.length / ITEMS_PER_PAGE);
    const paginatedGroups = groups.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Card>
            <CardContent className="p-0">
                <AppointmentsTable 
                    groups={paginatedGroups}
                    onRowClick={onRowClick}
                    actionButton={(group) => (
                        <>
                            {actionButtons.revert && actionButtons.revert(group)}
                            {actionButtons.bill && actionButtons.bill(group)}
                        </>
                    )}
                    emptyMessage={emptyMessage}
                />
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex justify-between items-center pt-4">
                    <span className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                        </Button>
                    </div>
                </CardFooter>
            )}
        </Card>
    );
}


export default function BillingPage() {
    const [completedGroups, setCompletedGroups] = useState<BillingGroup[]>([]);
    const [billedGroups, setBilledGroups] = useState<BillingGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<BillingGroup | null>(null);
    
    const groupAppointments = (appointments: Appointment[]): BillingGroup[] => {
        const grouped = appointments.reduce((acc, appt) => {
            const apptDate = startOfDay(new Date(appt.date));
            const key = `${appt.customerEmail}-${apptDate.toISOString()}`;
            if (!acc[key]) {
                acc[key] = {
                    id: key,
                    customerName: appt.customerName,
                    customerEmail: appt.customerEmail,
                    date: apptDate,
                    appointments: [],
                    appointmentIds: [],
                    totalServices: 0,
                };
            }
            acc[key].appointments.push(appt);
            acc[key].appointmentIds.push(appt.id);
            acc[key].totalServices += (appt.assignments || []).length;
            return acc;
        }, {} as Record<string, BillingGroup>);

        return Object.values(grouped).sort((a,b) => b.date.getTime() - a.date.getTime());
    };

    const fetchAppointments = async () => {
        setLoading(true);
        const [completedData, billedData] = await Promise.all([
            getAppointments('completed'),
            getAppointments('facturado')
        ]);
        
        setCompletedGroups(groupAppointments(completedData));
        setBilledGroups(groupAppointments(billedData));
        setLoading(false);
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const handleRowClick = (group: BillingGroup) => {
        setSelectedGroup(group);
        setIsModalOpen(true);
    }
    
    return (
        <>
            <BillingDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                billingGroup={selectedGroup}
            />
            <Card>
                 <CardHeader>
                    <CardTitle>Facturación</CardTitle>
                    <CardDescription>Gestiona los turnos completados pendientes de facturación y revisa los ya facturados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="por-cobrar">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="por-cobrar">Turnos por Cobrar</TabsTrigger>
                            <TabsTrigger value="cobrados">Turnos Cobrados</TabsTrigger>
                        </TabsList>
                        <TabsContent value="por-cobrar" className="mt-4">
                            <PaginatedAppointmentList
                                groups={completedGroups}
                                onRowClick={handleRowClick}
                                actionButtons={{
                                    bill: (group) => <BillButton appointmentIds={group.appointmentIds} onBill={fetchAppointments} />
                                }}
                                emptyMessage="No hay turnos pendientes de cobro."
                                isLoading={loading}
                            />
                        </TabsContent>
                        <TabsContent value="cobrados" className="mt-4">
                            <PaginatedAppointmentList
                                groups={billedGroups}
                                onRowClick={handleRowClick}
                                actionButtons={{
                                    revert: (group) => <RevertButton appointmentIds={group.appointmentIds} onRevert={fetchAppointments} />
                                }}
                                emptyMessage="No hay turnos facturados."
                                isLoading={loading}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </>
    );
}
