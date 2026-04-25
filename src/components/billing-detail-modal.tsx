
'use client';
import { useMemo, useState, useEffect, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Appointment, Service, Product } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Scissors, Package, User, Briefcase, StickyNote, Loader2, CreditCard, Banknote } from 'lucide-react';
import { getServices, getProducts } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateAppointment, billAllClientAppointments } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

interface BillingGroup {
    id: string;
    customerName: string;
    customerEmail: string;
    date: Date;
    appointments: Appointment[];
    appointmentIds: string[];
}

interface BillingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  billingGroup: BillingGroup | null;
  onBill?: () => void;
}

export function BillingDetailModal({ isOpen, onClose, billingGroup, onBill }: BillingDetailModalProps) {
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [notes, setNotes] = useState('');
    const [isSaving, startSaveTransition] = useTransition();
    const [isBilling, startBillTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        getServices().then(setAllServices);
        getProducts().then(setAllProducts);
    }, []);

    useEffect(() => {
        if (billingGroup && billingGroup.appointments.length > 0) {
            const combinedNotes = billingGroup.appointments.map(a => a.notes || '').filter(Boolean).join('\n---\n');
            setNotes(combinedNotes);
        }
    }, [billingGroup]);

    const {
        totalServices,
        totalProducts,
        grandTotal,
        totalServicesCash,
        totalProductsCash,
        grandTotalCash,
        serviceLines,
        productLines,
        allEmployeeNames,
    } = useMemo(() => {
        if (!billingGroup) {
            return {
                totalServices: 0,
                totalProducts: 0,
                grandTotal: 0,
                totalServicesCash: 0,
                totalProductsCash: 0,
                grandTotalCash: 0,
                serviceLines: [] as Service[],
                productLines: [] as Product[],
                allEmployeeNames: [] as string[],
            };
        }

        const allAppointments = billingGroup.appointments;
        const allServiceIds = allAppointments.flatMap(a => (a.assignments || []).map(as => as.serviceId));
        const allProductIds = allAppointments.flatMap(a => a.productIds || []);
        const uniqueEmployeeNames = [...new Set(allAppointments.map(a => a.employeeName).filter(Boolean))];

        const services = allServices.filter(s => allServiceIds.includes(s.id));
        const products = allProducts.filter(p => allProductIds.includes(p.id));

        const totalServices = services.reduce((sum, s) => sum + s.price, 0);
        const totalProducts = products.reduce((sum, p) => sum + p.price, 0);
        const totalServicesCash = services.reduce((sum, s) => sum + (s.cashPrice ?? s.price), 0);
        const totalProductsCash = products.reduce((sum, p) => sum + (p.cashPrice ?? p.price), 0);

        return {
            totalServices: totalServices / 100,
            totalProducts: totalProducts / 100,
            grandTotal: (totalServices + totalProducts) / 100,
            totalServicesCash: totalServicesCash / 100,
            totalProductsCash: totalProductsCash / 100,
            grandTotalCash: (totalServicesCash + totalProductsCash) / 100,
            serviceLines: services,
            productLines: products,
            allEmployeeNames: uniqueEmployeeNames,
        };
    }, [billingGroup, allServices, allProducts]);

    const canBill = billingGroup?.appointments.some(a => a.status === 'completed') ?? false;

    const handleBill = () => {
        if (!billingGroup) return;
        startBillTransition(async () => {
            try {
                await billAllClientAppointments(billingGroup.appointmentIds);
                toast({ title: 'Turno/s cobrado/s', description: 'Los turnos fueron marcados como cobrados.' });
                onBill?.();
                onClose();
            } catch (e) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cobrar el grupo.' });
            }
        });
    };

    const handleSaveNote = () => {
        if (!billingGroup || billingGroup.appointments.length === 0) return;
        const firstAppointmentId = billingGroup.appointments[0].id;
        startSaveTransition(async () => {
            try {
                await updateAppointment(firstAppointmentId, { notes });
                toast({ title: 'Nota Guardada', description: 'La nota del turno ha sido actualizada.' });
            } catch (e) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la nota.' });
            }
        });
    };

    if (!isOpen || !billingGroup) return null;

    const displayDate = new Date(billingGroup.date);
    const hasProducts = productLines.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="flex flex-col w-full max-h-[92dvh] overflow-hidden sm:max-w-md p-0">
                {/* Header fijo */}
                <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
                    <DialogTitle className="text-base">Detalle de Facturación</DialogTitle>
                    <DialogDescription className="text-sm">
                        Visita de <span className="font-medium text-foreground">{billingGroup.customerName}</span>
                    </DialogDescription>
                </DialogHeader>

                {/* Cuerpo scrolleable */}
                <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-2">

                    {/* Info del cliente */}
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{billingGroup.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{format(displayDate, 'PPP', { locale: es })}</span>
                        </div>
                        {allEmployeeNames.length > 0 && (
                            <div className="flex items-start gap-2">
                                <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="break-words">{allEmployeeNames.join(', ')}</span>
                            </div>
                        )}
                    </div>

                    {/* Servicios */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                            <Scissors className="h-3.5 w-3.5" /> Servicios
                        </p>
                        <div className="space-y-1">
                            {serviceLines.map(s => (
                                <div key={s.id} className="flex items-center justify-between text-sm">
                                    <span className="text-foreground">{s.name}</span>
                                    <span className="text-muted-foreground tabular-nums">${(s.price / 100).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="rounded-md bg-muted/40 px-3 py-2 text-center">
                                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><CreditCard className="h-3 w-3" />Tarjeta</p>
                                <p className="text-sm font-semibold tabular-nums">${totalServices.toFixed(2)}</p>
                            </div>
                            <div className="rounded-md bg-muted/40 px-3 py-2 text-center">
                                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Banknote className="h-3 w-3" />Efectivo</p>
                                <p className="text-sm font-semibold tabular-nums">${totalServicesCash.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Productos */}
                    {hasProducts && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                    <Package className="h-3.5 w-3.5" /> Productos
                                </p>
                                <div className="space-y-1">
                                    {productLines.map(p => (
                                        <div key={p.id} className="flex items-center justify-between text-sm">
                                            <span className="text-foreground">{p.name}</span>
                                            <span className="text-muted-foreground tabular-nums">${(p.price / 100).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="rounded-md bg-muted/40 px-3 py-2 text-center">
                                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><CreditCard className="h-3 w-3" />Tarjeta</p>
                                        <p className="text-sm font-semibold tabular-nums">${totalProducts.toFixed(2)}</p>
                                    </div>
                                    <div className="rounded-md bg-muted/40 px-3 py-2 text-center">
                                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Banknote className="h-3 w-3" />Efectivo</p>
                                        <p className="text-sm font-semibold tabular-nums">${totalProductsCash.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <Separator />

                    {/* Totales */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border bg-background px-3 py-3 text-center shadow-sm">
                            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 mb-1">
                                <CreditCard className="h-3.5 w-3.5" /> Total Tarjeta
                            </p>
                            <p className="text-xl font-bold tabular-nums">${grandTotal.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border bg-background px-3 py-3 text-center shadow-sm">
                            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 mb-1">
                                <Banknote className="h-3.5 w-3.5" /> Total Efectivo
                            </p>
                            <p className="text-xl font-bold tabular-nums">${grandTotalCash.toFixed(2)}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Notas */}
                    <div className="space-y-2 pb-1">
                        <Label htmlFor="billing-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                            <StickyNote className="h-3.5 w-3.5" /> Notas
                        </Label>
                        <Textarea
                            id="billing-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Añadí notas sobre el pago, referencia, etc."
                            className="resize-none text-sm"
                            rows={3}
                        />
                        <Button size="sm" onClick={handleSaveNote} disabled={isSaving} className="w-full sm:w-auto">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Nota
                        </Button>
                    </div>
                </div>

                {/* Footer fijo */}
                <DialogFooter className="px-5 py-3 border-t shrink-0 flex-row gap-2">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cerrar</Button>
                    {canBill && (
                        <Button className="flex-1" onClick={handleBill} disabled={isBilling}>
                            {isBilling
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <CreditCard className="mr-2 h-4 w-4" />
                            }
                            Cobrar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
