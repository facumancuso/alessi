import mongoose, { Schema, Model, models } from 'mongoose';
import type { Service, Product, Client, User, Appointment, AppointmentAssignment } from './types';

// ========= SERVICE MODEL =========
const serviceSchema = new Schema<Service>({
  code: { type: String, required: true },
  name: { type: String, required: true },
  duration: { type: Number, required: true },
  price: { type: Number, required: true },
}, { timestamps: true });

export const ServiceModel = (models.Service as Model<Service>) || mongoose.model<Service>('Service', serviceSchema);

// ========= PRODUCT MODEL =========
const productSchema = new Schema<Product>({
  code: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
}, { timestamps: true });

export const ProductModel = (models.Product as Model<Product>) || mongoose.model<Product>('Product', productSchema);

// ========= CLIENT MODEL =========
const clientSchema = new Schema<Client>({
  code: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobilePhone: { type: String },
  address: { type: String },
  alias: { type: String },
  location: { type: String },
  postalCode: { type: String },
  landlinePhone: { type: String },
  dni: { type: String },
  cuit: { type: String },
  priceList: { type: String },
  fantasyName: { type: String },
  salespersonId: { type: String },
  salespersonName: { type: String },
  clientCategory: { type: String },
  inactive: { type: Boolean, default: false },
  totalAppointments: { type: Number, default: 0 },
  lastVisit: { type: String },
}, { timestamps: true });

export const ClientModel = (models.Client as Model<Client>) || mongoose.model<Client>('Client', clientSchema);

// ========= USER MODEL =========
const userSchema = new Schema<User & { password: string }>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    required: true, 
    enum: ['Superadmin', 'Gerente', 'Recepcion', 'Peluquero'] 
  },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const UserModel = (models.User as Model<User & { password: string }>) || mongoose.model<User & { password: string }>('User', userSchema);

// ========= APPOINTMENT MODEL =========
const appointmentAssignmentSchema = new Schema<AppointmentAssignment>({
  employeeId: { type: String, required: true },
  serviceId: { type: String, required: true },
  time: { type: String, required: true },
  duration: { type: Number, required: true },
  productIds: [{ type: String }],
}, { _id: false });

const appointmentSchema = new Schema<Appointment>({
  assignments: [appointmentAssignmentSchema],
  serviceNames: [{ type: String }],
  productIds: [{ type: String }],
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String },
  date: { type: String, required: true },
  duration: { type: Number },
  status: { 
    type: String, 
    required: true, 
    enum: ['confirmed', 'cancelled', 'completed', 'waiting', 'no-show', 'facturado'],
    default: 'confirmed'
  },
  notes: { type: String },
  // Deprecated fields
  employeeId: { type: String },
  employeeName: { type: String },
  serviceIds: [{ type: String }],
}, { timestamps: true });

export const AppointmentModel = (models.Appointment as Model<Appointment>) || mongoose.model<Appointment>('Appointment', appointmentSchema);

// ========= SETTINGS MODEL (for application settings) =========
interface Settings {
  _id?: string;
  bookingClosingHours: number;
  whatsappApiUrl?: string;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
}

const settingsSchema = new Schema<Settings>({
  bookingClosingHours: { type: Number, default: 24 },
  whatsappApiUrl: { type: String },
  whatsappToken: { type: String },
  whatsappPhoneNumberId: { type: String },
}, { timestamps: true });

export const SettingsModel = (models.Settings as Model<Settings>) || mongoose.model<Settings>('Settings', settingsSchema);
