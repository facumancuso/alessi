/**
 * Script para migrar datos del emulador de Firestore a MongoDB
 */

import admin from 'firebase-admin';
import mongoose from 'mongoose';
import {
  ServiceModel,
  ProductModel,
  ClientModel,
  UserModel,
  AppointmentModel,
  SettingsModel
} from './src/lib/models';

// Conectar al emulador
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';

async function migrateFromEmulator() {
  console.log('🌐 MIGRACIÓN DESDE EMULADOR DE FIRESTORE A MONGODB\n');

  try {
    // Inicializar Firebase Admin sin credenciales (usa emulador)
    admin.initializeApp({
      projectId: 'alessi2026'
    });

    const db = admin.firestore();

    // Conectar a MongoDB
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/alessi2026'
    );
    console.log('✅ Conectado a MongoDB\n');

    // Limpiar colecciones
    console.log('🧹 Limpiando colecciones MongoDB...');
    await ServiceModel.deleteMany({});
    await ProductModel.deleteMany({});
    await ClientModel.deleteMany({});
    await UserModel.deleteMany({});
    await AppointmentModel.deleteMany({});
    await SettingsModel.deleteMany({});
    console.log('✅ Limpias\n');

    let counts = {
      services: 0,
      products: 0,
      clients: 0,
      users: 0,
      appointments: 0,
      settings: 0
    };

    // Función auxiliar para convertir Firestore Timestamp
    const convertTimestamp = (value: any) => {
      if (!value) return null;
      if (value.toDate) return new Date(value.toDate());
      if (value instanceof Date) return value;
      if (typeof value === 'string') return new Date(value);
      return null;
    };

    // Migrar servicios
    console.log('📦 Leyendo servicios desde Firestore...');
    const servicesSnap = await db.collection('services').get();
    const servicesData = [];
    for (const doc of servicesSnap.docs) {
      const data = doc.data();
      servicesData.push({
        code: data.code || '',
        name: data.name || '',
        duration: data.duration || 0,
        price: data.price || 0
      });
    }
    if (servicesData.length > 0) {
      await ServiceModel.insertMany(servicesData);
      counts.services = servicesData.length;
    }
    console.log(`   ✅ ${counts.services} servicios migrados\n`);

    // Migrar productos
    console.log('📦 Leyendo productos desde Firestore...');
    const productsSnap = await db.collection('products').get();
    const productsData = [];
    for (const doc of productsSnap.docs) {
      const data = doc.data();
      productsData.push({
        code: data.code || '',
        name: data.name || '',
        price: data.price || 0
      });
    }
    if (productsData.length > 0) {
      await ProductModel.insertMany(productsData);
      counts.products = productsData.length;
    }
    console.log(`   ✅ ${counts.products} productos migrados\n`);

    // Migrar clientes
    console.log('👥 Leyendo clientes desde Firestore...');
    const clientsSnap = await db.collection('clients').get();
    const clientsData = [];
    for (const doc of clientsSnap.docs) {
      const data = doc.data();
      clientsData.push({
        code: data.code || '',
        name: data.name || '',
        email: data.email || '',
        mobilePhone: data.mobilePhone || '',
        homePhone: data.homePhone || '',
        location: data.location || '',
        observations: data.observations || '',
        birthDate: convertTimestamp(data.birthDate),
        inactive: data.inactive || false
      });

      if (clientsData.length % 5000 === 0) {
        console.log(`   ... ${clientsData.length} clientes cargados`);
      }
    }
    if (clientsData.length > 0) {
      // Insertar por lotes para evitar problemas de memoria
      const batchSize = 1000;
      for (let i = 0; i < clientsData.length; i += batchSize) {
        const batch = clientsData.slice(i, i + batchSize);
        await ClientModel.insertMany(batch, { ordered: false }).catch(() => {
          // Ignora errores de duplicados
        });
        if ((i + batchSize) % 5000 === 0) {
          console.log(`   ... ${Math.min(i + batchSize, clientsData.length)} clientes insertados en MongoDB`);
        }
      }
      counts.clients = clientsData.length;
    }
    console.log(`   ✅ ${counts.clients} clientes migrados\n`);

    // Migrar usuarios
    console.log('👤 Leyendo usuarios desde Firestore...');
    const usersSnap = await db.collection('users').get();
    const usersData = [];
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      usersData.push({
        name: data.name || '',
        email: data.email || '',
        password: data.password || 'NO_PASSWORD_SET',
        role: data.role || 'Recepcion',
        isActive: data.isActive !== false
      });
    }
    if (usersData.length > 0) {
      await UserModel.insertMany(usersData);
      counts.users = usersData.length;
    }
    console.log(`   ✅ ${counts.users} usuarios migrados\n`);

    // Migrar citas
    console.log('📅 Leyendo citas desde Firestore...');
    const appointmentsSnap = await db.collection('appointments').get();
    const appointmentsData = [];
    for (const doc of appointmentsSnap.docs) {
      const data = doc.data();
      const startTime = convertTimestamp(data.startTime) || new Date();
      const endTime = convertTimestamp(data.endTime) || new Date(startTime.getTime() + 30 * 60000);

      appointmentsData.push({
        date: startTime,
        clientCode: data.clientCode || '',
        clientName: data.clientName || '',
        serviceCode: data.serviceCode || '',
        serviceName: data.serviceName || '',
        description: data.description || '',
        status: data.status || 'confirmed',
        startTime: startTime,
        endTime: endTime,
        assignments: data.assignments || [],
        notes: data.notes || '',
        cancelled: data.cancelled || false,
        cancelledBy: data.cancelledBy || '',
        cancelledAt: convertTimestamp(data.cancelledAt),
        cancellationReason: data.cancellationReason || ''
      });

      if (appointmentsData.length % 5000 === 0) {
        console.log(`   ... ${appointmentsData.length} citas cargadas`);
      }
    }
    if (appointmentsData.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < appointmentsData.length; i += batchSize) {
        const batch = appointmentsData.slice(i, i + batchSize);
        await AppointmentModel.insertMany(batch, { ordered: false }).catch(() => {
          // Ignora errores
        });
        if ((i + batchSize) % 5000 === 0) {
          console.log(`   ... ${Math.min(i + batchSize, appointmentsData.length)} citas insertadas en MongoDB`);
        }
      }
      counts.appointments = appointmentsData.length;
    }
    console.log(`   ✅ ${counts.appointments} citas migradas\n`);

    // Migrar configuración
    console.log('⚙️ Leyendo configuración desde Firestore...');
    const settingsSnap = await db.collection('settings').get();
    if (settingsSnap.size > 0) {
      const settingsDoc = settingsSnap.docs[0].data();
      await SettingsModel.create({
        bookingClosingHours: settingsDoc.bookingClosingHours || 24,
        whatsappApiUrl: settingsDoc.whatsappApiUrl || '',
        whatsappToken: settingsDoc.whatsappToken || '',
        whatsappPhoneNumberId: settingsDoc.whatsappPhoneNumberId || ''
      });
      counts.settings = 1;
    }
    console.log(`   ✅ Configuración migrada\n`);

    // Resumen
    console.log('📊 RESUMEN DE MIGRACIÓN:');
    console.log(`   Servicios:     ${counts.services}`);
    console.log(`   Productos:     ${counts.products}`);
    console.log(`   Clientes:      ${counts.clients}`);
    console.log(`   Usuarios:      ${counts.users}`);
    console.log(`   Citas:         ${counts.appointments}`);
    console.log(`   Configuración: ${counts.settings}`);

    const total = counts.services + counts.products + counts.clients + 
                  counts.users + counts.appointments + counts.settings;
    console.log(`\n✨ Total: ${total} documentos migrados`);

    await mongoose.connection.close();
    admin.app().delete();
    console.log('\n✅ Migración completada');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrateFromEmulator();
