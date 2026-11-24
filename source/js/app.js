/* =========================================================
   Arranque: actualización automática de la pantalla.
   Las secciones se registran solas (formulario.js, horario.js,
   citas.js); aquí solo se avisa cuándo volver a pintar.
   ========================================================= */
(() => {
    // HU #07: la pantalla se actualiza sola en un máximo de 5 minutos.
    const INTERVALO_MS = 5 * 60 * 1000;

    const refrescar = () => Utils.emitir('reservas:cambiaron');

    setInterval(refrescar, INTERVALO_MS);

    // Al volver a la pestaña después de un rato, refrescar enseguida.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refrescar();
    });

    // Cambios hechos en otra pestaña del mismo navegador.
    window.addEventListener('storage', (e) => {
        if (e.key === null || e.key.startsWith('serena.')) refrescar();
    });
})();
