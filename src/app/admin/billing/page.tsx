
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
import { useTransition, useState, useEffect } from "react";
import type { Appointment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import dynamic from 'next/dynamic';
const BillingDetailModal = dynamic(() => import('@/components/billing-detail-modal').then(m => m.BillingDetailModal), { ssr: false, loading: () => null });
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
            try {
                await revertAllClientAppointments(appointmentIds);
                toast({ title: "Turno/s revertido/s", description: "El grupo de turnos ha vuelto a la lista de 'Por Cobrar'." });
                onRevert();
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'No se pudo revertir',
                    description: error instanceof Error ? error.message : 'Ocurrio un error al revertir el grupo.',
                });
            }
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
            try {
                await billAllClientAppointments(appointmentIds);
                toast({ title: "Turno/s facturado/s", description: "El grupo de turnos fue marcado como cobrado." });
                onBill();
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'No se pudo facturar',
                    description: error instanceof Error ? error.message : 'Ocurrio un error al facturar el grupo.',
                });
            }
        });
    }

    return (
        <Button size="sm" onClick={handleClick} disabled={isPending}>
            <DollarSign className="mr-2 h-4 w-4" />
            {isPending ? "Facturando..." : "Cobrar"}
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
    if (groups.length === 0) {
        return (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                {emptyMessage}
            </div>
        );
    }

    return (
        <>
            {/* Vista mobile: cards */}
            <div className="flex flex-col divide-y sm:hidden">
                {groups.map((group) => (
                    <div
                        key={group.id}
                        onClick={() => onRowClick(group)}
                        className="cursor-pointer p-4 hover:bg-muted/40 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{group.customerName}</p>
                                <p className="text-sm text-muted-foreground truncate">{group.customerEmail}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                    <span className="text-xs text-muted-foreground">
                                        {format(group.date, "PPP", { locale: es })}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {group.totalServices} servicio(s)
                                    </span>
                                </div>
                            </div>
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                {actionButton(group)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Vista desktop: tabla */}
            <div className="hidden sm:block">
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
                        {groups.map((group) => (
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
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
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
                <CardFooter className="flex justify-between items-center pt-4 px-4 sm:px-6">
                    <span className="text-sm text-muted-foreground">
                        Pág. {currentPage} / {totalPages}
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
                onBill={fetchAppointments}
            />
            <Card>
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle>Facturación</CardTitle>
                    <CardDescription>Gestiona los turnos completados pendientes de facturación y revisa los ya facturados.</CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
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
                                    bill: (group) => (
                                        <BillButton
                                            appointmentIds={group.appointmentIds}
                                            onBill={fetchAppointments}
                                        />
                                    )
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
