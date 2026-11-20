# Serena – Sistema de agendamiento

Sistema web de agendamiento de citas para **Serena Centro Estético**.

## Estado actual

- Proyecto frontend estático: HTML + CSS puro, sin frameworks ni JavaScript todavía.
- Archivos:
  - `source/index.html` – página principal.
  - `source/style.css` – estilos globales (variables en `:root`).
- La página tiene cuatro bloques:
  1. **Header** con logo (🌸 Serena) y navegación (botón "Inicio").
  2. **Formulario "Nueva reserva"**: nombre del cliente, teléfono, servicio, profesional encargada, fecha y hora.
  3. **Tarjeta "Horario del día"** (`#day-schedule`): franjas de una hora (9:00 AM – 06:00 PM, sin la de 12:00 por almuerzo) marcadas como "Hora disponible".
  4. Sección `#scheduled-appointments` (citas agendadas) creada pero vacía.

## Datos del negocio (conocidos hasta ahora)

- **Servicios:** Manicure, Pedicure, Manicure & Pedicure, Pestañas, Masaje, Limpieza facial, Depilación, Maquillaje, Micropigmentación.
- **Profesionales:** Ximena, Maria.
- **Horario de atención (deducido de la tarjeta, por confirmar):** franjas de 9:00 AM a 6:00 PM, sin la de 12:00 (posible almuerzo).

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

- [ ] Documentar requisitos funcionales y no funcionales (el usuario los tiene en otro equipo).
- [ ] Definir roles de usuario (¿quién agenda: recepción, clienta o ambas?).
- [ ] Construir la sección de citas agendadas.
- [ ] Agregar lógica (JavaScript / backend) para guardar reservas y marcar horas ocupadas.
- [ ] Corregir los `value=""` vacíos en el select de profesionales del formulario.
- [ ] Calcular dinámicamente el contador "9 disponibles" y la fecha de la tarjeta del horario.
