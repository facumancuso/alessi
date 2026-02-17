
'use client';
import { useState, useEffect } from 'react';
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

export default function MyDayPage() {
  const { currentUser } = useCurrentUser();
  const [dailyAppointments, setDailyAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAppointments, setHistoryAppointments] = useState<Appointment[]>([]);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!currentUser) return;

      setLoading(true);
      try {
        // We get ALL appointments from the data source
        const allAppointments = await getAppointments();
        
        // Then we filter them on the client-side
        const todayAppointments = allAppointments
          .filter(appt => 
            (appt.assignments || []).some(a => a.employeeId === currentUser.id) && 
            isToday(new Date(appt.date))
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        setDailyAppointments(todayAppointments);
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
        setDailyAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchAppointments();
    }
  }, [currentUser]);

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
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Historial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyAppointments.length > 0 ? (
                  dailyAppointments.map(appt => (
                    <TableRow key={appt.id}>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {format(new Date(appt.date), 'p', { locale: es })}
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
                          {(Array.isArray(appt.serviceNames) ? appt.serviceNames : [appt.serviceNames]).map(name => (
                            <Badge key={name} variant="secondary">{name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(appt.status)} className="capitalize">{getStatusText(appt.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleShowHistory(appt.customerEmail); }}>
                             <History className="h-4 w-4" />
                             <span className="sr-only">Ver Historial</span>
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
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

    