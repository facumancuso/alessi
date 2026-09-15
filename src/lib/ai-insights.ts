'use server';

import { getCurrentUser } from './auth-actions';
import { connectToDatabase } from './mongodb';
import { AppointmentModel, ServiceModel, UserModel } from './models';

// Prueba de viabilidad: asistente de preguntas en lenguaje natural sobre el
// negocio, disponible solo para Superadmin. Usa la capa gratuita de la API
// de Gemini vía REST (sin dependencias nuevas). Si no funciona bien o no
// vale la pena el costo/latencia, este archivo se puede borrar sin afectar
// el resto de la app.

const GEMINI_MODEL = 'gemini-2.5-flash';
const CONTEXT_WINDOW_DAYS = 60;
const MAX_QUESTION_LENGTH = 500;

const DAY_NAMES = ['', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

async function buildBusinessContext(): Promise<string> {
  await connectToDatabase();

  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - CONTEXT_WINDOW_DAYS);

  const dateMatchStage = {
    $addFields: {
      __d: { $convert: { input: '$date', to: 'date', onError: null, onNull: null } },
    },
  };

  const [revenueByService, loadByEmployeeDay, statusCounts, services, employees] = await Promise.all([
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

  return `
Período de datos: últimos ${CONTEXT_WINDOW_DAYS} días (desde ${rangeStart.toISOString().slice(0, 10)} hasta ${rangeEnd.toISOString().slice(0, 10)}).

Turnos completados por servicio (nombre: cantidad, precio base, ingreso estimado):
${serviceLines}

Turnos por empleado y día de la semana (suma de turnos de ese día en todo el período, no cancelados):
${employeeLines}

Cantidad de turnos por estado en el período:
${statusLines}
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

    const prompt = `Sos un asistente interno para la administración de "Alessi Hairdressing", una peluquería. Te paso datos agregados reales del negocio. Respondé la pregunta del administrador en español, de forma breve y concreta, basándote ÚNICAMENTE en estos datos. Si la pregunta no se puede responder con la información disponible, decilo claramente en vez de inventar una respuesta.

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
