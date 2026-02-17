// Script de prueba para verificar la conexión a MongoDB
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alessi2026';

async function testConnection() {
  try {
    console.log('🔍 Intentando conectar a MongoDB...');
    console.log(`📍 URI: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI);
    
    console.log('✅ Conexión exitosa a MongoDB!');
    console.log(`📦 Base de datos: ${mongoose.connection.db.databaseName}`);
    
    // Listar colecciones
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📚 Colecciones existentes (${collections.length}):`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    await mongoose.connection.close();
    console.log('👋 Conexión cerrada correctamente');
    
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
