/**
 * Script de Backup de Firebase
 * 
 * Este script hace una copia de seguridad de los datos actuales
 * antes de la migración a MongoDB.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backup() {
  console.log('📦 Creando backup de Firebase...\n');
  
  const sourceDir = path.join(__dirname, 'firebase_data');
  const backupDir = path.join(__dirname, 'firebase_backup_' + new Date().toISOString().replace(/:/g, '-').split('.')[0]);
  
  try {
    // Verificar que existe firebase_data
    await fs.access(sourceDir);
    
    console.log(`📂 Origen: ${sourceDir}`);
    console.log(`💾 Destino: ${backupDir}\n`);
    
    // Copiar directorio completo
    console.log('⏳ Copiando archivos...');
    await copyDir(sourceDir, backupDir);
    
    console.log('✅ Backup completado exitosamente!\n');
    console.log(`💾 Los datos de Firebase han sido respaldados en:`);
    console.log(`   ${backupDir}\n`);
    console.log('🔒 Este backup te permitirá restaurar los datos si es necesario.');
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️ No se encontró el directorio firebase_data');
      console.log('   No hay datos de Firebase para respaldar.');
    } else {
      console.error('❌ Error creando backup:', error.message);
      process.exit(1);
    }
  }
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

backup();
