/* =========================================================
   Arranque: sesión del usuario y actualización automática.
   Las secciones se registran solas (formulario.js, horario.js,
   citas.js, detalle.js); aquí solo se avisa cuándo volver a pintar.
   ========================================================= */
(() => {
    const { mostrarAviso, emitir } = Utils;

    /* ---------- Sesión ---------- */

    const ROLES = { admin: 'Administradora', recepcionista: 'Recepción' };

    async function cargarSesion() {
        try {
            const usuario = await ReservasAPI.sesionActual();
            document.getElementById('user-name').textContent = usuario.nombre;
            document.getElementById('user-role').textContent = ROLES[usuario.rol] || usuario.rol;
            document.getElementById('user-chip').hidden = false;
            document.getElementById('logout-btn').hidden = false;
            // El CSS usa esta clase para mostrar u ocultar acciones según el rol.
            document.body.classList.add(`rol-${usuario.rol}`);
        } catch (error) {
            if (error.codigo === 'SIN_SESION') location.href = 'login.html';
            else mostrarAviso(error.message, 'error');
        }
    }

    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await ReservasAPI.cerrarSesion();
        } finally {
            location.href = 'login.html';
        }
    });

    /* ---------- Actualización automática ---------- */

    // HU #07: la pantalla se actualiza sola en un máximo de 5 minutos.
    const INTERVALO_MS = 5 * 60 * 1000;
    const refrescar = () => emitir('reservas:cambiaron');

    setInterval(refrescar, INTERVALO_MS);

    // Al volver a la pestaña después de un rato, refrescar enseguida.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refrescar();
    });

    // Si falla una carga de datos (p. ej. el servidor está apagado), avisar en pantalla (HU #07).
    let ultimoAviso = 0;
    window.addEventListener('unhandledrejection', (evento) => {
        const error = evento.reason;
        if (!(error instanceof ReservasAPI.ErrorReserva) || error.codigo === 'SIN_SESION') return;
        evento.preventDefault();
        // Varias secciones fallan a la vez: un solo aviso.
        if (Date.now() - ultimoAviso > 2000) {
            ultimoAviso = Date.now();
            mostrarAviso(error.message, 'error');
        }
    });

    cargarSesion();
})();
