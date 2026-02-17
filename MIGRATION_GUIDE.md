# Script de Migración de Firebase a MongoDB

Este script te ayudará a migrar datos existentes de Firebase/Firestore a MongoDB.

## ⚠️ Importante

- Asegúrate de tener un backup de tus datos de Firebase
- Ejecuta este script solo una vez
- Verifica los datos en MongoDB Compass después de la migración

## Opción 1: Exportar desde Firebase y importar manualmente

### 1. Exportar datos de Firebase

Si tienes datos en el emulador de Firebase:
```powershell
# Los datos del emulador están en: firebase_data/firestore_export/
```

Si tienes datos en Firebase producción, usa la consola de Firebase para exportarlos.

### 2. Convertir a formato MongoDB

Necesitarás convertir los documentos de Firestore a formato MongoDB. Las principales diferencias:

**Firebase/Firestore:**
```json
{
  "id": "auto-generated-id",
  "field": "value"
}
```

**MongoDB:**
```json
{
  "_id": "ObjectId",
  "field": "value"
}
```

## Opción 2: Script de migración automático

Puedes crear un script que lea de Firebase y escriba en MongoDB. Aquí un ejemplo:

```javascript
// migrate-firebase-to-mongodb.js
import admin from 'firebase-admin';
import mongoose from 'mongoose';
import { ServiceModel, ProductModel, ClientModel, AppointmentModel } from './src/lib/models.ts';

// Inicializar Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Conectar a MongoDB
await mongoose.connect('mongodb://localhost:27017/alessi2026');

// Migrar servicios
async function migrateServices() {
  const snapshot = await db.collection('services').get();
  const services = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    services.push({
      code: data.code,
      name: data.name,
      duration: data.duration,
      price: data.price
    });
  });
  
  await ServiceModel.insertMany(services);
  console.log(`✅ Migrados ${services.length} servicios`);
}

// Ejecutar migración
await migrateServices();
// ... repetir para otras colecciones
```

## Opción 3: Usar los datos de seed existentes

La forma más simple es usar los datos de seed que ya tienes:

1. Ve a `/admin/seed` en tu aplicación
2. Usa los botones de importación que ya existen
3. Los datos se cargarán directamente en MongoDB

## Verificar la migración

Después de migrar, verifica en MongoDB Compass:

1. Abre MongoDB Compass
2. Conéctate a `mongodb://localhost:27017`
3. Selecciona la base de datos `alessi2026`
4. Verifica que las colecciones tengan datos:
   - users
   - services
   - products
   - clients
   - appointments

## Problemas comunes

### Los IDs no coinciden
- MongoDB usa ObjectId en lugar de strings
- Necesitarás actualizar las referencias entre documentos

### Fechas en formato diferente
- Firebase usa Timestamp
- MongoDB puede usar Date o String ISO
- El código ya maneja esto automáticamente

### Usuarios y contraseñas
- Las contraseñas de Firebase Auth no son migrables
- Necesitarás restablecer las contraseñas o crear nuevos usuarios
- Las contraseñas ahora se almacenan hasheadas con bcrypt

## Crear usuarios nuevos

Puedes crear usuarios desde MongoDB Compass o usando bcrypt:

```javascript
import bcrypt from 'bcryptjs';

const password = 'mi-contraseña';
const hashedPassword = await bcrypt.hash(password, 10);

// Inserta en MongoDB Compass:
{
  "name": "Admin",
  "email": "admin@alessi.com",
  "password": "hash-generado-arriba",
  "role": "Superadmin",
  "isActive": true
}
```

## Notas finales

- Los datos migrados mantendrán la misma estructura
- Los IDs serán diferentes (MongoDB genera nuevos ObjectIds)
- Asegúrate de probar todas las funcionalidades después de migrar
