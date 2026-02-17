import mongoose from 'mongoose';
import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { 
  ServiceModel, 
  ProductModel, 
  ClientModel, 
  UserModel, 
  AppointmentModel, 
  SettingsModel 
} from './src/lib/models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alessi2026';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'alessi-62b1d';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';

function convertValue(value: any): any {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(convertValue);
  }
  if (value && typeof value === 'object') {
    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = convertValue(v);
    }
    return result;
  }
  return value;
}

async function readCollection(collectionName: string) {
  const db = admin.firestore();
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map(doc => {
    const data = convertValue(doc.data());
    // Avoid storing Firestore id field if present
    if (data && typeof data === 'object' && 'id' in data) {
      delete data.id;
    }
    return data;
  });
}

async function migrateCollection(collectionName: string, model: any) {
  const docs = await readCollection(collectionName);
  if (docs.length === 0) {
    console.log(`   ℹ️ ${collectionName}: sin documentos`);
    return 0;
  }

  await model.deleteMany({});
  const result = await model.insertMany(docs);
  console.log(`   ✅ ${collectionName}: ${result.length} documentos migrados`);
  return result.length;
}

async function migrate() {
  console.log('🚀 Iniciando migración desde emulador de Firestore a MongoDB\n');

  // Configurar emulator host
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;

  // Inicializar Firebase Admin apuntando al emulador
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
    });
  }

  // Conectar a MongoDB
  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Conectado a: ${MONGODB_URI}`);

  // Verificar conexión al emulador
  console.log(`\n🔧 Usando Firestore Emulator en ${FIRESTORE_EMULATOR_HOST}`);
  const db = admin.firestore();
  await db.listCollections();
  console.log('✅ Conexión al emulador OK\n');

  const stats = {
    services: await migrateCollection('services', ServiceModel),
    products: await migrateCollection('products', ProductModel),
    clients: await migrateCollection('clients', ClientModel),
    users: await migrateCollection('users', UserModel),
    appointments: await migrateCollection('appointments', AppointmentModel),
    settings: await migrateCollection('settings', SettingsModel),
  };

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  console.log('\n📊 Resumen:');
  console.log(`   Servicios:  ${stats.services}`);
  console.log(`   Productos:  ${stats.products}`);
  console.log(`   Clientes:   ${stats.clients}`);
  console.log(`   Usuarios:   ${stats.users}`);
  console.log(`   Citas:      ${stats.appointments}`);
  console.log(`   Config:     ${stats.settings}`);
  console.log(`\n   TOTAL:      ${total} documentos migrados`);

  console.log('\n🎉 Migración completada');

  await mongoose.connection.close();
}

migrate().catch(async (error) => {
  console.error('\n❌ Error en la migración:', error);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
