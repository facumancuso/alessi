
'use client';
import { useState, useEffect, useRef, useTransition, useMemo, Suspense } from 'react';
import { getAppointments, getClientByEmail, getProducts, getServices, getUsers } from '@/lib/data';
import type { Appointment, AppointmentAssignment, Client, Product, Service, User as AppUser } from '@/lib/types';
import { isToday, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock, Loader2, FileText,
  Scissors, CheckCircle2, PlayCircle, Edit2, Save, Package,
  Calendar, AlertCircle, MessageSquare, ChevronRight, Hash, ImageOff,
  User,
} from 'lucide-react';
import { useCurrentUser } from '../user-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateAssignmentStatus, updateAppointment } from '@/lib/actions';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// ─── Catalog module-level cache (persists across navigations) ─────────────────
type CatalogData = { services: Service[]; products: Product[]; employees: AppUser[] };

let _catalogCache: CatalogData | null = null;
let _catalogPromise: Promise<CatalogData> | null = null;

async function loadCatalogCached(): Promise<CatalogData> {
  if (_catalogCache) return _catalogCache;
  if (_catalogPromise) return _catalogPromise;
  _catalogPromise = Promise.all([getServices(), getProducts(), getUsers()]).then(([services, products, users]) => {
    _catalogCache = { services, products, employees: users.filter(u => u.role === 'Peluquero' && u.isActive) };
    _catalogPromise = null;
    return _catalogCache;
  }).catch(err => { _catalogPromise = null; throw err; });
  return _catalogPromise;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusInfo(status: Appointment['status']) {
  const map: Record<string, { label: string; color: string }> = {
    confirmed:   { label: 'Confirmado',  color: 'bg-sky-100 text-sky-700 border-sky-200' },
    waiting:     { label: 'En Espera',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
    in_progress: { label: 'En Atención', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    completed:   { label: 'Completado',  color: 'bg-slate-100 text-slate-600 border-slate-200' },
    cancelled:   { label: 'Cancelado',   color: 'bg-rose-100 text-rose-700 border-rose-200' },
    'no-show':   { label: 'No asistió',  color: 'bg-rose-100 text-rose-700 border-rose-200' },
    facturado:   { label: 'Facturado',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  };
  return map[status] ?? { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function getClientPhotoUrl(client: Client | null) {
  if (!client) return null;
  const maybe = client as unknown as Record<string, unknown>;
  const candidates = ['photoUrl', 'avatarUrl', 'imageUrl', 'profileImage', 'profilePicture', 'photo'];
  for (const key of candidates) {
    const value = maybe[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function ClientAvatar({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-14 w-14 text-xl',
    lg: 'h-16 w-16 text-2xl',
  };
  const iconSize = size === 'lg' ? 'h-8 w-8' : size === 'md' ? 'h-7 w-7' : 'h-4 w-4';

  if (photoUrl) {
    return (
      <div className={cn('relative overflow-hidden rounded-full border border-border/60 bg-muted shrink-0', sizeClasses[size])}>
        <img
          src={photoUrl}
          alt={`Foto de ${name}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div className="absolute inset-0 hidden items-center justify-center bg-slate-700 text-white" aria-hidden>
          <User className={cn('opacity-95', iconSize)} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-full bg-slate-700 text-white font-bold flex items-center justify-center shrink-0 select-none',
      sizeClasses[size]
    )}>
      <User className={cn('opacity-95', iconSize)} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyDayPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <MyDayPageContent />
    </Suspense>
  );
}

function MyDayPageContent() {
  const { currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [dailyAppointments, setDailyAppointments] = useState<Appointment[]>([]);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Appointment[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClient, setLoadingClient] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const previousStatusesRef = useRef<Map<string, Appointment['status']>>(new Map());
  const [isPending, startTransition] = useTransition();
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [isEditingTurn, setIsEditingTurn] = useState(false);
  const [draftAssignments, setDraftAssignments] = useState<AppointmentAssignment[]>([]);
  const [initialAssignmentsCount, setInitialAssignmentsCount] = useState(0);
  const requestedAppointmentId = searchParams.get('appointmentId');

  useEffect(() => {
    const fetchAppointments = async (showLoader = false) => {
      if (!currentUser) return;

      if (showLoader) {
        setLoading(true);
      }

      try {
        const all = await getAppointments();

        const requestedAppointment = requestedAppointmentId
          ? all.find(appt => appt.id === requestedAppointmentId)
          : undefined;

        const employeeAppointments = all
          .filter(appt => 
            (appt.assignments || []).some(a => a.employeeId === currentUser.id) && 
            isToday(new Date(appt.date)) &&
            appt.status !== 'cancelled'
          )
          .sort((a, b) => {
            const getEmployeeTime = (appt: Appointment) => {
              const myAssignment = (appt.assignments || []).find(a => a.employeeId === currentUser.id);
              if (myAssignment?.time) {
                return new Date(`${format(new Date(appt.date), 'yyyy-MM-dd')}T${myAssignment.time}:00`).getTime();
              }
              return new Date(appt.date).getTime();
            };
            return getEmployeeTime(a) - getEmployeeTime(b);
          });

        const shouldIncludeRequestedAppointment =
          requestedAppointment &&
          isToday(new Date(requestedAppointment.date)) &&
          requestedAppointment.status !== 'cancelled' &&
          !employeeAppointments.some(appt => appt.id === requestedAppointment.id);

        const todayAppointments = shouldIncludeRequestedAppointment
          ? [...employeeAppointments, requestedAppointment].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          : employeeAppointments;

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
        setAllAppointments(all);
        setDailyAppointments(todayAppointments);

        // Auto-select: prefer in_progress → waiting → first
        setSelectedApptId(prev => {
          if (prev) return prev;
          const auto = todayAppointments.find(a => a.status === 'in_progress')
            ?? todayAppointments.find(a => a.status === 'waiting')
            ?? todayAppointments[0];
          return auto?.id ?? null;
        });
      } catch (error) {
        console.error('Failed to fetch appointments:', error);
        setDailyAppointments([]);
      } finally {
        if (showLoader) setLoading(false);
      }
    };

    if (currentUser) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => undefined);
      }
      fetchAppointments(true);
      const interval = setInterval(() => fetchAppointments(false), 15000);
      return () => clearInterval(interval);
    }
  }, [currentUser, toast, requestedAppointmentId]);

  useEffect(() => {
    if (!dailyAppointments.length) return;
    if (!requestedAppointmentId) return;

    const requestedExists = dailyAppointments.some(appt => appt.id === requestedAppointmentId);
    if (requestedExists) {
      setSelectedApptId(requestedAppointmentId);
    }
  }, [requestedAppointmentId, dailyAppointments]);

  // Load client details when selection changes
  useEffect(() => {
    const appt = dailyAppointments.find(a => a.id === selectedApptId);
    if (!appt) {
      setClientData(null);
      setClientHistory([]);
      setUpcomingVisits([]);
      return;
    }
    setLoadingClient(true);
    getClientByEmail(appt.customerEmail)
      .then(client => {
        setClientData(client ?? null);
        const appointmentsByClient = allAppointments
          .filter(a => a.customerEmail === appt.customerEmail && a.id !== appt.id)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const currentTimestamp = new Date(appt.date).getTime();

        const history = appointmentsByClient
          .filter(a => new Date(a.date).getTime() < currentTimestamp)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 12);

        const upcoming = appointmentsByClient
          .filter(a => new Date(a.date).getTime() > currentTimestamp && a.status !== 'cancelled')
          .slice(0, 6);

        setClientHistory(history);
        setUpcomingVisits(upcoming);
      })
      .finally(() => setLoadingClient(false));
  }, [selectedApptId, allAppointments]);

  const selectedAppt = useMemo(
    () => dailyAppointments.find(a => a.id === selectedApptId) ?? null,
    [dailyAppointments, selectedApptId]
  );

  const myAssignments = useMemo(
    () => (selectedAppt?.assignments ?? [])
      .map((a, idx) => ({ assignment: a, idx }))
      .filter(({ assignment }) => assignment.employeeId === currentUser?.id),
    [selectedAppt, currentUser]
  );

  const displayedAssignments = useMemo(
    () => {
      const source = isEditingTurn ? draftAssignments : (selectedAppt?.assignments ?? []);
      if (isEditingTurn) {
        return source.map((a, idx) => ({ assignment: a, idx }));
      }
      return source
        .map((a, idx) => ({ assignment: a, idx }))
        .filter(({ assignment }) => assignment.employeeId === currentUser?.id);
    },
    [isEditingTurn, draftAssignments, selectedAppt, currentUser]
  );

  const hasInProgressAssignment = useMemo(
    () => myAssignments.some(({ assignment }) => (assignment.status ?? 'pending') === 'in_progress'),
    [myAssignments]
  );

  const hasPendingAssignment = useMemo(
    () => myAssignments.some(({ assignment }) => (assignment.status ?? 'pending') === 'pending'),
    [myAssignments]
  );

  const firstPendingAssignment = useMemo(
    () => myAssignments.find(({ assignment }) => (assignment.status ?? 'pending') === 'pending') ?? null,
    [myAssignments]
  );

  const firstInProgressAssignment = useMemo(
    () => myAssignments.find(({ assignment }) => (assignment.status ?? 'pending') === 'in_progress') ?? null,
    [myAssignments]
  );

  useEffect(() => {
    setNotes(selectedAppt?.notes ?? '');
  }, [selectedAppt?.id, selectedAppt?.notes]);

  useEffect(() => {
    if (_catalogCache) {
      setAllServices(_catalogCache.services);
      setAllProducts(_catalogCache.products);
      setEmployees(_catalogCache.employees);
      return;
    }
    setCatalogLoading(true);
    loadCatalogCached()
      .then(catalog => {
        setAllServices(catalog.services);
        setAllProducts(catalog.products);
        setEmployees(catalog.employees);
      })
      .catch(() => {
        toast({
          title: 'Error cargando catálogo',
          description: 'No se pudieron cargar servicios y productos.',
          variant: 'destructive',
        });
      })
      .finally(() => setCatalogLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsEditingTurn(false);
    if (!selectedAppt) {
      setDraftAssignments([]);
      setInitialAssignmentsCount(0);
      return;
    }
    const normalized = (selectedAppt.assignments ?? []).map((a, index) => ({
      ...a,
      productIds: a.productIds ?? (index === 0 ? (selectedAppt.productIds ?? []) : []),
      status: a.status ?? 'pending',
    }));
    setDraftAssignments(normalized);
    setInitialAssignmentsCount(normalized.length);
  }, [selectedAppt?.id]);

  const handleStatus = (status: 'pending' | 'in_progress' | 'completed', assignmentIdx: number) => {
    if (!selectedAppt || !currentUser || isStatusSaving) return;

    // Optimistic update: reflect the change instantly in the UI
    const applyOptimistic = (list: Appointment[]) =>
      list.map(a => {
        if (a.id !== selectedAppt.id) return a;
        const newAssignments = (a.assignments ?? []).map((asgn, i) =>
          i === assignmentIdx ? { ...asgn, status } : asgn
        );
        const allDone = newAssignments.every(x => (x.status ?? 'pending') === 'completed');
        const anyGoing = newAssignments.some(x => (x.status ?? 'pending') === 'in_progress');
        return { ...a, assignments: newAssignments, status: allDone ? 'completed' : anyGoing ? 'in_progress' : 'waiting' } as Appointment;
      });

    setDailyAppointments(prev => applyOptimistic(prev));
    setAllAppointments(prev => applyOptimistic(prev));

    // Fire-and-forget: no bloqueamos la UI mientras guarda en el servidor
    setIsStatusSaving(true);
    const appointmentId = selectedAppt.id;
    const userId = currentUser.id;
    updateAssignmentStatus(appointmentId, userId, status, assignmentIdx)
      .then(result => {
        if (result.error) {
          // Revert optimistic update fetching fresh data from server
          return getAppointments().then(all => {
            setAllAppointments(all);
            setDailyAppointments(
              all.filter(a =>
                (a.assignments ?? []).some(x => x.employeeId === userId) &&
                isToday(new Date(a.date)) &&
                a.status !== 'cancelled'
              )
            );
            toast({
              title: 'Error al actualizar turno',
              description: result.error,
              variant: 'destructive',
            });
          }).catch(() => undefined);
        }
      })
      .catch(() => {
        toast({
          title: 'Error al actualizar turno',
          description: 'No se pudo guardar el cambio. Intentá de nuevo.',
          variant: 'destructive',
        });
      })
      .finally(() => setIsStatusSaving(false));
  };

  const handleSaveNotes = () => {
    if (!selectedAppt) return;
    startTransition(async () => {
      try {
        await updateAppointment(selectedAppt.id, { notes: notes.trim() || undefined });

        setAllAppointments(prev => prev.map(a =>
          a.id === selectedAppt.id ? { ...a, notes: notes.trim() || undefined } : a
        ));
        setDailyAppointments(prev => prev.map(a =>
          a.id === selectedAppt.id ? { ...a, notes: notes.trim() || undefined } : a
        ));

        toast({
          title: 'Notas guardadas',
          description: 'Las notas del turno se actualizaron correctamente.',
        });
      } catch (error) {
        toast({
          title: 'Error al guardar notas',
          description: 'No se pudieron guardar las notas.',
          variant: 'destructive',
        });
      }
    });
  };

  const updateDraftAssignment = (index: number, field: keyof AppointmentAssignment, value: string | number) => {
    setDraftAssignments(prev => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value } as AppointmentAssignment;
      if (field === 'serviceId') {
        const service = allServices.find(s => s.id === value);
        if (service) updated.duration = service.duration;
      }
      next[index] = updated;
      return next;
    });
  };

  const addProductToDraft = (index: number, productId: string) => {
    if (!productId) return;
    setDraftAssignments(prev => {
      const next = [...prev];
      const current = next[index];
      const currentProductIds = current.productIds ?? [];
      next[index] = { ...current, productIds: [...currentProductIds, productId] };
      return next;
    });
  };

  const removeProductFromDraft = (index: number, productPosition: number) => {
    setDraftAssignments(prev => {
      const next = [...prev];
      const current = next[index];
      const currentProductIds = current.productIds ?? [];
      next[index] = {
        ...current,
        productIds: [...currentProductIds.slice(0, productPosition), ...currentProductIds.slice(productPosition + 1)],
      };
      return next;
    });
  };

  const addDraftAssignment = () => {
    if (!currentUser) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setDraftAssignments(prev => ([
      ...prev,
      {
        employeeId: currentUser.id,
        serviceId: '',
        time: `${hh}:${mm}`,
        duration: 30,
        productIds: [],
        status: 'pending',
      },
    ]));
  };

  const removeDraftAssignment = (index: number) => {
    setDraftAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return 'Sin asignar';
    return employees.find(e => e.id === employeeId)?.name ?? 'Profesional';
  };

  const handleSaveTurnEdits = () => {
    if (!selectedAppt || !currentUser) return;

    if (draftAssignments.some(a => !a.employeeId || !a.serviceId || !a.time || !a.duration)) {
      toast({
        title: 'Faltan datos',
        description: 'Completá profesional, servicio, hora y duración para guardar cambios del turno.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        const normalizedAssignments = draftAssignments.map(a => ({
          ...a,
          productIds: a.productIds ?? [],
          status: a.status ?? 'pending',
        }));

        await updateAppointment(selectedAppt.id, {
          assignments: normalizedAssignments,
          productIds: normalizedAssignments.flatMap(a => a.productIds ?? []),
        });

        setAllAppointments(prev => prev.map(a =>
          a.id === selectedAppt.id
            ? { ...a, assignments: normalizedAssignments }
            : a
        ));
        setDailyAppointments(prev => prev.map(a =>
          a.id === selectedAppt.id
            ? {
                ...a,
                assignments: normalizedAssignments,
                serviceNames: normalizedAssignments.map(asg => allServices.find(s => s.id === asg.serviceId)?.name ?? 'Servicio'),
              }
            : a
        ));

        setIsEditingTurn(false);
        toast({
          title: 'Turno actualizado',
          description: 'Se guardaron los cambios de servicios/productos/horarios.',
        });
      } catch {
        toast({
          title: 'Error al actualizar turno',
          description: 'No se pudieron guardar los cambios del turno.',
          variant: 'destructive',
        });
      }
    });
  };

  // ── Derived display values ────────────────────────────────────────────────
  const myTime = myAssignments[0]?.assignment?.time;
  const displayDate = myTime && selectedAppt
    ? new Date(`${format(new Date(selectedAppt.date), 'yyyy-MM-dd')}T${myTime}:00`)
    : selectedAppt ? new Date(selectedAppt.date) : null;

  const clientPhotoUrl = useMemo(() => getClientPhotoUrl(clientData), [clientData]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dailyAppointments.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center px-4">
        <Calendar className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg font-semibold text-foreground">Sin turnos para hoy</p>
        <p className="text-sm text-muted-foreground">No tenés turnos programados para hoy.</p>
      </div>
    );
  }

  return (
    <div className="salon-shell myday-shell space-y-4 md:space-y-5 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ficha de Cliente</h1>
          <p className="text-sm text-muted-foreground">Vista de atención al cliente en turno</p>
        </div>
        {selectedAppt && (
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
            getStatusInfo(selectedAppt.status).color
          )}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {getStatusInfo(selectedAppt.status).label}
          </span>
        )}
      </div>

      {/* ── Appointment strip ─────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {dailyAppointments.map(appt => {
          const mine = (appt.assignments ?? []).find(a => a.employeeId === currentUser?.id);
          const t = mine?.time
            ? new Date(`${format(new Date(appt.date), 'yyyy-MM-dd')}T${mine.time}:00`)
            : new Date(appt.date);
          const isSelected = appt.id === selectedApptId;
          const si = getStatusInfo(appt.status);
          return (
            <button
              key={appt.id}
              onClick={() => { setSelectedApptId(appt.id); }}
              className={cn(
                'flex shrink-0 flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
                'min-w-[108px] max-w-[142px]',
                isSelected
                  ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/20 hover:bg-muted/40'
              )}
            >
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {format(t, 'HH:mm')}
              </span>
              <span className="mt-1 w-full truncate text-sm font-bold text-foreground leading-tight">
                {appt.customerName.split(' ')[0]}
              </span>
              <span className={cn(
                'mt-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                si.color
              )}>
                {si.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Ficha: 3 panels ──────────────────────────────────────────────── */}
      {selectedAppt && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">

          {/* ── PANEL 2: Historial de visitas ──────────────────────────────── */}
          <div className="order-2 rounded-xl border bg-card shadow-sm flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-3 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">Historial de Visitas</h3>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {clientHistory.length} registros
              </span>
            </div>

            <ScrollArea className="flex-1" style={{ maxHeight: '420px' }}>
              {loadingClient ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : clientHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-4">
                  <Calendar className="h-8 w-8 text-muted-foreground/25" />
                  <p className="text-sm font-medium text-muted-foreground">Sin visitas anteriores</p>
                  <p className="text-xs text-muted-foreground/70">Es la primera vez que viene</p>
                </div>
              ) : (
                <div className="divide-y">
                  {clientHistory.map(appt => (
                    <div key={appt.id} className="px-3.5 py-2.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Date + employee */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-sm font-bold text-foreground">
                              {format(new Date(appt.date), "d MMM yyyy", { locale: es })}
                            </span>
                            {appt.employeeName && (
                              <span className="text-xs text-muted-foreground">
                                por {appt.employeeName.split(' ')[0]}
                              </span>
                            )}
                          </div>
                          {/* Services */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(appt.serviceNames ?? []).filter(Boolean).map((s, si) => (
                              <span key={si} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                <Scissors className="h-2.5 w-2.5 text-muted-foreground" />{s}
                              </span>
                            ))}
                          </div>
                          {/* Notes */}
                          {appt.notes && (
                            <p className="mt-1.5 text-[11px] italic text-muted-foreground leading-relaxed">
                              {appt.notes}
                            </p>
                          )}
                        </div>
                        {/* Status badge */}
                        <span className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          getStatusInfo(appt.status).color
                        )}>
                          {getStatusInfo(appt.status).label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ── PANEL 3: Turno Actual ──────────────────────────────────────── */}
          <div className="order-1 rounded-lg border bg-card shadow-sm flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex flex-col gap-2 px-3.5 py-3 border-b shrink-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">Turno Actual</h3>
              </div>
              <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                {!isEditingTurn && currentUser?.role === 'Peluquero' && hasPendingAssignment && firstPendingAssignment && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-[11px]"
                    disabled={isStatusSaving}
                    onClick={() => handleStatus('in_progress', firstPendingAssignment.idx)}
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Iniciar turno
                  </Button>
                )}
                {!isEditingTurn && currentUser?.role === 'Peluquero' && hasInProgressAssignment && firstInProgressAssignment && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-[11px] border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                    disabled={isStatusSaving}
                    onClick={() => handleStatus('completed', firstInProgressAssignment.idx)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Finalizar turno
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-[11px]"
                  onClick={() => setIsEditingTurn(v => !v)}
                  disabled={isPending || catalogLoading}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  {isEditingTurn ? 'Cancelar edición' : 'Editar aquí'}
                </Button>
                {isEditingTurn && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-[11px]"
                    onClick={addDraftAssignment}
                    disabled={isPending || catalogLoading}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Agregar servicio
                  </Button>
                )}
                {isEditingTurn && (
                  <Button size="sm" className="h-8 gap-1.5 text-[11px]" onClick={handleSaveTurnEdits} disabled={isPending || catalogLoading}>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Guardar cambios
                  </Button>
                )}
                <span className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                  getStatusInfo(selectedAppt.status).color
                )}>
                  {getStatusInfo(selectedAppt.status).label}
                </span>
              </div>
            </div>

            <div className="px-3.5 py-3 border-b bg-muted/10">
              <div className="flex items-start gap-3">
                <ClientAvatar name={selectedAppt.customerName} photoUrl={clientPhotoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold leading-tight text-foreground">
                      {selectedAppt.customerName}
                    </h2>
                    {clientData?.clientCategory && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                        {clientData.clientCategory}
                      </span>
                    )}
                  </div>
                  {clientData?.code && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Hash className="h-3 w-3" />{clientData.code}
                    </p>
                  )}
                  {selectedAppt.notes && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                        <p className="text-[11px] leading-relaxed text-amber-800 line-clamp-2">{selectedAppt.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Service assignment cards */}
            <div className="px-3.5 pt-3 pb-2 space-y-2">
              {myAssignments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tenés servicios asignados en este turno.
                </p>
              )}
              {displayedAssignments.map(({ assignment, idx }) => {
                const editableAssignment = isEditingTurn ? draftAssignments[idx] : assignment;
                const isOriginalAssignment = idx < initialAssignmentsCount;
                const serviceName = allServices.find(s => s.id === editableAssignment?.serviceId)?.name
                  ?? selectedAppt.serviceNames?.[idx]
                  ?? 'Servicio';
                const aStatus = editableAssignment?.status ?? 'pending';
                return (
                  <div key={idx} className="rounded-lg border bg-muted/20 p-2.5 space-y-2">
                    {/* Service */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground leading-snug truncate">{serviceName}</p>
                        <p className="text-xs text-muted-foreground">con {getEmployeeName(editableAssignment?.employeeId)}</p>
                      </div>
                      <span className="rounded-full border bg-background px-2 py-1 text-[10px] text-muted-foreground">
                        #{idx + 1}
                      </span>
                    </div>

                    {isEditingTurn && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">Profesional</label>
                          <select
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={editableAssignment.employeeId}
                            onChange={(e) => updateDraftAssignment(idx, 'employeeId', e.target.value)}
                          >
                            <option value="">Seleccionar profesional...</option>
                            {employees.map(employee => (
                              <option key={employee.id} value={employee.id}>{employee.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">Servicio</label>
                          <select
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={editableAssignment.serviceId}
                            onChange={(e) => updateDraftAssignment(idx, 'serviceId', e.target.value)}
                          >
                            <option value="">Seleccionar servicio...</option>
                            {allServices.map(service => (
                              <option key={service.id} value={service.id}>{service.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">Hora</label>
                          <input
                            type="time"
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={editableAssignment.time}
                            onChange={(e) => updateDraftAssignment(idx, 'time', e.target.value)}
                            disabled={isOriginalAssignment}
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[11px] font-semibold text-muted-foreground">Duración (min)</label>
                          <input
                            type="number"
                            min={1}
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={editableAssignment.duration ?? 0}
                            onChange={(e) => updateDraftAssignment(idx, 'duration', Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[11px] font-semibold text-muted-foreground">Productos</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(editableAssignment.productIds ?? []).map((productId, productIndex) => {
                              const product = allProducts.find(p => p.id === productId);
                              return (
                                <span key={`${productId}-${productIndex}`} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                  {product?.name ?? 'Producto'}
                                  <button
                                    type="button"
                                    className="ml-1 rounded-full px-1 hover:bg-muted"
                                    onClick={() => removeProductFromDraft(idx, productIndex)}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                          <select
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            defaultValue=""
                            onChange={(e) => {
                              addProductToDraft(idx, e.target.value);
                              e.currentTarget.value = '';
                            }}
                          >
                            <option value="">Agregar producto...</option>
                            {allProducts.map(product => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => removeDraftAssignment(idx)}
                          >
                            Quitar servicio
                          </Button>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Time + duration */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-semibold text-foreground tabular-nums">
                          {displayDate ? format(displayDate, 'HH:mm') : '—'}
                        </span>
                      </span>
                      {assignment.duration && (
                        <span className="flex items-center gap-1">
                          Duración:
                          <span className="font-semibold text-foreground">{editableAssignment?.duration ?? assignment.duration} min</span>
                        </span>
                      )}
                    </div>

                    {!isEditingTurn && (editableAssignment.productIds ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(editableAssignment.productIds ?? []).map((productId, productIndex) => {
                          const product = allProducts.find(p => p.id === productId);
                          return (
                            <span
                              key={`${productId}-${productIndex}`}
                              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]"
                            >
                              <Package className="h-3 w-3 text-muted-foreground" />
                              {product?.name ?? 'Producto'}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Action button */}
                    {aStatus === 'pending' && (
                      <Button
                        size="sm"
                        className="h-8 w-full gap-2 text-xs"
                        disabled={isStatusSaving}
                        onClick={() => handleStatus('in_progress', idx)}
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Iniciar atención
                      </Button>
                    )}
                    {aStatus === 'in_progress' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-full gap-2 text-xs border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                        disabled={isStatusSaving}
                        onClick={() => handleStatus('completed', idx)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Finalizar servicio
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

          <div className="order-3 rounded-lg border bg-card shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-3 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">Notas internas</h3>
              </div>
            </div>
            <div className="px-3.5 py-3 flex-1 flex flex-col gap-2">
              <Textarea
                placeholder="Color utilizado, productos recomendados, observaciones del cliente…"
                className="flex-1 min-h-[120px] resize-none text-xs bg-muted/20 border-muted focus:bg-background"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={isPending}
                  onClick={handleSaveNotes}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Guardar nota
                </Button>
              </div>
            </div>
          </div>

          <div className="order-4 rounded-lg border bg-card shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-3 border-b shrink-0">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximas visitas</h4>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {upcomingVisits.length}
              </span>
            </div>
            <div className="px-3.5 py-3 flex-1">
              {loadingClient ? (
                <div className="mt-2 h-10 animate-pulse rounded-md bg-muted" />
              ) : upcomingVisits.length === 0 ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  <ImageOff className="h-3.5 w-3.5" />
                  No hay próximas visitas agendadas.
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingVisits.map(visit => (
                    <div key={visit.id} className="rounded-md border bg-muted/30 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {format(new Date(visit.date), 'EEE d MMM, HH:mm', { locale: es })}
                        </span>
                        <span className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          getStatusInfo(visit.status).color
                        )}>
                          {getStatusInfo(visit.status).label}
                        </span>
                      </div>
                      {(visit.serviceNames ?? []).filter(Boolean).length > 0 && (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {(visit.serviceNames ?? []).filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-auto border-t px-3.5 py-2.5">
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground" asChild>
                <Link href={`/admin/clients/${encodeURIComponent(selectedAppt.customerEmail)}`}>
                  Ver ficha completa
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
