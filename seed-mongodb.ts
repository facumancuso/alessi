/**
 * Script de población de datos iniciales en MongoDB
 * Crea datos básicos para que la aplicación funcione
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { 
  ServiceModel, 
  ProductModel, 
  ClientModel, 
  UserModel, 
  AppointmentModel, 
  SettingsModel 
} from './src/lib/models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alessi2026';

async function seedDatabase() {
  console.log('🌱 Poblando base de datos inicial en MongoDB\n');

  try {
    // Conectar a MongoDB
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Conectado\n`);

    // Limpiar colecciones existentes
    console.log('🧹 Limpiando colecciones...');
    await ServiceModel.deleteMany({});
    await ProductModel.deleteMany({});
    await ClientModel.deleteMany({});
    await UserModel.deleteMany({});
    await AppointmentModel.deleteMany({});
    await SettingsModel.deleteMany({});
    console.log('✅ Limpias\n');

    // Crear servicios (basados en Alessi Hairdressing)
    console.log('📦 Creando servicios...');
    const services = await ServiceModel.insertMany([
      {
        code: 'CORTE',
        name: 'Corte de Cabello',
        duration: 30,
        price: 5000
      },
      {
        code: 'COLORACION',
        name: 'Coloración',
        duration: 60,
        price: 8000
      },
      {
        code: 'ALISADO',
        name: 'Alisado Brasileño',
        duration: 90,
        price: 12000
      },
      {
        code: 'PEINADO',
        name: 'Peinado y Arreglo',
        duration: 45,
        price: 4000
      },
      {
        code: 'MANICURA',
        name: 'Manicura',
        duration: 40,
        price: 3000
      },
      {
        code: 'PEDICURA',
        name: 'Pedicura',
        duration: 50,
        price: 3500
      }
    ]);
    console.log(`✅ ${services.length} servicios creados\n`);

    // Crear productos
    console.log('📦 Creando productos...');
    const products = await ProductModel.insertMany([
      {
        code: 'SHAMPOO',
        name: 'Champú Premium',
        price: 1500
      },
      {
        code: 'ACONDICIONADOR',
        name: 'Acondicionador Hidratante',
        price: 1500
      },
      {
        code: 'MASCARILLA',
        name: 'Mascarilla Capilar',
        price: 2000
      },
      {
        code: 'TINTE',
        name: 'Tinte Profesional',
        price: 2500
      }
    ]);
    console.log(`✅ ${products.length} productos creados\n`);

    // Crear usuarios (administrador y empleados)
    console.log('👤 Creando usuarios...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const employeePassword = await bcrypt.hash('empleado123', 10);

    const users = await UserModel.insertMany([
      {
        name: 'Administrador',
        email: 'admin@alessi.com',
        password: adminPassword,
        role: 'Superadmin',
        isActive: true
      },
      {
        name: 'Gerente',
        email: 'gerente@alessi.com',
        password: employeePassword,
        role: 'Gerente',
        isActive: true
      },
      {
        name: 'Recepcionista',
        email: 'recepcion@alessi.com',
        password: employeePassword,
        role: 'Recepcion',
        isActive: true
      },
      {
        name: 'María - Peluquería',
        email: 'maria@alessi.com',
        password: employeePassword,
        role: 'Peluquero',
        isActive: true
      },
      {
        name: 'Laura - Peluquería',
        email: 'laura@alessi.com',
        password: employeePassword,
        role: 'Peluquero',
        isActive: true
      }
    ]);
    console.log(`✅ ${users.length} usuarios creados\n`);

    // Crear algunos clientes
    console.log('👥 Creando clientes...');
    const clients = await ClientModel.insertMany([
      {
        code: '0001',
        name: 'Cliente 1',
        email: 'cliente1@example.com',
        mobilePhone: '1234567890',
        location: 'San Juan',
        inactive: false
      },
      {
        code: '0002',
        name: 'Cliente 2',
        email: 'cliente2@example.com',
        mobilePhone: '0987654321',
        location: 'San Juan',
        inactive: false
      },
      {
        code: '0003',
        name: 'Cliente 3',
        email: 'cliente3@example.com',
        mobilePhone: '5555555555',
        location: 'San Juan',
        inactive: false
      }
    ]);
    console.log(`✅ ${clients.length} clientes creados\n`);

    // Crear configuración
    console.log('⚙️ Creando configuración...');
    await SettingsModel.create({
      bookingClosingHours: 24,
      whatsappApiUrl: '',
      whatsappToken: '',
      whatsappPhoneNumberId: ''
    });
    console.log('✅ Configuración creada\n');

    // Resumen
    console.log('📊 Resumen:');
    console.log(`   Servicios:  ${services.length}`);
    console.log(`   Productos:  ${products.length}`);
    console.log(`   Usuarios:   ${users.length}`);
    console.log(`   Clientes:   ${clients.length}`);
    
    console.log('\n✨ Base de datos poblada exitosamente\n');
    
    console.log('🔑 Credenciales de acceso:');
    console.log('   Superadmin:');
    console.log('   - Email: admin@alessi.com');
    console.log('   - Contraseña: admin123\n');
    console.log('   Empleados (Gerente, Recepcionista, Peluqueros):');
    console.log('   - Contraseña: empleado123\n');

    await mongoose.connection.close();
    console.log('✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('\n❌ Error poblando base de datos:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedDatabase();
