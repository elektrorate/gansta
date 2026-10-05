# Gantsta

Aplicación móvil en español para gestionar offerings y campañas publicitarias: objetivos de ventas, consultas, cierres, presupuesto por Meta/Google/TikTok y calendario de resultados.

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

## Prototipo en Vercel

La interfaz Vite y la API se publican en un mismo proyecto Vercel. `api/index.mjs` delega al handler compartido sin abrir un puerto; `server/index.mjs` mantiene el servidor local. El proyecto usa Node.js 24, región `fra1` y funciones con duración máxima configurada de 60 segundos. Las rutas desconocidas de `/api` responden JSON, no la página web.

El despliegue Hobby se autoriza únicamente como prototipo personal de evaluación, no para operar un negocio. Antes de cualquier uso comercial hay que utilizar un plan permitido por Vercel o cambiar de alojamiento. No se activa automáticamente un plan de pago.

Variables de Production en Vercel:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`: configuración pública de la app web.
- `VITE_API_URL=/`: peticiones a `/api` en el mismo origen; nunca dejar una dirección localhost en la publicación.
- `VITE_ENABLE_DEMO=false`: no activar demostración en el build publicado.
- `GOOGLE_CLOUD_PROJECT=gansta-app`.
- `NODE_OPTIONS=--experimental-require-module`: compatibilidad documentada de Vercel Node 24 con las dependencias ESM de Firebase Admin 14. Sin esta opción el runtime puede devolver `ERR_REQUIRE_ESM` aunque el build termine correctamente.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: credencial privada de Firebase Admin, marcada Sensitive y exclusiva de Production. Nunca usar un prefijo `VITE_` ni subirla a GitHub. Las Preview no reciben esta credencial y fallan cerradas para acceso a la API.
- `APP_ORIGIN`, si se configura: lista de orígenes exactos, separados por comas. Vercel añade también sus URLs de deployment y producción a la lista, sin usar comodines ni confiar en cabeceras Host arbitrarias.

El límite de cuerpo de la API es 1 MB. Vercel aplica además sus límites de plataforma (incluyendo tamaño de respuesta); el snapshot completo puede requerir paginación si aumenta el volumen. El contador de solicitudes en memoria es una protección de mejor esfuerzo por instancia, no un límite distribuido ni una garantía de facturación. No se importan ni borran los datos demo.

## Nueva planificación

«Ver planificación» abre una pantalla nueva basada en un Gantt general de tareas, cuatro hitos, resumen del periodo y tarjetas expandibles. El mini Gantt de cada tarjeta muestra exclusivamente sus propias subtareas, con fechas y progreso independientes. No se vuelve al calendario grande de la interfaz retirada.

Semana/Mes controla el Gantt general. Las fechas y el progreso de los mini Gantt se calculan con los datos de sus subtareas; los datos antiguos sin fechas propias heredan el periodo de su tarea y se identifican con un asterisco, sin modificarse automáticamente. Se conservan las tareas y datos demo guardados.

El administrador puede crear tareas, editar estructura, fechas, responsables, prioridades, dependencias, descripción (hasta 140 palabras), Drive e hitos. Los colaboradores solo pueden actualizar el cumplimiento de sus tareas asignadas. Demo y backend usan los mismos validadores. Las dependencias circulares o ajenas al proyecto se rechazan. Los hitos no se completan por fecha: su estado se deriva de sus tareas o de una confirmación explícita del administrador.

`tests/planning-browser.mjs` verifica la nueva pantalla en 320/375/390/430 px y que ningún mini Gantt incluya subtareas de otras tarjetas. Se ejecuta con Playwright externo a la aplicación, mediante `PLAYWRIGHT_MODULE` y `VERIFY_OUTPUT`.

## Gasto por periodo

«Desglose e historial de gasto» es un único desplegable que permite consultar un día, una semana de lunes a domingo, un mes o un rango personalizado. Muestra el gasto del periodo, lo gastado antes desde el inicio de la pauta, el acumulado, el saldo histórico y el disponible hasta hoy. Cada plataforma incluye presupuesto y detalle por fecha, con los días anteriores identificados. Los periodos se limitan a las fechas del offering y a hoy; los excesos se muestran como presupuesto excedido, no como dinero disponible negativo.

El inicio de la pauta corresponde al inicio del offering. El nombre de campaña es independiente del nombre del producto; el administrador puede editarlo en el desplegable o en el paso Objetivo del formulario. Los offerings anteriores sin nombre de campaña usan el nombre del producto hasta que se les asigne uno.

`npm test` incluye las pruebas de periodos y totales. `tests/spending-browser.mjs` comprueba el desglose y que la planificación no rompa ventas ni presupuesto en 320/375/390/430 px con Playwright instalado fuera de la aplicación (`PLAYWRIGHT_MODULE` y `VERIFY_OUTPUT`).

## Firebase y backend

Proyecto Firebase creado el 4 de octubre de 2026:

- Nombre: **Gantsta**. ID: `gansta-app`.
- App web: **Gantsta Web**, ID `1:896911100017:web:85f0d8846bf4d44153b3d0`.
- Firestore: `(default)`, modo nativo Standard, región Fráncfort `europe-west3`, con protección de borrado.
- Verificado: facturación desactivada y acceso sin autenticación a Firestore rechazado con `403 PERMISSION_DENIED`.
- Consola: https://console.firebase.google.com/project/gansta-app/overview

El acceso por correo/contraseña y los dominios locales se habilitaron en la consola. Las reglas de Firestore se publicaron de forma independiente, sin desplegar el frontend o backend. La configuración local está en `.env`, excluido de Git. La credencial del servidor está fuera del repositorio y se referencia mediante `GOOGLE_APPLICATION_CREDENTIALS`; nunca debe ponerse en variables `VITE_` ni en archivos versionados. No se han importado los datos demo.

El primer administrador se dio de alta con correo verificado mediante `bootstrap-admin`; el bloqueo de inicialización ya existe y no se debe repetir el procedimiento. El backend local escucha en `http://127.0.0.1:8787`, con origen permitido `http://localhost:8000`. Se verificó la lectura autenticada del snapshot con respuesta 200, el rechazo sin token con 401 y el rechazo de origen ajeno con 403. Firestore no contiene offerings todavía: se crean desde la cuenta real o mediante una importación explícitamente autorizada. Esto confirma la conexión local, no un despliegue ni una validación completa de producción.

Una cuenta autenticada sin perfil autorizado puede verificar su correo desde la app, pero no acceder a los datos ni activarse por sí sola. El procedimiento `bootstrap-admin` sigue exigiendo una cuenta habilitada y con correo verificado. `tests/auth-gate-browser.mjs` verifica este flujo sin enviar correos reales y sin conceder permisos.

La configuración pública de la app web se obtiene mediante `firebase apps:sdkconfig WEB 1:896911100017:web:85f0d8846bf4d44153b3d0 --project gansta-app`. Para desarrollo en `http://localhost:8000/`, `APP_ORIGIN` debe ser exactamente `http://localhost:8000` y `VITE_API_URL` debe apuntar al backend, por ejemplo `http://127.0.0.1:8787`.

Copiar `.env.example` a `.env`, configurar Firebase Authentication y Firestore, y proporcionar credenciales ADC al servidor fuera del repositorio. Ajustar `APP_ORIGIN` al origen exacto del frontend y `VITE_API_URL` a la URL del backend.

```sh
npm run server
npm run bootstrap-admin -- UID
```

El bootstrap requiere un usuario real habilitado y con correo verificado. La configuración de Firebase Hosting sirve el frontend; el servidor Node necesita alojamiento separado. Nunca incluir credenciales de servicio en variables `VITE_`.

## Estado y contexto

Primera implementación en desarrollo. La conexión a Firebase real, los correos y el flujo completo de invitaciones aún requieren configuración y validación. Hay pendientes conocidos; no se presenta como una versión lista para producción.

Consultar [CONTEXTO_PROYECTO.md](CONTEXTO_PROYECTO.md) para requisitos, decisiones de interfaz, arquitectura, mapa de archivos y pendientes concretos.
