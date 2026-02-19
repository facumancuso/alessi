

'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, Loader2, PartyPopper, CreditCard, X, DollarSign, User as UserIcon, Package, Scissors, History, Check, XCircle, Ban, StickyNote, ChevronsUpDown, ArrowLeft, Trash2, AlertCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { Service, Client, Appointment, User, Product, AppointmentAssignment } from '@/lib/types';
import { updateAppointment, updateAppointmentStatus, deleteAppointment } from '@/lib/actions';
import { getServices, getUsers, getProducts, getClients, getAppointmentById } from '@/lib/data';
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
    const [date, setDate] = useState<Date | undefined>();
    const [notes, setNotes] = useState('');
    const [currentStatus, setCurrentStatus] = useState<Appointment['status'] | undefined>('confirmed');
    
    const [isSaving, startSaveTransition] = useTransition();
    const [isStatusChanging, startStatusTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);

    const [clients, setClients] = useState<Client[]>([]);
    const [employees, setEmployees] = useState<User[]>([]);
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [serviceSearchOpen, setServiceSearchOpen] = useState<number | null>(null);
    const [assignmentProductSearchOpen, setAssignmentProductSearchOpen] = useState<string | null>(null);

    
    const isReceptionOrAdmin = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente' || currentUser?.role === 'Recepcion';
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

                setEmployees(users.filter(u => u.role === 'Peluquero'));
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
                        setDate(appt.date ? new Date(appt.date) : new Date());
                        setNotes(appt.notes || '');
                        setCurrentStatus(appt.status);
                    }
                } else {
                    const prefillDate = searchParams.get('date');
                    const prefillTime = searchParams.get('time');
                    const prefillEmployeeId = searchParams.get('employeeId');

                    setDate(prefillDate ? new Date(prefillDate) : new Date());
                    
                    const newAssignment: Partial<AppointmentAssignment> = {};
                    if(prefillEmployeeId) newAssignment.employeeId = prefillEmployeeId;
                    if(prefillTime) newAssignment.time = prefillTime;

                    setAssignments([newAssignment]);
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

    const { totalDuration, totalPrice } = useMemo(() => {
        const servicesDuration = assignments.reduce((sum, a) => sum + (a.duration || 0), 0);
        const servicesPrice = selectedServicesDetails.reduce((sum, a) => sum + (a.service?.price || 0), 0);
        const productsPrice = selectedProductIds.reduce((sum, productId) => {
            const product = allProducts.find(p => p.id === productId);
            return sum + (product?.price || 0);
        }, 0);
        
        return {
        totalDuration: servicesDuration,
        totalPrice: (servicesPrice + productsPrice) / 100
        };
    }, [assignments, selectedServicesDetails, selectedProductIds, allProducts]);


    const handleSave = () => {
        if (!canEdit) return;
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

            const appointmentData: Partial<Appointment> = {
                customerName,
                customerEmail,
                customerPhone,
                assignments: finalAssignments,
                productIds: finalAssignments.flatMap(a => a.productIds || []),
                date: date.toISOString(),
                status: currentStatus,
                notes,
            };

            try {
                const idToSave = appointmentId || `appt_${Date.now()}`;
                await updateAppointment(idToSave, { ...appointmentData, id: idToSave });

                toast({ title: isEditing ? 'Turno Actualizado' : 'Turno Creado Exitosamente' });
                router.push('/admin/agenda');
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
                router.push('/admin/agenda');
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        });
    }
    
    const openClientSearch = () => {
        if (!canEdit) return;
        getClients().then(setClients); // Fetch/re-fetch clients only when modal is opened
        setIsClientModalOpen(true);
    }

    const handleClientSelect = (client: Partial<Client>) => {
        setCustomerName(client.name || '');
        setCustomerEmail(client.email || '');
        setCustomerPhone(client.mobilePhone || '');
        setIsClientModalOpen(false);
    }

    const handleBack = () => {
        router.push('/admin/agenda');
    }
    
    const addAssignment = () => {
        const firstAvailableEmployee = employees[0];
        if (firstAvailableEmployee) {
            setAssignments([...assignments, { employeeId: firstAvailableEmployee.id, time: '10:00', duration: 30 }]);
        } else {
            toast({ variant: 'destructive', title: 'No hay empleados', description: 'No se pueden añadir servicios sin empleados disponibles.' });
        }
    }
    
    const updateAssignment = (index: number, field: keyof AppointmentAssignment, value: string | number) => {
        const newAssignments = [...assignments];
        const oldAssignment = newAssignments[index];
        newAssignments[index] = { ...oldAssignment, [field]: value };
        
        if (field === 'serviceId') {
            const service = allServices.find(s => s.id === value);
            if (service) {
                newAssignments[index].duration = service.duration;
            }
        }
        
        setAssignments(newAssignments);
    }
    
    const removeAssignment = (index: number) => {
        const newAssignments = [...assignments];
        newAssignments.splice(index, 1);
        setAssignments(newAssignments);
    }

    const getAssignmentProductSearchKey = (index: number) => `${index}`;

    const addProductToAssignment = (assignmentIndex: number, productId: string) => {
        const newAssignments = [...assignments];
        const assignment = newAssignments[assignmentIndex];
        const currentProductIds = assignment.productIds || [];
        newAssignments[assignmentIndex] = {
            ...assignment,
            productIds: [...currentProductIds, productId],
        };
        setAssignments(newAssignments);
    }

    const removeProductFromAssignment = (assignmentIndex: number, productPosition: number) => {
        const newAssignments = [...assignments];
        const assignment = newAssignments[assignmentIndex];
        const currentProductIds = assignment.productIds || [];
        newAssignments[assignmentIndex] = {
            ...assignment,
            productIds: [...currentProductIds.slice(0, productPosition), ...currentProductIds.slice(productPosition + 1)],
        };
        setAssignments(newAssignments);
    }
    
     if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
     }

     return (
         <>
         <ClientSearchModal
            isOpen={isClientModalOpen}
            onClose={() => setIsClientModalOpen(false)}
            clients={clients}
            onSelectClient={handleClientSelect}
         />
         <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Volver</span>
                </Button>
                <h1 className="text-2xl font-bold">{isEditing ? 'Editar Turno' : 'Nuevo Turno'}</h1>
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalles del Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="name">Cliente</Label>
                                {(isReceptionOrAdmin) ? (
                                    <Button variant="outline" className="w-full justify-start font-normal" onClick={openClientSearch} disabled={!canEdit}>
                                        <Search className="mr-2 h-4 w-4" />
                                        {customerName || 'Buscar o crear cliente...'}
                                    </Button>
                                ) : (
                                    <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={!canEdit} />
                                )}
                            </div>
                            {isReceptionOrAdmin && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} disabled={!canEdit || (clients.some(c => c.email === customerEmail && !!c.id))}/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Teléfono</Label>
                                        <Input id="phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} disabled={!canEdit}/>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Servicios y Empleados</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[200px]">Servicio</TableHead>
                                        <TableHead className="min-w-[150px]">Empleado</TableHead>
                                        <TableHead className="min-w-[100px]">Hora</TableHead>
                                        <TableHead className="w-[100px]">Duración</TableHead>
                                        <TableHead className="min-w-[220px]">Productos</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assignments.map((assignment, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <Popover open={serviceSearchOpen === index} onOpenChange={(isOpen) => setServiceSearchOpen(isOpen ? index : null)}>
                                                    <PopoverTrigger asChild disabled={!canEdit}>
                                                        <Button variant="outline" className="w-full justify-start font-normal">
                                                            {allServices.find(s => s.id === assignment.serviceId)?.name || "Seleccionar..."}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar servicio..." />
                                                            <CommandList>
                                                                <CommandEmpty>No se encontraron servicios.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {allServices.map(s => (
                                                                        <CommandItem
                                                                            key={s.id}
                                                                            value={`${s.code} ${s.name}`}
                                                                            onSelect={() => {
                                                                                updateAssignment(index, 'serviceId', s.id);
                                                                                setServiceSearchOpen(null);
                                                                            }}
                                                                        >
                                                                            {s.name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                             <TableCell>
                                                <Select value={assignment.employeeId} onValueChange={(value) => updateAssignment(index, 'employeeId', value)} disabled={!canEdit}>
                                                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input type="time" value={assignment.time || ''} onChange={(e) => updateAssignment(index, 'time', e.target.value)} disabled={!canEdit}/>
                                            </TableCell>
                                             <TableCell>
                                                <Input type="number" value={assignment.duration || 0} onChange={(e) => updateAssignment(index, 'duration', parseInt(e.target.value, 10))} disabled={!canEdit}/>
                                            </TableCell>
                                            <TableCell>
                                                <Popover
                                                    open={assignmentProductSearchOpen === getAssignmentProductSearchKey(index)}
                                                    onOpenChange={(isOpen) => setAssignmentProductSearchOpen(isOpen ? getAssignmentProductSearchKey(index) : null)}
                                                >
                                                    <PopoverTrigger asChild disabled={!canEdit}>
                                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                                            Añadir producto...
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar por código o nombre..." />
                                                            <CommandList>
                                                                <CommandEmpty>No se encontraron productos.</CommandEmpty>
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
                                                                            {p.code} - {p.name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {(assignment.productIds || []).map((productId, productIndex) => {
                                                        const product = allProducts.find(p => p.id === productId);
                                                        return (
                                                            <Badge key={`${productId}-${productIndex}`} variant="outline" className="flex items-center gap-1">
                                                                {product?.name}
                                                                <button
                                                                    onClick={() => removeProductFromAssignment(index, productIndex)}
                                                                    className="rounded-full hover:bg-black/20"
                                                                    disabled={!canEdit}
                                                                >
                                                                    <X className="h-3 w-3"/>
                                                                </button>
                                                            </Badge>
                                                        )
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => removeAssignment(index)} disabled={!canEdit}>
                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                            <Button variant="outline" onClick={addAssignment} disabled={!canEdit}>Añadir Servicio</Button>
                        </CardContent>
                    </Card>
                    
                    <Card>
                         <CardHeader><CardTitle>Fecha del Turno</CardTitle></CardHeader>
                         <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Fecha</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")} disabled={!isReceptionOrAdmin}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                         </CardContent>
                    </Card>

                 </div>
                 <div className="space-y-4">
                    {isReceptionOrAdmin && isEditing && (
                    <Card>
                        <CardHeader><CardTitle>Acciones del Turno</CardTitle></CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <Button variant="outline" className="justify-start" onClick={() => handleStatusChange('completed')} disabled={isStatusChanging || currentStatus === 'completed'}>
                                {isStatusChanging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4 text-green-500" />} Marcar como Completado
                            </Button>
                            <Button variant="outline" className="justify-start" onClick={() => handleStatusChange('cancelled')} disabled={isStatusChanging || currentStatus === 'cancelled'}>
                                {isStatusChanging ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4 text-red-500" />} Cancelar Turno
                            </Button>
                            <Button variant="outline" className="justify-start" onClick={() => handleStatusChange('no-show')} disabled={isStatusChanging || currentStatus === 'no-show'}>
                                {isStatusChanging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4 text-orange-500" />} Marcar como "No se presentó"
                            </Button>
                        </CardContent>
                    </Card>
                    )}

                    <Card>
                        <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                             <div className="space-y-2">
                                <Label htmlFor="notes">Notas del turno</Label>
                                <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, preferencias, etc." className="w-full min-h-[80px] p-2 border rounded-md" disabled={!canEdit}/>
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex justify-between">
                                <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Duración Total:</p>
                                <p className="font-medium">{totalDuration} min</p>
                            </div>
                            {isReceptionOrAdmin && (
                                <div className="flex justify-between font-semibold text-base pt-2">
                                    <p className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Precio Total:</p>
                                    <p>${totalPrice.toFixed(2)}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                     <div className="flex justify-end gap-2">
                        {isReceptionOrAdmin && isEditing && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isSaving}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar Turno
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2"><AlertCircle/>¿Estás seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción es permanente y no se puede deshacer. Se eliminará el turno de forma definitiva.
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
                        <Button variant="ghost" onClick={handleBack} disabled={isSaving}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving || !canEdit}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {isEditing ? 'Guardar Cambios' : 'Crear Turno'}
                        </Button>
                    </div>
                 </div>
             </div>
         </div>
         </>
     );
}
