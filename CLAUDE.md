# Serena – Sistema de agendamiento

Sistema web de agendamiento de citas para **Serena Centro Estético**. Corre en el equipo de recepción
(app web local); cómo instalar y ejecutar está en `README.md`.

## Arquitectura

- **Servidor** (`server/`): Node.js ≥ 22.13 + Express 5 + SQLite con el módulo nativo `node:sqlite` (sin dependencias nativas). CommonJS.
  - `config.js` – **única fuente** de horario (`HORAS`), `SERVICIOS`, `PROFESIONALES` y ajustes (puerto, host, ruta BD, sesión, intentos de login). El navegador la recibe como `window.SERENA_CONFIG` en `GET /config.js`.
  - `db.js` – abre `data/serena.db`, PRAGMAs (WAL, `synchronous=FULL`, foreign keys) y migraciones por `PRAGMA user_version` (agregar migraciones nuevas al final del arreglo, nunca editar las aplicadas).
  - `reservas.js` – reglas de negocio; el servidor es la autoridad (valida todo, no confía en el navegador).
  - `auth.js` – usuarios (scrypt), sesiones (token en cookie HttpOnly + SameSite=Strict; en BD solo el hash), bloqueo tras 5 intentos fallidos por IP, `requiereSesion` y `requiereRol`.
  - `app.js` – rutas; `crearApp(db)` separado de `index.js` para probar sin abrir puerto.
  - `scripts/crear-usuario.js` – `npm run crear-usuario`; `scripts/cambiar-clave.js` – `npm run cambiar-clave` (lista usuarios, cambia la contraseña y cierra sus sesiones). Ambos usan `scripts/consola.js` (preguntas por consola, contraseña oculta).
  - `test/api.test.js` – `npm test` (node:test, BD en memoria).
- **API** (todas bajo `/api`, JSON; errores como `{ codigo, mensaje }`):
  - `POST/GET/DELETE /sesion` (ingresar / usuario actual / salir).
  - `GET /reservas?fecha=` (día) · `GET /reservas?estado=agendada` (pendientes) · `GET /reservas/ocupadas?fecha&profesional&excluir` · `GET /reservas/:id`.
  - `POST /reservas` · `PATCH /reservas/:id` · `POST /reservas/:id/cancelar` · `POST /reservas/:id/atender` · `DELETE /reservas/:id` (solo admin).
  - Las peticiones que cambian datos deben llevar la cabecera `X-Serena: 1` (protección CSRF).
  - Códigos: `DATOS_INVALIDOS` 400, `SIN_SESION`/`CREDENCIALES` 401, `NO_AUTORIZADO` 403, `NO_EXISTE` 404, `HORA_OCUPADA`/`NO_EDITABLE` 409, `DEMASIADOS_INTENTOS` 429.
- **Página** (`source/`): HTML + CSS + JavaScript puro, sin frameworks ni módulos ES. Express la sirve como archivos estáticos.
  - `index.html` (app) y `login.html` (ingreso). Orden de scripts: `config.js` → `api.js` → `utils.js` → secciones → `app.js`.
  - `js/api.js` – `ReservasAPI`: única capa que habla con el servidor (`fetch`). Un 401 redirige a `login.html`; sin red lanza `SIN_CONEXION`.
  - `js/utils.js` – `Utils`: fechas/horas, catálogos (llena los `<select>` de servicio y profesional desde `SERENA_CONFIG`), `llenarHoras`, `confirmar` (segunda confirmación), aviso (toast), `el()` para crear nodos con `textContent` (nunca `innerHTML` con datos de clientas) y eventos entre secciones.
  - `js/formulario.js` – formulario "Nueva reserva": validación, horas disponibles, prellenado desde el horario.
  - `js/horario.js` – "Horario del día": navegación entre días, reservas por hora (atendidas con etiqueta), cupos libres; clic en hora libre prellena el formulario, clic en reserva abre el detalle.
  - `js/citas.js` – "Citas agendadas": pendientes; las vencidas sin cerrar salen primero con etiqueta "Por cerrar".
  - `js/detalle.js` – diálogo de la cita: ver, editar, marcar atendida, cancelar y borrar.
  - `js/app.js` – sesión (nombre/rol en el header, clase `rol-<rol>` en `<body>`, botón Salir), refresco automático cada 5 min y aviso si falla una carga.
  - `js/login.js` – página de ingreso.
- Las secciones se comunican con eventos en `document` (`Utils.emitir/escuchar`): `reservas:cambiaron`, `reserva:prellenar`, `reserva:abrir`, `horario:ir-a`.

## Reglas de negocio

- Una hora queda ocupada **por profesional** (Ximena y María pueden atender a la misma hora). Garantizado también por un índice único parcial en SQLite (`reservas_sin_cruce`).
- Estados: `agendada` → `atendida` (solo desde el día de la cita) o `cancelada` (queda en historial y libera la hora). Solo las `agendada` se editan. Borrar es definitivo y solo para `admin`.
- No se agenda ni se reagenda a una hora que ya pasó.
- Roles: `recepcionista` (agenda, edita, cancela, atiende) y `admin` (además borra). La UI oculta "Borrar" con CSS (`body:not(.rol-admin)`), pero quien decide es el servidor.
- Cancelar y borrar piden segunda confirmación; editar avisa que se reemplazan los datos (HU #06).

## Detalles técnicos a recordar

- El aviso (toast) es un `popover` para verse por encima de los `<dialog>` abiertos.
- El evento `close` de `<dialog>` llega con retraso: no limpiar estado en él si el diálogo ya se reabrió.
- La Content-Security-Policy no permite scripts ni estilos en línea: todo JS/CSS va en archivos.
- `node:sqlite` emite un ExperimentalWarning en Node 22; los scripts de npm lo silencian con `--disable-warning=ExperimentalWarning`.

## Requerimientos (resumen de `Documentation/Documento con Especificación de Requerimientos.pdf`)

`Documentation/` está en `.gitignore`: el PDF solo existe en el equipo del usuario.

**Funcionales**
- RF1 Registrar reserva: nombre y teléfono de la clienta, servicio, fecha, hora y profesional asignada. ✅
- RF2 Mostrar por día las horas reservadas y con qué servicio; ver reservas pasadas. ✅
- RF4 Modificar reservas: editar, cancelar (doble confirmación; la hora queda libre) y borrar. ✅
- RF5 Cerrar el servicio (marcar la cita como atendida). ✅
- RF6 Sin dobles reservas; avisar antes de reemplazar datos; bloquear a usuarios no autorizados. ✅
- Mensajes: "se guardó con éxito" y aviso de error si no se puede guardar o conectar con el servidor. ✅

**Descartado por decisión del usuario (2026-11-23):** recordatorios y encuesta por WhatsApp (RF3 y encuesta de RF5) y sincronización con Google Calendar. El sistema no necesita internet.

**No funcionales**
- Refresco automático (HU dice cada 10 min; HU #07 dice ≤ 5 min): se usa 5 min. Un registro nuevo se ve de inmediato y el refresco no borra lo que se está escribiendo. ✅
- Interfaz intuitiva, procesos cortos, usable en el celular.
- Capacidad mínima: 1000 clientas. Aplicación ligera.
- Datos protegidos, cifrados (en tránsito y en reposo) y respaldados, sin pérdidas ante cortes de energía.
- Windows, portátil o de mesa, idealmente portable; base de datos local en el equipo de recepción.

## Datos del negocio

- **Servicios** y **profesionales** (Ximena, María): en `server/config.js`.
- **Horario de atención (por confirmar con el negocio):** franjas de 9:00 AM a 6:00 PM, sin la de 12:00 (almuerzo).

## Guía de estilo

- La tarjeta **"Horario del día"** es la referencia visual: tarjetas con bordes redondeados (~24px), sombras suaves y difusas,
  encabezados con icono en badge (`.section-header`), bloques interactivos con hover (borde sólido, leve desplazamiento, sombra).
- **Paleta beige y blanco** (variables en `:root` de `style.css`): café caramelo `--primary-color: #8b6b4e`, beige arena `--secondary-color`,
  beige claro `--accent-soft`, fondo crema `--background-color`, tarjetas `--surface`, texto `--text-color` / `--text-muted`.
  Estados: `--error-*` (terracota), `--success-*` (verde oliva, atendida), `--warning-*` (ámbar, por cerrar).
- Usar siempre las variables CSS de `:root` en lugar de colores fijos. Botones genéricos: `.btn`, `.btn--primary`, `.btn--danger`, `.btn--danger-outline`, `.btn--link-danger`.
- Debe verse bien en celular (media queries a 600px y 480px).
- Idioma de la interfaz y del código: español.

## Pendiente

- [ ] Paso 5: cifrado de la base de datos en reposo, respaldos automáticos y recuperación.
- [ ] HTTPS si se abre a la red local (`HOST=0.0.0.0`), para no enviar contraseñas sin cifrar por el wifi.
- [ ] Gestión de usuarios desde la página (hoy solo por consola) y cambio de contraseña.
- [ ] Confirmar con el negocio el horario de atención y el contador por cupos (9 horas × 2 profesionales).
- [ ] Empaquetar como app portable para Windows (requisito "idealmente portable").
