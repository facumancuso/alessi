# 🚀 Inicio Rápido - MongoDB

## Pasos para iniciar el proyecto

### 1️⃣ Verifica que MongoDB esté ejecutándose

```powershell
# Opción 1: Abre MongoDB Compass
# Conéctate a: mongodb://localhost:27017

# Opción 2: Verifica el servicio (Windows)
Get-Service MongoDB

# Si no está ejecutándose, inícialo
net start MongoDB
```

### 2️⃣ Verifica las variables de entorno

Asegúrate de que `.env.local` existe con:

```env
MONGODB_URI=mongodb://localhost:27017/alessi2026
JWT_SECRET=cambiar-por-algo-seguro
MERCADOPAGO_ACCESS_TOKEN=tu-token
```

### 3️⃣ Prueba la conexión a MongoDB

```powershell
npm run test:mongodb
```

Deberías ver: ✅ Conexión exitosa a MongoDB!

### 4️⃣ Inicia la aplicación

```powershell
npm run dev
```

La aplicación estará disponible en: http://localhost:9002

### 5️⃣ Crea tu primer usuario

**Opción A: Desde la aplicación**
1. Ve a http://localhost:9002/admin/seed
2. Crea usuarios, servicios, productos, etc.

**Opción B: Desde MongoDB Compass**
1. Abre MongoDB Compass
2. Conéctate a `mongodb://localhost:27017`
3. Selecciona la base de datos `alessi2026`
4. Crea la colección `users`
5. Inserta un documento:

```json
{
  "name": "Admin",
  "email": "admin@alessi.com",
  "password": "$2a$10$rQwXK8YzOxq5xqxqX...", // Usa bcrypt para generar
  "role": "Superadmin",
  "isActive": true
}
```

Para generar el hash de la contraseña, puedes usar este código:

```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('tu-contraseña', 10);
console.log(hash);
```

### 6️⃣ Inicia sesión

1. Ve a http://localhost:9002/login
2. Selecciona tu usuario
3. Ingresa la contraseña
4. ¡Listo!

## 📝 Notas Importantes

- **MongoDB debe estar ejecutándose ANTES de iniciar la aplicación**
- **Las contraseñas ahora están hasheadas** (no puedes usar contraseñas en texto plano)
- **Los archivos de Firebase están en backup** (.backup) por si necesitas referencia

## 🔧 Si algo no funciona

1. **Verifica MongoDB**
   ```powershell
   mongod --version
   ```

2. **Revisa los logs**
   - En la terminal donde ejecutaste `npm run dev`
   - En la consola del navegador (F12)

3. **Elimina y recrea la base de datos**
   ```javascript
   // En MongoDB Compass o mongo shell
   use alessi2026
   db.dropDatabase()
   ```

4. **Reinstala dependencias**
   ```powershell
   rm -rf node_modules
   npm install
   ```

## 📚 Documentación Completa

- `MONGODB_README.md` - Guía detallada de configuración
- `CAMBIOS_MONGODB.md` - Lista completa de cambios
- `MIGRATION_GUIDE.md` - Cómo migrar datos de Firebase

## ✅ Checklist de Verificación

- [ ] MongoDB instalado
- [ ] MongoDB ejecutándose
- [ ] Archivo `.env.local` creado
- [ ] `npm install` ejecutado
- [ ] `npm run test:mongodb` exitoso
- [ ] Usuario creado
- [ ] Login funciona

## 🎉 ¡Listo!

Si todos los pasos anteriores funcionaron, tu aplicación está lista para usar con MongoDB.

**¿Problemas?** Revisa los archivos de documentación en la raíz del proyecto.
