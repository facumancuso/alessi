
'use client';
import { useState, useEffect, useMemo, useTransition } from 'react';
import Link from "next/link";
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getClientByEmail, getAppointmentsByClient, getServices, getProducts } from "@/lib/data";
import { updateAppointment, updateAppointmentStatus } from "@/lib/actions";
import { notFound } from "next/navigation";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock, DollarSign, ArrowLeft, Package, Scissors, User, Briefcase, PlusCircle, Loader2, Play, Check, X, StickyNote, Plus, Minus, AlertCircle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment, Client, Service, Product, AppointmentAssignment } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '../../user-context';
import { ClientModal } from '@/components/client-modal';


function getBadgeVariant(status: Appointment['status']) {
    switch (status) {
        case 'confirmed': return 'default';
        case 'cancelled': return 'destructive';
        case 'completed': return 'secondary';
        case 'waiting': return 'outline';
        case 'facturado': return 'default';
        default: return 'outline';
    }
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const decodedEmail = decodeURIComponent(params.email as string);
  const { toast } = useToast();
  
  const [client, setClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, startUpdateTransition] = useTransition();

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertAction, setAlertAction] = useState<'start' | 'finish' | null>(null);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertDescription, setAlertDescription] = useState('');

  const { upcomingAppointment, pastAppointments } = useMemo(() => {
    const sorted = [...allAppointments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const upcoming = sorted.find(appt => isToday(new Date(appt.date)) && (appt.status === 'confirmed' || appt.status === 'waiting'));
    const past = sorted.filter(appt => appt.id !== upcoming?.id);
    return { upcomingAppointment: upcoming, pastAppointments: past };
  }, [allAppointments]);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    getServices().then(setAllServices);
    getProducts().then(setAllProducts);
  }, []);

  useEffect(() => {
    if (upcomingAppointment) {
        setSelectedProductIds(upcomingAppointment.productIds || []);
        setNotes(upcomingAppointment.notes || '');
    }
  }, [upcomingAppointment]);

  const groupedProducts = useMemo(() => {
    const productCounts: { [key: string]: { product: Product, count: number } } = {};
    (selectedProductIds || []).forEach(id => {
      const product = allProducts.find(p => p.id === id);
      if (product) {
        if (productCounts[id]) {
          productCounts[id].count++;
        } else {
          productCounts[id] = { product, count: 1 };
        }
      }
    });
    return Object.values(productCounts);
  }, [selectedProductIds, allProducts]);


  const { totalDuration } = useMemo(() => {
    if (!upcomingAppointment) return { totalDuration: 0 };
    const duration = (upcomingAppointment.assignments || []).reduce((sum, s) => sum + (s.duration || 0), 0);
    return { totalDuration: duration };
  }, [upcomingAppointment]);
  
  const fetchClientData = async () => {
    setLoading(true);
    try {
      const [clientData, appointmentData] = await Promise.all([
        getClientByEmail(decodedEmail),
        getAppointmentsByClient(decodedEmail)
      ]);
      
      if (!clientData) {
        notFound();
      }

      setClient(clientData);
      setAllAppointments(appointmentData);
    } catch (error) {
      console.error("Failed to fetch client data", error);
      notFound();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [decodedEmail]);
  
  const handleSaveNote = () => {
      if (!upcomingAppointment) return;
      startUpdateTransition(async () => {
          try {
              const updatedAppt = await updateAppointment(upcomingAppointment.id, { notes });
              if (updatedAppt) {
                setAllAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
                toast({ title: 'Nota Guardada' });
              }
          } catch (e) {
              toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la nota.' });
          }
      });
  };

  const openConfirmationAlert = (action: 'start' | 'finish') => {
    setAlertAction(action);
    if (action === 'start') {
        setAlertTitle('¿Iniciar Turno?');
        setAlertDescription('Esto marcará el turno como "en espera" y notificará al peluquero. ¿Continuar?');
    } else {
        setAlertTitle('¿Finalizar Turno?');
        setAlertDescription('Esto marcará el turno como "completado" y lo enviará a facturación. ¿Continuar?');
    }
    setIsAlertOpen(true);
  };

  const handleStartAppointment = async () => {
    if (!upcomingAppointment) return;
    startUpdateTransition(async () => {
      const updatedAppt = await updateAppointmentStatus(upcomingAppointment.id, 'waiting');
       if (updatedAppt) {
         setAllAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
         toast({ title: 'Turno Iniciado' });
       }
    });
  }

  const handleFinishAppointment = async () => {
    if (!upcomingAppointment) return;
    startUpdateTransition(async () => {
       await updateAppointmentStatus(upcomingAppointment.id, 'completed');
       toast({ title: 'Turno Finalizado' });
        if (currentUser?.role === 'Peluquero') {
            router.push('/admin/my-day');
        } else {
            fetchClientData();
        }
    });
  }


  const handleConfirmAction = () => {
    if (alertAction === 'start') {
        handleStartAppointment();
    } else if (alertAction === 'finish') {
        handleFinishAppointment();
    }
    setIsAlertOpen(false);
    setAlertAction(null);
  };
  
  const handleAddAssignment = (serviceId: string) => {
      if (!serviceId || !upcomingAppointment) return;
      const service = allServices.find(s => s.id === serviceId);
      if (!service) return;

      const newAssignment: AppointmentAssignment = {
          serviceId: service.id,
          employeeId: currentUser?.id || '', // Default to current user or handle differently
          time: format(new Date(), 'HH:mm'), // Default to now
          duration: service.duration,
      };

      const newAssignments = [...(upcomingAppointment.assignments || []), newAssignment];

      startUpdateTransition(async () => {
        const updatedAppt = await updateAppointment(upcomingAppointment.id, { assignments: newAssignments });
        if (updatedAppt) {
            setAllAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
            toast({title: "Servicio añadido"});
        }
      });
  }

  const handleRemoveAssignment = (assignmentIndex: number) => {
      if(!upcomingAppointment) return;
      if (assignmentIndex < 0 || assignmentIndex >= (upcomingAppointment.assignments || []).length) return;

      const newAssignments = [...(upcomingAppointment.assignments || [])];
      newAssignments.splice(assignmentIndex, 1);
      
      startUpdateTransition(async () => {
        const updatedAppt = await updateAppointment(upcomingAppointment.id, { assignments: newAssignments });
        if (updatedAppt) {
            setAllAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
            toast({title: "Servicio eliminado"});
        }
      });
  }

  const handleAddProduct = (productId: string) => {
    if (!productId || !upcomingAppointment) return;
    const newProductIds = [...(selectedProductIds || []), productId];
    startUpdateTransition(async () => {
        const updatedAppt = await updateAppointment(upcomingAppointment.id, { productIds: newProductIds });
        if (updatedAppt) {
            setAllAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
            setSelectedProductIds(updatedAppt.productIds || []);
            toast({title: "Producto añadido"});
        }
    });
  }
  
  const handleRemoveProduct = (productId: string) => {
    if (!upcomingAppointment) return;
    const indexToRemove = selectedProductIds.lastIndexOf(productId);
    if (indexToRemove === -1) return;
    const newProductIds = [...selectedProductIds];
    newProductIds.splice(indexToRemove, 1);
    startUpdateTransition(async () => {
        const updatedAppt = await updateAppointment(upcomingAppointment.id, { productIds: newProductIds });
        if (updatedAppt) {
            setAllAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
            setSelectedProductIds(updatedAppt.productIds || []);
            toast({title: "Producto eliminado"});
        }
    });
  }

  const handleBackClick = () => {
    if (currentUser?.role === 'Peluquero') {
      router.push('/admin/my-day');
    } else {
      router.push('/admin/clients');
    }
  }

  const canManageAppointmentStatus = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente' || currentUser?.role === 'Peluquero';
  const canManageClientData = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente';
  const isHairdresser = currentUser?.role === 'Peluquero';

  if (loading || !client) {
    return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
    <ClientModal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        fetchClientData(); // Refresh data after modal closes
      }}
      client={client}
    />
    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-primary"/>{alertTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                    {alertDescription}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmAction}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Volver</span>
            </Button>
            <h1 className="text-2xl font-bold">Ficha del Cliente</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Datos del Cliente</CardTitle>
                        {canManageClientData && (
                          <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(true)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar Cliente</span>
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex flex-col items-center gap-4 text-center">
                         <Avatar className="h-24 w-24">
                            <AvatarImage src="https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg" alt={client.name} data-ai-hint="person portrait" />
                            <AvatarFallback>{client.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h2 className="text-2xl font-bold">{client.name}</h2>
                            <p className="text-muted-foreground">{client.alias || ''}</p>
                        </div>
                      </div>

                      {!isHairdresser && (
                        <>
                            <Separator/>
                            <p><strong>Email:</strong> {client.email}</p>
                            <p><strong>Teléfono Celular:</strong> {client.mobilePhone || 'N/A'}</p>
                            <p><strong>Teléfono Fijo:</strong> {client.landlinePhone || 'N/A'}</p>
                            <p><strong>Domicilio:</strong> {client.address || 'N/A'}</p>
                            <p><strong>Localidad:</strong> {client.location || 'N/A'}</p>
                            <p><strong>Código Postal:</strong> {client.postalCode || 'N/A'}</p>
                            <Separator/>
                            <p><strong>DNI:</strong> {client.dni || 'N/A'}</p>
                            <p><strong>CUIT:</strong> {client.cuit || 'N/A'}</p>
                            <p><strong>Nombre de Fantasía:</strong> {client.fantasyName || 'N/A'}</p>
                            <p><strong>Categoría:</strong> {client.clientCategory || 'N/A'}</p>
                            <p><strong>Lista de Precios:</strong> {client.priceList || 'N/A'}</p>
                            <p><strong>Vendedor:</strong> {client.salespersonName || 'N/A'}</p>
                            <div className="flex items-center gap-2"><strong>Inactivo:</strong> <Badge variant={client.inactive ? 'destructive' : 'secondary'}>{client.inactive ? 'Sí' : 'No'}</Badge></div>
                        </>
                      )}
                    </CardContent>
                </Card>
                
                {canManageAppointmentStatus && upcomingAppointment && (
                    <Card>
                      <CardHeader><CardTitle>Acciones del Turno</CardTitle></CardHeader>
                      <CardContent className="flex w-full gap-2 pt-2">
                        <Button className="flex-1" variant="outline" onClick={() => openConfirmationAlert('start')} disabled={isUpdating || upcomingAppointment.status !== 'confirmed'}>
                            {isUpdating ? <Loader2 className="animate-spin"/> : <Play className="mr-2"/>} Iniciar
                        </Button>
                        <Button className="flex-1" onClick={() => openConfirmationAlert('finish')} disabled={isUpdating || upcomingAppointment.status !== 'waiting'}>
                            {isUpdating ? <Loader2 className="animate-spin"/> : <Check className="mr-2"/>} Finalizar
                        </Button>
                      </CardContent>
                    </Card>
                )}
            </div>

            <div className="xl:col-span-2 space-y-6">
                 {upcomingAppointment ? (
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Turno Actual</CardTitle>
                                    <CardDescription>
                                        {format(new Date(upcomingAppointment.date), "PPP 'a las' p", { locale: es })}
                                        <Badge variant={getBadgeVariant(upcomingAppointment.status)} className="ml-2 capitalize">{upcomingAppointment.status}</Badge>
                                    </CardDescription>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/admin/appointments/new?id=${upcomingAppointment.id}`}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Servicios en este turno</h4>
                                <div className="space-y-1 text-sm">
                                    {(upcomingAppointment.assignments || []).map((assignment, index) => {
                                        const service = allServices.find(s => s.id === assignment.serviceId);
                                        return (
                                            <div key={`${assignment.serviceId}-${index}`} className="flex items-center justify-between gap-2 bg-secondary/50 p-2 rounded-md">
                                                <span className="flex items-center gap-2"><Scissors className="h-4 w-4 text-muted-foreground"/> {service?.name || 'Servicio desconocido'}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveAssignment(index)} disabled={isUpdating}><X className="h-4 w-4"/></Button>
                                            </div>
                                        );
                                    })}
                                    {(upcomingAppointment.assignments || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Ningún servicio añadido.</p>}
                                </div>
                                <Select onValueChange={handleAddAssignment} disabled={isUpdating} value="">
                                    <SelectTrigger className="mt-2"><SelectValue placeholder="Añadir servicio..." /></SelectTrigger>
                                    <SelectContent>
                                        {allServices.filter(s => !(upcomingAppointment.assignments || []).map(a => a.serviceId).includes(s.id)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator />
                             <div>
                                <h4 className="font-semibold text-sm mb-2">Productos en este turno</h4>
                                <div className="space-y-1 text-sm">
                                     {groupedProducts.map(({ product, count }) => (
                                        <div key={product.id} className="flex items-center justify-between gap-2 bg-secondary/50 p-2 rounded-md">
                                            <span className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground"/> {product.name}</span>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveProduct(product.id)} disabled={isUpdating}><Minus className="h-4 w-4"/></Button>
                                                <span className="w-4 text-center">{count}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddProduct(product.id)} disabled={isUpdating}><Plus className="h-4 w-4"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                    {groupedProducts.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Ningún producto añadido.</p>}
                                </div>
                                <Select onValueChange={handleAddProduct} value="" disabled={isUpdating}>
                                    <SelectTrigger className="mt-2"><SelectValue placeholder="Añadir producto..." /></SelectTrigger>
                                    <SelectContent>
                                        {allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator/>
                            <div>
                                <Label htmlFor="notes">Notas para este turno</Label>
                                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, preferencias, etc."/>
                                <Button onClick={handleSaveNote} disabled={isUpdating} size="sm" className="mt-2">Guardar Nota</Button>
                            </div>
                             <div className="space-y-2 text-sm pt-4 border-t">
                                <div className="flex justify-between font-bold"><span className="text-muted-foreground">Duración total estimada:</span> <span>{totalDuration} min</span></div>
                             </div>
                        </CardContent>
                    </Card>
                ) : (
                     <Card>
                        <CardHeader>
                            <CardTitle>No hay próximas visitas</CardTitle>
                            <CardDescription>Este cliente no tiene turnos programados.</CardDescription>
                        </CardHeader>
                    </Card>
                )}
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Visitas</CardTitle>
                        <CardDescription>Servicios y productos adquiridos por {client.name} en el pasado.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                        {pastAppointments.length > 0 ? pastAppointments.map(appt => (
                            <Link key={appt.id} href={`/admin/appointments/new?id=${appt.id}`} className="block border p-4 rounded-lg hover:bg-secondary transition-colors">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                                    <div>
                                        <p className="font-semibold flex items-center gap-2">
                                            <Calendar className="h-4 w-4" /> 
                                            {format(new Date(appt.date), "PPP", { locale: es })}
                                            <span className="text-muted-foreground font-normal flex items-center gap-2">
                                                <Clock className="h-4 w-4" /> {format(new Date(appt.date), "p", { locale: es })}
                                            </span>
                                        </p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                            <Briefcase className="h-4 w-4" /> 
                                            Atendido por: {appt.employeeName}
                                        </p>
                                    </div>
                                    <Badge variant={getBadgeVariant(appt.status)} className="capitalize self-start">
                                        {appt.status === 'confirmed' ? 'Confirmado' : appt.status === 'cancelled' ? 'Cancelado' : appt.status === 'completed' ? 'Completado' : appt.status}
                                    </Badge>
                                </div>
                                <Separator />
                                <div className="py-4">
                                    <h4 className="font-semibold mb-2">Servicios y Productos</h4>
                                    <div className="text-sm space-y-1">
                                        {appt.serviceNames.map((name, index) => (
                                            <p key={`${name}-${index}`} className="flex items-center gap-2"><Scissors className="h-4 w-4 text-muted-foreground" /> {name}</p>
                                        ))}
                                        {(appt.productIds && appt.productIds.length > 0) && allProducts.filter(p => appt.productIds?.includes(p.id)).map(p => (
                                            <p key={p.id} className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /> {p.name}</p>
                                        ))}
                                    </div>
                                    {appt.notes && (
                                        <>
                                            <Separator className="my-2"/>
                                            <div>
                                                <h4 className="font-semibold mb-1 flex items-center gap-2"><StickyNote className="h-4 w-4"/> Notas de esta visita</h4>
                                                <p className="text-sm text-muted-foreground pl-6">{appt.notes}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </Link>
                        )) : (
                            <p className="text-muted-foreground text-center py-8">No hay historial de visitas para este cliente.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
    </>
  );
}

    