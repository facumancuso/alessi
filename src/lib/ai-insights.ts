'use server';

import { getCurrentUser } from './auth-actions';
import { connectToDatabase } from './mongodb';
import { AppointmentModel, ServiceModel, UserModel } from './models';
import { format, addDays, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

// Prueba de viabilidad: asistente de preguntas en lenguaje natural sobre el
// negocio, disponible solo para Superadmin. Usa la capa gratuita de la API
// de Gemini vía REST (sin dependencias nuevas). Si no funciona bien o no
// vale la pena el costo/latencia, este archivo se puede borrar sin afectar
// el resto de la app.

const GEMINI_MODEL = 'gemini-2.5-flash';
const CONTEXT_WINDOW_DAYS = 60;
const MAX_QUESTION_LENGTH = 500;

const DAY_NAMES = ['', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const CONTEXT_WINDOW_FUTURE_DAYS = 30;

async function buildBusinessContext(): Promise<string> {
  await connectToDatabase();

  const now = new Date();
  const rangeEnd = now;
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - CONTEXT_WINDOW_DAYS);

  // The daily breakdown below needs to reach back far enough to always cover
  // the *entire* previous calendar month (for "cuánto se facturó el mes
  // pasado") and forward into scheduled appointments (for "la semana que
  // viene") -- both fall outside the plain rangeStart..rangeEnd window used
  // by the historical aggregates above.
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const dailyRangeStart = prevMonthStart < rangeStart ? prevMonthStart : rangeStart;
  const dailyRangeEnd = addDays(now, CONTEXT_WINDOW_FUTURE_DAYS);

  const dateMatchStage = {
    $addFields: {
      __d: { $convert: { input: '$date', to: 'date', onError: null, onNull: null } },
    },
  };

  const [revenueByService, loadByEmployeeDay, statusCounts, services, employees, dailyAppointments] = await Promise.all([
    AppointmentModel.aggregate([
      dateMatchStage,
      { $match: { __d: { $gte: rangeStart, $lte: rangeEnd }, status: { $in: ['completed', 'facturado'] } } },
      { $unwind: '$assignments' },
      { $group: { _id: '$assignments.serviceId', count: { $sum: 1 } } },
    ]),
    AppointmentModel.aggregate([
      dateMatchStage,
      { $match: { __d: { $gte: rangeStart, $lte: rangeEnd }, status: { $ne: 'cancelled' } } },
      { $unwind: '$assignments' },
      { $group: { _id: { employeeId: '$assignments.employeeId', dow: { $dayOfWeek: '$__d' } }, count: { $sum: 1 } } },
    ]),
    AppointmentModel.aggregate([
      dateMatchStage,
      { $match: { __d: { $gte: rangeStart, $lte: rangeEnd } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ServiceModel.find({}).select('name price').lean(),
    UserModel.find({ role: 'Peluquero' }).select('name isActive').lean(),
    // Per-appointment detail (not pre-aggregated) so the model can answer
    // questions about a specific date -- the aggregates above only bucket by
    // day-of-week, which loses which exact day each appointment fell on.
    // Range extends further back (full previous calendar month) and forward
    // (scheduled appointments) than the historical aggregates above.
    AppointmentModel.aggregate([
      dateMatchStage,
      { $match: { __d: { $gte: dailyRangeStart, $lte: dailyRangeEnd } } },
      { $project: { date: '$__d', assignments: 1, status: 1 } },
    ]),
  ]);

  const serviceNameById = new Map(services.map(s => [s._id.toString(), { name: s.name, price: s.price }]));
  const employeeNameById = new Map(employees.filter(e => e.isActive).map(e => [e._id.toString(), e.name]));

  const serviceLines = revenueByService
    .map(row => {
      const svc = serviceNameById.get(row._id);
      if (!svc) return null;
      return `- ${svc.name}: ${row.count} turnos completados, precio base $${svc.price}, ingreso estimado $${svc.price * row.count}`;
    })
    .filter(Boolean)
    .join('\n') || '(sin turnos completados en este período)';

  const loadByEmployee = new Map<string, Map<number, number>>();
  for (const row of loadByEmployeeDay) {
    const empId = row._id.employeeId;
    const dow = row._id.dow;
    if (!loadByEmployee.has(empId)) loadByEmployee.set(empId, new Map());
    loadByEmployee.get(empId)!.set(dow, row.count);
  }

  const employeeLines = [...employeeNameById.entries()]
    .map(([empId, name]) => {
      const byDay = loadByEmployee.get(empId);
      const dayCounts = [1, 2, 3, 4, 5, 6, 7]
        .map(dow => `${DAY_NAMES[dow]}: ${byDay?.get(dow) ?? 0}`)
        .join(', ');
      return `- ${name} -> ${dayCounts}`;
    })
    .join('\n') || '(sin empleados activos)';

  const statusLines = statusCounts
    .map(row => `- ${row._id}: ${row.count}`)
    .join('\n') || '(sin turnos en este período)';

  // Per-day breakdown, pre-seeded so days with zero appointments show up
  // explicitly instead of being silently absent from the context. Covers
  // dailyRangeStart..dailyRangeEnd, i.e. further back and forward than the
  // historical aggregates above (see comment where those are computed).
  type DayBucket = { total: number; byEmployee: Map<string, number>; byStatus: Map<string, number>; revenue: number };
  const dayBuckets = new Map<string, DayBucket>();
  for (let d = new Date(dailyRangeStart); d <= dailyRangeEnd; d.setDate(d.getDate() + 1)) {
    dayBuckets.set(format(d, 'yyyy-MM-dd'), { total: 0, byEmployee: new Map(), byStatus: new Map(), revenue: 0 });
  }

  for (const appt of dailyAppointments) {
    const apptDate = appt.date instanceof Date ? appt.date : new Date(appt.date);
    if (Number.isNaN(apptDate.getTime())) continue;
    const key = format(apptDate, 'yyyy-MM-dd');
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;

    bucket.total += 1;
    bucket.byStatus.set(appt.status, (bucket.byStatus.get(appt.status) ?? 0) + 1);

    const employeesInAppt = new Set<string>((appt.assignments ?? []).map((a: any) => a.employeeId).filter(Boolean));
    for (const empId of employeesInAppt) {
      const name = employeeNameById.get(empId) ?? 'Sin asignar';
      bucket.byEmployee.set(name, (bucket.byEmployee.get(name) ?? 0) + 1);
    }

    if (appt.status === 'completed' || appt.status === 'facturado') {
      for (const a of appt.assignments ?? []) {
        const svc = serviceNameById.get(a.serviceId);
        if (svc) bucket.revenue += svc.price;
      }
    }
  }

  const dailyLines = [...dayBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, bucket]) => {
      const dow = format(new Date(`${dateKey}T12:00:00`), 'EEEE', { locale: es });
      const dowCapitalized = dow.charAt(0).toUpperCase() + dow.slice(1);
      if (bucket.total === 0) {
        return `- ${dateKey} (${dowCapitalized}): 0 turnos`;
      }
      const employeePart = [...bucket.byEmployee.entries()].map(([name, count]) => `${name}: ${count}`).join(', ');
      const statusPart = [...bucket.byStatus.entries()].map(([status, count]) => `${status}: ${count}`).join(', ');
      return `- ${dateKey} (${dowCapitalized}): ${bucket.total} turnos totales. Por profesional: ${employeePart || '(sin asignar)'}. Por estado: ${statusPart}. Facturación del día: $${bucket.revenue}.`;
    })
    .join('\n');

  // Rollups computed here (not left for the model to sum from the daily
  // detail) so answers about "el último mes/semana" or "la semana que viene"
  // don't depend on the LLM adding up 7-30 lines correctly.
  const sumRange = (fromKey: string, toKey: string) => {
    let total = 0;
    let revenue = 0;
    for (const [key, bucket] of dayBuckets) {
      if (key >= fromKey && key <= toKey) {
        total += bucket.total;
        revenue += bucket.revenue;
      }
    }
    return { total, revenue };
  };

  const todayKey = format(now, 'yyyy-MM-dd');
  const last7 = sumRange(format(subDays(now, 6), 'yyyy-MM-dd'), todayKey);
  const last30 = sumRange(format(subDays(now, 29), 'yyyy-MM-dd'), todayKey);
  const prevMonthKey = format(prevMonthStart, 'yyyy-MM-dd');
  const prevMonthEndKey = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevMonth = sumRange(prevMonthKey, prevMonthEndKey);
  const thisMonthKey = format(startOfMonth(now), 'yyyy-MM-dd');
  const thisMonth = sumRange(thisMonthKey, todayKey);
  const tomorrowKey = format(addDays(now, 1), 'yyyy-MM-dd');
  const next7 = sumRange(tomorrowKey, format(addDays(now, 7), 'yyyy-MM-dd'));
  const next30 = sumRange(tomorrowKey, format(addDays(now, CONTEXT_WINDOW_FUTURE_DAYS), 'yyyy-MM-dd'));

  const rollupLines = `
- Hoy (${todayKey}): ${sumRange(todayKey, todayKey).total} turnos, facturación $${sumRange(todayKey, todayKey).revenue}.
- Últimos 7 días incluyendo hoy (${format(subDays(now, 6), 'yyyy-MM-dd')} a ${todayKey}): ${last7.total} turnos, facturación $${last7.revenue}.
- Últimos 30 días incluyendo hoy (${format(subDays(now, 29), 'yyyy-MM-dd')} a ${todayKey}): ${last30.total} turnos, facturación $${last30.revenue}.
- Mes calendario anterior completo (${prevMonthKey} a ${prevMonthEndKey}): ${prevMonth.total} turnos, facturación $${prevMonth.revenue}.
- Mes calendario en curso hasta hoy (${thisMonthKey} a ${todayKey}): ${thisMonth.total} turnos, facturación $${thisMonth.revenue}.
- Próximos 7 días ya agendados (${tomorrowKey} a ${format(addDays(now, 7), 'yyyy-MM-dd')}, sin facturación porque todavía no pasaron): ${next7.total} turnos.
- Próximos ${CONTEXT_WINDOW_FUTURE_DAYS} días ya agendados (${tomorrowKey} a ${format(addDays(now, CONTEXT_WINDOW_FUTURE_DAYS), 'yyyy-MM-dd')}): ${next30.total} turnos.
`.trim();

  return `
Hoy es ${todayKey}.

Período de datos históricos (turnos por servicio, por empleado y por estado): últimos ${CONTEXT_WINDOW_DAYS} días (desde ${rangeStart.toISOString().slice(0, 10)} hasta ${rangeEnd.toISOString().slice(0, 10)}).

Turnos completados por servicio (nombre: cantidad, precio base, ingreso estimado):
${serviceLines}

Turnos por empleado y día de la semana (suma de turnos de ese día en TODO el período histórico, no cancelados -- útil para patrones generales, no para una fecha puntual):
${employeeLines}

Cantidad de turnos por estado en el período histórico:
${statusLines}

Resumen rápido ya calculado (usá estos números directamente para preguntas de "hoy", "esta semana", "este/el mes", "los próximos N días" -- NO los recalcules sumando el detalle día por día):
${rollupLines}

Detalle día por día (fecha exacta, desde ${format(dailyRangeStart, 'yyyy-MM-dd')} hasta ${format(dailyRangeEnd, 'yyyy-MM-dd')} -- incluye pasado y turnos ya agendados a futuro; usá esta sección solo para preguntas sobre una fecha puntual distinta a las del resumen rápido):
${dailyLines}
`.trim();
}

export async function askBusinessQuestion(question: string): Promise<{ answer: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'Superadmin') {
    return { error: 'No tenés permisos para usar el asistente de IA.' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: 'Falta configurar GEMINI_API_KEY en el servidor.' };
  }

  const trimmed = question.trim();
  if (!trimmed) {
    return { error: 'Escribí una pregunta.' };
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return { error: `La pregunta es demasiado larga (máximo ${MAX_QUESTION_LENGTH} caracteres).` };
  }

  try {
    const context = await buildBusinessContext();

    const prompt = `Sos un asistente interno para la administración de "Alessi Hairdressing", una peluquería. Te paso datos agregados reales del negocio, organizados en varias secciones. Respondé la pregunta del administrador en español, de forma breve y concreta, basándote ÚNICAMENTE en estos datos.

Antes de responder "no se puede saber", revisá bien todas las secciones. Para preguntas de "hoy", "esta semana", "los últimos 7/30 días", "el mes pasado" o "los próximos N días", usá los números de "Resumen rápido ya calculado" tal cual están, no los recalcules. Para una fecha puntual distinta (ej. "el 15 de septiembre") o para filtrar por un profesional en un día específico, usá "Detalle día por día". Los turnos futuros (agendados pero no realizados) nunca tienen facturación todavía, aclaralo si preguntan por plata de fechas futuras. Solo decí que no se puede responder si el dato realmente no está en ninguna sección.

DATOS DEL NEGOCIO:
${context}

PREGUNTA: ${trimmed}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('Gemini API error:', response.status, errorBody);
      return { error: 'El asistente de IA no está disponible en este momento. Probá de nuevo en unos minutos.' };
    }

    const data = await response.json();
    const answer: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) {
      console.error('Unexpected Gemini response shape:', JSON.stringify(data));
      return { error: 'No se pudo generar una respuesta.' };
    }

    return { answer: answer.trim() };
  } catch (error) {
    console.error('Error in askBusinessQuestion:', error);
    return { error: 'Ocurrió un error al consultar la IA.' };
  }
}
