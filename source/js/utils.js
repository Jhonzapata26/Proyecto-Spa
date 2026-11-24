/* =========================================================
   Utilidades compartidas y eventos entre secciones.
   ========================================================= */
const Utils = (() => {
    // Fecha local en formato YYYY-MM-DD (toISOString usaría UTC y podría cambiar el día).
    function fechaLocal(fecha = new Date()) {
        const a = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${a}-${m}-${d}`;
    }

    function aDate(fecha, hora = '00:00') {
        const [a, m, d] = fecha.split('-').map(Number);
        const [h, min] = hora.split(':').map(Number);
        return new Date(a, m - 1, d, h, min);
    }

    function sumarDias(fecha, dias) {
        const f = aDate(fecha);
        f.setDate(f.getDate() + dias);
        return fechaLocal(f);
    }

    // "13:00" -> "1:00 PM"
    function formatoHora(hora) {
        const [h, min] = hora.split(':').map(Number);
        const sufijo = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${sufijo}`;
    }

    // "2026-11-23" -> "Lunes 23 de noviembre de 2026"
    function formatoFechaLarga(fecha) {
        const texto = aDate(fecha).toLocaleDateString('es-CO', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        }).replace(',', '');
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    // "2026-11-23" -> { dia: "23", mes: "nov", semana: "lun" }
    function partesFecha(fecha) {
        const f = aDate(fecha);
        const corto = (opciones) => f.toLocaleDateString('es-CO', opciones).replace('.', '');
        return { dia: String(f.getDate()), mes: corto({ month: 'short' }), semana: corto({ weekday: 'short' }) };
    }

    function yaPaso(fecha, hora) {
        return aDate(fecha, hora) <= new Date();
    }

    /* ---------- Catálogos (se leen del formulario para no duplicarlos) ---------- */

    function opcionesDe(idSelect) {
        return [...document.getElementById(idSelect).options]
            .filter((op) => op.value)
            .map((op) => ({ valor: op.value, nombre: op.textContent.trim() }));
    }

    const servicios = opcionesDe('service');
    const profesionales = opcionesDe('manager');
    const nombre = (lista, valor) => (lista.find((x) => x.valor === valor) || {}).nombre || valor;

    /* ---------- Aviso flotante ---------- */

    const aviso = document.getElementById('toast');
    let temporizadorAviso;
    function mostrarAviso(mensaje, tipo = 'ok') {
        aviso.textContent = mensaje;
        aviso.className = `toast toast--${tipo} is-visible`;
        clearTimeout(temporizadorAviso);
        temporizadorAviso = setTimeout(() => aviso.classList.remove('is-visible'), 4000);
    }

    /* ---------- Eventos entre secciones ---------- */
    // 'reservas:cambiaron'  -> hay que volver a pintar los datos
    // 'reserva:prellenar'   -> { fecha, hora, profesional } para el formulario
    // 'horario:ir-a'        -> { fecha } para la tarjeta del horario

    function emitir(nombreEvento, detalle) {
        document.dispatchEvent(new CustomEvent(nombreEvento, { detail: detalle }));
    }

    function escuchar(nombreEvento, manejador) {
        document.addEventListener(nombreEvento, (e) => manejador(e.detail || {}));
    }

    /** Crea un elemento con clase y texto (textContent: evita inyectar HTML). */
    function el(etiqueta, clase, texto) {
        const nodo = document.createElement(etiqueta);
        if (clase) nodo.className = clase;
        if (texto !== undefined) nodo.textContent = texto;
        return nodo;
    }

    return {
        fechaLocal, sumarDias, formatoHora, formatoFechaLarga, partesFecha, yaPaso,
        profesionales,
        nombreServicio: (valor) => nombre(servicios, valor),
        nombreProfesional: (valor) => nombre(profesionales, valor),
        mostrarAviso, emitir, escuchar, el,
    };
})();
