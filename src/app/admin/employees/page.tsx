
'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getAppointments, getUsers, getServices } from '@/lib/data';
import type { Appointment, User, Service } from '@/lib/types';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Crown, DollarSign, Calendar as CalendarIcon, TrendingUp, User as UserIcon, Filter } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';

type EmployeeStats = {
  user: User;
  totalAppointments: number;
  allAppointments: Appointment[];
};

const chartConfig = {
  value: {
    label: 'Trabajos',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;


export default function EmployeesPage() {
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  const [topPerformer, setTopPerformer] = useState<EmployeeStats | null>(null);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
        const [users, completedAppointments, servicesData] = await Promise.all([
            getUsers(),
            getAppointments('completed'),
            getServices()
        ]);
        setAllUsers(users.filter(u => u.role === 'Peluquero'));
        setAllAppointments(completedAppointments);
        setAllServices(servicesData);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!allUsers.length || !allAppointments.length) return;

    const filteredAppointments = allAppointments.filter(a => isSameDay(new Date(a.date), selectedDate));

    const employeeStats = allUsers.map(employee => {
        const employeeAppointments = filteredAppointments
            .filter(a => (a.assignments || []).some(assign => assign.employeeId === employee.id))
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        return {
            user: employee,
            totalAppointments: employeeAppointments.length,
            allAppointments: employeeAppointments,
        };
    });

    const sortedStats = employeeStats.sort((a, b) => b.totalAppointments - a.totalAppointments);
    setStats(sortedStats);
    setTopPerformer(sortedStats[0] || null);
  }, [selectedDate, allAppointments, allUsers, allServices]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento de Empleados</CardTitle>
          <CardDescription>Métricas y estadísticas de los trabajos realizados por cada empleado para el día seleccionado.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-4">
                <Label htmlFor="date-filter" className="flex items-center gap-2">
                    <Filter className="h-4 w-4"/>
                    Filtrar por día:
                </Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus locale={es} />
                    </PopoverContent>
                </Popover>
            </div>
        </CardContent>
      </Card>
      
      {topPerformer && topPerformer.totalAppointments > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Crown className="text-yellow-500" /> El Peluquero del Día
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
                <AvatarImage src="https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg" alt={topPerformer.user.name} data-ai-hint="person portrait" />
                <AvatarFallback>{topPerformer.user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="grid gap-2">
              <p className="text-2xl font-bold">{topPerformer.user.name}</p>
              <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1 text-muted-foreground">
                <span className="flex items-center gap-1"><TrendingUp className="h-4 w-4" /> {topPerformer.totalAppointments} trabajos</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="w-full" defaultValue={stats[0]?.user.id}>
        {stats.map((stat, index) => (
          <AccordionItem value={stat.user.id} key={stat.user.id}>
            <AccordionTrigger className={cn(stat.user.id === topPerformer?.user.id && stat.totalAppointments > 0 && 'font-bold text-primary')}>
              <div className="flex items-center gap-4 flex-1">
                 <span className="font-bold text-lg text-muted-foreground w-6">#{index + 1}</span>
                 <Avatar className="h-10 w-10">
                    <AvatarImage src="https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg" alt={stat.user.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{stat.user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-base">{stat.user.name}</span>
                <Badge variant={stat.user.id === topPerformer?.user.id && stat.totalAppointments > 0 ? 'default' : 'secondary'}>{stat.totalAppointments} trabajos</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
                {stat.totalAppointments > 0 ? (
                    <div className="space-y-6 p-4">
                        <div className="grid md:grid-cols-1 gap-4 text-lg">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <span className="text-muted-foreground">Total de Trabajos Completados:</span>
                                <strong className="text-2xl">{stat.totalAppointments}</strong>
                            </div>
                        </div>
                        
                        <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2"><UserIcon className="h-5 w-5"/> Historial de Trabajos del Día</h4>
                            <ScrollArea className="h-[400px] border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-secondary">
                                        <TableRow>
                                            <TableHead>Hora</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Servicios</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stat.allAppointments.map(appt => (
                                            <TableRow key={appt.id}>
                                                <TableCell>{format(new Date(appt.date), 'HH:mm')}</TableCell>
                                                <TableCell>{appt.customerName}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(appt.serviceNames || []).join(', ')}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-8">
                        No hay trabajos completados para este empleado en la fecha seleccionada.
                    </div>
                )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
