

'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Papa from 'papaparse';
import { 
    createAppointment as createAppointmentData, 
    getServiceById, 
    getSettings, 
    cancelAppointment as cancelAppointmentData, 
    updateAppointment as updateAppointmentData,
    deleteAppointment as deleteAppointmentData,
    getAppointments,
    getClients,
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
import { createUser } from './auth-actions';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { revalidatePath } from 'next/cache';
import type { Appointment, AppointmentAssignment, Client, Product, Service, User } from './types';
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';

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

export async function createAppointment(data: Partial<Omit<Appointment, 'id' | 'status'>>): Promise<Appointment> {
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

export async function startAppointment(id: string) {
    return updateAppointmentStatus(id, 'waiting');
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

export async function billAllClientAppointments(appointmentIds: string[]) {
    await updateClientAppointmentsStatus(appointmentIds, 'facturado');
    revalidatePath('/admin/billing');
}

export async function revertAllClientAppointments(appointmentIds: string[]) {
    await updateClientAppointmentsStatus(appointmentIds, 'completed');
    revalidatePath('/admin/billing');
}


export async function createBackup() {
    const [
        appointments,
        clients,
        products,
        services,
        users
    ] = await Promise.all([
        getAppointments(),
        getClients(),
        getProducts(),
        getServices(),
        getUsers()
    ]);
    return {
        appointments,
        clients,
        products,
        services,
        users
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
