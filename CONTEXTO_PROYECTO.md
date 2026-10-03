# Gantsta — Contexto completo para continuar el desarrollo

Actualizado: 3 de octubre de 2026. Idioma del producto y de la colaboración: español.

### Actualización de entrega al repositorio

El usuario autorizó subir el proyecto a https://github.com/elektrorate/gansta (el repositorio se escribe **gansta**, mientras que la aplicación conserva el nombre **Gantsta**). Se preparó la aplicación en la raíz del repositorio, rama `main`, con README, código, pruebas y este documento. Se volvieron a ejecutar satisfactoriamente las diez pruebas y la compilación el 3 de octubre de 2026; persiste la advertencia de tamaño del bundle. Se excluyen dependencias instaladas, compilados y credenciales. Los apartados posteriores sobre ausencia de publicación describen el estado anterior a esta entrega. La subida a GitHub no es un despliegue de la aplicación ni activa Firebase.

Este documento consolida las decisiones de la conversación, el estado del código y los pendientes. Es una memoria portable para otro editor o asistente; no es una transcripción literal. Las decisiones definitivas de este documento sustituyen las propuestas antiguas que se contradigan con ellas. El estado descrito corresponde a esta fecha: comprobar el código antes de continuar.

## 1. Objetivo y decisión principal

Construir **Gantsta desde cero**, una aplicación exclusivamente móvil para gestionar campañas publicitarias online de productos, clases y experiencias. El núcleo es seguir el cumplimiento de ventas: objetivo, cierres conseguidos, consultas recibidas y gasto publicitario a lo largo del tiempo.

El repositorio https://github.com/elektrorate/gantmk fue una referencia inicial. Posteriormente el usuario pidió expresamente crear una aplicación nueva desde cero. No asumir que hay que clonar, modificar o conservar la arquitectura de aquel repositorio.

Nombre definitivo del proyecto: **gantsta**. El detalle de producto se llama **Offering**, no Overview.

## 2. Ubicación y portabilidad

Carpeta de la aplicación:

```text
C:\Users\34645\Documents\Codex\2026-10-01\https-github-com-elektrorate-gantmk-https\outputs\gantsta
```

Abrir esta carpeta como raíz en el nuevo editor. Las rutas de código mencionadas a continuación son relativas a ella. Para trasladarla a otro ordenador, copiar el proyecto y sus archivos de bloqueo; no hacen falta `node_modules` ni `dist`. No compartir archivos `.env` con credenciales ni claves de servicio.

Este archivo permite recuperar el contexto. Para ejecutar o modificar la aplicación también hace falta el código, no solo este Markdown.

## 3. Principios de interfaz acordados

- Diseño pensado exclusivamente para teléfono, vertical y táctil; referencia de 360–430 px.
- No convertirlo en un dashboard de escritorio con tablas anchas.
- Jerarquía clara, tarjetas, botones cómodos y navegación sencilla.
- Calendario completo del periodo seleccionado, con opciones Semana y Mes.
- Datos comerciales coherentes entre Dashboard, Offering, calendario y evolución de ventas.
- Distinguir el avance de ventas del avance de tareas. Son medidas diferentes.
- Interfaz y cantidades en español; euros para precio y presupuesto.
- Los nombres, importes, responsables y datos iniciales son ejemplos de demostración, no datos reales del negocio.

## 4. Dashboard

Mostrar el listado de offerings dividido en cuatro categorías:

1. Experiencias.
2. Cursos.
3. Workshops.
4. Giftcard.

Las pestañas evitan un listado demasiado largo. Incorporar búsqueda y filtros por periodo y avance. Conservar filtros y categoría al regresar del detalle.

Cada tarjeta muestra nombre del producto, precio, cierres conseguidos frente al objetivo, porcentaje y barra de color. **Al tocarla se abre directamente el detalle completo de Offering**, no un resumen intermedio.

Escala de avance acordada:

| Cumplimiento del objetivo | Color |
| --- | --- |
| 0 % | Gris |
| 1–49 % | Naranja |
| 50–79 % | Amarillo |
| 80–99 % | Azul |
| 100 % o más | Verde |

El porcentaje representa ventas conseguidas / objetivo. El color no indica automáticamente si la campaña va adelantada o retrasada respecto al tiempo. Los objetivos superados pueden mostrar más del 100 %; la barra visual puede limitarse al ancho disponible.

## 5. Offering: detalle del producto

Ejemplo de referencia: **Clases regulares · 90 € por inscripción · objetivo de 20 inscripciones**.

Contenido:

1. Nombre y precio del producto.
2. Objetivo y cierres conseguidos, con porcentaje.
3. Gráfico **Cumplimiento de ventas**, visible directamente.
4. Presupuesto asignado, gastado y disponible; desglose por plataforma.
5. Consultas y cerrados, con periodo identificado.
6. Botón **Ver planificación** hacia una pantalla independiente.
7. Calendario Semana / Mes, navegación de fechas y detalle del día seleccionado.

Los totales del objetivo corresponden al periodo completo del offering. Los datos del calendario corresponden al periodo seleccionado. Indicar las fechas para que no se confundan.

### Exclusiones expresas del usuario

- No llamar Overview a esta sección.
- No añadir el botón «+ Registrar actividad» en Offering.
- No mostrar bloques de conversión porcentual, coste por consulta o coste por inscripción.
- No mostrar «Ingresos y proyección», «Valor de 8 cierres: 720 €» ni «Valor del objetivo: 1.800 €» con la arquitectura rechazada.
- Mantener el precio del producto. No reintroducir proyecciones económicas sin acordar antes una presentación nueva.

## 6. Cumplimiento de ventas: núcleo de la app

El usuario lo describió como un Gantt de ventas. La solución definida es un **gráfico temporal de ventas acumuladas reales frente a previstas**, separado del Gantt de tareas.

- Nombre visible: **Cumplimiento de ventas**.
- Ubicación: dentro del Offering, sin necesitar otra pantalla.
- Eje temporal según el periodo del offering.
- Comparar metas acumuladas intermedias con cierres acumulados registrados.
- No dibujar ventas reales futuras como ceros.
- No fijar todos los proyectos a cuatro semanas.
- Las metas intermedias deben poder editarse; un reparto lineal inicial es solo una ayuda.
- No confundir número de cierres con ingresos cobrados.

## 7. Planificación: pantalla independiente

Recorrido: **Dashboard → Offering → Ver planificación → Planificación → volver al Offering**.

Mostrar exactamente cuatro hitos en una línea horizontal:

```text
Inicio ───── Material ───── Revisión ───── Objetivo
```

No sustituir Revisión por Publicar ni Objetivo por Cierre. No añadir un quinto marcador. Evitar etiquetas partidas que parezcan hitos extra.

Debajo se muestran tareas con nombre, hito, estado, responsable, fechas, duración y cumplimiento. Las barras de duración no representan el porcentaje de tarea completada.

Ejemplo de cinco tareas usado en el diseño:

| Tarea | Responsable | Estado de ejemplo |
| --- | --- | --- |
| Definir objetivo | Ana | Completada |
| Diseñar anuncios | Carlos | Completada |
| Configurar campaña | Laura | En proceso |
| Revisar resultados | Laura | Pendiente |
| Preparar informe | Ana | Pendiente |

La implementación inicial calcula cumplimiento mediante subtareas marcadas. Permite bloquear tareas y filtrar por hito. El resumen de tareas completadas debe distinguirse de su progreso parcial y de las ventas.

### Carpeta de Google Drive

- Cada offering puede tener una carpeta vinculada, visible en Planificación.
- Sin vínculo: «Vincular carpeta». Con vínculo: abrir y cambiar carpeta.
- Guardar el enlace por offering; validar HTTPS y dominio exacto `drive.google.com` con ruta de carpeta.
- Es un enlace a materiales. No supone sincronización, importación ni acceso automático a archivos.
- No hay carpeta real del negocio proporcionada.

## 8. Creación de un offering

Asistente móvil en tres pasos: **Producto → Objetivo → Equipo**.

Campos de la implementación inicial:

- Nombre, categoría y descripción.
- Precio y modalidad: por inscripción, mensual o por unidad.
- Inicio y fin del periodo.
- Objetivo numérico y nombre de la unidad, por ejemplo inscripciones.
- Metas semanales acumuladas editables, adaptadas a la duración real.
- Responsable y miembros del equipo.
- Fechas de los cuatro hitos.
- Carpeta de Drive opcional.

### Presupuesto por plataforma: decisión confirmada

Presupuesto debe desplegar su desglose. Plataformas iniciales: **Meta, Google y TikTok**.

Cada plataforma puede activarse y recibir un importe para el periodo. El total se calcula sumando solo las plataformas activas. Mostrar también el desglose en el resumen. Ejemplo: Meta 150 €, Google 100 €, TikTok 50 € → total 300 €.

No hay integración automática con las APIs publicitarias. Asignación de presupuesto y gasto real son conceptos separados.

## 9. Administración y autenticación

Plan aprobado: login general con Firebase Authentication y datos en Firestore.

- Correo y contraseña, recuperación de contraseña y cierre de sesión.
- Sin formulario de registro público.
- El administrador crea una invitación con nombre, correo y rol.
- Acceso efectivo requiere perfil autorizado, correo verificado y estado activo.
- Primer administrador mediante procedimiento controlado; siguientes usuarios desde Administración.
- Desactivar un usuario bloquea su acceso conservando historial.
- Operaciones privilegiadas en backend con Firebase Admin SDK, nunca confiando solo en botones ocultos.

| Capacidad | Administrador | Colaborador |
| --- | --- | --- |
| Consultar offerings | Todos | Solo asignados |
| Consultar ventas y presupuestos | Sí | De offerings asignados |
| Crear/editar producto, metas y presupuesto | Sí | No |
| Gestionar usuarios y asignaciones | Sí | No |
| Gestionar tareas | Sí | Actualizar cumplimiento de tareas propias |
| Introducir resultados diarios | Sí, decisión inicial de implementación | No por ahora |

### Flujo implementado, pendiente de validar con Firebase real

Backend crea usuario y perfil invitado. El cliente solicita correo para establecer contraseña mediante recuperación de Firebase. El usuario inicia sesión, verifica su correo y activa su invitación. El servidor comprueba caducidad de siete días y estado de cuenta.

Este flujo concreto es una solución técnica inicial. No afirmar que los correos o la activación ya funcionan en producción: falta configuración y pruebas reales.

### Registro de resultados: decisión provisional de implementación

Se ha ubicado en **Administración → Resultados diarios**, respetando el rechazo al botón de actividad dentro de Offering. Registrar por offering, día y plataforma: consultas, cierres y gasto.

Un registro del mismo día y plataforma se reemplaza al editarlo, evitando sumarlo dos veces. La ubicación y el permiso exclusivo de administrador deben validarse con el usuario durante la revisión funcional; no presentarlos como requisito expresamente confirmado.

## 10. Arquitectura actual

Aplicación nueva con React 19, TypeScript 6 y Vite 8. Firebase Web SDK 12 y Firebase Admin SDK 13. Backend HTTP de Node.js, con Node **24 o superior** como referencia del proyecto.

- Navegación cliente mediante hash.
- Estilos propios, ancho móvil máximo de aproximadamente 430 px.
- Importes almacenados en céntimos enteros.
- Fechas de calendario como `YYYY-MM-DD`.
- Validadores compartidos entre cliente y servidor.
- Backend verifica token y permisos; escrituras privilegiadas con Admin SDK.
- Reglas Firestore deniegan escrituras directas del cliente.
- Firebase Hosting configurado para el frontend; el backend necesita alojamiento separado.
- No se ha implementado una integración con Meta, Google Ads, TikTok ni sincronización de Drive.

### Mapa de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/main.tsx` | Arranque, rutas, navegación y protección de pantallas |
| `src/Auth.tsx` | Login, recuperación y validación de acceso |
| `src/Dashboard.tsx` | Categorías, búsqueda, filtros y tarjetas |
| `src/Offering.tsx` | Detalle, gráfico de ventas, presupuesto y calendario |
| `src/OfferingForm.tsx` | Creación y edición en tres pasos |
| `src/Planning.tsx` | Hitos, tareas, responsables, subtareas y Drive |
| `src/Admin.tsx` | Administración, usuarios y resultados diarios |
| `src/store.tsx` | Estado, carga de datos, demo y mutaciones |
| `src/firebase.ts` | Configuración Firebase y llamadas autenticadas a API |
| `src/data.ts` | Datos ficticios y valores iniciales |
| `src/ui.tsx`, `src/styles.css` | Componentes y estilos compartidos |
| `shared/model.ts` | Tipos de datos |
| `shared/domain.ts` | Fechas, importes, metas, validación y permisos de dominio |
| `server/index.mjs` | API HTTP autenticada |
| `server/permissions.mjs` | Reglas de autorización del servidor |
| `server/bootstrap.mjs` | Alta controlada del primer administrador |
| `firestore.rules` | Reglas de acceso directo a Firestore |
| `firebase.json` | Configuración de reglas y hosting estático |
| `tests/domain.test.mjs` | Pruebas de dominio y autorización |
| `.env.example` | Variables necesarias, sin credenciales reales |

### Modelo de datos

- `Profile`: identificador, nombre, correo, rol admin/collaborator y estado invited/active/disabled.
- `Offering`: nombre, categoría, precio, modalidad, descripción, periodo, objetivo, unidad, presupuestos por plataforma, plataformas activas, metas acumuladas, responsable, miembros, fechas de hitos y enlace Drive.
- `Entry`: fecha, plataforma, consultas, cerrados y gasto. Identificador por fecha/plataforma dentro de cada offering.
- `Task`: título, índice de hito, responsable, fechas, bloqueo y subtareas con estado completado.
- `Bundle`: conjunto cargado de offerings, tareas, registros y perfiles visibles.

API principal: `/health`, `/api/snapshot`, `/api/activate`, `/api/users`, `/api/users/:id`, `/api/users/:id/resend`, `/api/offerings/:id` y sus registros/tareas. Consultar `server/index.mjs` para métodos y contratos exactos.

## 11. Demo y datos reales

La demo requiere entrada explícita mediante «Probar la aplicación con datos de ejemplo». Guarda cambios localmente en el navegador mediante `localStorage`; los filtros usan `sessionStorage`.

Los datos de demo incluyen varias categorías y usuarios ficticios. Permiten revisar visualmente roles y flujos, pero no prueban la seguridad de Firebase. No se envían correos reales en demo.

Nunca sustituir un error de Firebase por datos ficticios sin avisar. Demo y acceso real deben permanecer claramente separados. El almacenamiento de demo no es una base multiusuario ni se sincroniza entre dispositivos.

## 12. Ejecutar desde otro editor

En la raíz `gantsta`, con Node 24 o superior:

```powershell
npm.cmd ci
npm.cmd --prefix server ci
npm.cmd run dev -- --port 5187
```

Abrir `http://127.0.0.1:5187/`. El puerto es una sugerencia: comprobar disponibilidad. Una sesión anterior usó ese puerto, pero no se garantiza que el servidor siga ejecutándose.

Para comprobar el código:

```powershell
npm.cmd test
npm.cmd run build
```

Para demo basta el frontend. Para datos reales:

1. Copiar `.env.example` a `.env` y completar la configuración pública del proyecto Firebase.
2. Habilitar correo/contraseña en Firebase Authentication y configurar dominios autorizados.
3. Configurar Firestore, revisar y publicar sus reglas en el proyecto correcto.
4. Proporcionar credenciales ADC al backend fuera del repositorio.
5. Hacer coincidir `APP_ORIGIN` con el origen exacto del frontend, por ejemplo `http://127.0.0.1:5187`.
6. Configurar `VITE_API_URL`, por ejemplo `http://127.0.0.1:8787`, y `GOOGLE_CLOUD_PROJECT`.
7. Arrancar el backend con `npm.cmd run server` en otra terminal.
8. Crear y verificar realmente el usuario inicial de Firebase Authentication y ejecutar `npm.cmd run bootstrap-admin -- UID` con su UID. El script exige usuario verificado y habilitado, y tiene bloqueo de inicialización única.

Variables de referencia: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_API_URL`, `VITE_ENABLE_DEMO`, `GOOGLE_CLOUD_PROJECT`, `APP_ORIGIN`, `PORT`.

No poner credenciales de servicio en variables `VITE_`: se incorporan al cliente. No publicar sin revisar entorno, origen permitido, reglas, roles y flujo de invitación.

En el entorno original las dependencias se instalaron con una caché offline auxiliar por restricciones de red. Esa caché está fuera de la app y no forma parte de su arquitectura; en otro equipo con acceso a npm se usan los comandos normales anteriores.

## 13. Estado comprobado y límites de la validación

Estado registrado en la sesión de desarrollo anterior a este documento:

- Código de todas las pantallas principales creado.
- Compilación de TypeScript y Vite superada.
- Diez pruebas automatizadas de dominio y autorización superadas.
- Se abrió la demo en navegador con viewport de 390 × 844.
- Se revisaron visualmente Dashboard y detalle de Offering, con navegación directa correcta.
- Dashboard mostraba ejemplos 8/20 (40 %), 15/20 (75 %) y 17/20 (85 %).
- Hubo una advertencia de tamaño del bundle, no un error de compilación.

Estas son verificaciones históricas, no ejecutadas de nuevo al escribir este documento. No equivalen a una verificación completa de toda la aplicación.

**Pendiente:** pruebas completas en navegador de creación/edición, resultados y su persistencia, planificación, usuarios y distintos tamaños móviles. No se ha conectado un proyecto Firebase real ni validado extremo a extremo su login, envío de correos, invitaciones o permisos mediante emuladores. No se ha desplegado ni publicado el proyecto nuevo en GitHub.

## 14. Pendientes concretos para continuar

1. Corregir el reenvío de invitaciones: en `src/Admin.tsx` actualmente se envía el correo, pero falta llamar al endpoint de reenvío para renovar la caducidad. El endpoint existe en el backend.
2. Revisar paridad de validación entre demo y servidor al editar un offering: comprobar tareas/registros ya existentes, cambios de periodo, plataformas y miembros activos.
3. Completar prueba móvil: crear offering con Meta/Google/TikTok, revisar suma, guardar resultados, editar el mismo día/plataforma y comprobar que no duplica; recargar y comprobar persistencia.
4. Probar tareas, subtareas, bloqueo, responsables, cuatro hitos y enlace Drive.
5. Probar acceso por rol, offering ajeno, cuenta desactivada, correo sin verificar e invitación caducada con Firebase/emuladores.
6. Revisar 360–430 px, errores de consola, legibilidad y ausencia de desbordamiento.
7. Añadir README técnico de instalación y despliegue, y formatear el código para facilitar mantenimiento. Este documento aporta contexto, pero no sustituye la validación del procedimiento de producción.
8. Configurar Firebase real cuando se disponga del proyecto y acceso necesarios. No simular esta conexión ni declararla terminada.
9. Confirmar con el usuario el flujo de Resultados diarios y cualquier futura proyección económica.

No hay autorización nueva implícita para enviar correos a personas, contratar servicios, desplegar en producción ni publicar repositorios por el mero hecho de leer este documento.

## 15. Referencias históricas

Memoria antigua: `../memoria-proyecto-gantmk.md`. Contiene decisiones y estados anteriores; no usar sus pendientes de prototipado como estado actual del código.

Prototipos originales en el equipo de origen:

```text
C:/Users/34645/.codex/visualizations/2026/10/01/01a0f75c-82f2-7290-9ea6-9ec3f170eb90/
  dashboard-mobile.html
  offering-mobile.html
  planificacion-mobile.html
  crear-offering-mobile.html
```

Son referencias históricas externas, no dependencias de ejecución. Algunos prototipos antiguos abrían Planificación como panel o volvían a un Offering resumido: esos comportamientos fueron rechazados. La especificación vigente requiere pantallas independientes y detalle completo.

La petición de guardar memoria se materializa en documentos locales. No implica memoria global de ChatGPT ni confirma que un chat se haya movido a un proyecto de la aplicación.

## 16. Texto para iniciar trabajo en otro editor

> Lee CONTEXTO_PROYECTO.md y revisa el código de esta carpeta. Estamos construyendo Gantsta desde cero, exclusivamente para móvil, en español. Respeta las decisiones de Dashboard, Offering, Cumplimiento de ventas, Planificación con cuatro hitos y presupuesto por Meta/Google/TikTok. Continúa desde el código existente sin reiniciarlo ni reintroducir los bloques rechazados. Distingue lo implementado, lo probado y lo pendiente; comienza por los pendientes concretos y la verificación móvil. No afirmes que Firebase real funciona hasta configurarlo y comprobarlo.
