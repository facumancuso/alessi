

'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, Loader2, PartyPopper, CreditCard, X, DollarSign, User as UserIcon, Package, Scissors, History, Check, XCircle, Ban, StickyNote, ChevronsUpDown, ArrowLeft, Trash2, AlertCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { Service, Client, Appointment, User, Product, AppointmentAssignment } from '@/lib/types';
import { createAppointment, updateAppointment, updateAppointmentStatus, deleteAppointment } from '@/lib/actions';
import { getServices, getUsers, getProducts, getAppointmentById } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentUser } from '@/app/admin/user-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClientSearchModal } from '@/components/client-search-modal';
import { sortEmployeesByAgendaOrder } from '@/lib/employee-order';


export default function NewAppointmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentUser } = useCurrentUser();
    const { toast } = useToast();

    const appointmentId = searchParams.get('id');
    const isEditing = !!appointmentId;

    const [appointment, setAppointment] = useState<Partial<Appointment> | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [assignments, setAssignments] = useState<Partial<AppointmentAssignment>[]>([]);
    const [initialAssignmentsCount, setInitialAssignmentsCount] = useState(0);
    const [date, setDate] = useState<Date | undefined>();
    const [notes, setNotes] = useState('');
    const [currentStatus, setCurrentStatus] = useState<Appointment['status'] | undefined>('confirmed');
    
    const [isSaving, startSaveTransition] = useTransition();
    const [isStatusChanging, startStatusTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);

    const [employees, setEmployees] = useState<User[]>([]);
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [selectedExistingClientId, setSelectedExistingClientId] = useState<string | null>(null);
    
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [serviceSearchOpen, setServiceSearchOpen] = useState<number | null>(null);
    const [serviceSearchTerm, setServiceSearchTerm] = useState('');
    const [assignmentProductSearchOpen, setAssignmentProductSearchOpen] = useState<string | null>(null);

    
    const isReceptionOrAdmin = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente' || currentUser?.role === 'Recepcion';
    const isEmployee = currentUser?.role === 'Peluquero';
    const canEdit = isReceptionOrAdmin || currentUser?.role === 'Peluquero';

    useEffect(() => {
        setIsLoading(true);
        const fetchData = async () => {
            try {
                const [users, services, products] = await Promise.all([
                    getUsers(),
                    getServices(),
                    getProducts()
                ]);

                const sortedEmployees = sortEmployeesByAgendaOrder(
                    users.filter(u => u.role === 'Peluquero')
                );

                setEmployees(sortedEmployees);
                setAllServices(services);
                setAllProducts(products);

                if (appointmentId) {
                    const appt = await getAppointmentById(appointmentId);
                    if (appt) {
                        setAppointment(appt);
                        setCustomerName(appt.customerName || '');
                        setCustomerEmail(appt.customerEmail || '');
                        setCustomerPhone(appt.customerPhone || '');
                        const normalizedAssignments = (appt.assignments || []).map((assignment, index) => ({
                            ...assignment,
                            productIds: assignment.productIds || (index === 0 ? (appt.productIds || []) : []),
                        }));
                        setAssignments(normalizedAssignments);
                        setInitialAssignmentsCount(normalizedAssignments.length);
                        setDate(appt.date ? new Date(appt.date) : new Date());
                        setNotes(appt.notes || '');
                        setCurrentStatus(appt.status);
                    }
                } else {
                    const prefillDate = searchParams.get('date');
                    const prefillTime = searchParams.get('time');
                    const prefillEmployeeId = searchParams.get('employeeId');

                    if (prefillDate) {
                        const [y, m, d] = prefillDate.split('-').map(Number);
                        setDate(new Date(y, m - 1, d));
                    } else {
                        setDate(new Date());
                    }
                    
                    const newAssignment: Partial<AppointmentAssignment> = {};
                    if(prefillEmployeeId) newAssignment.employeeId = prefillEmployeeId;
                    if(prefillTime) newAssignment.time = prefillTime;

                    setAssignments([newAssignment]);
                    setInitialAssignmentsCount(0);
                }
            } catch (error) {
                console.error("Failed to load data for appointment page", error);
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos necesarios.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [appointmentId, currentUser, toast, searchParams]);


    const selectedServicesDetails = useMemo(() => 
        assignments.map(a => ({
            ...a,
            service: allServices.find(s => s.id === a.serviceId)
        }))
    , [assignments, allServices]);

    const selectedProductIds = useMemo(
        () => assignments.flatMap(a => a.productIds || []),
        [assignments]
    );

    const filteredServices = useMemo(() => {
        const query = serviceSearchTerm.trim().toLowerCase();
        if (!query) return allServices;

        const exactCodeMatches = allServices.filter(service => (service.code || '').trim().toLowerCase() === query);
        if (exactCodeMatches.length > 0) {
            return exactCodeMatches;
        }

        return allServices.filter(service => (service.name || '').toLowerCase().includes(query));
    }, [allServices, serviceSearchTerm]);

    const { totalDuration, totalPrice, totalCashPrice } = useMemo(() => {
        const servicesDuration = assignments.reduce((sum, a) => sum + (a.duration || 0), 0);
        const servicesPrice = selectedServicesDetails.reduce((sum, a) => sum + (a.service?.price || 0), 0);
        const servicesCashPrice = selectedServicesDetails.reduce((sum, a) => sum + (a.service?.cashPrice ?? a.service?.price ?? 0), 0);
        const productsPrice = selectedProductIds.reduce((sum, productId) => {
            const product = allProducts.find(p => p.id === productId);
            return sum + (product?.price || 0);
        }, 0);
        const productsCashPrice = selectedProductIds.reduce((sum, productId) => {
            const product = allProducts.find(p => p.id === productId);
            return sum + (product?.cashPrice ?? product?.price ?? 0);
        }, 0);

        return {
            totalDuration: servicesDuration,
            totalPrice: (servicesPrice + productsPrice) / 100,
            totalCashPrice: (servicesCashPrice + productsCashPrice) / 100,
        };
    }, [assignments, selectedServicesDetails, selectedProductIds, allProducts]);


    const handleSave = () => {
        if (!canEdit) return;
        if (!customerName.trim()) {
            toast({
                variant: "destructive",
                title: "Falta el cliente",
                description: "Ingresá o seleccioná un cliente antes de guardar el turno.",
            });
            return;
        }
        if (!date || assignments.length === 0 || assignments.some(a => !a.serviceId || !a.employeeId || !a.time)) {
            toast({
                variant: "destructive",
                title: "Faltan datos",
                description: "Por favor completa la fecha, y para cada servicio asigna un empleado, hora y duración.",
            });
            return;
        }
        
        startSaveTransition(async () => {
            const finalAssignments = assignments.filter(a => a.serviceId && a.employeeId && a.time && a.duration) as AppointmentAssignment[];

            const appointmentData = {
                customerName,
                customerEmail,
                customerPhone,
                assignments: finalAssignments,
                productIds: finalAssignments.flatMap(a => a.productIds || []),
                date: date.toISOString(),
                notes,
            };

            try {
                if (isEditing && appointmentId) {
                    await updateAppointment(appointmentId, { ...appointmentData, status: currentStatus });
                } else {
                    const initialStatus = currentUser?.role === 'Peluquero' ? 'waiting' : 'confirmed';
                    await createAppointment({ ...appointmentData, status: initialStatus });
                }

                toast({ title: isEditing ? 'Turno Actualizado' : 'Turno Creado Exitosamente' });
                const agendaDate = format(date || new Date(), 'yyyy-MM-dd');
                router.push(`/admin/agenda?date=${agendaDate}`);
            } catch (e) {
                console.error(e);
                toast({ variant: "destructive", title: "Error", description: 'No se pudo guardar el turno.' });
            }
        });
    }

    const handleStatusChange = (newStatus: Appointment['status']) => {
        if (!isReceptionOrAdmin || !appointmentId) return;

        startStatusTransition(async () => {
            await updateAppointmentStatus(appointmentId, newStatus);
            toast({
                title: "Estado del turno actualizado",
                description: `El turno se ha marcado como "${newStatus}".`,
            });
            setCurrentStatus(newStatus);
        });
    }

    const handleDelete = () => {
        if (!isReceptionOrAdmin || !appointmentId) return;

        startSaveTransition(async () => {
            const result = await deleteAppointment(appointmentId);
            if(result.success) {
                toast({ title: "Turno Eliminado", description: "El turno ha sido eliminado correctamente." });
                const agendaDate = format(date || new Date(), 'yyyy-MM-dd');
                router.push(`/admin/agenda?date=${agendaDate}`);
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        });
    }
    
    const openClientSearch = () => {
        if (!canEdit) return;
        setIsClientModalOpen(true);
    }

    const handleClientSelect = (client: Partial<Client>) => {
        setCustomerName(client.name || '');
        setCustomerEmail(client.email || '');
        setCustomerPhone(client.mobilePhone || '');
        setSelectedExistingClientId(client.id || null);
        setIsClientModalOpen(false);
    }

    const handleBack = () => {
        const agendaDate = format(date || new Date(), 'yyyy-MM-dd');
        router.push(`/admin/agenda?date=${agendaDate}`);
    }
    
    const addAssignment = () => {
        if (employees.length === 0) {
            toast({ variant: 'destructive', title: 'No hay empleados', description: 'No se pueden añadir servicios sin empleados disponibles.' });
            return;
        }

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        setAssignments(prev => {
            const isFirstAssignment = prev.length === 0;
            let defaultEmployeeId: string | undefined;
            if (isFirstAssignment && currentUser?.role === 'Peluquero') {
                defaultEmployeeId = currentUser.id;
            } else {
                defaultEmployeeId = prev[prev.length - 1]?.employeeId ?? employees[0]?.id;
            }
            return [...prev, { employeeId: defaultEmployeeId, time: currentTime, duration: 30 }];
        });
    }

    const updateAssignment = (index: number, field: keyof AppointmentAssignment, value: string | number) => {
        setAssignments(prev => {
            const newAssignments = [...prev];
            newAssignments[index] = { ...newAssignments[index], [field]: value };
            if (field === 'serviceId') {
                const service = allServices.find(s => s.id === value);
                if (service) newAssignments[index].duration = service.duration;
            }
            return newAssignments;
        });
    }

    const removeAssignment = (index: number) => {
        setAssignments(prev => prev.filter((_, i) => i !== index));
    }

    const getAssignmentProductSearchKey = (index: number) => `${index}`;

    const addProductToAssignment = (assignmentIndex: number, productId: string) => {
        setAssignments(prev => {
            const newAssignments = [...prev];
            const currentProductIds = newAssignments[assignmentIndex].productIds || [];
            newAssignments[assignmentIndex] = { ...newAssignments[assignmentIndex], productIds: [...currentProductIds, productId] };
            return newAssignments;
        });
    }

    const removeProductFromAssignment = (assignmentIndex: number, productPosition: number) => {
        setAssignments(prev => {
            const newAssignments = [...prev];
            const currentProductIds = newAssignments[assignmentIndex].productIds || [];
            newAssignments[assignmentIndex] = {
                ...newAssignments[assignmentIndex],
                productIds: [...currentProductIds.slice(0, productPosition), ...currentProductIds.slice(productPosition + 1)],
            };
            return newAssignments;
        });
    }
    
     if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
     }

     return (
         <>
         <ClientSearchModal
            isOpen={isClientModalOpen}
            onClose={() => setIsClientModalOpen(false)}
            onSelectClient={handleClientSelect}
         />
         <div className="salon-shell myday-shell space-y-4 pb-10">

            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight">{isEditing ? 'Editar Turno' : 'Nuevo Turno'}</h1>
                    {isEditing && date && (
                        <span className="text-sm text-muted-foreground">{format(date, "EEEE d 'de' MMMM", { locale: es })}</span>
                    )}
                    {isEditing && currentStatus && (
                        <Badge variant={
                            currentStatus === 'completed' ? 'default' :
                            currentStatus === 'cancelled' ? 'destructive' :
                            currentStatus === 'in_progress' ? 'secondary' :
                            'outline'
                        } className="text-xs capitalize h-5">
                            {currentStatus === 'confirmed' ? 'Confirmado' :
                             currentStatus === 'waiting' ? 'En espera' :
                             currentStatus === 'in_progress' ? 'En proceso' :
                             currentStatus === 'completed' ? 'Completado' :
                             currentStatus === 'cancelled' ? 'Cancelado' :
                             currentStatus === 'no-show' ? 'No se presentó' : currentStatus}
                        </Badge>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">

                    {/* Cliente */}
                    <Card className="rounded-2xl border bg-card shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <UserIcon className="h-3.5 w-3.5" /> Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid sm:grid-cols-2 gap-3 pt-0">
                            <div className="space-y-1 sm:col-span-2">
                                {isReceptionOrAdmin ? (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start font-normal h-9 text-sm gap-2"
                                        onClick={openClientSearch}
                                        disabled={!canEdit}
                                    >
                                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className={cn(!customerName && "text-muted-foreground")}>
                                            {customerName || 'Buscar o crear cliente...'}
                                        </span>
                                    </Button>
                                ) : (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Nombre</Label>
                                        <Input value={customerName} readOnly disabled className="bg-muted/40 h-9 text-sm" />
                                    </div>
                                )}
                            </div>
                            {isReceptionOrAdmin && customerName && (
                                <>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Email</Label>
                                        <Input
                                            value={customerEmail}
                                            onChange={(e) => { setCustomerEmail(e.target.value); setSelectedExistingClientId(null); }}
                                            disabled={!canEdit || !!selectedExistingClientId}
                                            className="h-8 text-sm"
                                            placeholder="email@ejemplo.com"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Teléfono</Label>
                                        <Input
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            disabled={!canEdit}
                                            className="h-8 text-sm"
                                            placeholder="+54 9 11 ..."
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Fecha */}
                    <Card className="rounded-2xl border bg-card shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <CalendarIcon className="h-3.5 w-3.5" /> Fecha del Turno
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn("w-full sm:w-auto justify-start text-left font-normal h-9 text-sm", !date && "text-muted-foreground")}
                                        disabled={!isReceptionOrAdmin}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                        </CardContent>
                    </Card>

                    {/* Servicios */}
                    <Card className="rounded-2xl border bg-card shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Scissors className="h-3.5 w-3.5" /> Servicios
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={addAssignment}
                                    disabled={!canEdit}
                                >
                                    + Agregar
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-0">
                            {assignments.length === 0 && (
                                <div className="rounded-xl border border-dashed bg-muted/20 py-8 text-center">
                                    <Scissors className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                                    <p className="text-sm text-muted-foreground">Sin servicios asignados</p>
                                    <p className="text-xs text-muted-foreground/60 mt-0.5">Presioná "+ Agregar" para empezar</p>
                                </div>
                            )}
                            {assignments.map((assignment, index) => {
                                const isExistingAssignment = isEditing && index < initialAssignmentsCount;
                                const rowCanEdit = canEdit;
                                const serviceDetail = allServices.find(s => s.id === assignment.serviceId);
                                return (
                                    <div
                                        key={index}
                                        className={cn(
                                            "rounded-xl border p-3 space-y-2.5 transition-colors",
                                            isExistingAssignment ? "bg-muted/20" : "bg-card"
                                        )}
                                    >
                                        {/* Row header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-muted-foreground tabular-nums">#{index + 1}</span>
                                                {serviceDetail && (
                                                    <span className="text-xs font-medium truncate max-w-[180px]">{serviceDetail.name}</span>
                                                )}
                                                {isExistingAssignment && (
                                                    <Badge variant="secondary" className="text-xs h-4.5 px-1.5 py-0">Hora fija</Badge>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeAssignment(index)}
                                                disabled={!rowCanEdit}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>

                                        {/* Fields grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div className="col-span-2 sm:col-span-2 space-y-1">
                                                <Label className="text-xs text-muted-foreground">Servicio</Label>
                                                <Popover
                                                    open={serviceSearchOpen === index}
                                                    onOpenChange={(isOpen) => {
                                                        setServiceSearchOpen(isOpen ? index : null);
                                                        if (!isOpen) setServiceSearchTerm('');
                                                    }}
                                                >
                                                    <PopoverTrigger asChild disabled={!rowCanEdit}>
                                                        <Button variant="outline" className="w-full justify-start font-normal h-8 text-xs">
                                                            {serviceDetail?.name || "Seleccionar..."}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-0">
                                                        <Command shouldFilter={false}>
                                                            <CommandInput
                                                                placeholder="Buscar por nombre o código..."
                                                                value={serviceSearchTerm}
                                                                onValueChange={setServiceSearchTerm}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>Sin resultados.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {filteredServices.map(s => (
                                                                        <CommandItem
                                                                            key={s.id}
                                                                            value={s.id}
                                                                            onSelect={() => {
                                                                                updateAssignment(index, 'serviceId', s.id);
                                                                                setServiceSearchOpen(null);
                                                                                setServiceSearchTerm('');
                                                                            }}
                                                                        >
                                                                            <span className="text-muted-foreground mr-2 tabular-nums">{s.code}</span>
                                                                            {s.name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="col-span-2 sm:col-span-2 space-y-1">
                                                <Label className="text-xs text-muted-foreground">Empleado</Label>
                                                <Select
                                                    value={assignment.employeeId}
                                                    onValueChange={(v) => updateAssignment(index, 'employeeId', v)}
                                                    disabled={!rowCanEdit}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Seleccionar..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {employees.map(e => (
                                                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Hora</Label>
                                                <Input
                                                    type="time"
                                                    className="h-8 text-xs"
                                                    value={assignment.time || ''}
                                                    onChange={(e) => updateAssignment(index, 'time', e.target.value)}
                                                    disabled={isExistingAssignment || (index === 0 && isEditing ? !isReceptionOrAdmin : !canEdit)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Duración (min)</Label>
                                                <Input
                                                    type="number"
                                                    className="h-8 text-xs"
                                                    value={assignment.duration || 0}
                                                    onChange={(e) => updateAssignment(index, 'duration', parseInt(e.target.value, 10))}
                                                    disabled
                                                />
                                            </div>
                                        </div>

                                        {/* Productos */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Package className="h-3 w-3" /> Productos
                                            </Label>
                                            <div className="flex flex-wrap gap-1 items-center">
                                                {(assignment.productIds || []).map((productId, productIndex) => {
                                                    const product = allProducts.find(p => p.id === productId);
                                                    return (
                                                        <Badge
                                                            key={`${productId}-${productIndex}`}
                                                            variant="secondary"
                                                            className="flex items-center gap-1 h-6 text-xs pr-1"
                                                        >
                                                            {product?.name}
                                                            {rowCanEdit && (
                                                                <button
                                                                    onClick={() => removeProductFromAssignment(index, productIndex)}
                                                                    className="rounded-full hover:opacity-60 ml-0.5"
                                                                >
                                                                    <X className="h-2.5 w-2.5" />
                                                                </button>
                                                            )}
                                                        </Badge>
                                                    );
                                                })}
                                                {rowCanEdit && (
                                                    <Popover
                                                        open={assignmentProductSearchOpen === getAssignmentProductSearchKey(index)}
                                                        onOpenChange={(isOpen) => setAssignmentProductSearchOpen(isOpen ? getAssignmentProductSearchKey(index) : null)}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2">
                                                                <Package className="h-3 w-3" /> Añadir
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Buscar producto..." />
                                                                <CommandList>
                                                                    <CommandEmpty>Sin resultados.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {allProducts.map(p => (
                                                                            <CommandItem
                                                                                key={p.id}
                                                                                value={`${p.code} ${p.name}`}
                                                                                onSelect={() => {
                                                                                    addProductToAssignment(index, p.id);
                                                                                    setAssignmentProductSearchOpen(null);
                                                                                }}
                                                                            >
                                                                                <span className="text-muted-foreground mr-2 tabular-nums">{p.code}</span>
                                                                                {p.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {isEmployee && assignments.length > 0 && (
                                <p className="text-xs text-muted-foreground pt-0.5 px-1">
                                    Podés editar servicios y profesionales. La hora de las líneas ya guardadas queda fija y la duración se ajusta automáticamente.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                </div>

                {/* Sidebar */}
                <div className="space-y-3">

                    {/* Acciones del turno */}
                    {isReceptionOrAdmin && isEditing && (
                        <Card className="rounded-2xl border bg-card shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                    Estado
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-1.5 pt-0">
                                <button
                                    className={cn(
                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left w-full",
                                        currentStatus === 'completed'
                                            ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 font-medium"
                                            : "hover:bg-muted/60 text-foreground/80"
                                    )}
                                    onClick={() => handleStatusChange('completed')}
                                    disabled={isStatusChanging || currentStatus === 'completed'}
                                >
                                    {isStatusChanging ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Check className="h-4 w-4 shrink-0 text-green-500" />}
                                    Completado
                                </button>
                                <button
                                    className={cn(
                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left w-full",
                                        currentStatus === 'cancelled'
                                            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-medium"
                                            : "hover:bg-muted/60 text-foreground/80"
                                    )}
                                    onClick={() => handleStatusChange('cancelled')}
                                    disabled={isStatusChanging || currentStatus === 'cancelled'}
                                >
                                    {isStatusChanging ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                                    Cancelar turno
                                </button>
                                <button
                                    className={cn(
                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left w-full",
                                        currentStatus === 'no-show'
                                            ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 font-medium"
                                            : "hover:bg-muted/60 text-foreground/80"
                                    )}
                                    onClick={() => handleStatusChange('no-show')}
                                    disabled={isStatusChanging || currentStatus === 'no-show'}
                                >
                                    {isStatusChanging ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Ban className="h-4 w-4 shrink-0 text-orange-500" />}
                                    No se presentó
                                </button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Notas */}
                    <Card className="rounded-2xl border bg-card shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <StickyNote className="h-3.5 w-3.5" /> Notas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Alergias, preferencias, observaciones..."
                                className="w-full min-h-[90px] resize-none rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 transition-colors"
                                disabled={!canEdit}
                            />
                        </CardContent>
                    </Card>

                    {/* Resumen */}
                    <Card className="rounded-2xl border bg-card shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5" /> Resumen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" /> Duración
                                </span>
                                <span className="text-sm font-semibold tabular-nums">{totalDuration} min</span>
                            </div>
                            {isReceptionOrAdmin && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <CreditCard className="h-3.5 w-3.5" /> Tarjeta
                                            </span>
                                            <span className="text-base font-bold tabular-nums">${totalPrice.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <DollarSign className="h-3.5 w-3.5" /> Efectivo
                                            </span>
                                            <span className="text-base font-bold tabular-nums text-black">${totalCashPrice.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Botones de acción */}
                    <div className="space-y-2">
                        <Button
                            className="w-full h-9 text-sm font-medium"
                            onClick={handleSave}
                            disabled={isSaving || !canEdit}
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {isEditing ? 'Guardar Cambios' : 'Crear Turno'}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full h-8 text-xs"
                            onClick={handleBack}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                        {isReceptionOrAdmin && isEditing && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                                        disabled={isSaving}
                                    >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar turno
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5 text-destructive" /> ¿Eliminar este turno?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción es permanente y no se puede deshacer.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, eliminar"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>

                </div>
            </div>
         </div>
         </>
     );
}
