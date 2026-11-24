/* =========================================================
   Diálogo "Detalle de la cita": ver, editar, cerrar (atendida),
   cancelar y borrar. Se abre con el evento 'reserva:abrir'.
   ========================================================= */
(() => {
    const {
        fechaLocal, formatoHora, formatoFechaLarga, nombreServicio, nombreProfesional,
        llenarHoras, confirmar, mostrarAviso, emitir, escuchar, el,
    } = Utils;

    const ESTADOS = {
        agendada: 'Pendiente',
        atendida: 'Atendida',
        cancelada: 'Cancelada',
    };

    const dialogo = document.getElementById('appointment-dialog');
    const titulo = document.getElementById('detail-title');
    const subtitulo = document.getElementById('detail-subtitle');
    const estado = document.getElementById('detail-status');
    const vista = document.getElementById('detail-view');
    const datos = document.getElementById('detail-data');
    const nota = document.getElementById('detail-note');

    const botones = {
        atender: document.getElementById('detail-attend'),
        editar: document.getElementById('detail-edit'),
        irA: document.getElementById('detail-goto'),
        cancelar: document.getElementById('detail-cancel'),
        borrar: document.getElementById('detail-delete'),
    };

    const formEditar = document.getElementById('edit-form');
    const campos = {
        nombre: document.getElementById('edit-name'),
        telefono: document.getElementById('edit-phone'),
        servicio: document.getElementById('edit-service'),
        profesional: document.getElementById('edit-manager'),
        fecha: document.getElementById('edit-date'),
        hora: document.getElementById('edit-time'),
    };

    // Los selects de edición usan las mismas opciones que el formulario principal.
    campos.servicio.replaceChildren(...[...document.getElementById('service').options].map((o) => o.cloneNode(true)));
    campos.profesional.replaceChildren(...[...document.getElementById('manager').options].map((o) => o.cloneNode(true)));

    let cita = null; // cita abierta en el diálogo

    /* ---------- Vista de detalle ---------- */

    function fila(etiqueta, valor) {
        return [el('dt', null, etiqueta), el('dd', null, valor)];
    }

    function mostrarDetalle() {
        const pendiente = cita.estado === 'agendada';
        const esFuturo = cita.fecha > fechaLocal();

        subtitulo.textContent = `${formatoFechaLarga(cita.fecha)} · ${formatoHora(cita.hora)}`;
        estado.textContent = ESTADOS[cita.estado] || cita.estado;
        estado.className = `status-badge status-badge--${cita.estado}`;

        datos.replaceChildren(
            ...fila('Clienta', cita.cliente),
            ...fila('Teléfono', cita.telefono),
            ...fila('Servicio', nombreServicio(cita.servicio)),
            ...fila('Profesional', nombreProfesional(cita.profesional)),
        );

        botones.atender.hidden = !pendiente;
        botones.editar.hidden = !pendiente;
        botones.cancelar.hidden = !pendiente;
        botones.atender.disabled = esFuturo;

        nota.textContent = pendiente && esFuturo
            ? 'La cita se podrá marcar como atendida el día de la cita.'
            : '';
        nota.hidden = !nota.textContent;

        titulo.textContent = 'Detalle de la cita';
        formEditar.hidden = true;
        vista.hidden = false;
    }

    async function abrir(id) {
        try {
            cita = await ReservasAPI.obtener(id);
        } catch (error) {
            manejarError(error);
            return;
        }
        mostrarDetalle();
        if (!dialogo.open) dialogo.showModal();
    }

    function cerrar() {
        dialogo.close();
        cita = null;
    }

    function manejarError(error) {
        if (error instanceof ReservasAPI.ErrorReserva) {
            mostrarAviso(error.message, 'error');
            if (error.codigo === 'NO_EXISTE') cerrar();
        } else {
            console.error(error);
            mostrarAviso('No se pudo completar la acción. Intenta de nuevo.', 'error');
        }
        emitir('reservas:cambiaron');
    }

    /** Ejecuta una acción sobre la cita, avisa y refresca la pantalla. */
    async function ejecutar(accion, mensajeExito, { cerrarAlTerminar = true } = {}) {
        try {
            const resultado = await accion();
            mostrarAviso(mensajeExito);
            emitir('reservas:cambiaron');
            if (cerrarAlTerminar) {
                cerrar();
            } else {
                cita = resultado;
                mostrarDetalle();
            }
        } catch (error) {
            manejarError(error);
        }
    }

    function descripcion() {
        return `la cita de ${cita.cliente} del ${formatoFechaLarga(cita.fecha).toLowerCase()} a las ${formatoHora(cita.hora)}`;
    }

    /* ---------- Acciones ---------- */

    botones.atender.addEventListener('click', () =>
        ejecutar(() => ReservasAPI.marcarAtendida(cita.id), '✅ Cita marcada como atendida', { cerrarAlTerminar: false }));

    botones.cancelar.addEventListener('click', async () => {
        const ok = await confirmar({
            titulo: '¿Cancelar la cita?',
            mensaje: `Se cancelará ${descripcion()}. La hora quedará libre para otra clienta.`,
            textoSi: 'Sí, cancelar cita',
            peligro: true,
        });
        if (ok) ejecutar(() => ReservasAPI.cancelar(cita.id), 'Cita cancelada. La hora quedó libre.');
    });

    botones.borrar.addEventListener('click', async () => {
        const ok = await confirmar({
            titulo: '¿Borrar la cita?',
            mensaje: `Se borrará ${descripcion()} del sistema. Esta acción no se puede deshacer.`,
            textoSi: 'Sí, borrar',
            peligro: true,
        });
        if (ok) ejecutar(() => ReservasAPI.borrar(cita.id), 'Cita borrada.');
    });

    botones.irA.addEventListener('click', () => {
        emitir('horario:ir-a', { fecha: cita.fecha });
        cerrar();
        document.getElementById('day-schedule').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('detail-close').addEventListener('click', cerrar);
    // El evento "close" llega con retraso: si el diálogo ya se volvió a abrir, no borrar la cita actual.
    dialogo.addEventListener('close', () => { if (!dialogo.open) cita = null; });
    // Clic en el fondo oscuro cierra el diálogo.
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo) cerrar(); });

    /* ---------- Edición ---------- */

    async function actualizarHorasEdicion(deseada = campos.hora.value) {
        await llenarHoras(campos.hora, {
            fecha: campos.fecha.value,
            profesional: campos.profesional.value,
            deseada,
            excluirId: cita.id,
        });
    }

    botones.editar.addEventListener('click', async () => {
        campos.nombre.value = cita.cliente;
        campos.telefono.value = cita.telefono;
        campos.servicio.value = cita.servicio;
        campos.profesional.value = cita.profesional;
        campos.fecha.value = cita.fecha;
        campos.fecha.min = fechaLocal();
        await actualizarHorasEdicion(cita.hora);

        titulo.textContent = 'Editar cita';
        vista.hidden = true;
        formEditar.hidden = false;
        campos.nombre.focus();
    });

    campos.fecha.addEventListener('change', () => actualizarHorasEdicion());
    campos.profesional.addEventListener('change', () => actualizarHorasEdicion());
    campos.nombre.addEventListener('input', () => campos.nombre.setCustomValidity(''));

    document.getElementById('edit-back').addEventListener('click', mostrarDetalle);

    formEditar.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        campos.nombre.setCustomValidity(
            campos.nombre.value.trim().length < 3 ? 'Escribe el nombre de la clienta (mínimo 3 letras).' : '');
        if (!formEditar.reportValidity()) return;
        if (campos.hora.disabled || !campos.hora.value) {
            mostrarAviso('Elige una hora disponible.', 'error');
            return;
        }

        // HU #06: avisar que los cambios reemplazan los datos existentes.
        const ok = await confirmar({
            titulo: '¿Guardar los cambios?',
            mensaje: 'Los cambios reemplazarán los datos actuales de la cita.',
            textoSi: 'Sí, guardar',
        });
        if (!ok) return;

        ejecutar(() => ReservasAPI.actualizar(cita.id, {
            cliente: campos.nombre.value,
            telefono: campos.telefono.value,
            servicio: campos.servicio.value,
            profesional: campos.profesional.value,
            fecha: campos.fecha.value,
            hora: campos.hora.value,
        }), '✅ Cita actualizada', { cerrarAlTerminar: false });
    });

    escuchar('reserva:abrir', ({ id }) => abrir(id));
})();
