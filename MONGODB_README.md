# Configuración de MongoDB para Alessi 2026

## Migración de Firebase a MongoDB

Este proyecto ha sido migrado de Firebase/Firestore a MongoDB local. Esta guía te ayudará a configurar el entorno.

## Requisitos Previos

1. **Instalar MongoDB Community Edition**
   - Descarga desde: https://www.mongodb.com/try/download/community
   - Durante la instalación, asegúrate de instalar **MongoDB Compass** (incluido)
   - MongoDB se ejecutará automáticamente en `mongodb://localhost:27017`

2. **Verificar la instalación**
   ```powershell
   mongod --version
   ```

## Configuración del Proyecto

### 1. Variables de Entorno

El archivo `.env.local` ya está creado con la configuración básica:

```env
MONGODB_URI=mongodb://localhost:27017/alessi2026
JWT_SECRET=tu-secreto-super-seguro-cambialo-en-produccion
MERCADOPAGO_ACCESS_TOKEN=
```

**IMPORTANTE:** 
- Cambia el `JWT_SECRET` por un valor único y seguro en producción
- Agrega tu token de MercadoPago si lo usas

### 2. Iniciar MongoDB

MongoDB debe estar ejecutándose antes de iniciar la aplicación.

**En Windows:**
- Si instalaste MongoDB como servicio, ya está corriendo
- Verifica abriendo MongoDB Compass y conectándote a `mongodb://localhost:27017`

**Manualmente (si no está como servicio):**
```powershell
mongod
```

### 3. Iniciar la Aplicación

```powershell
npm run dev
```

La primera vez que ejecutes la aplicación:
- MongoDB creará automáticamente la base de datos `alessi2026`
- Las colecciones se crearán cuando insertes el primer documento

## Estructura de la Base de Datos

### Colecciones

- **users** - Usuarios del sistema (con contraseñas hasheadas)
- **services** - Servicios ofrecidos
- **products** - Productos disponibles
- **clients** - Clientes registrados
- **appointments** - Citas/Turnos
- **settings** - Configuración de la aplicación

### Autenticación

El sistema ahora usa:
- **bcryptjs** para hash de contraseñas
- **JWT (JSON Web Tokens)** para sesiones
- Cookies HTTP-only para seguridad

## Usar MongoDB Compass

MongoDB Compass es una interfaz gráfica para visualizar y administrar tus datos:

1. Abre **MongoDB Compass**
2. Conéctate a: `mongodb://localhost:27017`
3. Selecciona la base de datos `alessi2026`
4. Explora las colecciones y documentos

## Crear Usuario Inicial

Si necesitas crear un usuario administrador inicial, puedes:

1. Ir a `/admin/seed` (no requiere autenticación)
2. O crear manualmente desde MongoDB Compass
3. O usar el script de seed que ya existe

## Comandos Útiles

### Listar bases de datos
```javascript
// En MongoDB Compass o mongo shell
show dbs
```

### Ver colecciones
```javascript
use alessi2026
show collections
```

### Buscar usuarios
```javascript
db.users.find()
```

### Eliminar toda la base de datos (¡CUIDADO!)
```javascript
use alessi2026
db.dropDatabase()
```

## Backup y Restore

### Hacer backup
```powershell
mongodump --db=alessi2026 --out=./mongodb_backup
```

### Restaurar backup
```powershell
mongorestore --db=alessi2026 ./mongodb_backup/alessi2026
```

## Solución de Problemas

### Error: "No se puede conectar a MongoDB"
- Verifica que MongoDB esté ejecutándose
- Verifica el puerto (por defecto 27017)
- Revisa el firewall de Windows

### Error: "MongooseError: Operation buffering timed out"
- MongoDB no está corriendo
- Inicia el servicio de MongoDB

### La aplicación no inicia
- Verifica que todas las dependencias estén instaladas: `npm install`
- Revisa el archivo `.env.local`
- Verifica la consola para errores específicos

## Archivos de Respaldo

Durante la migración se crearon copias de seguridad:
- `src/lib/data.ts.backup` - Versión original con Firebase
- `src/lib/auth-actions.ts.backup` - Versión original con Firebase Auth

Estos archivos pueden eliminarse una vez que confirmes que todo funciona correctamente.

## Diferencias con Firebase

| Aspecto | Firebase | MongoDB |
|---------|----------|---------|
| Base de datos | Firestore (NoSQL) | MongoDB (NoSQL) |
| Autenticación | Firebase Auth | JWT + bcrypt |
| Conexión | Cloud/Emulador | Local |
| IDs | Generados por Firebase | ObjectId de MongoDB |
| Consultas en tiempo real | ✅ | ❌ (requiere implementación) |
| Costo | Por uso | Gratis (local) |

## Próximos Pasos

1. ✅ Migración de datos completada
2. ✅ Sistema de autenticación configurado
3. 🔄 Probar todas las funcionalidades
4. 📝 Migrar datos existentes de Firebase (si es necesario)
5. 🚀 Desplegar en producción (MongoDB Atlas para cloud)

## Despliegue en Producción

Para producción, considera usar **MongoDB Atlas** (cloud):

1. Crea una cuenta en https://www.mongodb.com/cloud/atlas
2. Crea un cluster gratuito
3. Actualiza `MONGODB_URI` en tus variables de entorno de producción
4. Actualiza `JWT_SECRET` con un valor seguro

Ejemplo de URI para Atlas:
```
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/alessi2026
```
