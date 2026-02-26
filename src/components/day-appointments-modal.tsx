'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Appointment } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, User, Scissors, Pencil, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  date: Date | null;
  onEditAppointment: (appointment: Appointment) => void;
  onAddAppointment: (date: Date) => void;
}

export function DayAppointmentsModal({ isOpen, onClose, appointments, date, onEditAppointment, onAddAppointment }: DayAppointmentsModalProps) {
  if (!isOpen || !date) return null;

  const getAppointmentColorClasses = (appointment: Appointment) => {
    if (appointment.status === 'cancelled') {
      return 'bg-red-100 border-red-500 text-red-900';
    }

    const customerKey = appointment.customerEmail || appointment.customerName;
    const clientAppointmentsSameDay = appointments.filter(appt => (appt.customerEmail || appt.customerName) === customerKey).length;

    if (clientAppointmentsSameDay >= 2) {
      return 'bg-yellow-100 border-yellow-500 text-yellow-900';
    }

    return 'bg-blue-100 border-blue-500 text-blue-900';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Turnos del {format(date, 'PPP', { locale: es })}
          </DialogTitle>
          <DialogDescription>
            {appointments.length > 0 ? `Hay ${appointments.length} turno(s) para este día.` : 'No hay turnos para este día.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {appointments.length > 0 ? (
              appointments.map((appt, index) => (
                <div key={appt.id}>
                  <div className={cn('flex justify-between items-start rounded-md border p-3', getAppointmentColorClasses(appt))}>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {appt.customerName}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Scissors className="h-4 w-4" />
                        {appt.employeeName}
                      </p>
                       <div className="flex flex-wrap gap-1">
                        {(Array.isArray(appt.serviceNames) ? appt.serviceNames : [appt.serviceNames]).map(name => (
                            <Badge key={name} variant="secondary">{name}</Badge>
                        ))}
                       </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onEditAppointment(appt)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Editar Turno</span>
                    </Button>
                  </div>
                  {index < appointments.length - 1 && <Separator className="my-4" />}
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>No hay turnos agendados para este día.</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-between gap-2">
            <Button onClick={() => onAddAppointment(date)} variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Turno
            </Button>
          <Button variant="default" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
