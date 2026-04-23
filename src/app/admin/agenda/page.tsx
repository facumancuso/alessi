
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
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, setHours, setMinutes, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter, Clock, PlusCircle, Loader2, Upload, Download, User as UserIcon, Scissors } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Appointment, AppointmentAssignment, Client, User } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DayAppointmentsModal } from '@/components/day-appointments-modal';
import { ClientHistoryModal } from '@/components/client-history-modal';
import { useCurrentUser } from '../user-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { importData, exportAppointments, moveAssignment } from '@/lib/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { sortEmployeesByAgendaOrder } from '@/lib/employee-order';

const employeeColors = [
    { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 },
    { bg: 'bg-slate-100', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 },
    { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 },
    { bg: 'bg-slate-100', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 },
    { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 },
    { bg: 'bg-slate-100', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 },
    { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 },
];

const fallbackColor = { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300', hueVar: 0 };


const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function computeBlockLayouts(blocks: { id: string; top: number; height: number }[]): Map<string, { slot: number; totalSlots: number }> {
    if (blocks.length === 0) return new Map();

    const sorted = [...blocks].sort((a, b) => a.top - b.top);

    // Assign each block to a lane (column) greedily
    const laneEnds: number[] = [];
    const blockLanes = new Map<string, number>();

    for (const block of sorted) {
        let lane = laneEnds.findIndex(end => end <= block.top);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = block.top + block.height;
        blockLanes.set(block.id, lane);
    }

    // Find transitively overlapping groups (connected components)
    const blockById = new Map(blocks.map(b => [b.id, b]));
    const visited = new Set<string>();
    const groups: string[][] = [];

    for (const block of sorted) {
        if (visited.has(block.id)) continue;
        const group: string[] = [];
        const queue = [block.id];
        visited.add(block.id);
        while (queue.length > 0) {
            const id = queue.shift()!;
            group.push(id);
            const current = blockById.get(id)!;
            for (const other of sorted) {
                if (!visited.has(other.id)) {
                    const overlaps = current.top < other.top + other.height && other.top < current.top + current.height;
                    if (overlaps) {
                        visited.add(other.id);
                        queue.push(other.id);
                    }
                }
            }
        }
        groups.push(group);
    }

    const result = new Map<string, { slot: number; totalSlots: number }>();
    for (const group of groups) {
        const lanesUsed = new Set(group.map(id => blockLanes.get(id)!));
        const totalSlots = lanesUsed.size;
        for (const id of group) {
            result.set(id, { slot: blockLanes.get(id)!, totalSlots });
        }
    }
    return result;
}

interface DragState {
    apptId: string;
    assignmentIdx: number;
    employeeId: string;
    time: string;
    customerName: string;
    serviceName: string;
    duration: number;
}

interface PendingMove {
    drag: DragState;
    newTime: string;
    newEmployeeId: string;
    newEmployeeName: string;
}

interface AppointmentPreviewData {
    appointment: Appointment;
    assignment: AppointmentAssignment;
    serviceName: string;
    employeeName: string;
}

interface AppointmentPreviewPanelData extends AppointmentPreviewData {
    blockId: string;
    top: number;
    left: number;
    side: 'right' | 'left';
}

const attendedStatuses = new Set<Appointment['status']>(['completed', 'facturado']);

function DayView({
  day,
  viewStartHour,
  viewEndHour,
  viewInterval,
  getAppointmentsForDay,
    getAppointmentColorClasses,
  handleEditAppointment,
  handleNewAppointment,
  canManageAgenda,
  now,
  employeeFilter,
  timeSlots,
  allEmployees,
    totalAppointmentsCount,
    attendedAppointmentsCount,
        pendingServicesCount,
  onMoveAssignment,
    isHairdresser,
        isReception,
    onOpenMyDay,
}: {
  day: Date;
  viewStartHour: number;
  viewEndHour: number;
  viewInterval: number;
  getAppointmentsForDay: (day: Date, employeeId?: string) => Appointment[];
    getAppointmentColorClasses: (appointment: Appointment, day: Date) => { card: string; pill: string };
  handleEditAppointment: (appointment: Appointment) => void;
  handleNewAppointment: (day: Date, time: string, employeeId: string) => void;
  canManageAgenda: boolean;
  now: Date;
  employeeFilter: string;
  timeSlots: string[];
  allEmployees: User[];
    totalAppointmentsCount: number;
    attendedAppointmentsCount: number;
        pendingServicesCount: number;
  onMoveAssignment: (apptId: string, idx: number, newTime: string, newEmployeeId: string) => Promise<void>;
    isHairdresser: boolean;
        isReception: boolean;
    onOpenMyDay: (appointmentId: string) => void;
}) {
    const timeIndicatorRef = useRef<HTMLDivElement>(null);
        const timelineContainerRef = useRef<HTMLDivElement>(null);
        const previewPanelRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [hoverSlot, setHoverSlot] = useState<{ time: string; employeeId: string } | null>(null);
    const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
    const [isMoving, setIsMoving] = useState(false);
    const [hoveredRow, setHoveredRow] = useState<{ top: number; height: number } | null>(null);
        const [focusedRow, setFocusedRow] = useState<{ top: number; height: number } | null>(null);
        const [previewPanel, setPreviewPanel] = useState<AppointmentPreviewPanelData | null>(null);
    const lastTapRef = useRef<{ blockId: string; at: number } | null>(null);
    const minuteHeight = 1.3;
    const timelineTopOffset = 14;
    const hourHeight = 60 * minuteHeight;
    const totalHours = viewEndHour - viewStartHour;
    const safeInterval = Number.isFinite(viewInterval) && viewInterval > 0 ? viewInterval : 30;

    const getEventTop = (timeStr: string) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        return (totalMinutes - viewStartHour * 60) * minuteHeight + timelineTopOffset;
    };
    
    const getEventHeight = (duration: number) => (duration || 0) * minuteHeight;
    
    const visibleEmployees = (employeeFilter !== 'todos')
            ? allEmployees.filter(e => e.id === employeeFilter)
            : allEmployees;

    const nowIndicatorTop = isSameDay(day, now)
        ? ((now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600) * 60 - viewStartHour * 60) * minuteHeight + timelineTopOffset
        : -1;

    const rowHeight = safeInterval * minuteHeight;
    const slotsPerHour = Math.max(1, Math.round(60 / safeInterval));
    const minEmployeeColumnWidth = employeeFilter !== 'todos' ? 150 : 120;
    const employeeGridTemplate = `repeat(${Math.max(visibleEmployees.length, 1)}, minmax(${minEmployeeColumnWidth}px, 1fr))`;
    
    useEffect(() => {
        if (timeIndicatorRef.current && isSameDay(day, now)) {
            timeIndicatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [nowIndicatorTop, day, now]);

    useEffect(() => {
        if (!previewPanel) return;

        const closePreviewIfClickedOutside = (event: MouseEvent | TouchEvent) => {
            if (!previewPanelRef.current) return;
            const target = event.target as Node;
            if (previewPanelRef.current.contains(target)) return;
            setPreviewPanel(null);
        };

        document.addEventListener('mousedown', closePreviewIfClickedOutside);
        document.addEventListener('touchstart', closePreviewIfClickedOutside);

        return () => {
            document.removeEventListener('mousedown', closePreviewIfClickedOutside);
            document.removeEventListener('touchstart', closePreviewIfClickedOutside);
        };
    }, [previewPanel]);

    const getEmployeeForAssignment = (assignment: AppointmentAssignment) => {
        const employee = allEmployees.find(e => e.id === assignment.employeeId);
        const employeeIndex = allEmployees.findIndex(e => e.id === assignment.employeeId);
        const color = employeeIndex !== -1 ? (employeeColors[employeeIndex % employeeColors.length] || fallbackColor) : fallbackColor;
        return { employee, color };
    }


    const handleConfirmMove = async () => {
        if (!pendingMove) return;
        setIsMoving(true);
        try {
            await onMoveAssignment(pendingMove.drag.apptId, pendingMove.drag.assignmentIdx, pendingMove.newTime, pendingMove.newEmployeeId);
        } finally {
            setIsMoving(false);
            setPendingMove(null);
            setDragState(null);
        }
    };

    return (
        <>
        <AlertDialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Mover turno?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-1">
                        <span className="block font-medium text-foreground">{pendingMove?.drag.customerName} — {pendingMove?.drag.serviceName}</span>
                        <span className="block">
                            De <span className="font-medium text-foreground">{pendingMove?.drag.time}</span> → <span className="font-medium text-foreground">{pendingMove?.newTime}</span>
                            {pendingMove?.drag.employeeId !== pendingMove?.newEmployeeId && (
                                <> · empleado: <span className="font-medium text-foreground">{pendingMove?.newEmployeeName}</span></>
                            )}
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isMoving}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction disabled={isMoving} onClick={handleConfirmMove}>
                        {isMoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirmar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <div className="flex flex-col">
            <div className={cn("agenda-day-summary grid gap-3 border-b bg-muted/30 px-4 py-3 md:grid-cols-3", isReception ? 'text-base' : 'text-sm')}>
                <div>
                    <span className="font-medium text-foreground">Turnos del día:</span>{' '}
                    <span className="text-lg font-semibold text-foreground">{totalAppointmentsCount}</span>
                </div>
                <div>
                    <span className="font-medium text-foreground">Turnos atendidos:</span>{' '}
                    <span className="text-lg font-semibold text-foreground">{attendedAppointmentsCount}</span>
                </div>
                <div>
                    <span className="font-medium text-foreground">Servicios por realizar:</span>{' '}
                    <span className="text-lg font-semibold text-foreground">{pendingServicesCount}</span>
                </div>
            </div>
            <div className="agenda-employee-header flex sticky top-0 bg-card/95 backdrop-blur z-30 border-b">
                  <div className="w-24 md:w-28 flex-shrink-0 border-r pt-4"></div>
                 <div className="grid flex-1" style={{ gridTemplateColumns: employeeGridTemplate }}>
                    {visibleEmployees.map((employee, employeePosition) => (
                        <div
                            key={employee.id}
                            className={cn("border-l px-2 py-3 text-center font-semibold leading-tight", isReception ? 'text-sm md:text-base' : 'text-xs md:text-sm')}
                            style={{ backgroundColor: employeePosition % 2 === 0 ? '#ffffff' : '#f1f5f9' }}
                        >
                            {employee.name}
                            <Badge variant="secondary" className="ml-2">{getAppointmentsForDay(day, employee.id).filter(a => a.status !== 'cancelled').length}</Badge>
                        </div>
                    ))}
                </div>
            </div>
            <ScrollArea className="w-full whitespace-nowrap" style={{ height: '64vh' }}>
                <div className="relative flex min-w-full" style={{ height: totalHours * hourHeight + timelineTopOffset }}>
                    <div ref={timelineContainerRef} className="absolute inset-0 pointer-events-none" />
                    {hoveredRow && (
                        <div
                            className="absolute left-0 right-0 pointer-events-none z-[15]"
                            style={{
                                top: hoveredRow.top,
                                height: hoveredRow.height,
                                background: 'hsl(220 90% 56% / 0.18)',
                                borderTop: '2px solid hsl(220 90% 50% / 0.7)',
                                borderBottom: '2px solid hsl(220 90% 50% / 0.7)',
                                boxShadow: '0 0 12px hsl(220 90% 56% / 0.15)',
                            }}
                        />
                    )}
                    {focusedRow && (
                        <div
                            className="absolute left-0 right-0 pointer-events-none z-[16]"
                            style={{
                                top: focusedRow.top,
                                height: focusedRow.height,
                                background: 'hsl(214 100% 54% / 0.12)',
                                borderTop: '2px solid hsl(214 100% 45% / 0.65)',
                                borderBottom: '2px solid hsl(214 100% 45% / 0.65)',
                                boxShadow: '0 0 12px hsl(214 100% 54% / 0.2)',
                            }}
                        />
                    )}
                    <div
                        className="sticky left-0 bg-card/90 backdrop-blur-sm z-20 flex w-24 md:w-28 border-r"
                        style={{ paddingTop: timelineTopOffset }}
                    >
                        <div className="relative w-12 md:w-14 border-r bg-slate-100/90">
                            {timeSlots.map((time, index) => {
                                const [hours, minutes] = time.split(':').map(Number);
                                if (minutes !== 0) {
                                    return null;
                                }

                                return (
                                    <div
                                        key={`hour-${time}`}
                                        className="absolute inset-x-0 border-t border-slate-300/90 px-2 pt-1 text-slate-800"
                                        style={{ top: index * rowHeight + timelineTopOffset, height: hourHeight }}
                                    >
                                        <div className={cn("font-semibold leading-none tracking-tight", isReception ? 'text-2xl md:text-[28px]' : 'text-[22px] md:text-2xl')}>
                                            {String(hours).padStart(2, '0')}
                                        </div>
                                        <div className={cn("mt-1 font-semibold uppercase tracking-[0.12em] text-slate-500", isReception ? 'text-[11px]' : 'text-[10px]')}>
                                            hs
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className={cn("relative flex-1 bg-slate-800 font-semibold text-slate-100", isReception ? 'text-[11px] md:text-xs' : 'text-[10px] md:text-[11px]')}>
                            {timeSlots.map((time, index) => {
                                const [, minutes] = time.split(':').map(Number);

                                return (
                                    <div
                                        key={`minute-${time}`}
                                        className="absolute inset-x-0 border-t border-slate-600/70 px-1.5"
                                        style={{ top: index * rowHeight + timelineTopOffset, height: rowHeight }}
                                    >
                                        <div className="-translate-y-1/2">
                                            :{String(minutes).padStart(2, '0')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid flex-1" style={{ gridTemplateColumns: employeeGridTemplate }}>
                        {nowIndicatorTop > 0 && (
                            <div
                                ref={timeIndicatorRef}
                                className="agenda-now-indicator absolute right-0 h-0.5 bg-red-500 z-40"
                                style={{ top: nowIndicatorTop, left: 0 }}
                            >
                                <div className="absolute -left-1 md:-left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500"></div>
                            </div>
                        )}
                        {visibleEmployees.map((employee, employeePosition) => {
                            const dailyAppointments = getAppointmentsForDay(day, employee.id);
                            const employeeHue = (employeePosition * 39 + 18) % 360;
                            
                            return (
                                <div
                                    key={employee.id}
                                    className="agenda-employee-column border-l relative min-w-[130px] md:min-w-[150px]"
                                    style={{ backgroundColor: employeePosition % 2 === 0 ? '#ffffff' : '#f1f5f9' }}
                                >
                                    {timeSlots.map((time, index) => {
                                        const [, m] = time.split(':').map(Number);
                                        const rowClass = m === 0
                                            ? 'border-slate-700/80'
                                            : m === 30
                                                ? 'border-slate-600/70 border-dashed'
                                                : 'border-slate-500/55 border-dotted';

                                        const isHover = !!dragState && hoverSlot?.time === time && hoverSlot?.employeeId === employee.id;
                                        return (
                                        <div
                                            key={time}
                                            className={cn(
                                                "agenda-slot-line absolute w-full border-t transition-colors",
                                                canManageAgenda && !dragState && "cursor-pointer hover:bg-secondary/60",
                                                isHover && "bg-primary/15",
                                                rowClass
                                            )}
                                            style={{ top: index * rowHeight + timelineTopOffset, height: rowHeight }}
                                            onClick={() => canManageAgenda && !dragState && handleNewAppointment(day, time, employee.id)}
                                            onDragOver={dragState ? (e) => { e.preventDefault(); setHoverSlot({ time, employeeId: employee.id }); } : undefined}
                                            onDragLeave={dragState ? () => setHoverSlot(null) : undefined}
                                            onDrop={dragState ? (e) => {
                                                e.preventDefault();
                                                setHoverSlot(null);
                                                const empName = allEmployees.find(e2 => e2.id === employee.id)?.name ?? employee.id;
                                                setPendingMove({ drag: dragState, newTime: time, newEmployeeId: employee.id, newEmployeeName: empName });
                                            } : undefined}
                                        >
                                        </div>
                                    )})}

                                    {(() => {
                                        // Collect all blocks for this employee to compute overlap layout
                                        const allBlocks = dailyAppointments.flatMap(appt => {
                                            if (!appt.assignments) return [];
                                            return appt.assignments
                                                .map((assign, originalIdx) => ({ assign, originalIdx, appt }))
                                                .filter(({ assign }) => assign.employeeId === employee.id && assign.time && assign.duration)
                                                .map(({ assign, originalIdx, appt }) => ({
                                                    id: `${appt.id}-${originalIdx}`,
                                                    top: getEventTop(assign.time),
                                                    height: getEventHeight(assign.duration),
                                                }));
                                        });
                                        const layouts = computeBlockLayouts(allBlocks);

                                        return dailyAppointments.flatMap(appt => {
                                            if (!appt.assignments) return [];
                                            return appt.assignments
                                                .map((assign, originalIdx) => ({ assign, originalIdx }))
                                                .filter(({ assign }) => assign.employeeId === employee.id && assign.time && assign.duration)
                                                .map(({ assign: assignment, originalIdx }) => {
                                                    const top = getEventTop(assignment.time);
                                                    const height = getEventHeight(assignment.duration);
                                                    const currentStatus = appt.status;
                                                    const serviceName = appt.serviceNames?.[originalIdx] || 'Servicio';
                                                    const appointmentColorClasses = getAppointmentColorClasses(appt, day);
                                                    const visualHeight = Math.max(height, 44);
                                                    const blockId = `${appt.id}-${originalIdx}`;
                                                    const layout = layouts.get(blockId) ?? { slot: 0, totalSlots: 1 };
                                                    const GAP = 2;
                                                    const colWidth = `calc(${100 / layout.totalSlots}% - ${GAP * 2}px)`;
                                                    const colLeft = `calc(${(layout.slot / layout.totalSlots) * 100}% + ${GAP}px)`;

                                                    return (
                                                        <TooltipProvider key={blockId} delayDuration={300}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        className={cn(
                                                                            "agenda-appointment-card absolute rounded-xl cursor-pointer z-10 overflow-hidden border-l-4 border shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20",
                                                                            appointmentColorClasses.card,
                                                                            previewPanel?.blockId === blockId && 'ring-2 ring-primary/40 shadow-lg',
                                                                            canManageAgenda && "cursor-grab active:cursor-grabbing"
                                                                        )}
                                                                        style={{ top, height: visualHeight, left: colLeft, width: colWidth, ['--employee-hue' as string]: employeeHue }}
                                                                        data-status={currentStatus}
                                                                        draggable={canManageAgenda}
                                                                        onDragStart={canManageAgenda ? (e) => {
                                                                            e.stopPropagation();
                                                                            setDragState({
                                                                                apptId: appt.id!,
                                                                                assignmentIdx: originalIdx,
                                                                                employeeId: assignment.employeeId,
                                                                                time: assignment.time,
                                                                                customerName: appt.customerName,
                                                                                serviceName,
                                                                                duration: assignment.duration,
                                                                            });
                                                                        } : undefined}
                                                                        onDragEnd={() => { setDragState(null); setHoverSlot(null); }}
                                                                        onMouseEnter={() => setHoveredRow({ top, height: visualHeight })}
                                                                        onMouseLeave={() => setHoveredRow(null)}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (isHairdresser) {
                                                                                const cardElement = e.currentTarget;
                                                                                const cardRect = cardElement.getBoundingClientRect();
                                                                                const timelineRect = timelineContainerRef.current?.getBoundingClientRect();
                                                                                const employeeName = allEmployees.find(emp => emp.id === assignment.employeeId)?.name || 'Profesional';

                                                                                cardElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                                                                setFocusedRow({ top, height: visualHeight });

                                                                                if (timelineRect) {
                                                                                    const panelWidth = 290;
                                                                                    const side = cardRect.left > timelineRect.left + timelineRect.width * 0.62 ? 'left' : 'right';
                                                                                    const availableTop = Math.max(8, timelineRect.height - 236);
                                                                                    const calculatedTop = Math.min(Math.max(8, cardRect.top - timelineRect.top), availableTop);
                                                                                    const baseLeft = side === 'right'
                                                                                        ? cardRect.right - timelineRect.left + 8
                                                                                        : cardRect.left - timelineRect.left - panelWidth - 8;
                                                                                    const calculatedLeft = Math.min(
                                                                                        Math.max(8, baseLeft),
                                                                                        Math.max(8, timelineRect.width - panelWidth - 8)
                                                                                    );

                                                                                    setPreviewPanel({
                                                                                        blockId,
                                                                                        top: calculatedTop,
                                                                                        left: calculatedLeft,
                                                                                        side,
                                                                                        appointment: appt,
                                                                                        assignment,
                                                                                        serviceName,
                                                                                        employeeName,
                                                                                    });
                                                                                }
                                                                                return;
                                                                            }
                                                                            handleEditAppointment(appt);
                                                                        }}
                                                                        onDoubleClick={(e) => {
                                                                            if (!isHairdresser || !appt.id) return;
                                                                            e.stopPropagation();
                                                                            onOpenMyDay(appt.id);
                                                                        }}
                                                                        onTouchEnd={(e) => {
                                                                            if (!isHairdresser || !appt.id) return;
                                                                            e.stopPropagation();
                                                                            const nowTs = Date.now();
                                                                            const previousTap = lastTapRef.current;
                                                                            if (previousTap && previousTap.blockId === blockId && nowTs - previousTap.at < 320) {
                                                                                lastTapRef.current = null;
                                                                                onOpenMyDay(appt.id);
                                                                                return;
                                                                            }
                                                                            lastTapRef.current = { blockId, at: nowTs };
                                                                        }}
                                                                    >
                                                                        <div className="px-2 py-1 md:px-2.5 md:py-1.5 space-y-0.5 min-w-0">
                                                                            <p className={cn("font-semibold leading-snug text-current truncate", isReception ? 'text-xs md:text-sm' : 'text-[10px] md:text-xs')}>{appt.customerName}</p>
                                                                            <p className={cn("font-medium leading-tight text-current opacity-90 truncate", isReception ? 'text-[11px] md:text-xs' : 'text-[9px] md:text-[10px]')}>{serviceName}</p>
                                                                            <p className={cn("font-medium text-current opacity-75", isReception ? 'text-[10px] md:text-[11px]' : 'text-[8px] md:text-[9px]')}>{assignment.duration} min</p>
                                                                        </div>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right" className="max-w-[220px] p-0 overflow-hidden">
                                                                    <div className="px-3 py-2 space-y-1.5">
                                                                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                                                                            <UserIcon className="h-3.5 w-3.5 shrink-0" />
                                                                            {appt.customerName}
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                            <Clock className="h-3 w-3 shrink-0" />
                                                                            {assignment.time} · {assignment.duration} min
                                                                        </div>
                                                                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                                                            <Scissors className="h-3 w-3 shrink-0 mt-0.5" />
                                                                            <span>{serviceName}</span>
                                                                        </div>
                                                                        {appt.notes && (
                                                                            <p className="text-xs italic text-muted-foreground border-t pt-1 mt-1">{appt.notes}</p>
                                                                        )}
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    );
                                                });
                                        });
                                    })()}
                                </div>
                            )
                        })}

                        {isHairdresser && previewPanel && (
                            <div
                                ref={previewPanelRef}
                                className="absolute z-50 w-[290px] rounded-xl border bg-card/95 backdrop-blur shadow-2xl"
                                style={{ top: previewPanel.top, left: previewPanel.left }}
                            >
                                <div className="border-b px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vista rápida</p>
                                    <p className="text-sm font-semibold leading-tight">{previewPanel.appointment.customerName}</p>
                                </div>
                                <div className="space-y-2 px-3 py-2 text-sm">
                                    <div className="rounded-md border px-2 py-1.5">
                                        <p className="text-[11px] text-muted-foreground">Profesional</p>
                                        <p className="font-medium">{previewPanel.employeeName}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-md border px-2 py-1.5">
                                            <p className="text-[11px] text-muted-foreground">Horario</p>
                                            <p className="font-medium">{previewPanel.assignment.time}</p>
                                        </div>
                                        <div className="rounded-md border px-2 py-1.5">
                                            <p className="text-[11px] text-muted-foreground">Duración</p>
                                            <p className="font-medium">{previewPanel.assignment.duration} min</p>
                                        </div>
                                    </div>
                                    <div className="rounded-md border px-2 py-1.5">
                                        <p className="text-[11px] text-muted-foreground">Servicio</p>
                                        <p className="font-medium">{previewPanel.serviceName}</p>
                                    </div>
                                    {previewPanel.appointment.notes && (
                                        <div className="rounded-md border px-2 py-1.5">
                                            <p className="text-[11px] text-muted-foreground">Notas</p>
                                            <p className="text-xs leading-relaxed">{previewPanel.appointment.notes}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 border-t px-3 py-2">
                                    <Button
                                        size="sm"
                                        className="h-8 flex-1 text-xs"
                                        onClick={() => {
                                            setPreviewPanel(null);
                                            setFocusedRow(null);
                                            onOpenMyDay(previewPanel.appointment.id);
                                        }}
                                    >
                                        Ir a My Day
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs"
                                        onClick={() => {
                                            setPreviewPanel(null);
                                            setFocusedRow(null);
                                        }}
                                    >
                                        Cerrar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
        </>
    );
};


export default function AgendaPage() {
  const router = useRouter();
    const searchParams = useSearchParams();
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();

    const resolveDateFromQuery = () => {
        const dateParam = searchParams.get('date');
        if (!dateParam) return new Date();
        const parsed = new Date(`${dateParam}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    const [date, setDate] = useState<Date>(resolveDateFromQuery);
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

    useEffect(() => {
        setDate(resolveDateFromQuery());
    }, [searchParams]);

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
        const fetchAgendaData = async () => {
            setLoading(true);
            try {
                const [appointmentsData, employeesData] = await Promise.all([
                    getAppointments(),
                    getUsers().then(users => users.filter(u => u.role === 'Peluquero' && u.isActive))
                ]);

                setAppointments(appointmentsData);

                const sortedEmployees = sortEmployeesByAgendaOrder(employeesData);

                setAllEmployees(sortedEmployees);
            } catch (error) {
                console.error('Failed to fetch agenda data:', error);
                setAppointments([]);
                setAllEmployees([]);
                toast({
                    variant: 'destructive',
                    title: 'No se pudo cargar la agenda',
                    description: 'Revisá la conexión o recargá la página.'
                });
            } finally {
                setLoading(false);
            }
        };

        fetchAgendaData();
    
    const timer = setInterval(() => {
        setNow(new Date());
    }, 10000); // Update every 10 seconds
    return () => clearInterval(timer);
    }, [toast]);


  const isHairdresser = currentUser?.role === 'Peluquero';
    const isReception = currentUser?.role === 'Recepcion';
  const canManageAgenda = !isHairdresser;
  const canImportExport = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente';

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
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  const getAppointmentsForDaySummary = (day: Date) => {
      let appointmentsToFilter = [...appointments];

      if (employeeFilter !== 'todos') {
          appointmentsToFilter = appointmentsToFilter.filter(appt => {
              if (appt.assignments && appt.assignments.length > 0) {
                  return appt.assignments.some(a => a.employeeId === employeeFilter);
              }

              return appt.employeeId === employeeFilter;
          });
      }

      return appointmentsToFilter
          .filter(appt => isSameDay(new Date(appt.date), day))
          .filter(appt => appt.status !== 'cancelled');
  };

  const dayAppointmentsSummary = useMemo(() => {
      const dayAppointments = getAppointmentsForDaySummary(date);
      const pendingStatuses = new Set<Appointment['status']>(['confirmed', 'waiting', 'in_progress']);

      const countAppointmentServices = (appt: Appointment) => {
          if (appt.assignments && appt.assignments.length > 0) {
              return appt.assignments.length;
          }

          const services = Array.isArray(appt.serviceNames)
              ? appt.serviceNames.filter(Boolean)
              : appt.serviceNames
                  ? [appt.serviceNames]
                  : [];

          return services.length > 0 ? services.length : 1;
      };

      const pendingServicesCount = dayAppointments
          .filter(appt => pendingStatuses.has(appt.status))
          .reduce((sum, appt) => sum + countAppointmentServices(appt), 0);

      return {
          totalAppointmentsCount: dayAppointments.length,
          attendedAppointmentsCount: dayAppointments.filter(appt => attendedStatuses.has(appt.status)).length,
          pendingServicesCount,
      };
  }, [appointments, date, employeeFilter]);

    const getAppointmentColorClasses = (appointment: Appointment, day: Date) => {
        if (appointment.status === 'completed' || appointment.status === 'facturado') {
            return {
                card: 'bg-emerald-200 text-emerald-900 border-emerald-400 border-l-emerald-600',
                pill: 'bg-emerald-300 text-emerald-900'
            };
        }

        if (appointment.status === 'cancelled' || appointment.status === 'no-show') {
            return {
                card: 'bg-rose-200 text-rose-900 border-rose-400 border-l-rose-600',
                pill: 'bg-rose-300 text-rose-900'
            };
        }

        const isMultiEmployee = (appointment.assignments || []).length > 1;

        const customerKey = appointment.customerEmail || appointment.customerName;
        const clientAppointmentsSameDay = appointments.filter(appt => {
            const sameClient = (appt.customerEmail || appt.customerName) === customerKey;
            return sameClient && isSameDay(new Date(appt.date), day);
        }).length;

        if (isMultiEmployee || clientAppointmentsSameDay >= 2) {
            return {
                card: 'bg-amber-200 text-amber-900 border-amber-400 border-l-amber-600',
                pill: 'bg-amber-300 text-amber-900'
            };
        }

        return {
            card: 'bg-indigo-200 text-indigo-900 border-indigo-400 border-l-indigo-600',
            pill: 'bg-indigo-300 text-indigo-900'
        };
    };

  const handleNewAppointment = (day: Date, time: string, employeeId: string) => {
      const dateString = day.toISOString().split('T')[0];
      router.push(`/admin/appointments/new?date=${dateString}&time=${time}&employeeId=${employeeId}`);
  };

  const handleEditAppointment = (appointment: Appointment) => {
      router.push(`/admin/appointments/new?id=${appointment.id}`);
  };

  const handleOpenInMyDay = (appointmentId?: string) => {
      if (!appointmentId) return;
      router.push(`/admin/my-day?appointmentId=${appointmentId}`);
  };

  const handleMoveAssignment = async (apptId: string, idx: number, newTime: string, newEmployeeId: string) => {
      const previousAppointments = appointments;

      setAppointments(prev =>
          prev.map(appt => {
              if (appt.id !== apptId) return appt;
              const nextAssignments = [...(appt.assignments || [])];
              if (!nextAssignments[idx]) return appt;
              nextAssignments[idx] = {
                  ...nextAssignments[idx],
                  time: newTime,
                  employeeId: newEmployeeId,
              };
              return { ...appt, assignments: nextAssignments };
          })
      );

      try {
          await moveAssignment(apptId, idx, newTime, newEmployeeId);
          toast({ title: 'Turno movido', description: `El turno fue actualizado correctamente.` });

          // Sin bloquear la UI, reconciliamos con estado servidor.
          void getAppointments()
              .then(setAppointments)
              .catch(() => {
                  // En caso de error de refresco mantenemos el estado optimista.
              });
      } catch (error) {
          setAppointments(previousAppointments);
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudo mover el turno.' });
      }
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
            mobilePhone: clientDetails?.mobilePhone || phone,
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
                              const appointmentDate = new Date(appt.date);
                                                            const appointmentColorClasses = getAppointmentColorClasses(appt, day);
                              return (
                                                                <div key={appt.id} className={cn("p-1 rounded-sm text-xs border", appointmentColorClasses.card)} onClick={(e) => {e.stopPropagation(); handleEditAppointment(appt);}}>
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
                             const appointmentColorClasses = getAppointmentColorClasses(appt, day);
                             const services = Array.isArray(appt.serviceNames) ? appt.serviceNames : [appt.serviceNames];
                             return (
                              <div key={appt.id} className={cn("p-1 rounded-sm text-xs truncate border", appointmentColorClasses.card)} onClick={(e) => {e.stopPropagation(); handleEditAppointment(appt);}}>
                                  {services.join(', ')}
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
      <div className="salon-shell space-y-4 md:space-y-5">
        <Tabs defaultValue="dia">
          <div className="flex justify-center mb-4">
              <TabsList className={cn('agenda-tabs-list grid w-full max-w-md', isReception ? 'grid-cols-1' : 'grid-cols-3')}>
                  <TabsTrigger className="agenda-tabs-trigger" value="dia">Día</TabsTrigger>
                  {!isReception && <TabsTrigger className="agenda-tabs-trigger" value="semana">Semana</TabsTrigger>}
                  {!isReception && <TabsTrigger className="agenda-tabs-trigger" value="mes">Mes</TabsTrigger>}
              </TabsList>
          </div>
          <TabsContent value="dia">
              <Card className="agenda-panel agenda-panel--timeline">
                  <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <CardTitle>Agenda del Día: {format(date, "EEEE d 'de' MMMM", { locale: es })}</CardTitle>
                         <CardDescription>
                          {(employeeFilter !== 'todos' && !isHairdresser) ? `Mostrando agenda para ${visibleEmployees[0]?.name}.` : 'Mostrando todos los empleados.'}
                        </CardDescription>
                      </div>
                      <div className="flex w-full lg:w-auto flex-col sm:flex-row gap-2">
                        {canManageAgenda && 
                            <Button asChild>
                                <Link href={`/admin/appointments/new?date=${date.toISOString().split('T')[0]}`}>
                                    <PlusCircle className="mr-2 h-4 w-4"/>
                                    Nuevo Turno
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
                            getAppointmentColorClasses={getAppointmentColorClasses}
                            handleEditAppointment={handleEditAppointment}
                            handleNewAppointment={handleNewAppointment}
                            canManageAgenda={canManageAgenda}
                            now={now}
                            employeeFilter={employeeFilter}
                            timeSlots={timeSlots}
                            allEmployees={allEmployees}
                                                        totalAppointmentsCount={dayAppointmentsSummary.totalAppointmentsCount}
                                                        attendedAppointmentsCount={dayAppointmentsSummary.attendedAppointmentsCount}
                                                        pendingServicesCount={dayAppointmentsSummary.pendingServicesCount}
                            onMoveAssignment={handleMoveAssignment}
                            isHairdresser={!!isHairdresser}
                            isReception={!!isReception}
                            onOpenMyDay={handleOpenInMyDay}
                        />
                    )}
                  </CardContent>
              </Card>
          </TabsContent>
          {!isReception && <TabsContent value="semana">
            <Card className="agenda-panel">
                  <CardHeader>
                      <CardTitle>Agenda de la Semana</CardTitle>
                      <CardDescription>{format(startOfWeek(date, {locale: es}), "PPP", {locale: es})} - {format(endOfWeek(date, {locale:es}), "PPP", {locale:es})}</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {renderWeekView(date)}
                  </CardContent>
               </Card>
          </TabsContent>}
          {!isReception && <TabsContent value="mes">
              <Card className="agenda-panel">
                  <CardHeader>
                      <CardTitle>Agenda del Mes: {format(date, "MMMM yyyy", { locale: es })}</CardTitle>
                  </CardHeader>
                  <CardContent>
                      {renderMonthView(date)}
                  </CardContent>
              </Card>
          </TabsContent>}
        </Tabs>

        <Card className="agenda-panel">
          <CardHeader>
            <CardTitle>{isHairdresser ? 'Configuración de Vista' : 'Agenda de Recepción'}</CardTitle>
            <CardDescription>
              {isHairdresser
                ? 'Ajustá tu vista diaria para trabajar cómodo desde tablet.'
                : 'Visualiza y gestiona los turnos. Utiliza los filtros para organizar la vista.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
                            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 shrink-0">
                      <Filter className="h-5 w-5 text-muted-foreground" />
                      <Label>Filtrar por:</Label>
                  </div>
                                    <div className="grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
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
                                                    <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Filtrar por empleado..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                            <SelectItem value="todos">Todos los empleados</SelectItem>
                                                            {allEmployees.map(emp => (
                                                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                            ))}
                                                    </SelectContent>
                                            </Select>
                                    </div>

                    {canImportExport && (
                                                <div className="grid w-full md:w-auto grid-cols-1 sm:grid-cols-2 gap-2">
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
                            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 border-t pt-3">
                                <div className="flex items-center gap-2 shrink-0">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <Label>Vista diaria:</Label>
                </div>
                                <div className='w-full lg:w-auto grid grid-cols-1 sm:grid-cols-3 gap-2'>
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

    




    

    




    



    