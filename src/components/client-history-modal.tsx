
'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Appointment, Client } from '@/lib/types';
import { format, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, Scissors, MessageCircle } from 'lucide-react';
import { WhatsAppReminderButton } from './whatsapp-reminder-button';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  clientName: string;
  clientPhone?: string;
}


export function ClientHistoryModal({ isOpen, onClose, appointments, clientName, clientPhone }: ClientHistoryModalProps) {
  if (!isOpen) return null;

  const getStatusVariant = (status: Appointment['status']) => {
    switch (status) {
      case 'completed': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'no-show': return 'destructive';
      case 'waiting': return 'default';
      default: return 'outline';
    }
  }
  const getStatusText = (status: Appointment['status']) => {
    const statusMap = {
        'completed': 'Completado',
        'cancelled': 'Cancelado',
        'confirmed': 'Confirmado',
        'waiting': 'En Espera',
        'no-show': 'No se presentó',
        'facturado': 'Facturado'
    }
    return statusMap[status];
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de {clientName}</DialogTitle>
          <DialogDescription>
            Mostrando {appointments.length} visita(s) en total.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {appointments.length > 0 ? (
              appointments.map((appt, index) => (
                <div key={appt.id}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(appt.date), 'PPP', { locale: es })}
                            <span className="text-muted-foreground font-normal flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {format(new Date(appt.date), 'p', { locale: es })}
                            </span>
                        </div>
                         <div className="flex flex-wrap gap-1">
                            {(Array.isArray(appt.serviceNames) ? appt.serviceNames : [appt.serviceNames]).map(name => (
                                <Badge key={name} variant="outline">{name}</Badge>
                            ))}
                        </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Scissors className="h-4 w-4" />
                        Atendido por: {appt.employeeName}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(appt.status)}>{getStatusText(appt.status)}</Badge>
                  </div>
                  {index < appointments.length - 1 && <Separator className="my-4" />}
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Este cliente aún no tiene un historial de visitas.</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
           <WhatsAppReminderButton
              appointments={appointments}
              clientName={clientName}
              clientPhone={clientPhone}
            />
          <Button variant="default" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    