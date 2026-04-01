
'use client';
import { useState, useEffect, useRef, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getAppointments, getClientByEmail } from '@/lib/data';
import type { Appointment, Client } from '@/lib/types';
import { isToday, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, History, Briefcase, Loader2 } from 'lucide-react';
import { ClientHistoryModal } from '@/components/client-history-modal';
import { useCurrentUser } from '../user-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { updateAssignmentStatus } from '@/lib/actions';

export default function MyDayPage() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [dailyAppointments, setDailyAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAppointments, setHistoryAppointments] = useState<Appointment[]>([]);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const previousStatusesRef = useRef<Map<string, Appointment['status']>>(new Map());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const fetchAppointments = async (showLoader = false) => {
      if (!currentUser) return;

      if (showLoader) {
        setLoading(true);
      }

      try {
        // We get ALL appointments from the data source
        const allAppointments = await getAppointments();
        
        // Then we filter them on the client-side
        const todayAppointments = allAppointments
          .filter(appt => 
            (appt.assignments || []).some(a => a.employeeId === currentUser.id) && 
            isToday(new Date(appt.date)) &&
            appt.status !== 'cancelled'
          )
          .sort((a, b) => {
            // Get the employee's specific time for each appointment
            const getEmployeeTime = (appt: Appointment) => {
              const myAssignment = (appt.assignments || []).find(a => a.employeeId === currentUser.id);
              if (myAssignment?.time) {
                return new Date(`${format(new Date(appt.date), 'yyyy-MM-dd')}T${myAssignment.time}:00`).getTime();
              }
              return new Date(appt.date).getTime();
            };
            
            return getEmployeeTime(a) - getEmployeeTime(b);
          });

        // Notify employee when a known appointment transitions to waiting
        const previousStatuses = previousStatusesRef.current;
        todayAppointments.forEach(appt => {
          const previousStatus = previousStatuses.get(appt.id);
          if (previousStatus && previousStatus !== 'waiting' && appt.status === 'waiting') {
            toast({
              title: 'Cliente en espera',
              description: `${appt.customerName} llegó y está esperando atención.`,
            });

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('Cliente en espera', {
                body: `${appt.customerName} está en espera (${format(new Date(appt.date), 'p', { locale: es })}).`,
              });
            }
          }
        });

        previousStatusesRef.current = new Map(todayAppointments.map(appt => [appt.id, appt.status]));
        
        setDailyAppointments(todayAppointments);
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
        setDailyAppointments([]);
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    };

    if (currentUser) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => undefined);
      }

      fetchAppointments(true);
      const interval = setInterval(() => {
        fetchAppointments(false);
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [currentUser, toast]);

  const refreshAppointments = async () => {
    if (!currentUser) return;
    try {
      const allAppointments = await getAppointments();
      const todayAppointments = allAppointments
        .filter(appt =>
          (appt.assignments || []).some(a => a.employeeId === currentUser.id) &&
          isToday(new Date(appt.date)) &&
          appt.status !== 'cancelled'
        )
        .sort((a, b) => {
          // Get the employee's specific time for each appointment
          const getEmployeeTime = (appt: Appointment) => {
            const myAssignment = (appt.assignments || []).find(a => a.employeeId === currentUser.id);
            if (myAssignment?.time) {
              return new Date(`${format(new Date(appt.date), 'yyyy-MM-dd')}T${myAssignment.time}:00`).getTime();
            }
            return new Date(appt.date).getTime();
          };
          
          return getEmployeeTime(a) - getEmployeeTime(b);
        });
      setDailyAppointments(todayAppointments);
    } catch (error) {
      console.error("Failed to refresh appointments:", error);
    }
  };

  const handleAssignmentStatus = (
    appointmentId: string,
    employeeId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ) => {
    startTransition(async () => {
      await updateAssignmentStatus(appointmentId, employeeId, status);
      await refreshAppointments();
    });
  };

  const handleShowHistory = async (email: string) => {
    const [clientAppointments, clientDetails] = await Promise.all([
      getAppointments().then(apps => apps.filter(app => app.customerEmail === email)),
      getClientByEmail(email)
    ]);
    setHistoryAppointments(clientAppointments);
    setHistoryClient(clientDetails || null);
    setIsHistoryModalOpen(true);
  };

  const getStatusVariant = (status: Appointment['status']) => {
    switch (status) {
      case 'completed': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'in_progress': return 'default';
      case 'waiting': return 'default';
      default: return 'outline';
    }
  }

   const getStatusText = (status: Appointment['status']) => {
        const statusMap = {
          'completed': 'Terminado',
            'cancelled': 'Cancelado',
            'confirmed': 'Confirmado',
            'waiting': 'En Espera',
          'in_progress': 'En Proceso',
            'no-show': 'No Presentado',
            'facturado': 'Facturado'
        }
        return statusMap[status];
    }

  if (loading) {
    return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <ClientHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        appointments={historyAppointments}
        clientName={historyClient?.name || ''}
        clientPhone={historyClient?.mobilePhone}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-6 w-6" />
              Mis Turnos para Hoy
            </CardTitle>
            <CardDescription>
              Estos son tus turnos programados para hoy, {format(new Date(), 'PPP', { locale: es })}. Haz clic en el nombre de un cliente para ver y gestionar su turno.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicios</TableHead>
                  <TableHead>Estado Turno</TableHead>
                  <TableHead>Mi Progreso</TableHead>
                  <TableHead className="text-right">Historial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyAppointments.length > 0 ? (
                  dailyAppointments.map(appt => {
                    const myAssignments = (appt.assignments || [])
                      .map((a, idx) => ({ assignment: a, idx }))
                      .filter(({ assignment }) => assignment.employeeId === currentUser?.id);

                    const myTime = myAssignments[0]?.assignment?.time;
                    const displayDate = myTime
                      ? new Date(`${format(new Date(appt.date), 'yyyy-MM-dd')}T${myTime}:00`)
                      : new Date(appt.date);

                    return (
                      <TableRow key={appt.id}>
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {format(displayDate, 'p', { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="link" asChild className="p-0 h-auto font-medium">
                            <Link href={`/admin/clients/${encodeURIComponent(appt.customerEmail)}`}>
                              {appt.customerName}
                            </Link>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {myAssignments.map(({ idx }) => {
                              const name = appt.serviceNames?.[idx];
                              return name ? <Badge key={idx} variant="secondary">{name}</Badge> : null;
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(appt.status)} className="capitalize">{getStatusText(appt.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            {myAssignments.map(({ assignment, idx }) => {
                              const serviceName = appt.serviceNames?.[idx] ?? 'Servicio';
                              const assignmentStatus = assignment.status ?? 'pending';
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">{serviceName}:</span>
                                  {assignmentStatus === 'completed' ? (
                                    <Badge className="bg-green-600 text-white">Terminado</Badge>
                                  ) : assignmentStatus === 'in_progress' ? (
                                    <>
                                      <Badge variant="default">En Proceso</Badge>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isPending}
                                        onClick={() => handleAssignmentStatus(appt.id, assignment.employeeId, 'completed')}
                                      >
                                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Finalizar'}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Badge variant="outline">Pendiente</Badge>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isPending}
                                        onClick={() => handleAssignmentStatus(appt.id, assignment.employeeId, 'in_progress')}
                                      >
                                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Iniciar'}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleShowHistory(appt.customerEmail); }}>
                            <History className="h-4 w-4" />
                            <span className="sr-only">Ver Historial</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No tienes turnos para hoy.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

    