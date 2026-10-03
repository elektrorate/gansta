# Gantsta

Aplicación móvil en español para gestionar offerings y campañas publicitarias: objetivos de ventas, consultas, cierres, presupuesto por Meta/Google/TikTok, calendario y planificación de tareas.

## Desarrollo local

Requiere Node.js 24 o superior.

```sh
npm ci
npm --prefix server ci
npm run dev
```

El frontend permite entrar explícitamente en una demostración con datos ficticios guardados en el navegador.

```sh
npm test
npm run build
```

## Firebase y backend

Copiar `.env.example` a `.env`, configurar Firebase Authentication y Firestore, y proporcionar credenciales ADC al servidor fuera del repositorio. Ajustar `APP_ORIGIN` al origen exacto del frontend y `VITE_API_URL` a la URL del backend.

```sh
npm run server
npm run bootstrap-admin -- UID
```

El bootstrap requiere un usuario real habilitado y con correo verificado. La configuración de Firebase Hosting sirve el frontend; el servidor Node necesita alojamiento separado. Nunca incluir credenciales de servicio en variables `VITE_`.

## Estado y contexto

Primera implementación en desarrollo. La conexión a Firebase real, los correos y el flujo completo de invitaciones aún requieren configuración y validación. Hay pendientes conocidos; no se presenta como una versión lista para producción.

Consultar [CONTEXTO_PROYECTO.md](CONTEXTO_PROYECTO.md) para requisitos, decisiones de interfaz, arquitectura, mapa de archivos y pendientes concretos.
