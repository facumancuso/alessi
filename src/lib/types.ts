

export interface Service {
    id: string;
    code: string;
    name: string;
    duration: number;
    price: number;
}

export interface Product {
    id: string;
    code: string;
    name: string;
    price: number;
}

export interface AppointmentAssignment {
    employeeId: string;
    serviceId: string;
    time: string;
    duration: number;
}

export interface Appointment {
    id: string;
    assignments: AppointmentAssignment[];
    serviceNames: string[]; // Kept for display purposes, will be dynamically generated
    productIds?: string[];
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    date: string; // Changed from Date to string to pass safely from server to client
    duration?: number; // Now represents total duration, might be calculated
    status: 'confirmed' | 'cancelled' | 'completed' | 'waiting' | 'no-show' | 'facturado';
    notes?: string;
    // Deprecated fields, will be removed in the future
    employeeId?: string;
    employeeName?: string;
    serviceIds?: string[];
}


export interface Client {
    id: string;
    code: string; // Codigo
    name: string; // Nombre
    email: string; // Email
    mobilePhone?: string; // Telefono Celular
    address?: string; // Domicilio
    alias?: string; // Alias
    location?: string; // Localidad
    postalCode?: string; // Cod Postal
    landlinePhone?: string; // Telefono Fijo
    dni?: string; // Dni
    cuit?: string; // CUIT
    priceList?: string; // Lista De Precio
    fantasyName?: string; // Fantasia
    salespersonId?: string; // Vendedor
    salespersonName?: string; // Nom Vendedor
    clientCategory?: string; // Categoria Cliente
    inactive?: boolean; // Inactivo
    // Campos que calculamos dinámicamente
    totalAppointments?: number;
    lastVisit?: string; // Changed from Date to string
}


export interface User {
    id: string;
    name: string;
    email: string;
    role: 'Superadmin' | 'Gerente' | 'Recepcion' | 'Peluquero';
    password?: string; // This should only be used for creation/update, not stored long-term in state
    isActive: boolean;
}
