
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
import { Checkbox } from "@/components/ui/checkbox";
import { getAppointments, getBillingGroupsPaginated } from "@/lib/data";
import { revertAllClientAppointments, billAllClientAppointments } from "@/lib/actions";
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Undo2, Loader2, Banknote, CreditCard } from "lucide-react";
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
    const [pendingMethod, setPendingMethod] = useState<'cash' | 'card' | null>(null);
    const { toast } = useToast();

    const handleClick = (e: React.MouseEvent, method: 'cash' | 'card') => {
        e.stopPropagation();
        setPendingMethod(method);
        startTransition(async () => {
            try {
                await billAllClientAppointments(appointmentIds, method);
                toast({
                    title: "Turno/s facturado/s",
                    description: `Cobrado en ${method === 'cash' ? 'efectivo' : 'tarjeta'}.`,
                });
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
        <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={(e) => handleClick(e, 'cash')} disabled={isPending}>
                {isPending && pendingMethod === 'cash' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                <span className="hidden sm:inline ml-1.5">Efectivo</span>
            </Button>
            <Button size="sm" onClick={(e) => handleClick(e, 'card')} disabled={isPending}>
                {isPending && pendingMethod === 'card' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                <span className="hidden sm:inline ml-1.5">Tarjeta</span>
            </Button>
        </div>
    )
}

function BulkBillBar({ selectedGroups, onBilled, onClear }: { selectedGroups: BillingGroup[], onBilled: () => void, onClear: () => void }) {
    const [isPending, startTransition] = useTransition();
    const [pendingMethod, setPendingMethod] = useState<'cash' | 'card' | null>(null);
    const { toast } = useToast();

    if (selectedGroups.length === 0) return null;

    const appointmentIds = selectedGroups.flatMap(g => g.appointmentIds);

    const handleClick = (method: 'cash' | 'card') => {
        setPendingMethod(method);
        startTransition(async () => {
            try {
                await billAllClientAppointments(appointmentIds, method);
                toast({
                    title: "Turnos facturados",
                    description: `Se cobraron ${selectedGroups.length} cliente(s) en ${method === 'cash' ? 'efectivo' : 'tarjeta'} (${appointmentIds.length} turno(s)).`,
                });
                onClear();
                onBilled();
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'No se pudo facturar el grupo',
                    description: error instanceof Error ? error.message : 'Ocurrio un error al facturar en grupo.',
                });
            }
        });
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-2.5 mb-3">
            <span className="text-sm font-medium">
                {selectedGroups.length} cliente(s) seleccionado(s) &middot; {appointmentIds.length} turno(s)
            </span>
            <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={onClear} disabled={isPending}>
                    Deseleccionar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleClick('cash')} disabled={isPending}>
                    {isPending && pendingMethod === 'cash' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                    Efectivo ({selectedGroups.length})
                </Button>
                <Button size="sm" onClick={() => handleClick('card')} disabled={isPending}>
                    {isPending && pendingMethod === 'card' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Tarjeta ({selectedGroups.length})
                </Button>
            </div>
        </div>
    );
}

function AppointmentsTable({
    groups,
    onRowClick,
    actionButton,
    emptyMessage,
    selection,
}: {
    groups: BillingGroup[],
    onRowClick: (group: BillingGroup) => void,
    actionButton: (group: BillingGroup) => React.ReactNode,
    emptyMessage: string,
    selection?: {
        selectedIds: Set<string>,
        onToggle: (groupId: string) => void,
        onToggleAll: (checked: boolean, groupIds: string[]) => void,
    },
}) {
    const allOnPageSelected = !!selection && groups.length > 0 && groups.every(g => selection.selectedIds.has(g.id));

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {selection && (
                        <TableHead className="w-10">
                            <Checkbox
                                checked={allOnPageSelected}
                                onCheckedChange={(checked) => selection.onToggleAll(!!checked, groups.map(g => g.id))}
                                aria-label="Seleccionar todos"
                            />
                        </TableHead>
                    )}
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groups.length > 0 ? groups.map((group) => (
                    <TableRow key={group.id} onClick={() => onRowClick(group)} className="cursor-pointer">
                        {selection && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={selection.selectedIds.has(group.id)}
                                    onCheckedChange={() => selection.onToggle(group.id)}
                                    aria-label={`Seleccionar turnos de ${group.customerName}`}
                                />
                            </TableCell>
                        )}
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
                        <TableCell colSpan={selection ? 5 : 4} className="h-24 text-center">
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
    isLoading,
    selection,
    serverPaged,
 }: {
    groups: BillingGroup[],
    onRowClick: (group: BillingGroup) => void,
    actionButtons: { [key: string]: (group: BillingGroup) => React.ReactNode },
    emptyMessage: string,
    isLoading: boolean,
    selection?: {
        selectedIds: Set<string>,
        onToggle: (groupId: string) => void,
        onToggleAll: (checked: boolean, groupIds: string[]) => void,
        onSelectAllGroups: () => void,
    },
    // When set, `groups` already IS the current page fetched from the
    // server (grouping+pagination happened in Mongo) instead of the full
    // list to be sliced client-side -- see admin/billing perf fix.
    serverPaged?: {
        page: number,
        totalCount: number,
        onPageChange: (page: number) => void,
    },
}) {
    const [localPage, setLocalPage] = useState(1);

    const currentPage = serverPaged ? serverPaged.page : localPage;
    const totalCount = serverPaged ? serverPaged.totalCount : groups.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
    const paginatedGroups = serverPaged
        ? groups
        : groups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const goToPage = (page: number) => {
        if (serverPaged) serverPaged.onPageChange(page);
        else setLocalPage(page);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    };

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Card>
            {selection && totalCount > 0 && (
                <div className="flex items-center justify-between px-4 pt-4">
                    <span className="text-xs text-muted-foreground">
                        {selection.selectedIds.size > 0
                            ? `${selection.selectedIds.size} de ${totalCount} seleccionados`
                            : `${totalCount} en total`}
                    </span>
                    {totalCount > ITEMS_PER_PAGE && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selection.onSelectAllGroups}>
                            Seleccionar los {totalCount} (todas las páginas)
                        </Button>
                    )}
                </div>
            )}
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
                    selection={selection && {
                        selectedIds: selection.selectedIds,
                        onToggle: selection.onToggle,
                        onToggleAll: selection.onToggleAll,
                    }}
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
    const [loading, setLoading] = useState(true);

    // "Turnos Cobrados" is fetched paginated straight from Mongo (see
    // getBillingGroupsPaginated) -- this list only ever grows, and fetching
    // every billed appointment ever just to show 10 rows was what made the
    // page take ~15s+ to load.
    const [billedGroups, setBilledGroups] = useState<BillingGroup[]>([]);
    const [billedTotal, setBilledTotal] = useState(0);
    const [billedPage, setBilledPage] = useState(1);
    const [billedLoading, setBilledLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<BillingGroup | null>(null);
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

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

    const fetchCompleted = async () => {
        setLoading(true);
        const completedData = await getAppointments('completed');
        setCompletedGroups(groupAppointments(completedData));
        setSelectedGroupIds(new Set());
        setLoading(false);
    };

    const fetchBilled = async (page: number) => {
        setBilledLoading(true);
        const { groups, total } = await getBillingGroupsPaginated({ status: 'facturado', page, pageSize: ITEMS_PER_PAGE });
        setBilledGroups(groups.map(g => ({ ...g, date: new Date(g.date) })));
        setBilledTotal(total);
        setBilledLoading(false);
    };

    useEffect(() => {
        fetchCompleted();
    }, []);

    useEffect(() => {
        fetchBilled(billedPage);
    }, [billedPage]);

    // After billing or reverting a group it moves between the two lists, so
    // both need refreshing; billed jumps back to page 1 since the changed
    // item now sorts to the top of "Cobrados".
    const refreshAfterBilling = () => {
        fetchCompleted();
        if (billedPage === 1) fetchBilled(1); else setBilledPage(1);
    };
    const refreshAfterRevert = () => {
        fetchCompleted();
        fetchBilled(billedPage);
    };

    const handleRowClick = (group: BillingGroup) => {
        setSelectedGroup(group);
        setIsModalOpen(true);
    }

    const toggleGroupSelection = (groupId: string) => {
        setSelectedGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const toggleAllOnPage = (checked: boolean, groupIds: string[]) => {
        setSelectedGroupIds(prev => {
            const next = new Set(prev);
            groupIds.forEach(id => checked ? next.add(id) : next.delete(id));
            return next;
        });
    };

    const selectAllPending = () => {
        setSelectedGroupIds(new Set(completedGroups.map(g => g.id)));
    };

    const selectedPendingGroups = completedGroups.filter(g => selectedGroupIds.has(g.id));

    return (
        <>
            <BillingDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                billingGroup={selectedGroup}
                onBill={refreshAfterBilling}
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
                            <BulkBillBar
                                selectedGroups={selectedPendingGroups}
                                onBilled={refreshAfterBilling}
                                onClear={() => setSelectedGroupIds(new Set())}
                            />
                            <PaginatedAppointmentList
                                groups={completedGroups}
                                onRowClick={handleRowClick}
                                actionButtons={{
                                    bill: (group) => (
                                        <BillButton
                                            appointmentIds={group.appointmentIds}
                                            onBill={refreshAfterBilling}
                                        />
                                    )
                                }}
                                emptyMessage="No hay turnos pendientes de cobro."
                                isLoading={loading}
                                selection={{
                                    selectedIds: selectedGroupIds,
                                    onToggle: toggleGroupSelection,
                                    onToggleAll: toggleAllOnPage,
                                    onSelectAllGroups: selectAllPending,
                                }}
                            />
                        </TabsContent>
                        <TabsContent value="cobrados" className="mt-4">
                            <PaginatedAppointmentList
                                groups={billedGroups}
                                onRowClick={handleRowClick}
                                actionButtons={{
                                    revert: (group) => <RevertButton appointmentIds={group.appointmentIds} onRevert={refreshAfterRevert} />
                                }}
                                emptyMessage="No hay turnos facturados."
                                isLoading={billedLoading}
                                serverPaged={{
                                    page: billedPage,
                                    totalCount: billedTotal,
                                    onPageChange: setBilledPage,
                                }}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </>
    );
}
