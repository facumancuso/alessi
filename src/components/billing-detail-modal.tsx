
'use client';
import { useMemo, useState, useEffect, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Appointment, Service, Product } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, Scissors, Package, User, DollarSign, Briefcase, StickyNote, Loader2 } from 'lucide-react';
import { getServices, getProducts } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateAppointment } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

interface BillingGroup {
    id: string;
    customerName: string;
    customerEmail: string;
    date: Date;
    appointments: Appointment[];
}

interface BillingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  billingGroup: BillingGroup | null;
}

export function BillingDetailModal({ isOpen, onClose, billingGroup }: BillingDetailModalProps) {
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [notes, setNotes] = useState('');
    const [isSaving, startSaveTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        getServices().then(setAllServices);
        getProducts().then(setAllProducts);
    }, []);
    
    useEffect(() => {
        if (billingGroup && billingGroup.appointments.length > 0) {
            // Combine notes from all appointments in the group
            const combinedNotes = billingGroup.appointments.map(a => a.notes || '').filter(Boolean).join('\n---\n');
            setNotes(combinedNotes);
        }
    }, [billingGroup]);

    const { totalServices, totalProducts, grandTotal, allServiceNames, allEmployeeNames } = useMemo(() => {
        if (!billingGroup) return { totalServices: 0, totalProducts: 0, grandTotal: 0, allServiceNames: [], allEmployeeNames: [] };
        
        const allAppointments = billingGroup.appointments;
        const allServiceIds = allAppointments.flatMap(a => (a.assignments || []).map(as => as.serviceId));
        const allProductIds = allAppointments.flatMap(a => a.productIds || []);
        
        const uniqueEmployeeNames = [...new Set(allAppointments.map(a => a.employeeName).filter(Boolean))];

        const services = allServices.filter(s => allServiceIds.includes(s.id));
        const products = allProducts.filter(p => allProductIds.includes(p.id));

        const totalServices = services.reduce((sum, s) => sum + s.price, 0);
        const totalProducts = products.reduce((sum, p) => sum + p.price, 0);
        const allServiceNames = services.map(s => s.name);

        return {
            totalServices: totalServices / 100,
            totalProducts: totalProducts / 100,
            grandTotal: (totalServices + totalProducts) / 100,
            allServiceNames,
            allEmployeeNames: uniqueEmployeeNames
        }
    }, [billingGroup, allServices, allProducts]);

    const handleSaveNote = () => {
        if (!billingGroup || billingGroup.appointments.length === 0) return;
        // This will save the combined note to the first appointment of the group.
        // A more complex implementation could distribute notes, but this is a simple approach.
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle de Facturación</DialogTitle>
          <DialogDescription>
            Resumen de la visita de {billingGroup.customerName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            {/* Detalles del Cliente y Turno */}
            <div className="space-y-2">
                <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> <strong>Cliente:</strong> {billingGroup.customerName}</p>
                <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> <strong>Fecha:</strong> {format(displayDate, 'PPP', { locale: es })}</p>
                <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" /> <strong>Atendido por:</strong> {allEmployeeNames.join(', ')}</p>
            </div>
            
            <Separator />

            {/* Servicios */}
            <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2"><Scissors className="h-4 w-4"/>Servicios</h4>
                {allServiceNames.map(name => <p key={name} className="text-sm pl-6">{name}</p>)}
                <div className="flex justify-between pl-6 pt-1 text-sm font-medium">
                    <span>Subtotal Servicios:</span>
                    <span>${totalServices.toFixed(2)}</span>
                </div>
            </div>

            {/* Productos */}
            {billingGroup.appointments.some(a => a.productIds && a.productIds.length > 0) && (
                <>
                <Separator />
                <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4"/>Productos</h4>
                    {allProducts.filter(p => billingGroup.appointments.some(a => a.productIds?.includes(p.id))).map(p => (
                        <p key={p.id} className="text-sm pl-6">{p.name}</p>
                    ))}
                    <div className="flex justify-between pl-6 pt-1 text-sm font-medium">
                        <span>Subtotal Productos:</span>
                        <span>${totalProducts.toFixed(2)}</span>
                    </div>
                </div>
                </>
            )}

            <Separator />
            
            {/* Notas */}
            <div className="space-y-2">
                <Label htmlFor="billing-notes" className="font-semibold flex items-center gap-2"><StickyNote className="h-4 w-4"/>Notas de Facturación</Label>
                <Textarea id="billing-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Añade notas sobre el pago, referencia, etc."/>
                <Button size="sm" onClick={handleSaveNote} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Guardar Nota
                </Button>
            </div>

            <Separator />

            {/* Total */}
             <div className="flex justify-between items-center text-lg font-bold pt-2">
                <p className="flex items-center gap-2"><DollarSign className="h-5 w-5"/>Total a Facturar</p>
                <span>${grandTotal.toFixed(2)}</span>
             </div>
        </div>
        <DialogFooter>
          <Button variant="default" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
