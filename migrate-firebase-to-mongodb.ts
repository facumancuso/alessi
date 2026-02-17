/**
 * Script de Migración de Firebase a MongoDB
 * 
 * Este script lee los datos exportados de Firebase/Firestore
 * y los migra a MongoDB local con las transformaciones necesarias.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  ServiceModel, 
  ProductModel, 
  ClientModel, 
  UserModel, 
  AppointmentModel, 
  SettingsModel 
} from './src/lib/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alessi2026';

// Función para leer archivos de exportación de Firestore
async function readFirestoreExport() {
  const exportPath = path.join(__dirname, 'firebase_data', 'firestore_export', 'all_namespaces', 'all_kinds');
  
  console.log('📂 Leyendo archivos de exportación de Firestore...');
  
  const files = await fs.readdir(exportPath);
  const outputFiles = files.filter(f => f.startsWith('output-'));
  
  const allDocuments = [];
  
  for (const file of outputFiles) {
    console.log(`   Procesando ${file}...`);
    const filePath = path.join(exportPath, file);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Los archivos de exportación son líneas JSON separadas
    const lines = content.trim().split('\n');
    
    for (const line of lines) {
      try {
        const doc = JSON.parse(line);
        allDocuments.push(doc);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.warn(`   ⚠️ Error parseando línea: ${errorMessage}`);
      }
    }
  }
  
  console.log(`✅ Total documentos leídos: ${allDocuments.length}`);
  return allDocuments;
}

// Función para organizar documentos por colección
function organizeByCollection(documents) {
  const collections = {
    services: [],
    products: [],
    clients: [],
    users: [],
    appointments: [],
    settings: []
  };
  
  for (const doc of documents) {
    if (!doc.name) continue;
    
    // El formato de Firestore es: projects/.../databases/.../documents/COLLECTION/ID
    const parts = doc.name.split('/documents/');
    if (parts.length < 2) continue;
    
    const pathParts = parts[1].split('/');
    const collection = pathParts[0];
    
    if (collections[collection] !== undefined) {
      collections[collection].push(doc);
    }
  }
  
  return collections;
}

// Función para convertir valor de Firestore a valor JavaScript
function convertFirestoreValue(value) {
  if (!value) return null;
  
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue).toISOString();
  if (value.nullValue !== undefined) return null;
  
  if (value.arrayValue) {
    return value.arrayValue.values?.map(v => convertFirestoreValue(v)) || [];
  }
  
  if (value.mapValue) {
    const obj = {};
    const fields = value.mapValue.fields || {};
    for (const [key, val] of Object.entries(fields)) {
      obj[key] = convertFirestoreValue(val);
    }
    return obj;
  }
  
  return null;
}

// Función para convertir documento de Firestore a objeto plano
function convertFirestoreDoc(doc) {
  const obj = {};
  const fields = doc.fields || {};
  
  for (const [key, value] of Object.entries(fields)) {
    obj[key] = convertFirestoreValue(value);
  }
  
  return obj;
}

// Migrar servicios
async function migrateServices(docs) {
  if (docs.length === 0) {
    console.log('   ℹ️ No hay servicios para migrar');
    return 0;
  }
  
  console.log(`📦 Migrando ${docs.length} servicios...`);
  
  const services = docs.map(doc => convertFirestoreDoc(doc));
  
  try {
    await ServiceModel.deleteMany({});
    const result = await ServiceModel.insertMany(services);
    console.log(`   ✅ ${result.length} servicios migrados`);
    return result.length;
  } catch (error) {
    console.error(`   ❌ Error migrando servicios:`, error.message);
    return 0;
  }
}

// Migrar productos
async function migrateProducts(docs) {
  if (docs.length === 0) {
    console.log('   ℹ️ No hay productos para migrar');
    return 0;
  }
  
  console.log(`📦 Migrando ${docs.length} productos...`);
  
  const products = docs.map(doc => convertFirestoreDoc(doc));
  
  try {
    await ProductModel.deleteMany({});
    const result = await ProductModel.insertMany(products);
    console.log(`   ✅ ${result.length} productos migrados`);
    return result.length;
  } catch (error) {
    console.error(`   ❌ Error migrando productos:`, error.message);
    return 0;
  }
}

// Migrar clientes
async function migrateClients(docs) {
  if (docs.length === 0) {
    console.log('   ℹ️ No hay clientes para migrar');
    return 0;
  }
  
  console.log(`📦 Migrando ${docs.length} clientes...`);
  
  const clients = docs.map(doc => convertFirestoreDoc(doc));
  
  try {
    await ClientModel.deleteMany({});
    const result = await ClientModel.insertMany(clients);
    console.log(`   ✅ ${result.length} clientes migrados`);
    return result.length;
  } catch (error) {
    console.error(`   ❌ Error migrando clientes:`, error.message);
    return 0;
  }
}

// Migrar usuarios (con hash de contraseñas)
async function migrateUsers(docs) {
  if (docs.length === 0) {
    console.log('   ℹ️ No hay usuarios para migrar');
    return 0;
  }
  
  console.log(`👤 Migrando ${docs.length} usuarios...`);
  console.log('   🔐 Hasheando contraseñas con bcrypt...');
  
  const users = await Promise.all(
    docs.map(async (doc) => {
      const user = convertFirestoreDoc(doc);
      
      // Si la contraseña existe y no está hasheada, hashearla
      if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        user.password = await bcrypt.hash(user.password, 10);
      } else if (!user.password) {
        // Si no tiene contraseña, usar una por defecto
        user.password = await bcrypt.hash('password123', 10);
        console.log(`   ⚠️ Usuario ${user.email} no tenía contraseña, se asignó: password123`);
      }
      
      return user;
    })
  );
  
  try {
    await UserModel.deleteMany({});
    const result = await UserModel.insertMany(users);
    console.log(`   ✅ ${result.length} usuarios migrados`);
    return result.length;
  } catch (error) {
    console.error(`   ❌ Error migrando usuarios:`, error.message);
    return 0;
  }
}

// Migrar citas
async function migrateAppointments(docs) {
  if (docs.length === 0) {
    console.log('   ℹ️ No hay citas para migrar');
    return 0;
  }
  
  console.log(`📅 Migrando ${docs.length} citas...`);
  
  const appointments = docs.map(doc => convertFirestoreDoc(doc));
  
  try {
    await AppointmentModel.deleteMany({});
    const result = await AppointmentModel.insertMany(appointments);
    console.log(`   ✅ ${result.length} citas migradas`);
    return result.length;
  } catch (error) {
    console.error(`   ❌ Error migrando citas:`, error.message);
    return 0;
  }
}

// Migrar configuración
async function migrateSettings(docs) {
  if (docs.length === 0) {
    console.log('   ℹ️ No hay configuración para migrar');
    return 0;
  }
  
  console.log(`⚙️ Migrando configuración...`);
  
  const settings = docs.map(doc => convertFirestoreDoc(doc));
  
  try {
    await SettingsModel.deleteMany({});
    const result = await SettingsModel.insertMany(settings);
    console.log(`   ✅ Configuración migrada`);
    return result.length;
  } catch (error) {
    console.error(`   ❌ Error migrando configuración:`, error.message);
    return 0;
  }
}

// Función principal de migración
async function migrate() {
  console.log('🚀 Iniciando migración de Firebase a MongoDB\n');
  
  try {
    // Conectar a MongoDB
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Conectado a: ${MONGODB_URI}\n`);
    
    // Leer datos de Firebase
    const documents = await readFirestoreExport();
    
    if (documents.length === 0) {
      console.log('❌ No se encontraron documentos para migrar');
      console.log('   Verifica que existan archivos en firebase_data/firestore_export/');
      process.exit(1);
    }
    
    console.log('');
    
    // Organizar por colección
    console.log('📊 Organizando documentos por colección...');
    const collections = organizeByCollection(documents);
    
    console.log(`   Services: ${collections.services.length}`);
    console.log(`   Products: ${collections.products.length}`);
    console.log(`   Clients: ${collections.clients.length}`);
    console.log(`   Users: ${collections.users.length}`);
    console.log(`   Appointments: ${collections.appointments.length}`);
    console.log(`   Settings: ${collections.settings.length}`);
    console.log('');
    
    // Migrar cada colección
    const stats = {
      services: await migrateServices(collections.services),
      products: await migrateProducts(collections.products),
      clients: await migrateClients(collections.clients),
      users: await migrateUsers(collections.users),
      appointments: await migrateAppointments(collections.appointments),
      settings: await migrateSettings(collections.settings)
    };
    
    console.log('\n✅ Migración completada!\n');
    console.log('📊 Resumen:');
    console.log(`   Servicios:  ${stats.services}`);
    console.log(`   Productos:  ${stats.products}`);
    console.log(`   Clientes:   ${stats.clients}`);
    console.log(`   Usuarios:   ${stats.users}`);
    console.log(`   Citas:      ${stats.appointments}`);
    console.log(`   Config:     ${stats.settings}`);
    
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    console.log(`\n   TOTAL:      ${total} documentos migrados`);
    
    console.log('\n🎉 ¡Migración exitosa!');
    console.log('\n💡 Próximos pasos:');
    console.log('   1. Abre MongoDB Compass y verifica los datos');
    console.log('   2. Inicia la aplicación: npm run dev');
    console.log('   3. Prueba el login con tus usuarios');
    
    if (stats.users > 0) {
      console.log('\n⚠️ IMPORTANTE:');
      console.log('   Las contraseñas han sido hasheadas con bcrypt.');
      console.log('   Si algún usuario no tenía contraseña, se asignó: password123');
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Conexión a MongoDB cerrada');
  }
}

// Ejecutar migración
migrate();
