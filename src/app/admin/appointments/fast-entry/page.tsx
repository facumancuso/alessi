'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getClients, getProducts, getServices, getUsers } from '@/lib/data';
import { batchCreateAppointments } from '@/lib/actions';
import type { Client, Product, Service, User, Appointment, AppointmentAssignment } from '@/lib/types';
import { ArrowLeft, CalendarIcon, Check, ChevronsUpDown, Loader2, PlusCircle, Save, Trash2, X, Search, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ClientSearchModal } from '@/components/client-search-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AppointmentRow = {
    rowId: number;
    time?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    assignments?: AppointmentAssignment[];
    productIds?: string[];
    duration?: number;
    notes?: string;
    employeeSearchOpen?: boolean;
    productSearchOpen?: boolean;
};


let rowIdCounter = 0;

export default function FastEntryPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [rows, setRows] = useState<AppointmentRow[]>([{ rowId: rowIdCounter++, assignments: [] }]);

    const [allClients, setAllClients] = useState<Client[]>([]);
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

    const handleAddRow = () => {
        setRows([...rows, { rowId: rowIdCounter++, assignments: [] }]);
    };

    const handleRemoveRow = (rowId: number) => {
        setRows(rows.filter(row => row.rowId !== rowId));
    };

    const handleRowChange = (rowId: number, updates: Partial<AppointmentRow>) => {
        setRows(rows.map(row => {
            if (row.rowId === rowId) {
                const newRow = { ...row, ...updates };

                if ('assignments' in updates) {
                    const selectedServices = allServices.filter(s => (newRow.assignments || []).map(a => a.serviceId).includes(s.id));
                    newRow.duration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
                }
                
                return newRow;
            }
            return row;
        }));
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
        getClients().then(setAllClients); // Fetch/re-fetch clients only when modal is opened
        setCurrentRowIdForClient(rowId);
        setIsClientModalOpen(true);
    }


    const handleSaveAll = () => {
        if (!date) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona una fecha.' });
            return;
        }
        
        const validRows = rows.filter(r => r.customerName && r.assignments && r.assignments.length > 0 && r.time);
        
        if(validRows.length !== rows.length) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor, completa Cliente, al menos un Servicio/Empleado y Hora para todos los turnos.' });
            return;
        }

        startSaveTransition(async () => {
            const appointmentsToCreate = validRows.map(row => {
                const [hours, minutes] = (row.time || "00:00").split(':').map(Number);
                
                const appointmentDate = new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    hours,
                    minutes,
                    0,
                    0
                );

                let currentTime = row.time!;
                const assignmentsWithTime = (row.assignments || []).map((assignment, index) => {
                    const assignmentWithTime = {
                        ...assignment,
                        time: currentTime,
                        duration: assignment.duration || 30
                    };
                    
                    if (index < row.assignments!.length - 1) {
                        const [h, m] = currentTime.split(':').map(Number);
                        const totalMinutes = h * 60 + m + (assignment.duration || 30);
                        const newH = Math.floor(totalMinutes / 60);
                        const newM = totalMinutes % 60;
                        currentTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
                    }
                    
                    return assignmentWithTime;
                });

                return {
                    customerName: row.customerName!,
                    customerEmail: row.customerEmail, 
                    customerPhone: row.customerPhone,
                    assignments: assignmentsWithTime,
                    productIds: row.productIds || [],
                    date: appointmentDate.toISOString(),
                    duration: row.duration || 0,
                    notes: row.notes || '',
                }
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
        const servicesPrice = (row.assignments || [])
            .map(a => allServices.find(s => s.id === a.serviceId)?.price || 0)
            .reduce((sum, price) => sum + price, 0);
        
        const productsPrice = (row.productIds || [])
            .map(id => allProducts.find(p => p.id === id)?.price || 0)
            .reduce((sum, price) => sum + price, 0);
            
        return (servicesPrice + productsPrice) / 100;
    };

    const addAssignment = (rowId: number) => {
        const firstAvailableEmployee = allEmployees[0];
        if (firstAvailableEmployee) {
            const row = rows.find(r => r.rowId === rowId);
            if (row) {
                const newAssignments = [...(row.assignments || []), { serviceId: '', employeeId: firstAvailableEmployee.id, time: '', duration: 0 }];
                handleRowChange(rowId, { assignments: newAssignments });
            }
        }
    };

    const updateAssignment = (rowId: number, index: number, field: keyof AppointmentAssignment, value: string) => {
        const row = rows.find(r => r.rowId === rowId);
        if (row && row.assignments) {
            const newAssignments = [...row.assignments];
            newAssignments[index] = { ...newAssignments[index], [field]: value };
            
            if (field === 'serviceId') {
                const service = allServices.find(s => s.id === value);
                if (service) {
                    newAssignments[index].duration = service.duration;
                }
            }
            
            handleRowChange(rowId, { assignments: newAssignments });
        }
    };
    
    const removeAssignment = (rowId: number, index: number) => {
        const row = rows.find(r => r.rowId === rowId);
        if (row && row.assignments) {
            const newAssignments = [...row.assignments];
            newAssignments.splice(index, 1);
            handleRowChange(rowId, { assignments: newAssignments });
        }
    };


    return (
        <>
            <ClientSearchModal 
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                clients={allClients}
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
                                        <TableHead className="min-w-[150px]">Hora</TableHead>
                                        <TableHead className="min-w-[220px]">Cliente</TableHead>
                                        <TableHead className="min-w-[400px]">Servicios y Empleados</TableHead>
                                        <TableHead className="min-w-[250px]">Productos</TableHead>
                                        <TableHead className="min-w-[100px]">Duración</TableHead>
                                        <TableHead className="min-w-[180px]">Notas</TableHead>
                                        <TableHead className="min-w-[120px] text-right">Total</TableHead>
                                        <TableHead>Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, index) => (
                                        <TableRow key={row.rowId}>
                                            <TableCell>
                                                <Input type="time" value={row.time || ''} onChange={e => handleRowChange(row.rowId, { time: e.target.value })} />
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="outline" className="w-full justify-start font-normal" onClick={() => openClientSearch(row.rowId)}>
                                                    <Search className="mr-2 h-4 w-4" />
                                                    {row.customerName || 'Buscar cliente...'}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    {(row.assignments || []).map((assignment, assignIndex) => (
                                                        <div key={assignIndex} className="flex gap-2 items-center">
                                                            <Select value={assignment.serviceId} onValueChange={(value) => updateAssignment(row.rowId, assignIndex, 'serviceId', value)}>
                                                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Servicio..." /></SelectTrigger>
                                                                <SelectContent>
                                                                    {allServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                            <Select value={assignment.employeeId} onValueChange={(value) => updateAssignment(row.rowId, assignIndex, 'employeeId', value)}>
                                                                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Empleado..." /></SelectTrigger>
                                                                <SelectContent>
                                                                    {allEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAssignment(row.rowId, assignIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                        </div>
                                                    ))}
                                                     <Button variant="outline" size="sm" onClick={() => addAssignment(row.rowId)}><PlusCircle className="mr-2 h-4 w-4"/> Añadir</Button>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Popover open={row.productSearchOpen} onOpenChange={(isOpen) => handleRowChange(row.rowId, { productSearchOpen: isOpen })}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start font-normal">Añadir productos...</Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar por código o nombre..." />
                                                            <CommandList>
                                                                <CommandEmpty>No hay productos.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {allProducts.map(p => (
                                                                        <CommandItem key={p.id} value={`${p.code} ${p.name}`} onSelect={() => {
                                                                            handleRowChange(row.rowId, { productIds: [...(row.productIds || []), p.id] });
                                                                        }}>{p.code} - {p.name}</CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {(row.productIds || []).map((id, pIndex) => {
                                                        const product = allProducts.find(p => p.id === id);
                                                        return <Badge key={`${id}-${pIndex}`} variant="outline" className="flex items-center gap-1">{product?.name} <button onClick={() => handleRowChange(row.rowId, { productIds: (row.productIds || []).filter((_, i) => i !== pIndex) })}><X className="h-3 w-3"/></button></Badge>;
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={row.duration || 0} onChange={e => handleRowChange(row.rowId, { duration: parseInt(e.target.value, 10) })} />
                                            </TableCell>
                                            <TableCell>
                                                <Input placeholder="Notas..." value={row.notes || ''} onChange={e => handleRowChange(row.rowId, { notes: e.target.value })} />
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
    