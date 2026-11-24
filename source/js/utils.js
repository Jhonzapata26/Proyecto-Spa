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

    /* ---------- Catálogos (vienen del servidor en /config.js) ---------- */

    const { SERVICIOS: servicios, PROFESIONALES: profesionales } = window.SERENA_CONFIG;

    /** Agrega las opciones del catálogo a un <select> (después de su opción vacía). */
    function llenarSelect(idSelect, lista) {
        const select = document.getElementById(idSelect);
        if (!select) return;
        for (const { valor, nombre } of lista) {
            const op = document.createElement('option');
            op.value = valor;
            op.textContent = nombre;
            select.append(op);
        }
    }

    llenarSelect('service', servicios);
    llenarSelect('manager', profesionales);
    const nombre = (lista, valor) => (lista.find((x) => x.valor === valor) || {}).nombre || valor;

    /* ---------- Aviso flotante ---------- */

    const aviso = document.getElementById('toast');
    // Como popover el aviso va en la capa superior, por encima de los diálogos abiertos.
    const usaPopover = typeof aviso.showPopover === 'function';
    let temporizadorAviso;
    function mostrarAviso(mensaje, tipo = 'ok') {
        clearTimeout(temporizadorAviso);
        aviso.textContent = mensaje;
        aviso.className = `toast toast--${tipo}`;
        if (usaPopover) {
            // Volver a abrirlo lo deja encima de un diálogo abierto después.
            if (aviso.matches(':popover-open')) aviso.hidePopover();
            aviso.showPopover();
        }
        requestAnimationFrame(() => requestAnimationFrame(() => aviso.classList.add('is-visible')));
        temporizadorAviso = setTimeout(() => {
            aviso.classList.remove('is-visible');
            if (usaPopover) temporizadorAviso = setTimeout(() => aviso.hidePopover(), 300);
        }, 4000);
    }

    /* ---------- Lista de horas de un <select> ---------- */

    function opcion(valor, texto, deshabilitada = false) {
        const op = document.createElement('option');
        op.value = valor;
        op.textContent = texto;
        op.disabled = deshabilitada;
        return op;
    }

    /**
     * Llena un <select> con las franjas del día: las ocupadas y las pasadas quedan deshabilitadas.
     * `deseada` se selecciona si está libre; `excluirId` ignora esa cita (al editarla).
     */
    async function llenarHoras(select, { fecha, profesional, deseada = '', excluirId = null }) {
        if (!fecha || !profesional) {
            select.replaceChildren(opcion('', 'Elige fecha y profesional'));
            select.disabled = true;
            return;
        }

        const ocupadas = await ReservasAPI.horasOcupadas(fecha, profesional, excluirId);
        const opciones = [opcion('', 'Seleccionar hora')];
        let libres = 0;

        for (const hora of ReservasAPI.HORAS) {
            if (ocupadas.includes(hora)) {
                opciones.push(opcion(hora, `${formatoHora(hora)} — ocupada`, true));
            } else if (yaPaso(fecha, hora)) {
                opciones.push(opcion(hora, `${formatoHora(hora)} — ya pasó`, true));
            } else {
                opciones.push(opcion(hora, formatoHora(hora)));
                libres++;
            }
        }

        if (libres === 0) opciones[0].textContent = 'Sin horas disponibles';

        select.replaceChildren(...opciones);
        select.disabled = libres === 0;
        select.value = opciones.some((op) => op.value === deseada && !op.disabled) ? deseada : '';
    }

    /* ---------- Confirmación (segunda confirmación antes de acciones delicadas) ---------- */

    const dialogoConfirmar = document.getElementById('confirm-dialog');
    const confirmarTitulo = document.getElementById('confirm-title');
    const confirmarMensaje = document.getElementById('confirm-message');
    const confirmarSi = document.getElementById('confirm-yes');
    const confirmarNo = document.getElementById('confirm-no');

    /** Muestra un diálogo y resuelve true si la persona confirma. */
    function confirmar({ titulo, mensaje, textoSi = 'Sí, continuar', peligro = false }) {
        confirmarTitulo.textContent = titulo;
        confirmarMensaje.textContent = mensaje;
        confirmarSi.textContent = textoSi;
        confirmarSi.className = peligro ? 'btn btn--danger' : 'btn btn--primary';

        return new Promise((resolver) => {
            const cerrar = (respuesta) => {
                confirmarSi.removeEventListener('click', si);
                confirmarNo.removeEventListener('click', no);
                dialogoConfirmar.removeEventListener('cancel', no);
                dialogoConfirmar.close();
                resolver(respuesta);
            };
            const si = () => cerrar(true);
            const no = (e) => { if (e) e.preventDefault(); cerrar(false); };
            confirmarSi.addEventListener('click', si);
            confirmarNo.addEventListener('click', no);
            dialogoConfirmar.addEventListener('cancel', no); // tecla Esc
            dialogoConfirmar.showModal();
            confirmarNo.focus(); // por seguridad, el foco queda en "No"
        });
    }

    /* ---------- Eventos entre secciones ---------- */
    // 'reservas:cambiaron'  -> hay que volver a pintar los datos
    // 'reserva:prellenar'   -> { fecha, hora, profesional } para el formulario
    // 'reserva:abrir'       -> { id } abre el detalle de una cita
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
        llenarHoras, confirmar, mostrarAviso, emitir, escuchar, el,
    };
})();
