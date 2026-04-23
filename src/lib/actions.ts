

'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Papa from 'papaparse';
import { 
    createAppointment as createAppointmentData, 
    clearDataReadCache,
    getServiceById, 
    getSettings, 
    updateSettings,
    cancelAppointment as cancelAppointmentData, 
    updateAppointment as updateAppointmentData,
    deleteAppointment as deleteAppointmentData,
    getAppointments,
    getClients,
    getClientByEmail,
    getProducts,
    getServices,
    getUsers,
    createClient,
    createProduct,
    createService,
    getUserByEmail,
    batchCreateClients,
    deleteClientFromDB,
    batchCreateAppointmentsData,
    updateClientAppointmentsStatus,
    deleteAllProducts,
    deleteAllServices,
    deleteAllClients,
    batchCreateProducts,
    batchCreateServices
} from './data';
import { createUser, getCurrentUser } from './auth-actions';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { revalidatePath } from 'next/cache';
import type { Appointment, AppointmentAssignment, ArcaInvoice, Client, Product, Service, User } from './types';
import { AppointmentModel, ClientModel, ProductModel, ServiceModel, SettingsModel, UserModel } from './models';
import { connectToDatabase } from './mongodb';
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { clearArcaConfigCache, createArcaClient, getArcaRuntimeConfig, isArcaConfigured } from './arca/client';
import { issueInvoiceWithArca } from './arca/service';
import { encryptSecret, maskSecret } from './arca/secrets';

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });

// --- LOGIN ACTION ---
// This is no longer needed as we are using Firebase Authentication on the client side.
// The logic is now in src/app/login/login-form.tsx


// --- BOOKING ACTIONS ---
const bookingSchema = z.object({
  serviceId: z.string().min(1, "Por favor, selecciona un servicio."),
  date: z.date({ required_error: "Por favor, selecciona una fecha." }),
  time: z.string().min(1, "Por favor, selecciona una hora."),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  email: z.string().email("Por favor, introduce un email válido."),
});

export type BookingFormState = {
  message: string;
  errors?: {
    serviceId?: string[];
    date?: string[];
    time?: string[];
    name?: string[];
    email?: string[];
    _form?: string[];
  };
};

export async function createBooking(
  prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const ipAddress = headers().get('x-forwarded-for') || '127.0.0.1';
  const serviceId = formData.get('serviceId') as string;
  const dateStr = formData.get('date') as string;
  const time = formData.get('time') as string;
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  const date = new Date(dateStr);

  const validatedFields = bookingSchema.safeParse({
    serviceId,
    date,
    time,
    name,
    email,
  });

  if (!validatedFields.success) {
    return {
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { serviceId: sId, date: d, time: t, name: n, email: e } = validatedFields.data;
  
  const service = await getServiceById(sId);
  if (!service) {
      return { message: "Servicio no válido.", errors: { _form: ["Servicio no válido."] } };
  }
  
  const bookingDateTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(t.split(':')[0]), parseInt(t.split(':')[1]));

  try {
    const appointment = await createAppointmentData({
      assignments: [{ serviceId: sId, employeeId: 'any', time: t, duration: service.duration }],
      customerName: n,
      customerEmail: e,
      date: bookingDateTime.toISOString(),
    });
    
    const preference = new Preference(client);

    const result = await preference.create({
        body: {
            items: [{
                id: service.id,
                title: service.name,
                quantity: 1,
                unit_price: service.price / 100,
            }],
            back_urls: {
                success: `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/confirmation/${appointment.id}`,
                failure: `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/`,
            },
            auto_return: 'approved',
            external_reference: appointment.id,
        }
    });

    redirect(result.init_point!);


  } catch (error) {
    console.error(error);
    return {
      message: 'Error al crear la reserva.',
      errors: { _form: ["No se pudo procesar la reserva. Por favor, intenta de nuevo."] }
    };
  }
}

export async function cancelBooking(id: string) {
    try {
        const cancelled = await cancelAppointmentData(id);
        if (!cancelled) {
            return { success: false, message: "No se encontró el turno." };
        }
        revalidatePath('/admin/agenda');
        revalidatePath('/admin/cancellations');
        return { success: true, message: "Turno cancelado con éxito." };
    } catch (error) {
        return { success: false, message: "Ocurrió un error al cancelar el turno." };
    }
}

export async function deleteAppointment(id: string) {
    try {
        await deleteAppointmentData(id);
        revalidatePath('/admin/agenda');
        return { success: true, message: "Turno eliminado con éxito." };
    } catch (error) {
        console.error("Failed to delete appointment:", error);
        return { success: false, message: "No se pudo eliminar el turno." };
    }
}

export async function deleteClientAction(id: string) {
    try {
        await deleteClientFromDB(id);
        revalidatePath('/admin/clients');
        return { success: true, message: "Cliente eliminado con éxito." };
    } catch (error: any) {
        console.error("Failed to delete client:", error);
        return { success: false, message: "No se pudo eliminar el cliente." };
    }
}


export async function updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | undefined> {
    try {
        const updatedAppointment = await updateAppointmentData(id, data);
        
        revalidatePath('/admin/agenda');
        if(updatedAppointment?.customerEmail) {
            revalidatePath(`/admin/clients/${encodeURIComponent(updatedAppointment.customerEmail)}`);
        }
        revalidatePath('/admin/my-day');
        revalidatePath('/admin');
        revalidatePath('/admin/appointments');
        revalidatePath('/admin/billing');
        
        return updatedAppointment;

    } catch (error) {
        console.error('Failed to update appointment details:', error);
        throw new Error("No se pudo actualizar el turno.");
    }
}

export async function createAppointment(data: Partial<Omit<Appointment, 'id'>> & { status?: Appointment['status'] }): Promise<Appointment> {
    try {
        const createdAppointment = await createAppointmentData(data);

        revalidatePath('/admin/agenda');
        if (createdAppointment?.customerEmail) {
            revalidatePath(`/admin/clients/${encodeURIComponent(createdAppointment.customerEmail)}`);
        }
        revalidatePath('/admin/my-day');
        revalidatePath('/admin');
        revalidatePath('/admin/appointments');
        revalidatePath('/admin/billing');

        return createdAppointment;
    } catch (error) {
        console.error('Failed to create appointment:', error);
        throw new Error("No se pudo crear el turno.");
    }
}

export async function updateAppointmentStatus(id: string, status: Appointment['status']): Promise<Appointment | undefined> {
    const appointment = await updateAppointment(id, { status });
    return appointment;
}

export async function markAppointmentWaiting(id: string) {
    return updateAppointmentStatus(id, 'waiting');
}

export async function startAppointment(id: string) {
    return updateAppointmentStatus(id, 'in_progress');
}

export async function completeAppointment(id: string) {
    return updateAppointmentStatus(id, 'completed');
}

export async function billAppointment(id: string) {
    return updateAppointmentStatus(id, 'facturado');
}

export async function revertAppointment(id: string) {
    return updateAppointmentStatus(id, 'completed');
}

export async function updateAssignmentStatus(
    appointmentId: string,
    employeeId: string,
    status: 'pending' | 'in_progress' | 'completed',
    assignmentIdx?: number
): Promise<void> {
    await connectToDatabase();
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment || !appointment.assignments || appointment.assignments.length === 0) {
        throw new Error('Turno no encontrado.');
    }

    let targetIndex = -1;
    if (typeof assignmentIdx === 'number') {
        const assignment = appointment.assignments[assignmentIdx];
        if (assignment && assignment.employeeId === employeeId) {
            targetIndex = assignmentIdx;
        }
    }

    if (targetIndex === -1) {
        targetIndex = appointment.assignments.findIndex(a => a.employeeId === employeeId);
    }

    if (targetIndex === -1) {
        throw new Error('Servicio no encontrado para este profesional.');
    }

    appointment.assignments[targetIndex].status = status;

    const assignmentStatuses = (appointment.assignments || []).map(a => a.status ?? 'pending');
    const allCompleted = assignmentStatuses.length > 0 && assignmentStatuses.every(s => s === 'completed');
    const anyInProgress = assignmentStatuses.some(s => s === 'in_progress');

    if (allCompleted) {
        appointment.status = 'completed';
    } else if (anyInProgress) {
        appointment.status = 'in_progress';
    } else {
        appointment.status = 'waiting';
    }

    await appointment.save();

    revalidatePath('/admin/my-day');
    revalidatePath('/admin/agenda');
    revalidatePath('/admin');
    revalidatePath('/admin/billing');
}

export async function billAllClientAppointments(appointmentIds: string[]) {
    await updateClientAppointmentsStatus(appointmentIds, 'facturado');
    revalidatePath('/admin/billing');
}

export async function revertAllClientAppointments(appointmentIds: string[]) {
    await connectToDatabase();
    const appointments = await AppointmentModel.find({ _id: { $in: appointmentIds } }).lean();

    const hasAuthorizedArcaVoucher = appointments.some(
        (appointment) => appointment.arcaInvoice?.status === 'authorized'
    );

    if (hasAuthorizedArcaVoucher) {
        throw new Error('No se puede revertir un grupo con comprobante ARCA autorizado.');
    }

    await updateClientAppointmentsStatus(appointmentIds, 'completed');
    revalidatePath('/admin/billing');
}

function sanitizeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Error desconocido al emitir comprobante ARCA.';
}

function hasBillingRole(role?: string): boolean {
    return role === 'Superadmin' || role === 'Gerente' || role === 'Recepcion';
}

function buildArcaDescription(customerName: string, appointments: Appointment[]): string {
    const servicesCount = appointments.reduce((total, appointment) => total + (appointment.assignments || []).length, 0);
    return `Servicios de peluqueria - ${customerName} - ${servicesCount} servicio(s)`;
}

function calculateTotalAmountCents(
    appointments: Appointment[],
    services: Service[],
    products: Product[]
): number {
    const servicePriceById = new Map(services.map((service) => [service.id, service.price]));
    const productPriceById = new Map(products.map((product) => [product.id, product.price]));

    const servicesCents = appointments.reduce((sum, appointment) => {
        return sum + (appointment.assignments || []).reduce((acc, assignment) => {
            return acc + (servicePriceById.get(assignment.serviceId) || 0);
        }, 0);
    }, 0);

    const productsCents = appointments.reduce((sum, appointment) => {
        return sum + (appointment.productIds || []).reduce((acc, productId) => {
            return acc + (productPriceById.get(productId) || 0);
        }, 0);
    }, 0);

    return servicesCents + productsCents;
}

export async function getArcaConfigurationStatus() {
    const user = await getCurrentUser();
    if (!user || !hasBillingRole(user.role)) {
        return { configured: false, allowed: false, environment: null as string | null, message: 'Sin permisos para facturar.' };
    }

    try {
        const configured = await isArcaConfigured();
        const runtime = configured ? await getArcaRuntimeConfig() : null;
        const environment = runtime?.production ? 'produccion' : 'homologacion';
        return {
            configured,
            allowed: true,
            environment,
            message: configured ? '' : 'Configuracion ARCA incompleta.',
        };
    } catch (error) {
        return {
            configured: false,
            allowed: true,
            environment: null as string | null,
            message: sanitizeErrorMessage(error),
        };
    }
}

export async function getArcaAdminSettings() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'Superadmin') {
        throw new Error('Solo Superadmin puede ver la configuracion ARCA.');
    }

    await connectToDatabase();
    const settings = await SettingsModel.findOne({}).lean();

    return {
        arcaCuit: settings?.arcaCuit ? String(settings.arcaCuit) : '',
        arcaProduction: Boolean(settings?.arcaProduction),
        arcaPtoVta: Number(settings?.arcaPtoVta || 1),
        arcaCbteTipo: Number(settings?.arcaCbteTipo || 11),
        arcaConcepto: Number(settings?.arcaConcepto || 2),
        arcaMoneda: settings?.arcaMoneda || 'PES',
        arcaDocTipoDefault: Number(settings?.arcaDocTipoDefault || 99),
        arcaDocNroDefault: Number(settings?.arcaDocNroDefault || 0),
        hasAccessToken: Boolean(settings?.arcaAccessTokenEncrypted),
        hasCertPem: Boolean(settings?.arcaCertPemEncrypted),
        hasKeyPem: Boolean(settings?.arcaKeyPemEncrypted),
        maskedAccessToken: maskSecret(settings?.arcaAccessTokenEncrypted ? 'guardado' : ''),
    };
}

type SaveArcaAdminSettingsInput = {
    arcaCuit: string;
    arcaProduction: boolean;
    arcaPtoVta: number;
    arcaCbteTipo: number;
    arcaConcepto: number;
    arcaMoneda: string;
    arcaDocTipoDefault: number;
    arcaDocNroDefault: number;
    accessToken?: string;
    certPem?: string;
    keyPem?: string;
    clearAccessToken?: boolean;
    clearCertPem?: boolean;
    clearKeyPem?: boolean;
};

export async function saveArcaAdminSettings(input: SaveArcaAdminSettingsInput) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'Superadmin') {
        throw new Error('Solo Superadmin puede guardar la configuracion ARCA.');
    }

    const cuit = Number((input.arcaCuit || '').replace(/\D/g, ''));
    if (!Number.isFinite(cuit) || String(cuit).length !== 11) {
        throw new Error('CUIT invalido. Debe tener 11 digitos.');
    }

    if (![1, 2, 3].includes(Number(input.arcaConcepto))) {
        throw new Error('Concepto invalido. Valores permitidos: 1, 2 o 3.');
    }

    const setPayload: Record<string, unknown> = {
        arcaCuit: cuit,
        arcaProduction: Boolean(input.arcaProduction),
        arcaPtoVta: Number(input.arcaPtoVta || 1),
        arcaCbteTipo: Number(input.arcaCbteTipo || 11),
        arcaConcepto: Number(input.arcaConcepto || 2),
        arcaMoneda: (input.arcaMoneda || 'PES').trim().toUpperCase(),
        arcaDocTipoDefault: Number(input.arcaDocTipoDefault || 99),
        arcaDocNroDefault: Number(input.arcaDocNroDefault || 0),
    };

    const accessToken = (input.accessToken || '').trim();
    const certPem = (input.certPem || '').trim();
    const keyPem = (input.keyPem || '').trim();

    if (accessToken) {
        setPayload.arcaAccessTokenEncrypted = encryptSecret(accessToken);
    }
    if (certPem) {
        setPayload.arcaCertPemEncrypted = encryptSecret(certPem);
    }
    if (keyPem) {
        setPayload.arcaKeyPemEncrypted = encryptSecret(keyPem);
    }

    const unsetPayload: Record<string, ''> = {};
    if (input.clearAccessToken) unsetPayload.arcaAccessTokenEncrypted = '';
    if (input.clearCertPem) unsetPayload.arcaCertPemEncrypted = '';
    if (input.clearKeyPem) unsetPayload.arcaKeyPemEncrypted = '';

    await connectToDatabase();
    await SettingsModel.findOneAndUpdate(
        {},
        {
            $set: setPayload,
            ...(Object.keys(unsetPayload).length > 0 ? { $unset: unsetPayload } : {}),
        },
        { upsert: true, new: true }
    ).lean();

    clearArcaConfigCache();
    revalidatePath('/admin/settings');
    revalidatePath('/admin/billing');

    return { success: true };
}

export async function testArcaConnection() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'Superadmin') {
        throw new Error('Solo Superadmin puede probar la conexion ARCA.');
    }

    try {
        const runtime = await getArcaRuntimeConfig();
        const afip = await createArcaClient();
        const serverStatus = await afip.ElectronicBilling.getServerStatus();

        return {
            ok: true,
            environment: runtime.production ? 'produccion' : 'homologacion',
            salesPoint: runtime.salesPoint,
            voucherType: runtime.voucherType,
            serverStatus,
            message: 'Conexion ARCA exitosa.',
        };
    } catch (error) {
        return {
            ok: false,
            message: sanitizeErrorMessage(error),
        };
    }
}

export async function issueArcaInvoiceForGroup(appointmentIds: string[]) {
    const user = await getCurrentUser();
    if (!user || !hasBillingRole(user.role)) {
        throw new Error('No tenes permisos para emitir comprobantes ARCA.');
    }

    await connectToDatabase();

    const docs = await AppointmentModel.find({ _id: { $in: appointmentIds } }).lean();
    const appointments = docs.map((doc) => ({
        ...doc,
        id: doc._id.toString(),
        _id: undefined,
    })) as unknown as Appointment[];

    if (appointments.length === 0) {
        throw new Error('No se encontraron turnos para facturar.');
    }

    const hasInvalidStatus = appointments.some(
        (appointment) => appointment.status !== 'completed' && appointment.status !== 'facturado'
    );
    if (hasInvalidStatus) {
        throw new Error('Solo se pueden facturar turnos completados.');
    }

    const alreadyAuthorized = appointments.find((appointment) => appointment.arcaInvoice?.status === 'authorized');
    if (alreadyAuthorized?.arcaInvoice) {
        return {
            success: true,
            alreadyIssued: true,
            invoice: alreadyAuthorized.arcaInvoice,
        };
    }

    const [services, products] = await Promise.all([getServices(), getProducts()]);
    const totalAmountCents = calculateTotalAmountCents(appointments, services, products);

    if (totalAmountCents <= 0) {
        throw new Error('No se pudo calcular un importe valido para facturar.');
    }

    const primaryAppointment = appointments[0];
    const client = await getClientByEmail(primaryAppointment.customerEmail);

    try {
        const arcaResponse = await issueInvoiceWithArca({
            totalAmount: totalAmountCents / 100,
            serviceDate: primaryAppointment.date,
            clientCuit: client?.cuit,
            clientDni: client?.dni,
            description: buildArcaDescription(primaryAppointment.customerName, appointments),
        });

        const invoiceRecord: ArcaInvoice = {
            status: 'authorized',
            environment: arcaResponse.environment,
            salesPoint: arcaResponse.salesPoint,
            voucherType: arcaResponse.voucherType,
            voucherNumber: arcaResponse.voucherNumber,
            cae: arcaResponse.cae,
            caeExpiration: arcaResponse.caeExpirationDate,
            issuedAt: new Date().toISOString(),
            currency: arcaResponse.currency,
            totalAmountCents,
            docType: arcaResponse.docType,
            docNumber: String(arcaResponse.docNumber),
            requestPayload: arcaResponse.requestPayload,
            responsePayload: arcaResponse.responsePayload,
        };

        await AppointmentModel.updateMany(
            { _id: { $in: appointmentIds } },
            {
                $set: {
                    status: 'facturado',
                    arcaInvoice: invoiceRecord,
                },
            }
        );

        revalidatePath('/admin/billing');

        return {
            success: true,
            alreadyIssued: false,
            invoice: invoiceRecord,
        };
    } catch (error) {
        const errorMessage = sanitizeErrorMessage(error);

        await AppointmentModel.updateMany(
            { _id: { $in: appointmentIds } },
            {
                $set: {
                    arcaInvoice: {
                        status: 'error',
                        environment: process.env.ARCA_PRODUCTION === 'true' ? 'produccion' : 'homologacion',
                        salesPoint: Number(process.env.ARCA_PTO_VTA || 1),
                        voucherType: Number(process.env.ARCA_CBTE_TIPO || 11),
                        currency: process.env.ARCA_MONEDA || 'PES',
                        totalAmountCents,
                        docType: Number(process.env.ARCA_DOC_TIPO_DEFAULT || 99),
                        docNumber: String(process.env.ARCA_DOC_NRO_DEFAULT || 0),
                        errorMessage,
                        issuedAt: new Date().toISOString(),
                    },
                },
            }
        );

        revalidatePath('/admin/billing');
        throw new Error(errorMessage);
    }
}

export async function moveAssignment(
    appointmentId: string,
    assignmentIdx: number,
    newTime: string,
    newEmployeeId: string
): Promise<void> {
    await connectToDatabase();
    const appt = await AppointmentModel.findById(appointmentId);
    if (!appt || !appt.assignments?.[assignmentIdx]) {
        throw new Error('Turno no encontrado');
    }
    appt.assignments[assignmentIdx].time = newTime;
    appt.assignments[assignmentIdx].employeeId = newEmployeeId;
    await appt.save();
    await clearDataReadCache();
    revalidatePath('/admin/agenda');
    revalidatePath('/admin/my-day');
    revalidatePath('/admin');
}


export async function createBackup() {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'Superadmin' && user.role !== 'Gerente')) {
        throw new Error('No tenes permisos para generar backup completo.');
    }

    await connectToDatabase();

    const [appointmentsRaw, clientsRaw, productsRaw, servicesRaw, usersRaw, settingsRaw] = await Promise.all([
        AppointmentModel.find({}).lean(),
        ClientModel.find({}).lean(),
        ProductModel.find({}).lean(),
        ServiceModel.find({}).lean(),
        UserModel.find({}).lean(),
        SettingsModel.find({}).lean(),
    ]);

    const stripMongoId = (doc: any) => {
        const { _id, ...rest } = doc;
        return rest;
    };

    return {
        meta: {
            app: 'alessi',
            format: 'alessi-backup-v2',
            generatedAt: new Date().toISOString(),
        },
        data: {
            appointments: appointmentsRaw.map(stripMongoId),
            clients: clientsRaw.map(stripMongoId),
            products: productsRaw.map(stripMongoId),
            services: servicesRaw.map(stripMongoId),
            users: usersRaw.map(stripMongoId),
            settings: settingsRaw.map(stripMongoId),
        },
    };
}

export async function restoreBackup(formData: FormData): Promise<{ success: boolean; message: string }> {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'Superadmin' && user.role !== 'Gerente')) {
        return { success: false, message: 'No tenes permisos para restaurar backup.' };
    }

    const file = formData.get('file') as File;
    if (!file) {
        return { success: false, message: 'No se selecciono archivo de backup.' };
    }

    let parsed: any;
    try {
        parsed = JSON.parse(await file.text());
    } catch {
        return { success: false, message: 'El archivo no es un JSON valido.' };
    }

    const payload = parsed?.data ? parsed.data : parsed;
    const appointments = Array.isArray(payload?.appointments) ? payload.appointments : null;
    const clients = Array.isArray(payload?.clients) ? payload.clients : null;
    const products = Array.isArray(payload?.products) ? payload.products : null;
    const services = Array.isArray(payload?.services) ? payload.services : null;
    const users = Array.isArray(payload?.users) ? payload.users : null;
    const settings = Array.isArray(payload?.settings) ? payload.settings : null;

    if (!appointments || !clients || !products || !services || !users || !settings) {
        return {
            success: false,
            message: 'Backup incompleto. Debe incluir appointments, clients, products, services, users y settings.',
        };
    }

    await connectToDatabase();

    try {
        await Promise.all([
            AppointmentModel.deleteMany({}),
            ClientModel.deleteMany({}),
            ProductModel.deleteMany({}),
            ServiceModel.deleteMany({}),
            UserModel.deleteMany({}),
            SettingsModel.deleteMany({}),
        ]);

        if (services.length) await ServiceModel.insertMany(services);
        if (products.length) await ProductModel.insertMany(products);
        if (clients.length) await ClientModel.insertMany(clients);
        if (users.length) await UserModel.insertMany(users);
        if (appointments.length) await AppointmentModel.insertMany(appointments);
        if (settings.length) await SettingsModel.insertMany(settings);

        revalidatePath('/admin');
        revalidatePath('/admin/agenda');
        revalidatePath('/admin/clients');
        revalidatePath('/admin/services');
        revalidatePath('/admin/products');
        revalidatePath('/admin/users');
        revalidatePath('/admin/settings');
        revalidatePath('/admin/billing');
        revalidatePath('/admin/backup');

        return {
            success: true,
            message: `Restauracion completa finalizada. ${appointments.length} turnos, ${clients.length} clientes, ${products.length} productos, ${services.length} servicios, ${users.length} usuarios y ${settings.length} settings.`,
        };
    } catch (error: any) {
        console.error('restoreBackup failed:', error);
        return {
            success: false,
            message: error?.message || 'No se pudo restaurar el backup completo.',
        };
    }
}


function convertToCSV(data: any[], headers: string[]): string {
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map(header => {
      // Ensure values are properly escaped for CSV
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
   // Add BOM for UTF-8
  return '\uFEFF' + csvRows.join('\n');
}

export async function exportClients(): Promise<string> {
    const clients = await getClients();
    const clientData = clients.map(c => ({
        name: c.name || '',
        address: c.address || '',
        alias: c.alias || '',
        location: c.location || '',
        postalCode: c.postalCode || '',
        landlinePhone: c.landlinePhone || '',
        mobilePhone: c.mobilePhone || '',
        email: c.email || '',
        dni: c.dni || '',
    }));

    const exportHeaders = ['Nombre', 'Domicilio', 'Alias', 'Localidad', 'Cod Postal', 'Telefono Fijo', 'Telefono Celular', 'Email', 'Dni'];
    
    const headerMap: { [key: string]: keyof (typeof clientData[0]) } = {
        'Nombre': 'name',
        'Domicilio': 'address',
        'Alias': 'alias',
        'Localidad': 'location',
        'Cod Postal': 'postalCode',
        'Telefono Fijo': 'landlinePhone',
        'Telefono Celular': 'mobilePhone',
        'Email': 'email',
        'Dni': 'dni',
    };

    const csvRows = [exportHeaders.join(',')];
    for (const row of clientData) {
        const values = exportHeaders.map(header => {
            const key = headerMap[header];
            const val = row[key] === null || row[key] === undefined ? '' : row[key];
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return '\uFEFF' + csvRows.join('\n');
}

export async function exportProducts(): Promise<string> {
    const products = await getProducts();
    const data = products.map(p => ({...p, price: p.price / 100}));
    return convertToCSV(data, ['id', 'name', 'price']);
}

export async function exportServices(): Promise<string> {
    const services = await getServices();
    const data = services.map(s => ({...s, price: s.price / 100}));
    return convertToCSV(data, ['id', 'name', 'duration', 'price']);
}

export async function exportAppointments(): Promise<string> {
    const appointments = await getAppointments();
    
    // Convert dates to Argentina time (UTC-3)
    const argentinaTimezoneOffset = -3 * 60; // in minutes
    
    const formattedAppointments = appointments.map(appt => {
        const localDate = toDate(new Date(appt.date));
        const utcDate = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000));
        const argentinaDate = new Date(utcDate.getTime() + (argentinaTimezoneOffset * 60000));

        return {
            ...appt,
            date: format(argentinaDate, "yyyy-MM-dd HH:mm:ss", { locale: es })
        }
    });

    return convertToCSV(formattedAppointments, ['id', 'customerName', 'customerEmail', 'date', 'status', 'employeeName']);
}

export async function importClientsFromJson(jsonString: string): Promise<{ 
    success: boolean; 
    message: string;
    createdCount?: number;
    updatedCount?: number;
}> {
    if (!jsonString) {
        return { success: false, message: 'El JSON no puede estar vacío.' };
    }

    try {
        // Clean up the JSON string
        let cleanedJson = jsonString.trim();
        // Remove trailing commas from the end of the array
        if (cleanedJson.endsWith(',')) {
            cleanedJson = cleanedJson.slice(0, -1);
        }
        
        let clientsToProcess: Partial<Client>[] = JSON.parse(cleanedJson);

        // Check if the first entry is the header and remove it
        if (clientsToProcess.length > 0) {
            const firstItem = clientsToProcess[0];
            if (
                firstItem.name === 'Nombre' &&
                firstItem.email === 'Email' &&
                firstItem.dni === 'Dni'
            ) {
                clientsToProcess.shift();
            }
        }
        
        if (!Array.isArray(clientsToProcess)) {
             return { success: false, message: 'El JSON debe ser un array de clientes.' };
        }

        if (!clientsToProcess.length) {
            return { success: false, message: 'El JSON está vacío o no contiene clientes válidos.' };
        }

        const { createdCount, updatedCount } = await batchCreateClients(clientsToProcess);
        
        revalidatePath('/admin/clients');
        
        return { 
            success: true, 
            message: `Importación completa. ${createdCount} clientes creados, ${updatedCount} clientes actualizados.`,
            createdCount,
            updatedCount
        };

    } catch (error: any) {
        console.error("Error importing clients from JSON:", error);
        return { success: false, message: `Error de sintaxis en el JSON: ${error.message}` };
    }
}

export async function importFromJson(formData: FormData): Promise<{ success: boolean; message: string; }> {
    const file = formData.get('file') as File;
    const type = formData.get('type') as 'clients' | 'services' | 'products' | 'users';
    
    if (!file) {
        return { success: false, message: 'No se ha subido ningún archivo.' };
    }
    
    const text = await file.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch(e) {
        return { success: false, message: 'El archivo no es un JSON válido.' };
    }
    
    let createdCount = 0;
    
    if (type === 'clients' && data.clients) {
        await deleteAllClients();
        const result = await batchCreateClients(data.clients);
        createdCount = result.createdCount;
    } else if (type === 'services' && data.services) {
        await deleteAllServices();
        const result = await batchCreateServices(data.services);
        createdCount = result.createdCount;
    } else if (type === 'products' && data.products) {
        await deleteAllProducts();
        const result = await batchCreateProducts(data.products);
        createdCount = result.createdCount;
    } else if (type === 'users' && data.users) {
        // NOTE: This does not delete existing users for safety.
        // It will only create new users if they don't exist based on email.
        for (const user of data.users) {
            try {
                await createUser(user);
                createdCount++;
            } catch (e) {
                // Ignore errors for existing users
            }
        }
    } else {
        return { success: false, message: `El JSON no contiene la clave esperada ('${type}').` };
    }
    
    revalidatePath(`/admin/${type}`);
    return { success: true, message: `Se importaron ${createdCount} registros de ${type}.` };
}


export async function importClientsFromCsv(formData: FormData): Promise<{ 
    success: boolean; 
    message: string;
    createdCount?: number;
    updatedCount?: number;
}> {
    const file = formData.get('file') as File;

    if (!file) {
        return { success: false, message: 'No se ha subido ningún archivo.' };
    }
    
    const text = await file.text();
    
    try {
        // Detectar el delimitador (coma o punto y coma)
        const firstLine = text.split('\n')[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';

        const result = Papa.parse(text, { 
            header: true, 
            skipEmptyLines: 'greedy',
            delimiter: delimiter,
            transformHeader: (header: string) => header.trim(),
        });

        const headerMap: { [key: string]: keyof Client } = {
            'Nombre': 'name',
            'Domicilio': 'address',
            'Alias': 'alias',
            'Localidad': 'location',
            'Cod Postal': 'postalCode',
            'Telefono Fijo': 'landlinePhone',
            'Telefono Celular': 'mobilePhone',
            'Email': 'email',
            'Dni': 'dni',
        };
        
        const clientsToProcess: Partial<Client>[] = (result.data as any[]).map(row => {
            const client: Partial<Client> = {};
            for (const key in row) {
                if (headerMap[key]) {
                    const mappedKey = headerMap[key];
                    (client as any)[mappedKey] = row[key];
                }
            }
            return client;
        }).filter(c => c.name);


        if (!clientsToProcess.length) {
            return { 
                success: false, 
                message: 'El archivo CSV está vacío o no tiene el formato correcto.' 
            };
        }

        const { createdCount, updatedCount } = await batchCreateClients(clientsToProcess);
        
        revalidatePath('/admin/clients');
        
        const message = `Importación completa. ${createdCount} clientes creados, ${updatedCount} clientes actualizados.`;
        
        return { 
            success: true, 
            message,
            createdCount,
            updatedCount
        };

    } catch (error: any) {
        console.error("Error importing clients from CSV:", error);
        return { 
            success: false, 
            message: `Error al procesar el archivo CSV: ${error.message}` 
        };
    }
}

export async function importData(formData: FormData): Promise<{ success: boolean, message: string }> {
  const file = formData.get('file') as File;
  const type = formData.get('type') as 'services' | 'products' | 'appointments';

  if (!file) {
    return { success: false, message: 'No se ha subido ningún archivo.' };
  }

  const text = await file.text();
  
  try {
    const result = Papa.parse(text, { header: true });
    let createdCount = 0;
    
    if (type === 'services') {
        const servicesToCreate = result.data.map((row: any) => ({
            code: row['code'] || '',
            name: row['name'] || '',
            duration: parseInt(row['duration'], 10) || 30,
            price: Math.round(parseFloat(row['price']) * 100) || 0,
        }));
        for(const service of servicesToCreate) {
            await createService(service);
            createdCount++;
        }
    } else if (type === 'products') {
        const productsToCreate = result.data.map((row: any) => ({
            code: row['code'] || '',
            name: row['name'] || '',
            price: Math.round(parseFloat(row['price']) * 100) || 0,
        }));
        for(const product of productsToCreate) {
            await createProduct(product);
            createdCount++;
        }
    } else if (type === 'appointments') {
        const appointmentsToCreate = (result.data as any[]).map((row: any) => {
            const date = new Date(row['date']);
            const assignments: AppointmentAssignment[] = (row['assignments'] || '')
                .split(';')
                .map((s: string) => {
                    const [serviceId, employeeId, time, duration] = s.split(':');
                    return { serviceId, employeeId, time, duration: parseInt(duration) };
                })
                .filter((a: any) => a.serviceId && a.employeeId);

            return {
                customerName: row['customerName'],
                customerEmail: row['customerEmail'],
                date: date.toISOString(),
                serviceNames: [] as string[],
                assignments: assignments,
            }
        });
        await batchCreateAppointmentsData(appointmentsToCreate as Omit<Appointment, 'id' | 'status'>[]);
        createdCount = appointmentsToCreate.length;
    }
    
    revalidatePath(`/admin/${type}`);
    return { success: true, message: `Se importaron ${createdCount} registros.` };

  } catch (error: any) {
    console.error(`Error importing ${type}:`, error);
    return { success: false, message: `Error al importar: ${error.message}` };
  }
}

export async function batchCreateAppointments(appointments: Omit<Appointment, 'id' | 'status'>[]): Promise<{ createdCount: number; createdAppointments: Appointment[] }> {
    const result = await batchCreateAppointmentsData(appointments);
    revalidatePath('/admin/agenda');
    return result;
}
