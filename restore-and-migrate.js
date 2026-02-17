/**
 * Script para restaurar datos desde backup de Firebase usando el emulador
 * y luego migrarlos a MongoDB
 */

const admin = require('firebase-admin');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Conectar al emulador de Firestore (si está corriendo)
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const serviceAccount = require('./firebase_key.json');

async function restoreAndMigrate() {
  console.log('🔄 Iniciando restauración de datos desde backup...\n');

  try {
    // Inicializar Firebase Admin
    console.log('🔌 Inicializando Firebase Admin...');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'alessi2026'
    });

    const db = admin.firestore();
    console.log('✅ Firebase conectado\n');

    // Conectar a MongoDB
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/alessi2026');
    console.log('✅ MongoDB conectado\n');

    // Obtener modelos
    const { 
      ServiceModel, ProductModel, ClientModel, 
      UserModel, AppointmentModel, SettingsModel 
    } = require('./src/lib/models');

    console.log('📥 Leyendo datos desde Firestore...\n');

    // Limpiar colecciones
    await ServiceModel.deleteMany({});
    await ProductModel.deleteMany({});
    await ClientModel.deleteMany({});
    await UserModel.deleteMany({});
    await AppointmentModel.deleteMany({});
    await SettingsModel.deleteMany({});

    let counts = {
      services: 0,
      products: 0,
      clients: 0,
      users: 0,
      appointments: 0,
      settings: 0
    };

    // Migrar servicios
    console.log('📦 Migrando servicios...');
    const servicesSnapshot = await db.collection('services').get();
    for (const doc of servicesSnapshot.docs) {
      const data = doc.data();
      await ServiceModel.create({
        code: data.code || '',
        name: data.name || '',
        duration: data.duration || 0,
        price: data.price || 0
      });
      counts.services++;
    }
    console.log(`   ✅ ${counts.services} servicios migrados\n`);

    // Migrar productos
    console.log('📦 Migrando productos...');
    const productsSnapshot = await db.collection('products').get();
    for (const doc of productsSnapshot.docs) {
      const data = doc.data();
      await ProductModel.create({
        code: data.code || '',
        name: data.name || '',
        price: data.price || 0
      });
      counts.products++;
    }
    console.log(`   ✅ ${counts.products} productos migrados\n`);

    // Migrar clientes
    console.log('👥 Migrando clientes...');
    const clientsSnapshot = await db.collection('clients').get();
    for (const doc of clientsSnapshot.docs) {
      const data = doc.data();
      try {
        await ClientModel.create({
          code: data.code || '',
          name: data.name || '',
          email: data.email || '',
          mobilePhone: data.mobilePhone || '',
          homePhone: data.homePhone || '',
          location: data.location || '',
          observations: data.observations || '',
          birthDate: data.birthDate ? new Date(data.birthDate.toDate ? data.birthDate.toDate() : data.birthDate) : null,
          inactive: data.inactive || false
        });
        counts.clients++;
        if (counts.clients % 1000 === 0) {
          console.log(`   ... ${counts.clients} clientes procesados`);
        }
      } catch (error) {
        console.error(`   ⚠️ Error migrando cliente ${data.code}:`, error.message);
      }
    }
    console.log(`   ✅ ${counts.clients} clientes migrados\n`);

    // Migrar usuarios
    console.log('👤 Migrando usuarios...');
    const usersSnapshot = await db.collection('users').get();
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      await UserModel.create({
        name: data.name || '',
        email: data.email || '',
        password: data.password || 'hash-sin-actualizar',
        role: data.role || 'Recepcion',
        isActive: data.isActive !== false
      });
      counts.users++;
    }
    console.log(`   ✅ ${counts.users} usuarios migrados\n`);

    // Migrar citas
    console.log('📅 Migrando citas...');
    const appointmentsSnapshot = await db.collection('appointments').get();
    for (const doc of appointmentsSnapshot.docs) {
      const data = doc.data();
      const startTime = data.startTime ? (data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime)) : new Date();
      
      await AppointmentModel.create({
        date: startTime,
        clientCode: data.clientCode || '',
        clientName: data.clientName || '',
        serviceCode: data.serviceCode || '',
        serviceName: data.serviceName || '',
        description: data.description || '',
        status: data.status || 'confirmed',
        startTime: startTime,
        endTime: data.endTime ? (data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime)) : startTime,
        assignments: data.assignments || [],
        notes: data.notes || '',
        cancelled: data.cancelled || false,
        cancelledBy: data.cancelledBy || '',
        cancelledAt: data.cancelledAt ? (data.cancelledAt.toDate ? data.cancelledAt.toDate() : new Date(data.cancelledAt)) : null,
        cancellationReason: data.cancellationReason || ''
      });
      counts.appointments++;
      if (counts.appointments % 1000 === 0) {
        console.log(`   ... ${counts.appointments} citas procesadas`);
      }
    }
    console.log(`   ✅ ${counts.appointments} citas migradas\n`);

    // Migrar configuración
    console.log('⚙️ Migrando configuración...');
    const settingsSnapshot = await db.collection('settings').get();
    if (settingsSnapshot.size > 0) {
      const settingsDoc = settingsSnapshot.docs[0].data();
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
    console.log('📊 Resumen de migración:');
    console.log(`   Servicios:    ${counts.services}`);
    console.log(`   Productos:    ${counts.products}`);
    console.log(`   Clientes:     ${counts.clients}`);
    console.log(`   Usuarios:     ${counts.users}`);
    console.log(`   Citas:        ${counts.appointments}`);
    console.log(`   Configuración: ${counts.settings}`);
    console.log(`\n✨ Migración completada exitosamente`);

    await mongoose.connection.close();
    admin.app().delete();

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

restoreAndMigrate();
