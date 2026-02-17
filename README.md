# Guía de Instalación y Puesta en Marcha del Proyecto Alessi

Este documento detalla los pasos necesarios para configurar y ejecutar el proyecto en una computadora nueva o recién formateada.

---

## 1. Prerrequisitos de Software

Antes de empezar, asegúrate de tener instalado el siguiente software:

- **Node.js:** Esencial para ejecutar el proyecto.
  - **Descarga:** [https://nodejs.org/](https://nodejs.org/) (descarga la versión LTS, es la más estable).
- **Visual Studio Code:** El editor de código recomendado.
  - **Descarga:** [https://code.visualstudio.com/](https://code.visualstudio.com/)
- **Firebase CLI (Command Line Interface):** Herramienta para gestionar los emuladores de Firebase.
  - **Instalación:** Abre una terminal (Símbolo del sistema o PowerShell) y ejecuta el siguiente comando:
    ```bash
    npm install -g firebase-tools
    ```

---

## 2. Configuración del Proyecto

1.  **Obtener los Archivos:** Copia toda la carpeta del proyecto (`Prueba5` en tu caso) a la nueva computadora.

2.  **Instalar Dependencias:**
    - Abre una terminal **dentro de la carpeta del proyecto** en Visual Studio Code (`Terminal > Nuevo terminal`).
    - Ejecuta el siguiente comando para instalar todas las librerías necesarias:
      ```bash
      npm install
      ```

---

## 3. Configuración de Firebase

1.  **Iniciar Sesión en Firebase:**
    - En la misma terminal, ejecuta el siguiente comando. Se abrirá una ventana en tu navegador para que inicies sesión con tu cuenta de Google.
      ```bash
      firebase login
      ```

2.  **Establecer el Proyecto de Firebase:**
    - Para asegurarte de que los emuladores se conecten al proyecto correcto (`turnolisto`), ejecuta:
      ```bash
      firebase use turnolisto
      ```

---

## 4. Carga de Datos Iniciales (Backup)

Para que tu entorno de desarrollo local tenga los datos con los que has estado trabajando, necesitas importarlos al emulador.

1.  **Coloca tu Backup:** Asegúrate de que tu archivo de respaldo (ej. `alessi_backup_... .json`) esté en una ubicación fácil de encontrar.

2.  **Inicia el Entorno por Primera Vez:**
    - Ejecuta el script de inicio haciendo doble clic en `start-dev-environment.bat`. Esto abrirá varias terminales.

3.  **Importa los Datos:**
    - Abre tu navegador y ve a `http://localhost:9002/admin/import`.
    - Haz clic en **"Seleccionar Archivo"** y elige tu archivo de backup.
    - Haz clic en los botones para importar **Clientes, Servicios, Productos y Usuarios**.

4.  **Verifica los Datos:**
    - Navega a `http://localhost:9002/admin/clients` o cualquier otra sección para confirmar que los datos se cargaron.

5.  **Guarda los Datos en el Emulador:**
    - Cierra **TODAS** las terminales que se abrieron con el script presionando `Ctrl + C` en cada una. Es crucial esperar a que la terminal de los emuladores muestre un mensaje de que los datos fueron exportados. Esto guardará los datos importados en la carpeta `firebase_data` para futuros inicios.

A partir de ahora, cada vez que uses `start-dev-environment.bat`, los datos se cargarán automáticamente.

---

## 5. Configuración de Red para Acceso Local

Para que otros dispositivos en tu misma red (WiFi o cableada) puedan acceder a tu aplicación, debes configurar el Firewall de Windows.

1.  **Abrir Firewall de Windows:**
    - Presiona la tecla `Windows`, escribe **"Firewall de Windows Defender"** y selecciona **"Firewall de Windows Defender con seguridad avanzada"**.

2.  **Crear Nueva Regla de Entrada:**
    - Izquierda: Clic en **"Reglas de entrada"**.
    - Derecha: Clic en **"Nueva regla..."**.

3.  **Asistente de Configuración:**
    - **Tipo de regla:** Selecciona **"Puerto"** y clic en "Siguiente".
    - **Protocolo y puertos:**
        - Selecciona **"TCP"**.
        - Selecciona **"Puertos locales específicos"** y escribe `9002`.
        - Clic en "Siguiente".
    - **Acción:** Selecciona **"Permitir la conexión"** y clic en "Siguiente".
    - **Perfil:** Deja las tres casillas marcadas (Dominio, Privado, Público) y clic en "Siguiente".
    - **Nombre:** Escribe un nombre descriptivo, como `Alessi Dev Server (Puerto 9002)`.
    - Clic en **"Finalizar"**.

---

## 6. Flujo de Trabajo Diario

> Nota de control de deploy: actualización registrada el **2026-02-17**.

- **Para Iniciar:** Simplemente haz doble clic en el archivo `start-dev-environment.bat`.
- **Para Acceder Localmente:** Usa `http://localhost:9002` en tu PC.
- **Para Compartir en tu Red:**
    1.  Busca tu IP local con el comando `ipconfig` en una terminal.
    2.  Comparte la dirección `http://<tu-ip-local>:9002` (ej. `http://192.168.1.105:9002`).
- **Para Compartir por Internet:** Usa el link que te proporciona la ventana de **Tunnelmole**.
- **Para Detener:** Cierra las terminales con `Ctrl + C`, especialmente la de los emuladores, para asegurar que los datos se guarden.
