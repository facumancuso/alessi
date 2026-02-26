'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getProducts, getServices, getUsers } from '@/lib/data';
import { batchCreateAppointments } from '@/lib/actions';
import type { Client, Product, Service, User, AppointmentAssignment } from '@/lib/types';
import { ArrowLeft, CalendarIcon, Loader2, PlusCircle, Save, Trash2, X, Search, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ClientSearchModal } from '@/components/client-search-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FastAssignment = AppointmentAssignment & {
    assignmentId: number;
    notes?: string;
    productIds?: string[];
    productSearchOpen?: boolean;
    serviceSearchOpen?: boolean;
    serviceSearchTerm?: string;
};

type AppointmentRow = {
    rowId: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    assignments?: FastAssignment[];
};


let rowIdCounter = 0;
let assignmentIdCounter = 0;

export default function FastEntryPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [rows, setRows] = useState<AppointmentRow[]>([{ rowId: rowIdCounter++, assignments: [] }]);

    const [allEmployees, setAllEmployees] = useState<User[]>([]);
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [currentRowIdForClient, setCurrentRowIdForClient] = useState<number | null>(null);

    useEffect(() => {
        setIsLoadingData(true);
        Promise.all([
            getUsers().then(users => users.filter(u => u.role === 'Peluquero' && u.isActive)),
            getServices(),
            getProducts(),
        ]).then(([employees, services, products]) => {
            setAllEmployees(employees);
            setAllServices(services);
            setAllProducts(products);
            setIsLoadingData(false);
        });
    }, []);

    const createNewAssignment = (defaultEmployeeId?: string): FastAssignment => ({
        assignmentId: assignmentIdCounter++,
        serviceId: '',
        employeeId: defaultEmployeeId || '',
        time: '',
        duration: 30,
        productIds: [],
        notes: '',
        productSearchOpen: false,
        serviceSearchOpen: false,
        serviceSearchTerm: '',
    });

    const handleAddRow = () => {
        const defaultEmployeeId = allEmployees[0]?.id;
        setRows(prevRows => [...prevRows, { rowId: rowIdCounter++, assignments: [createNewAssignment(defaultEmployeeId)] }]);
    };

    const handleRemoveRow = (rowId: number) => {
        setRows(prevRows => prevRows.filter(row => row.rowId !== rowId));
    };

    const handleRowChange = (rowId: number, updates: Partial<AppointmentRow>) => {
        setRows(prevRows => prevRows.map(row => row.rowId === rowId ? { ...row, ...updates } : row));
    };
    
    const handleClientSelect = (client: Partial<Client>) => {
        if (currentRowIdForClient === null) return;
        handleRowChange(currentRowIdForClient, {
            customerName: client.name,
            customerEmail: client.email || '',
            customerPhone: client.mobilePhone || '',
        });
        setIsClientModalOpen(false);
        setCurrentRowIdForClient(null);
    }
    
    const openClientSearch = (rowId: number) => {
        setCurrentRowIdForClient(rowId);
        setIsClientModalOpen(true);
    }


    const handleSaveAll = () => {
        if (!date) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona una fecha.' });
            return;
        }
        
        const validRows = rows.filter(r => r.customerName && r.assignments && r.assignments.length > 0);
        const hasInvalidAssignments = validRows.some(row =>
            (row.assignments || []).some(assignment => !assignment.serviceId || !assignment.employeeId || !assignment.time)
        );
        
        if(validRows.length !== rows.length || hasInvalidAssignments) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Completa Cliente, Servicio, Empleado y Hora en cada turno.' });
            return;
        }

        startSaveTransition(async () => {
            const appointmentsToCreate = validRows.flatMap(row => {
                return (row.assignments || []).map(assignment => {
                    const [hours, minutes] = (assignment.time || '00:00').split(':').map(Number);
                    const appointmentDate = new Date(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                        hours,
                        minutes,
                        0,
                        0
                    );

                    const assignmentWithDefaults: AppointmentAssignment = {
                        employeeId: assignment.employeeId,
                        serviceId: assignment.serviceId,
                        time: assignment.time,
                        duration: assignment.duration || 30,
                        productIds: assignment.productIds || [],
                    };

                    return {
                        customerName: row.customerName!,
                        customerEmail: row.customerEmail,
                        customerPhone: row.customerPhone,
                        assignments: [assignmentWithDefaults],
                        productIds: assignment.productIds || [],
                        date: appointmentDate.toISOString(),
                        duration: assignment.duration || 30,
                        notes: assignment.notes || '',
                        serviceNames: [],
                    };
                });
            });

            try {
                const result = await batchCreateAppointments(appointmentsToCreate as any);
                toast({ title: 'Turnos Guardados', description: `${result.createdCount} turnos fueron creados exitosamente.` });
                router.push('/admin/agenda');
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al guardar los turnos.' });
            }
        });
    }
    
    const calculateRowTotal = (row: AppointmentRow) => {
        return (row.assignments || []).reduce((sum, assignment) => {
            const servicePrice = allServices.find(s => s.id === assignment.serviceId)?.price || 0;
            const productsPrice = (assignment.productIds || [])
                .map(id => allProducts.find(p => p.id === id)?.price || 0)
                .reduce((acc, price) => acc + price, 0);
            return sum + servicePrice + productsPrice;
        }, 0) / 100;
    };

    const getFilteredServices = (query?: string) => {
        const normalizedQuery = (query || '').trim().toLowerCase();
        if (!normalizedQuery) return allServices;

        const exactCodeMatches = allServices.filter(service => (service.code || '').trim().toLowerCase() === normalizedQuery);
        if (exactCodeMatches.length > 0) {
            return exactCodeMatches;
        }

        return allServices.filter(service => (service.name || '').toLowerCase().includes(normalizedQuery));
    };

    const addAssignment = (rowId: number) => {
        const defaultEmployeeId = allEmployees[0]?.id;
        setRows(prevRows => prevRows.map(row => {
            if (row.rowId !== rowId) return row;
            return {
                ...row,
                assignments: [...(row.assignments || []), createNewAssignment(defaultEmployeeId)],
            };
        }));
    };

    const updateAssignment = (rowId: number, index: number, updates: Partial<FastAssignment>) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.rowId !== rowId || !row.assignments) return row;

            const newAssignments = [...row.assignments];
            if (!newAssignments[index]) return row;

            newAssignments[index] = { ...newAssignments[index], ...updates };

            if (updates.serviceId) {
                const service = allServices.find(s => s.id === updates.serviceId);
                if (service) {
                    newAssignments[index].duration = service.duration;
                }
            }

            return {
                ...row,
                assignments: newAssignments,
            };
        }));
    };
    
    const removeAssignment = (rowId: number, index: number) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.rowId !== rowId || !row.assignments) return row;
            const newAssignments = [...row.assignments];
            newAssignments.splice(index, 1);
            return {
                ...row,
                assignments: newAssignments,
            };
        }));
    };


    return (
        <>
            <ClientSearchModal 
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                onSelectClient={handleClientSelect}
            />
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Volver</span>
                    </Button>
                    <h1 className="text-2xl font-bold">Carga Rápida de Turnos</h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Cargar Agenda del Día</CardTitle>
                        <CardDescription>Añade múltiples turnos para un día específico de forma rápida. La duración y el precio se calculan automáticamente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                            <Button onClick={handleAddRow}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Turno</Button>
                            <Button onClick={handleSaveAll} disabled={isSaving || rows.length === 0} className="bg-green-600 hover:bg-green-700">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Guardar Todo
                            </Button>
                        </div>

                        {isLoadingData && <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}

                        {!isLoadingData && rows.length > 0 && (
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[220px]">Cliente</TableHead>
                                        <TableHead className="min-w-[700px]">Detalle por Turno</TableHead>
                                        <TableHead className="min-w-[120px] text-right">Total</TableHead>
                                        <TableHead>Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={row.rowId}>
                                            <TableCell>
                                                <Button variant="outline" className="w-full justify-start font-normal" onClick={() => openClientSearch(row.rowId)}>
                                                    <Search className="mr-2 h-4 w-4" />
                                                    {row.customerName || 'Buscar cliente...'}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    {(row.assignments || []).map((assignment, assignIndex) => (
                                                        <div key={assignment.assignmentId} className="rounded-md border p-2 space-y-2">
                                                            <div className="flex gap-2 items-center flex-wrap">
                                                            <Popover
                                                                open={assignment.serviceSearchOpen}
                                                                onOpenChange={(isOpen) => updateAssignment(row.rowId, assignIndex, { serviceSearchOpen: isOpen, serviceSearchTerm: isOpen ? (assignment.serviceSearchTerm || '') : '' })}
                                                            >
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="outline" className="w-[200px] justify-start font-normal">
                                                                        {allServices.find(s => s.id === assignment.serviceId)?.name || "Servicio..."}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[300px] p-0">
                                                                    <Command shouldFilter={false}>
                                                                        <CommandInput
                                                                            placeholder="Buscar por código exacto o nombre..."
                                                                            value={assignment.serviceSearchTerm || ''}
                                                                            onValueChange={(value) => updateAssignment(row.rowId, assignIndex, { serviceSearchTerm: value })}
                                                                        />
                                                                        <CommandList>
                                                                            <CommandEmpty>No se encontraron servicios.</CommandEmpty>
                                                                            <CommandGroup>
                                                                                {getFilteredServices(assignment.serviceSearchTerm).map(service => (
                                                                                    <CommandItem
                                                                                        key={service.id}
                                                                                        value={service.id}
                                                                                        onSelect={() => {
                                                                                            updateAssignment(row.rowId, assignIndex, {
                                                                                                serviceId: service.id,
                                                                                                serviceSearchOpen: false,
                                                                                                serviceSearchTerm: '',
                                                                                            });
                                                                                        }}
                                                                                    >
                                                                                        {service.code} - {service.name}
                                                                                    </CommandItem>
                                                                                ))}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                            <Select value={assignment.employeeId} onValueChange={(value) => updateAssignment(row.rowId, assignIndex, { employeeId: value })}>
                                                                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Empleado..." /></SelectTrigger>
                                                                <SelectContent>
                                                                    {allEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                            <Input className="w-[130px]" type="time" value={assignment.time || ''} onChange={e => updateAssignment(row.rowId, assignIndex, { time: e.target.value })} />
                                                            <Input className="w-[110px]" type="number" min={1} value={assignment.duration || 0} onChange={e => updateAssignment(row.rowId, assignIndex, { duration: Number(e.target.value) || 0 })} placeholder="Duración" />
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAssignment(row.rowId, assignIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                            </div>

                                                            <div className="flex gap-2 items-start flex-wrap">
                                                                <Popover open={assignment.productSearchOpen} onOpenChange={(isOpen) => updateAssignment(row.rowId, assignIndex, { productSearchOpen: isOpen })}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="outline" className="w-[220px] justify-start font-normal">Añadir productos...</Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-[300px] p-0">
                                                                        <Command>
                                                                            <CommandInput placeholder="Buscar por código o nombre..." />
                                                                            <CommandList>
                                                                                <CommandEmpty>No hay productos.</CommandEmpty>
                                                                                <CommandGroup>
                                                                                    {allProducts.map(p => (
                                                                                        <CommandItem key={p.id} value={`${p.code} ${p.name}`} onSelect={() => {
                                                                                            const currentProductIds = assignment.productIds || [];
                                                                                            if (!currentProductIds.includes(p.id)) {
                                                                                                updateAssignment(row.rowId, assignIndex, { productIds: [...currentProductIds, p.id] });
                                                                                            }
                                                                                        }}>{p.code} - {p.name}</CommandItem>
                                                                                    ))}
                                                                                </CommandGroup>
                                                                            </CommandList>
                                                                        </Command>
                                                                    </PopoverContent>
                                                                </Popover>

                                                                <Input className="min-w-[240px] flex-1" placeholder="Notas..." value={assignment.notes || ''} onChange={e => updateAssignment(row.rowId, assignIndex, { notes: e.target.value })} />
                                                            </div>

                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {(assignment.productIds || []).map((id, pIndex) => {
                                                                    const product = allProducts.find(p => p.id === id);
                                                                    return <Badge key={`${id}-${pIndex}`} variant="outline" className="flex items-center gap-1">{product?.name} <button onClick={() => updateAssignment(row.rowId, assignIndex, { productIds: (assignment.productIds || []).filter((_, i) => i !== pIndex) })}><X className="h-3 w-3"/></button></Badge>;
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                     <Button variant="outline" size="sm" onClick={() => addAssignment(row.rowId)}><PlusCircle className="mr-2 h-4 w-4"/> Añadir</Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1 font-semibold">
                                                   <DollarSign className="h-4 w-4 text-muted-foreground"/>
                                                   {calculateRowTotal(row).toFixed(2)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(row.rowId)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
    