
'use client';
import { useState, useEffect, useRef, useMemo, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAppointments, getUsers, getAppointmentsByClient, getClientByEmail } from '@/lib/data';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, setHours, setMinutes, addMinutes, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter, Clock, PlusCircle, Loader2, Upload, Download, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Appointment, AppointmentAssignment, Client, User } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DayAppointmentsModal } from '@/components/day-appointments-modal';
import { ClientHistoryModal } from '@/components/client-history-modal';
import { useCurrentUser } from '../user-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { importData, exportAppointments } from '@/lib/actions';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const employeeColors = [
    { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-500' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-500' },
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' },
    { bg: 'bg-indigo-100_100', text: 'text-indigo-800', border: 'border-indigo-500' },
    { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' },
    { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-500' },
];

const fallbackColor = { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-500' };


const statusColors: Record<Appointment['status'], string> = {
    'confirmed': 'border-pink-500',
    'waiting': 'border-yellow-500 animate-pulse',
    'completed': 'border-green-500',
    'cancelled': 'border-red-500 opacity-70',
    'no-show': 'border-gray-500 opacity-70',
    'facturado': 'border-blue-500'
}

const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function DayView({
  day,
  viewStartHour,
  viewEndHour,
  viewInterval,
  getAppointmentsForDay,
  handleEditAppointment,
  handleNewAppointment,
  canManageAgenda,
  now,
  employeeFilter,
  timeSlots,
  allEmployees
}: {
  day: Date;
  viewStartHour: number;
  viewEndHour: number;
  viewInterval: number;
  getAppointmentsForDay: (day: Date, employeeId?: string) => Appointment[];
  handleEditAppointment: (appointment: Appointment) => void;
  handleNewAppointment: (day: Date, time: string, employeeId: string) => void;
  canManageAgenda: boolean;
  now: Date;
  employeeFilter: string;
  timeSlots: string[];
  allEmployees: User[];
}) {
    const timeIndicatorRef = useRef<HTMLDivElement>(null);
    const minuteHeight = 1.2;
    const hourHeight = 60 * minuteHeight;
    const totalHours = viewEndHour - viewStartHour;
    const safeInterval = Number.isFinite(viewInterval) && viewInterval > 0 ? viewInterval : 30;

    const getEventTop = (timeStr: string) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        return (totalMinutes - viewStartHour * 60) * minuteHeight;
    };
    
    const getEventHeight = (duration: number) => (duration || 0) * minuteHeight;
    
    const visibleEmployees = (employeeFilter !== 'todos')
            ? allEmployees.filter(e => e.id === employeeFilter)
            : allEmployees;

    const nowIndicatorTop = isSameDay(day, now)
        ? ((now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600) * 60 - viewStartHour * 60) * minuteHeight
        : -1;

    const rowHeight = safeInterval * minuteHeight;
    
    useEffect(() => {
        if (timeIndicatorRef.current && isSameDay(day, now)) {
            timeIndicatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [nowIndicatorTop, day, now]);

    const getEmployeeForAssignment = (assignment: AppointmentAssignment) => {
        const employee = allEmployees.find(e => e.id === assignment.employeeId);
        const employeeIndex = allEmployees.findIndex(e => e.id === assignment.employeeId);
        const color = employeeIndex !== -1 ? (employeeColors[employeeIndex % employeeColors.length] || fallbackColor) : fallbackColor;
        return { employee, color };
    }


    return (
        <div className="flex flex-col">
            <div className="flex sticky top-0 bg-card z-30 border-b">
                 <div className="w-20 flex-shrink-0 border-r pt-4"></div>
                 <div className="flex flex-1">
                    {visibleEmployees.map(employee => (
                        <div key={employee.id} className="flex-1 min-w-[20vw] lg:min-w-[10vw] border-l p-2 text-center font-semibold text-sm">
                            {employee.name}
                            <Badge variant="secondary" className="ml-2">{getAppointmentsForDay(day, employee.id).length}</Badge>
                        </div>
                    ))}
                </div>
            </div>
            <ScrollArea className="w-full whitespace-nowrap" style={{ height: '70vh' }}>
                <div className="relative flex pt-4" style={{ height: totalHours * hourHeight }}>
                    <div className="sticky left-0 bg-card z-20 w-20 text-right pr-2 ">
                        {timeSlots.map((time) => {
                            return (
                                <div key={time} className="relative text-xs text-muted-foreground" style={{ height: rowHeight }}>
                                    <div className="absolute -translate-y-1/2 pr-2">
                                        {time}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex flex-1">
                        {nowIndicatorTop > 0 && (
                            <div
                                ref={timeIndicatorRef}
                                className="absolute w-full h-px bg-red-500 z-40"
                                style={{ top: nowIndicatorTop }}
                            >
                                <div className="absolute -left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500"></div>
                            </div>
                        )}
                        {visibleEmployees.map((employee) => {
                            const dailyAppointments = getAppointmentsForDay(day, employee.id);
                            
                            return (
                                <div key={employee.id} className="flex-1 min-w-[20vw] lg:min-w-[10vw] border-l relative">
                                    {timeSlots.map((time, index) => {
                                        const [h, m] = time.split(':').map(Number);
                                        let borderStyle = 'border-dotted';
                                        if (m === 0) borderStyle = 'border-solid';
                                        if (m === 30) borderStyle = 'border-dashed';

                                        return (
                                        <div 
                                            key={time} 
                                            className={cn("absolute w-full border-t", canManageAgenda && "cursor-pointer hover:bg-secondary/50", borderStyle)} 
                                            style={{ top: index * rowHeight, height: rowHeight }}
                                            onClick={() => canManageAgenda && handleNewAppointment(day, time, employee.id)}
                                        ></div>
                                    )})}
                                    
                                    {dailyAppointments.flatMap(appt => {
                                        if (!appt.assignments) return [];
                                        return appt.assignments
                                            .filter(assign => assign.employeeId === employee.id && assign.time && assign.duration)
                                            .map((assignment, assignIndex) => {
                                                const { color } = getEmployeeForAssignment(assignment);
                                                const top = getEventTop(assignment.time);
                                                const height = getEventHeight(assignment.duration);

                                                const appointmentDate = new Date(appt.date);
                                                const serviceDate = new Date(`${format(appointmentDate, 'yyyy-MM-dd')}T${assignment.time}`);

                                                const minutesToAppt = differenceInMinutes(serviceDate, now);
                                                let currentStatus = appt.status;
                                                if (currentStatus === 'confirmed' && isSameDay(day, new Date()) && minutesToAppt <= 15 && minutesToAppt > -assignment.duration) {
                                                    currentStatus = 'waiting';
                                                }

                                                const serviceName = appt.serviceNames?.[assignIndex] || 'Servicio';

                                                return (
                                                    <div 
                                                        key={`${appt.id}-${assignIndex}`}
                                                        className={cn(
                                                            "absolute left-1 right-1 p-2 rounded-lg cursor-pointer hover:opacity-80 z-10 overflow-hidden border-l-4", 
                                                            color.bg, 
                                                            color.text, 
                                                            statusColors[currentStatus]
                                                        )}
                                                        style={{ top, height }}
                                                        onClick={() => handleEditAppointment(appt)}
                                                    >
                                                        <p className="font-semibold text-sm truncate">{appt.customerName}</p>
                                                        <p className="text-xs truncate">{serviceName}</p>
                                                        <p className="text-xs flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {assignment.time} - {format(addMinutes(serviceDate, assignment.duration), 'p', { locale: es })}
                                                        </p>
                                                    </div>
                                                );
                                            })
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
};


export default function AgendaPage() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [employeeFilter, setEmployeeFilter] = useState('todos');
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [dayModalAppointments, setDayModalAppointments] = useState<Appointment[]>([]);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAppointments, setHistoryAppointments] = useState<Appointment[]>([]);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [now, setNow] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(19);
    const [viewInterval, setViewInterval] = useState(10); // Predeterminado: 10 minutos

  const importInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, startTransition] = useTransition();

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const safeInterval = Number.isFinite(viewInterval) && viewInterval > 0 ? viewInterval : 30;
    for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += safeInterval) {
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }
    return slots;
    }, [startHour, endHour, viewInterval]);


  useEffect(() => {
    Promise.all([
        getAppointments(),
        getUsers().then(users => users.filter(u => u.role === 'Peluquero' && u.isActive))
    ]).then(([appointmentsData, employeesData]) => {
        setAppointments(appointmentsData);
        
        const preferredOrder = ['Miguel Alessi', 'Viviana', 'Ines', 'Yami', 'Noe', 'Fede', 'Gonza'];
        const sortedEmployees = [...employeesData].sort((a, b) => {
            const indexA = preferredOrder.indexOf(a.name);
            const indexB = preferredOrder.indexOf(b.name);
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });

        setAllEmployees(sortedEmployees);
        setLoading(false);
    });
    
    const timer = setInterval(() => {
        setNow(new Date());
    }, 10000); // Update every 10 seconds
    return () => clearInterval(timer);
  }, []);


  const isHairdresser = currentUser?.role === 'Peluquero';
  const canManageAgenda = !isHairdresser;
  const canImportExport = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente';

  useEffect(() => {
      // Peluqueros can now see the full agenda, so we don't set a default filter for them.
      // if (isHairdresser && currentUser?.id) {
      //     setEmployeeFilter(currentUser.id);
      // }
  }, [isHairdresser, currentUser]);

  const getAppointmentsForDay = (day: Date, employeeId?: string) => {
    let appointmentsToFilter = [...appointments];
    
    if (employeeId) {
      // Always filter by the specific employee for this column
      appointmentsToFilter = appointmentsToFilter.filter(appt => {
        if (appt.assignments && appt.assignments.length > 0) {
            return appt.assignments.some(a => a.employeeId === employeeId);
        }
        // Fallback for old data model
        return appt.employeeId === employeeId;
      });
    } else if (employeeFilter !== 'todos') {
      // This case is for the whole page filter, not used inside DayView's loop
      appointmentsToFilter = appointmentsToFilter.filter(appt => {
         if (appt.assignments && appt.assignments.length > 0) {
            return appt.assignments.some(a => a.employeeId === employeeFilter);
        }
        // Fallback for old data model
        return appt.employeeId === employeeFilter;
      });
    }
    
    return appointmentsToFilter
      .filter(appt => isSameDay(new Date(appt.date), day))
      .filter(appt => appt.status !== 'cancelled' && appt.status !== 'no-show')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  const handleNewAppointment = (day: Date, time: string, employeeId: string) => {
      const dateString = day.toISOString().split('T')[0];
      router.push(`/admin/appointments/new?date=${dateString}&time=${time}&employeeId=${employeeId}`);
  };

  const handleEditAppointment = (appointment: Appointment) => {
      router.push(`/admin/appointments/new?id=${appointment.id}`);
  };
  
  const handleOpenDayModal = (day: Date) => {
    const dayAppointments = getAppointmentsForDay(day);
    setDayModalAppointments(dayAppointments);
    setDayModalDate(day);
    setIsDayModalOpen(true);
  }

  const handleCloseDayModal = () => {
    setIsDayModalOpen(false);
    setDayModalAppointments([]);
    setDayModalDate(null);
  }

  const handleShowHistory = async (email: string, phone?: string) => {
    const [clientAppointments, clientDetails] = await Promise.all([
      getAppointmentsByClient(email),
      getClientByEmail(email)
    ]);
    setHistoryAppointments(clientAppointments);
    setHistoryClient({
      ...clientDetails,
            mobilePhone: phone || clientDetails?.mobilePhone,
    } as Client);
    setIsHistoryModalOpen(true);
  }
  
  const handleExport = () => {
    startTransition(async () => {
        try {
            const csvData = await exportAppointments();
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'turnos.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: 'Exportación completa', description: 'Los datos de los turnos se han descargado.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error de exportación', description: 'No se pudieron exportar los datos.' });
        }
    });
  };

  const handleImportClick = () => {
      importInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      startTransition(async () => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', 'appointments');
          const result = await importData(formData);
          if (result.success) {
              toast({ title: 'Importación completa', description: result.message });
              // Here you would re-fetch appointments
          } else {
              toast({ variant: 'destructive', title: 'Error de importación', description: result.message });
          }
      });
      if(importInputRef.current) importInputRef.current.value = "";
  };
  
  const renderWeekView = (start: Date) => {
      if (loading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
      
      const weekDays = eachDayOfInterval({ start: startOfWeek(start, {locale: es}), end: endOfWeek(start, {locale: es}) });
      return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 border-t border-l">
              {weekDays.map(day => (
                  <div key={day.toString()} className="border-b border-r min-h-[150px] cursor-pointer hover:bg-secondary flex flex-col" onClick={() => handleOpenDayModal(day)}>
                      <div className={cn("p-2 border-b font-medium flex justify-between items-center", isSameDay(day, new Date()) && "bg-primary/10")}>
                          <span>{format(day, 'EEE d', { locale: es })}</span>
                          {canManageAgenda && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleNewAppointment(day, '', ''); }}>
                            <PlusCircle className="h-4 w-4" />
                          </Button>}
                      </div>
                      <div className="p-1 space-y-1 flex-1 overflow-y-auto">
                          {getAppointmentsForDay(day).map((appt) => {
                              const employeeId = (appt.assignments && appt.assignments.length > 0) ? appt.assignments[0]?.employeeId : appt.employeeId;
                              const employeeIndex = allEmployees.findIndex(e => e.id === employeeId);
                              const color = employeeIndex > -1 ? (employeeColors[employeeIndex % employeeColors.length] || fallbackColor) : fallbackColor;
                              const appointmentDate = new Date(appt.date);
                              return (
                                <div key={appt.id} className={cn("p-1 rounded-sm text-xs", color.bg, color.text)} onClick={(e) => {e.stopPropagation(); handleEditAppointment(appt);}}>
                                  <p className="font-semibold truncate">{(Array.isArray(appt.serviceNames) ? appt.serviceNames : [appt.serviceNames]).join(', ')}</p>
                                  <p className="truncate">{appt.customerName}</p>
                                  <p className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(appointmentDate, 'p', { locale: es })}</p>
                              </div>
                              )
                          })}
                      </div>
                  </div>
              ))}
          </div>
      )
  }

  const renderMonthView = (start: Date) => {
      if (loading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

      const monthDays = eachDayOfInterval({ start: startOfMonth(start), end: endOfMonth(start) });
      const firstDayOfMonth = startOfMonth(start);
      const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 for Monday

      return (
          <div className="grid grid-cols-7 border-t border-l">
              {Array.from({ length: startingDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="border-b border-r h-24 md:h-32"></div>)}
              {monthDays.map(day => (
                  <div key={day.toString()} className="border-b border-r h-24 md:h-32 cursor-pointer hover:bg-secondary flex flex-col" onClick={() => handleOpenDayModal(day)}>
                      <div className={cn("p-1 font-medium flex justify-between items-center", isSameDay(day, new Date()) && "bg-primary/10")}>
                          {format(day, 'd')}
                          {canManageAgenda && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleNewAppointment(day, '', ''); }}>
                              <PlusCircle className="h-4 w-4" />
                          </Button>}
                      </div>
                       <div className="p-1 space-y-1 overflow-y-auto">
                          {getAppointmentsForDay(day).slice(0,2).map((appt) => {
                             const employeeId = (appt.assignments && appt.assignments.length > 0) ? appt.assignments[0]?.employeeId : appt.employeeId;
                             const employeeIndex = allEmployees.findIndex(e => e.id === employeeId);
                             const color = employeeIndex > -1 ? (employeeColors[employeeIndex % employeeColors.length] || fallbackColor) : fallbackColor;
                             return (
                              <div key={appt.id} className={cn("p-1 rounded-sm text-xs truncate", color.bg, color.text)} onClick={(e) => {e.stopPropagation(); handleEditAppointment(appt);}}>
                                  {format(new Date(appt.date), 'p', { locale: es })} - {appt.customerName}
                              </div>
                             )
                          })}
                          {getAppointmentsForDay(day).length > 2 && <div className="text-xs text-muted-foreground p-1">+ {getAppointmentsForDay(day).length - 2} más</div>}
                      </div>
                  </div>
              ))}
          </div>
      )
  }

  const visibleEmployees = (employeeFilter !== 'todos') 
    ? allEmployees.filter(e => e.id === employeeFilter) 
    : allEmployees;

  return (
    <>
      <DayAppointmentsModal 
        isOpen={isDayModalOpen}
        onClose={handleCloseDayModal}
        appointments={dayModalAppointments}
        date={dayModalDate}
        onEditAppointment={(appt) => {
          handleCloseDayModal();
          handleEditAppointment(appt);
        }}
        onAddAppointment={(day) => {
          handleCloseDayModal();
          handleNewAppointment(day, '', '');
        }}
      />
      <ClientHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        appointments={historyAppointments}
        clientName={historyClient?.name || ''}
                clientPhone={historyClient?.mobilePhone}
      />
      <input type="file" ref={importInputRef} className="hidden" onChange={handleFileImport} accept=".csv" />
      <div className="space-y-6">
        <Tabs defaultValue="dia">
          <div className="flex justify-center mb-4">
              <TabsList>
                  <TabsTrigger value="dia">Día</TabsTrigger>
                  <TabsTrigger value="semana">Semana</TabsTrigger>
                  <TabsTrigger value="mes">Mes</TabsTrigger>
              </TabsList>
          </div>
          <TabsContent value="dia">
              <Card>
                  <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <CardTitle>Agenda del Día: {format(date, "PPP", { locale: es })}</CardTitle>
                         <CardDescription>
                          {(employeeFilter !== 'todos' && !isHairdresser) ? `Mostrando agenda para ${visibleEmployees[0]?.name}.` : 'Mostrando todos los empleados.'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {canManageAgenda && 
                            <Button asChild>
                                <Link href={`/admin/appointments/new?date=${date.toISOString().split('T')[0]}`}>
                                    <PlusCircle className="mr-2 h-4 w-4"/>
                                    Nuevo Turno
                                </Link>
                            </Button>
                        }
                        {canManageAgenda &&
                            <Button variant="outline" asChild>
                                <Link href="/admin/appointments/fast-entry">
                                    <Edit className="mr-2 h-4 w-4"/>
                                    Carga Rápida
                                </Link>
                            </Button>
                        }
                      </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center h-[70vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <DayView
                            day={date}
                            viewStartHour={startHour}
                            viewEndHour={endHour}
                            viewInterval={viewInterval}
                            getAppointmentsForDay={getAppointmentsForDay}
                            handleEditAppointment={handleEditAppointment}
                            handleNewAppointment={handleNewAppointment}
                            canManageAgenda={canManageAgenda}
                            now={now}
                            employeeFilter={employeeFilter}
                            timeSlots={timeSlots}
                            allEmployees={allEmployees}
                        />
                    )}
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="semana">
               <Card>
                  <CardHeader>
                      <CardTitle>Agenda de la Semana</CardTitle>
                      <CardDescription>{format(startOfWeek(date, {locale: es}), "PPP", {locale: es})} - {format(endOfWeek(date, {locale:es}), "PPP", {locale:es})}</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {renderWeekView(date)}
                  </CardContent>
               </Card>
          </TabsContent>
          <TabsContent value="mes">
              <Card>
                  <CardHeader>
                      <CardTitle>Agenda del Mes: {format(date, "MMMM yyyy", { locale: es })}</CardTitle>
                  </CardHeader>
                  <CardContent>
                      {renderMonthView(date)}
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Agenda de Recepción</CardTitle>
            <CardDescription>Visualiza y gestiona los turnos. Utiliza los filtros para organizar la vista.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-muted-foreground" />
                      <Label>Filtrar por:</Label>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-full md:w-[280px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={es} />
                    </PopoverContent>
                  </Popover>
                  
                    <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                        <SelectTrigger className="w-full md:w-[280px]">
                            <SelectValue placeholder="Filtrar por empleado..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los empleados</SelectItem>
                            {allEmployees.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  
                    {canImportExport && (
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={handleImportClick} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                Importar Agenda
                            </Button>
                            <Button variant="outline" onClick={handleExport} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                Exportar Agenda
                            </Button>
                        </div>
                    )}
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4 border-t pt-4">
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <Label>Vista diaria:</Label>
                </div>
                <div className='w-full md:w-auto grid grid-cols-3 gap-2'>
                    <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {hourOptions.map(h => <SelectItem key={`start-${h}`} value={h}>{h}:00</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {hourOptions.map(h => <SelectItem key={`end-${h}`} value={h}>{h}:00</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <Select 
                value={String(viewInterval)} 
                onValueChange={(v) => setViewInterval(Number(v))}
                >
                <SelectTrigger className="w-full">
                    <SelectValue>{viewInterval ? `${viewInterval} min` : '10 min'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
                </Select>

                </div>
                </div>

          </CardContent>
        </Card>
      </div>
    </>
  );
}

    




    

    




    



    