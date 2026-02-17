#!/usr/bin/env node

/**
 * Script para restaurar datos desde export de Firestore a MongoDB
 * Usa la herramienta de importación de Firebase CLI
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Ejecutando: ${command} ${args.join(' ')}\n`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Comando falló con código ${code}`));
      } else {
        resolve();
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    console.log('📥 RESTAURACIÓN DE DATOS DESDE BACKUP DE FIREBASE\n');
    console.log('=' .repeat(50) + '\n');

    // Verificar que el emulador está corriendo
    console.log('✓ Asegúrate de que el emulador está corriendo:');
    console.log('  firebase emulators:start --import ./firebase_backup_2026-02-08T19-11-50\n');
    
    console.log('⏳ Esperando 5 segundos...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Ahora ejecutar el script de migración
    console.log('📊 Migrando datos de Firestore a MongoDB...\n');
    
    // Usar tsx para ejecutar TypeScript
    await runCommand('npx', ['tsx', 'migrate-desde-emulator-completo.ts']);

    console.log('\n✨ ¡Datos restaurados y migrados exitosamente!');
    console.log('Puedes ahora acceder a http://localhost:9002');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Solución: Asegúrate de que Firebase Emulator está corriendo:');
    console.error('   firebase emulators:start --import ./firebase_backup_2026-02-08T19-11-50');
    process.exit(1);
  }
}

main();
