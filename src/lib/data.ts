'use server';

import { connectToDatabase } from './mongodb';
import { ServiceModel, ProductModel, ClientModel, UserModel, AppointmentModel, SettingsModel } from './models';
import type { Service, Appointment, Product, Client, User } from './types';

function normalizeAppointmentDate(dateValue: unknown): string {
  if (typeof dateValue === 'string') return dateValue;
  if (dateValue instanceof Date) return dateValue.toISOString();
  if (dateValue && typeof (dateValue as any).toString === 'function') {
    const parsed = new Date((dateValue as any).toString());
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

// ========= SERVICE FUNCTIONS =========
export async function getServices(): Promise<Service[]> {
  await connectToDatabase();
  const services = await ServiceModel.find({}).lean();
  return services.map(s => ({ ...s, id: s._id.toString(), _id: undefined } as unknown as Service));
}

export async function getServiceById(id: string): Promise<Service | null> {
  await connectToDatabase();
  const service = await ServiceModel.findById(id).lean();
  if (!service) return null;
  return { ...service, id: service._id.toString(), _id: undefined } as unknown as Service;
}

export async function createService(service: Omit<Service, 'id'>): Promise<Service> {
  await connectToDatabase();
  const newService = await ServiceModel.create(service);
  return { ...newService.toObject(), id: newService._id.toString(), _id: undefined } as unknown as Service;
}

export async function updateService(id: string, serviceUpdate: Partial<Omit<Service, 'id'>>): Promise<Service | null> {
  await connectToDatabase();
  const updated = await ServiceModel.findByIdAndUpdate(id, serviceUpdate, { new: true }).lean();
  if (!updated) return null;
  return { ...updated, id: updated._id.toString(), _id: undefined } as unknown as Service;
}

export async function deleteService(id: string): Promise<boolean> {
  await connectToDatabase();
  await ServiceModel.findByIdAndDelete(id);
  return true;
}

export async function deleteAllServices(): Promise<{ deletedCount: number }> {
  await connectToDatabase();
  const result = await ServiceModel.deleteMany({});
  return { deletedCount: result.deletedCount || 0 };
}

export async function batchCreateServices(services: Partial<Service>[]): Promise<{ createdCount: number }> {
  await connectToDatabase();
  const newServices = services.map(s => ({
    code: s.code || '',
    name: s.name || 'Servicio sin nombre',
    duration: Number(s.duration) || 30,
    price: Math.round(Number(s.price || 0))
  }));
  const result = await ServiceModel.insertMany(newServices);
  return { createdCount: result.length };
}

// ========= PRODUCT FUNCTIONS =========
export async function getProducts(): Promise<Product[]> {
  await connectToDatabase();
  const products = await ProductModel.find({}).lean();
  return products.map(p => ({ ...p, id: p._id.toString(), _id: undefined } as unknown as Product));
}

export async function getProductById(id: string): Promise<Product | null> {
  await connectToDatabase();
  const product = await ProductModel.findById(id).lean();
  if (!product) return null;
  return { ...product, id: product._id.toString(), _id: undefined } as unknown as Product;
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  await connectToDatabase();
  const newProduct = await ProductModel.create(product);
  return { ...newProduct.toObject(), id: newProduct._id.toString(), _id: undefined } as unknown as Product;
}

export async function updateProduct(id: string, productUpdate: Partial<Omit<Product, 'id'>>): Promise<Product | null> {
  await connectToDatabase();
  const updated = await ProductModel.findByIdAndUpdate(id, productUpdate, { new: true }).lean();
  if (!updated) return null;
  return { ...updated, id: updated._id.toString(), _id: undefined } as unknown as Product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  await connectToDatabase();
  await ProductModel.findByIdAndDelete(id);
  return true;
}

export async function deleteAllProducts(): Promise<{ deletedCount: number }> {
  await connectToDatabase();
  const result = await ProductModel.deleteMany({});
  return { deletedCount: result.deletedCount || 0 };
}

export async function batchCreateProducts(products: Partial<Product>[]): Promise<{ createdCount: number }> {
  await connectToDatabase();
  const newProducts = products.map(p => ({
    code: p.code || '',
    name: p.name || 'Producto sin nombre',
    price: Math.round(Number(p.price || 0))
  }));
  const result = await ProductModel.insertMany(newProducts);
  return { createdCount: result.length };
}

// ========= APPOINTMENT FUNCTIONS =========
export async function getAppointments(status?: Appointment['status']): Promise<Appointment[]> {
  try {
    await connectToDatabase();
    const filter = status ? { status } : {};
    const appointments = await AppointmentModel.find(filter).lean();

    const allServices = await getServices();
    const servicesMap = new Map(allServices.map(s => [s.id, s.name]));

    const allUsers = await getUsers();
    const usersMap = new Map(allUsers.map(u => [u.id, u.name]));

    return appointments.map(appt => {
      try {
        const serviceIds = (appt.assignments || []).map(a => a.serviceId);
        const employeeIds = [...new Set((appt.assignments || []).map(a => a.employeeId))];

        const normalizedDate = normalizeAppointmentDate(appt.date);
        let finalDateStr = normalizedDate;
        if (normalizedDate && appt.assignments && appt.assignments.length > 0 && appt.assignments[0].time) {
          const datePart = normalizedDate.substring(0, 10);
          finalDateStr = `${datePart}T${appt.assignments[0].time}:00`;
        }

        return {
          ...appt,
          id: appt._id!.toString(),
          _id: undefined,
          date: finalDateStr,
          serviceIds: serviceIds,
          serviceNames: serviceIds.map(id => servicesMap.get(id) || 'Servicio Desconocido'),
          employeeId: employeeIds[0] || appt.employeeId || '',
          employeeName: employeeIds.map(id => usersMap.get(id) || 'Empleado desc.').join(', ')
        } as unknown as Appointment;
      } catch (mapError) {
        console.error('Error mapping appointment:', mapError, appt);
        throw mapError;
      }
    });
  } catch (error) {
    console.error('Error in getAppointments:', error);
    throw error;
  }
}

export async function getAppointmentById(id: string): Promise<Appointment | undefined> {
  await connectToDatabase();
  const appointment = await AppointmentModel.findById(id).lean();
  if (!appointment) return undefined;

  const allServices = await getServices();
  const servicesMap = new Map(allServices.map(s => [s.id, s.name]));
  const serviceIds = (appointment.assignments || []).map(a => a.serviceId);

  return {
    ...appointment,
    id: appointment._id!.toString(),
    _id: undefined,
    serviceNames: serviceIds.map(id => servicesMap.get(id) || 'Servicio Desconocido')
  } as unknown as Appointment;
}

export async function createAppointment(data: Partial<Omit<Appointment, 'id' | 'status'>>): Promise<Appointment> {
  await connectToDatabase();

  const newAppointmentData = {
    ...data,
    status: 'confirmed' as const,
  };

  const newAppointment = await AppointmentModel.create(newAppointmentData);

  // Create or update client
  await createClient({ name: data.customerName, email: data.customerEmail, mobilePhone: data.customerPhone });

  return { ...newAppointment.toObject(), id: newAppointment._id.toString(), _id: undefined } as unknown as Appointment;
}

export async function updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | undefined> {
  await connectToDatabase();
  
  const updateData = { ...data };
  if (!updateData.status) {
    updateData.status = 'confirmed';
  }

  const updated = await AppointmentModel.findByIdAndUpdate(id, updateData, { new: true, upsert: true }).lean();
  if (!updated) return undefined;

  return { ...updated, id: updated._id!.toString(), _id: undefined } as unknown as Appointment;
}

export async function cancelAppointment(id: string): Promise<Appointment | undefined> {
  await connectToDatabase();
  const updated = await AppointmentModel.findByIdAndUpdate(id, { status: 'cancelled' }, { new: true }).lean();
  if (!updated) return undefined;
  return { ...updated, id: updated._id!.toString(), _id: undefined } as unknown as Appointment;
}

export async function deleteAppointment(id: string): Promise<boolean> {
  await connectToDatabase();
  await AppointmentModel.findByIdAndDelete(id);
  return true;
}

export async function batchCreateAppointmentsData(
  appointments: Omit<Appointment, 'id' | 'status'>[]
): Promise<{ createdCount: number; createdAppointments: Appointment[] }> {
  await connectToDatabase();

  // Create clients first
  for (const appt of appointments) {
    if (appt.customerName) {
      await createClient({ name: appt.customerName, email: appt.customerEmail });
    }
  }

  const newAppointments = appointments.map(appt => ({
    ...appt,
    status: 'confirmed' as const,
  }));

  const result = await AppointmentModel.insertMany(newAppointments);

  const createdAppointments = result.map(doc => ({
    ...doc.toObject(),
    id: doc._id.toString(),
    _id: undefined
  } as unknown as Appointment));

  return {
    createdCount: result.length,
    createdAppointments
  };
}

export async function updateClientAppointmentsStatus(appointmentIds: string[], status: Appointment['status']) {
  await connectToDatabase();
  await AppointmentModel.updateMany(
    { _id: { $in: appointmentIds } },
    { $set: { status } }
  );
}

// ========= CLIENT FUNCTIONS =========
export async function getClients(): Promise<Client[]> {
  await connectToDatabase();
  const clients = await ClientModel.find({}).lean();
  return clients.map(c => ({ ...c, id: c._id.toString(), _id: undefined } as unknown as Client));
}

export async function getClientByEmail(email: string): Promise<Client | undefined> {
  await connectToDatabase();
  const client = await ClientModel.findOne({ email }).lean();
  if (!client) return undefined;
  return { ...client, id: client._id.toString(), _id: undefined } as unknown as Client;
}

export async function createClient(clientData: Partial<Omit<Client, 'id'>>): Promise<Client> {
  await connectToDatabase();

  if (clientData.email) {
    const existing = await ClientModel.findOne({ email: clientData.email }).lean();
    if (existing) {
      // Update existing client
      const updated = await ClientModel.findByIdAndUpdate(
        existing._id,
        clientData,
        { new: true, runValidators: false }
      ).lean();
      return { ...updated!, id: updated!._id.toString(), _id: undefined } as unknown as Client;
    }
  }

  // Generate code if not provided
  if (!clientData.code) {
    const allClients = await getClients();
    const maxCode = allClients.reduce((max, client) => {
      const clientCode = parseInt(client.code, 10);
      return isNaN(clientCode) ? max : Math.max(max, clientCode);
    }, 0);
    clientData.code = (maxCode + 1).toString().padStart(4, '0');
  }

  // If no email is provided, create a temporary unique one
  if (!clientData.email) {
    clientData.email = `new_client_${Date.now()}@placeholder.com`;
  }

  const newClient = await ClientModel.create(clientData);
  return { ...newClient.toObject(), id: newClient._id.toString(), _id: undefined } as unknown as Client;
}

export async function batchCreateClients(clients: Partial<Client>[]): Promise<{ createdCount: number; updatedCount: number }> {
  await connectToDatabase();
  let createdCount = 0;
  let updatedCount = 0;

  const allClients = await getClients();
  const existingClientsMap = new Map(
    allClients.filter(c => c.email).map(c => [c.email!.toLowerCase().trim(), c])
  );

  let maxCode = allClients.reduce((max, client) => {
    const clientCode = parseInt(client.code, 10);
    return isNaN(clientCode) ? max : Math.max(max, clientCode);
  }, 0);

  const processedEmailsInImport = new Set<string>();

  for (const clientData of clients) {
    let email = (clientData.email || '').trim().toLowerCase();

    if (!email || processedEmailsInImport.has(email)) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      email = `${(clientData.name || 'cliente').replace(/\s/g, '_')}.${timestamp}.${random}@import.local`.toLowerCase();
    }
    processedEmailsInImport.add(email);

    const existingClient = existingClientsMap.get(email);
    if (existingClient) {
      await ClientModel.findByIdAndUpdate(existingClient.id, { ...clientData, email });
      updatedCount++;
    } else {
      maxCode++;
      const newClientData = {
        ...clientData,
        email,
        code: clientData.code || maxCode.toString().padStart(4, '0'),
      };
      await ClientModel.create(newClientData);
      createdCount++;
    }
  }

  return { createdCount, updatedCount };
}

export async function updateClient(id: string, clientUpdate: Partial<Client>): Promise<Client | undefined> {
  await connectToDatabase();
  const updated = await ClientModel.findByIdAndUpdate(id, clientUpdate, { new: true }).lean();
  if (!updated) return undefined;
  return { ...updated, id: updated._id.toString(), _id: undefined } as unknown as Client;
}

export async function deleteClientFromDB(id: string): Promise<boolean> {
  await connectToDatabase();
  await ClientModel.findByIdAndDelete(id);
  return true;
}

export async function deleteAllClients(): Promise<{ deletedCount: number }> {
  await connectToDatabase();
  const result = await ClientModel.deleteMany({});
  return { deletedCount: result.deletedCount || 0 };
}

export async function getAppointmentsByClient(email: string): Promise<Appointment[]> {
  try {
    await connectToDatabase();
    const appointments = await AppointmentModel.find({ customerEmail: email }).lean();

    const [allServices, allUsers] = await Promise.all([getServices(), getUsers()]);
    const servicesMap = new Map(allServices.map(s => [s.id, s.name]));
    const usersMap = new Map(allUsers.map(u => [u.id, u.name]));

    const sorted = appointments.map(appt => {
      try {
        const firstAssignment = appt.assignments && appt.assignments.length > 0 ? appt.assignments[0] : null;

        const normalizedDate = normalizeAppointmentDate(appt.date);
        let finalDateStr = normalizedDate;
        if (normalizedDate && firstAssignment?.time) {
          const datePart = normalizedDate.substring(0, 10);
          finalDateStr = `${datePart}T${firstAssignment.time}:00`;
        }

        return {
          ...appt,
          id: appt._id!.toString(),
          _id: undefined,
          date: finalDateStr,
          serviceNames: (appt.assignments || []).map(a => servicesMap.get(a.serviceId) || 'Servicio Desconocido'),
          employeeName: firstAssignment ? (usersMap.get(firstAssignment.employeeId) || 'Empleado desc.') : (appt.employeeName || '')
        } as unknown as Appointment;
      } catch (mapError) {
        console.error('Error mapping client appointment:', mapError, appt);
        throw mapError;
      }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return sorted;
  } catch (error) {
    console.error('Error in getAppointmentsByClient:', error);
    throw error;
  }
}

// ========= USER FUNCTIONS =========
export async function getUsers(): Promise<User[]> {
  await connectToDatabase();
  const users = await UserModel.find({}).select('-password').lean();
  return users.map(u => ({ ...u, id: u._id.toString(), _id: undefined } as unknown as User));
}

export async function getActiveUsers(): Promise<User[]> {
  await connectToDatabase();
  const users = await UserModel.find({ isActive: true }).select('-password').lean();
  return users.map(u => ({ ...u, id: u._id.toString(), _id: undefined } as unknown as User));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  await connectToDatabase();
  const user = await UserModel.findOne({ email }).select('-password').lean();
  if (!user) return null;
  return { ...user, id: user._id.toString(), _id: undefined } as unknown as User;
}

// ========= SETTINGS FUNCTIONS =========
export async function getSettings() {
  await connectToDatabase();
  let settings = await SettingsModel.findOne({}).lean();
  if (!settings) {
    // Create default settings
    const newSettings = await SettingsModel.create({ bookingClosingHours: 24 });
    return { ...newSettings.toObject(), spamProtection: true };
  }
  return { ...settings, spamProtection: true };
}

export async function updateSettings(newSettings: any) {
  await connectToDatabase();
  const updated = await SettingsModel.findOneAndUpdate({}, newSettings, { new: true, upsert: true }).lean();
  return updated;
}
