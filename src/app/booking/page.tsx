

'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Calendar as CalendarIcon, Clock, ChevronLeft, Loader2, PartyPopper, CreditCard, X, DollarSign, User as UserIcon, Package, Scissors, History, Check, XCircle, Ban, StickyNote, ChevronsUpDown, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import type { Service, Client, Appointment, User } from '@/lib/types';
import { createBooking, type BookingFormState, updateAppointment, updateAppointmentStatus } from '@/lib/actions';
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

const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

function SubmitBookingButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending} className="w-1/2">
            {pending ? <Loader2 className="animate-spin" /> : "Pagar y Confirmar"}
        </Button>
    );
}

export default function BookingPage() {
    const { toast } = useToast();
    const [allServices, setAllServices] = useState<Service[]>([]);
    
    // Public booking form state
    const [state, formAction] = useFormState(createBooking, { message: '', errors: {} });
    const [serviceId, setServiceId] = useState('');
    const [date, setDate] = useState<Date | undefined>();
    const [time, setTime] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');

    useEffect(() => {
        getServices().then(setAllServices);
    }, []);

    useEffect(() => {
        if (state?.errors?._form) {
        toast({
            variant: "destructive",
            title: "Error en la reserva",
            description: state.errors._form.join(", "),
        });
        }
    }, [state, toast]);
    const [step, setStep] = useState(1);
    const handleNextStep = () => setStep((prev) => prev + 1);
    const handlePrevStep = () => setStep((prev) => prev - 1);
    
    const publicSelectedService = allServices.find(s => s.id === serviceId);

    // This is the public booking form
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 p-4 sm:p-6 md:p-8">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-headline font-bold text-primary">Reservar un Turno</h1>
                <p className="text-muted-foreground">Elige tu servicio y encuentra el momento perfecto para ti.</p>
            </div>
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader className="text-center space-y-2">
                    <UserIcon className="h-10 w-10 text-primary mx-auto" />
                    <CardTitle className="text-2xl font-headline">
                        Completa los datos
                    </CardTitle>
                    <CardDescription>
                        Sigue los pasos para confirmar tu reserva.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="space-y-6">
                        <input type="hidden" name="serviceId" value={serviceId} />
                        <input type="hidden" name="date" value={date?.toISOString() || ''} />
                        <input type="hidden" name="time" value={time} />

                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in-0 duration-500">
                            <div className="space-y-2">
                                <Label htmlFor="service">1. Selecciona un servicio</Label>
                                <Select onValueChange={setServiceId} defaultValue={serviceId}>
                                <SelectTrigger id="service">
                                    <SelectValue placeholder="Elige un servicio..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allServices.map((service) => (
                                    <SelectItem key={service.id} value={service.id}>
                                        {service.name} - ${service.price / 100}
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                {state?.errors?.serviceId && <p className="text-sm font-medium text-destructive">{state.errors.serviceId}</p>}
                            </div>
                            <Button onClick={handleNextStep} disabled={!serviceId} className="w-full bg-accent hover:bg-accent/90">
                                Siguiente
                            </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in-0 duration-500">
                                <div className="space-y-2">
                                    <Label>2. Elige fecha y hora</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} disabled={(day) => day < new Date(new Date().setDate(new Date().getDate() - 1))}/>
                                        </PopoverContent>
                                    </Popover>
                                    {state?.errors?.date && <p className="text-sm font-medium text-destructive">{state.errors.date}</p>}
                                </div>
                                {date && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {timeSlots.map((slot) => (
                                            <Button key={slot} type="button" variant={time === slot ? 'default' : 'outline'} onClick={() => setTime(slot)}>
                                                {slot}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                                {state?.errors?.time && <p className="text-sm font-medium text-destructive">{state.errors.time}</p>}
                                <div className="flex justify-between">
                                    <Button variant="ghost" type="button" onClick={handlePrevStep}><ChevronLeft className="mr-2 h-4 w-4"/> Atrás</Button>
                                    <Button onClick={handleNextStep} type="button" disabled={!date || !time} className="bg-accent hover:bg-accent/90">Siguiente</Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in-0 duration-500">
                                <div className="space-y-2">
                                    <Label>3. Tus datos</Label>
                                    <Input name="name" placeholder="Nombre completo" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                                    {state?.errors?.name && <p className="text-sm font-medium text-destructive">{state.errors.name}</p>}
                                    <Input name="email" type="email" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
                                    {state?.errors?.email && <p className="text-sm font-medium text-destructive">{state.errors.email}</p>}
                                </div>
                                <Alert>
                                    <PartyPopper className="h-4 w-4" />
                                    <AlertTitle>Confirmación</AlertTitle>
                                    <AlertDescription>
                                        Estás reservando <strong>{publicSelectedService?.name}</strong> el día <strong>{date ? format(date, "PPP", { locale: es }) : ''}</strong> a las <strong>{time}</strong>.
                                    </AlertDescription>
                                </Alert>
                                <Alert className="bg-primary/10">
                                    <CreditCard className="h-4 w-4" />
                                    <AlertTitle>Pago Requerido</AlertTitle>
                                    <AlertDescription>
                                    Para confirmar tu reserva, se requiere el pago completo. Serás redirigido a Mercado Pago para completar la transacción.
                                    </AlertDescription>
                                </Alert>
                                <div className="flex justify-between">
                                    <Button variant="ghost" type="button" onClick={handlePrevStep}><ChevronLeft className="mr-2 h-4 w-4"/> Atrás</Button>
                                    <SubmitBookingButton />
                                </div>
                            </div>
                        )}
                        </form>
                </CardContent>
            </Card>
        </div>
    );
}

    