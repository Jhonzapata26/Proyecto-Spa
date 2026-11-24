# Serena – Sistema de agendamiento

Sistema web de agendamiento de citas para **Serena Centro Estético**.

## Estado actual

- Frontend HTML + CSS + JavaScript puro (sin frameworks, sin módulos ES para que funcione abriendo el archivo directo).
- Archivos:
  - `source/index.html` – página principal.
  - `source/style.css` – estilos globales (variables en `:root`).
  - `source/js/api.js` – capa de datos (`ReservasAPI`): hoy guarda en `localStorage`; las funciones devuelven promesas para cambiarlas luego por `fetch` al backend sin tocar el resto. Define las franjas `HORAS`.
  - `source/js/utils.js` – `Utils`: fechas/horas, catálogos (servicios y profesionales se leen de los `<select>` del formulario), aviso (toast), `el()` para crear nodos con `textContent` (nunca `innerHTML` con datos de clientas) y eventos entre secciones.
  - `source/js/formulario.js` – formulario: validación, horas disponibles, prellenado desde el horario.
  - `source/js/horario.js` – tarjeta "Horario del día": navegación entre días, reservas por hora (las atendidas con etiqueta), cupos libres; clic en hora libre prellena el formulario, clic en reserva abre el detalle.
  - `source/js/citas.js` – sección "Citas agendadas": todas las citas pendientes (estado `agendada`); las que ya pasaron sin cerrarse salen primero con etiqueta "Por cerrar". Clic abre el detalle.
  - `source/js/detalle.js` – diálogo de la cita (`<dialog>`): ver, editar, marcar atendida, cancelar y borrar. Se abre con el evento `reserva:abrir`.
- Estados de una cita: `agendada` → `atendida` (cerrar servicio, solo desde el día de la cita) o `cancelada` (queda en historial y libera la hora). Solo las `agendada` se editan. Borrar elimina la cita definitivamente.
- Cancelar y borrar piden segunda confirmación (`Utils.confirmar`); editar avisa que se reemplazan los datos (HU #06).
- El aviso (toast) es un `popover` para verse por encima de los diálogos abiertos.
- Ojo: el evento `close` de `<dialog>` llega con retraso; no limpiar estado en él si el diálogo ya se reabrió.
  - `source/js/app.js` – refresco automático cada 5 min, al volver a la pestaña y con cambios de otra pestaña.
- Las secciones se comunican con eventos en `document` (`Utils.emitir/escuchar`): `reservas:cambiaron`, `reserva:prellenar`, `horario:ir-a`. Orden de scripts en `index.html`: api → utils → secciones → app.
- Regla de doble reserva: una hora queda ocupada **por profesional** (Ximena y María pueden atender a la misma hora). Las reservas canceladas no ocupan.
- La hora se elige en un `<select>` con las franjas; las ocupadas o pasadas aparecen deshabilitadas.
- La página tiene cuatro bloques:
  1. **Header** con logo (🌸 Serena) y navegación (botón "Inicio").
  2. **Formulario "Nueva reserva"**: nombre del cliente, teléfono, servicio, profesional encargada, fecha y hora.
  3. **Tarjeta "Horario del día"** (`#day-schedule`): franjas de una hora (9:00 AM – 06:00 PM, sin la de 12:00 por almuerzo) marcadas como "Hora disponible".
  4. Sección `#scheduled-appointments` (citas agendadas) creada pero vacía.

## Datos del negocio (conocidos hasta ahora)

- **Servicios:** Manicure, Pedicure, Manicure & Pedicure, Pestañas, Masaje, Limpieza facial, Depilación, Maquillaje, Micropigmentación.
- **Profesionales:** Ximena, Maria.
- **Horario de atención (deducido de la tarjeta, por confirmar):** franjas de 9:00 AM a 6:00 PM, sin la de 12:00 (posible almuerzo).

## Requerimientos (resumen de `Documentation/Documento con Especificación de Requerimientos.pdf`)

**Roles:** quien agenda es la **recepcionista** (o un colaborador); existe un **administrador** con permisos para modificar datos confirmados. La clienta no usa el sistema directamente: solo recibe mensajes por WhatsApp.

**Funcionales**
- RF1 Registrar reserva: nombre y teléfono de la clienta, servicio, fecha, hora y profesional asignada.
- RF2 Mostrar por día las horas reservadas y con qué servicio (calendario con fechas/horas disponibles).
- RF4 Modificar reservas: editar (fecha/hora), cancelar (con doble confirmación; la franja queda libre) y borrar. Se pueden ver reservas pasadas.
- RF5 Cerrar el servicio (marcar la cita como atendida).
- RF6 Impedir que se sobrescriba una cita ya agendada (sin dobles reservas). Avisar antes de reemplazar datos; bloquear a usuarios no autorizados.
- Mensajes: "se guardó con éxito" al guardar; un aviso de error si no se puede guardar o conectar con el servidor.

**Descartado por decisión del usuario (2026-11-23):** recordatorios y encuesta por WhatsApp (RF3, encuesta de RF5) y sincronización con Google Calendar. El sistema no necesita internet.

**No funcionales**
- Refrescar el calendario automáticamente (HU dice cada 10 min; HU #07 dice ≤ 5 min). Un registro nuevo se ve de inmediato. El refresco no debe interrumpir lo que el usuario está escribiendo.
- Interfaz muy intuitiva, procesos cortos, usable también en el celular.
- Capacidad mínima: 1000 clientas. Aplicación ligera y con poco uso de RAM.
- Datos protegidos, cifrados y respaldados, sin pérdidas ante cortes de energía.
- Restricciones: Windows, portátil o de mesa, idealmente portable; **base de datos local**; instalada en el equipo de recepción.

## Guía de estilo

- La tarjeta **"Horario del día"** es la referencia visual para el resto de la página:
  tarjetas con bordes redondeados (~24px), sombras suaves y difusas, encabezados con icono en badge,
  bloques interactivos con hover (borde sólido, leve desplazamiento, sombra).
- **Paleta beige y blanco** (definida en `:root` de `style.css`):
  café caramelo `--primary-color: #8b6b4e` (botones y acentos), beige arena `--secondary-color: #d8c3a5`,
  beige claro `--accent-soft: #f1e8dc`, fondo crema `--background-color: #f7f2ea`, tarjetas blancas `--surface: #ffffff`,
  texto café oscuro `--text-color: #3b3027`, texto secundario `--text-muted: #8c7b6a`.
- Formulario y horario comparten el mismo estilo de tarjeta y de encabezado (`.section-header` con icono, título y subtítulo).
- Usar siempre las variables CSS de `:root` en lugar de colores fijos.
- Debe verse bien en celular (hay media query a 480px).
- Idioma de la interfaz: español.

## Pendiente

- [x] Documentar requisitos funcionales y no funcionales (ver sección Requerimientos).
- [x] Definir roles de usuario: recepcionista y administrador.
- [ ] Confirmar arquitectura propuesta: app web local (Node.js + Express + SQLite en el equipo de recepción).
- [ ] Confirmar intervalo de refresco: se implementó 5 min (cumple la HU #07 y también la de 10 min).
- [x] Registrar reservas (localStorage) y bloquear dobles reservas.
- [x] Corregir los `value=""` vacíos en el select de profesionales del formulario.
- [x] Construir la sección de citas agendadas.
- [x] Hacer dinámica la tarjeta "Horario del día" con las reservas guardadas.
- [x] Editar, cancelar, borrar y cerrar citas.
- [ ] Backend (Node + Express + SQLite) reemplazando `api.js`.
- [x] Calcular dinámicamente el contador y la fecha de la tarjeta del horario.
