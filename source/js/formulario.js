/* =========================================================
   Formulario "Nueva reserva"
   ========================================================= */
(() => {
    const { fechaLocal, formatoHora, yaPaso, mostrarAviso, emitir, escuchar } = Utils;

    const form = document.getElementById('booking-form');
    const campoNombre = document.getElementById('name');
    const campoFecha = document.getElementById('date');
    const campoProfesional = document.getElementById('manager');
    const campoHora = document.getElementById('time');
    const boton = form.querySelector('button[type="submit"]');

    /* ---------- Horas disponibles ---------- */

    // Hora sugerida desde el horario mientras falta elegir la profesional.
    let horaPendiente = null;

    function opcion(valor, texto, deshabilitada = false) {
        const op = document.createElement('option');
        op.value = valor;
        op.textContent = texto;
        op.disabled = deshabilitada;
        return op;
    }

    async function actualizarHoras() {
        const fecha = campoFecha.value;
        const profesional = campoProfesional.value;
        const seleccionPrevia = campoHora.value;

        if (!fecha || !profesional) {
            campoHora.replaceChildren(opcion('', 'Elige fecha y profesional'));
            campoHora.disabled = true;
            return;
        }

        const ocupadas = await ReservasAPI.horasOcupadas(fecha, profesional);
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

        if (libres === 0) {
            opciones[0].textContent = 'Sin horas disponibles';
        }

        campoHora.replaceChildren(...opciones);
        campoHora.disabled = libres === 0;

        // Conservar la hora elegida (o la que llegó del horario) si sigue libre.
        const deseada = horaPendiente || seleccionPrevia;
        const libre = opciones.some((op) => op.value === deseada && !op.disabled);
        campoHora.value = libre ? deseada : '';
        horaPendiente = null;
    }

    /* ---------- Validación ---------- */

    campoNombre.addEventListener('input', () => campoNombre.setCustomValidity(''));

    function nombreValido() {
        if (campoNombre.value.trim().length < 3) {
            campoNombre.setCustomValidity('Escribe el nombre de la clienta (mínimo 3 letras).');
            return false;
        }
        campoNombre.setCustomValidity('');
        return true;
    }

    /* ---------- Envío ---------- */

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (!nombreValido() || !form.reportValidity()) return;
        if (campoHora.disabled) {
            // Un select deshabilitado no se valida ni se envía: avisar aparte.
            mostrarAviso('No hay horas disponibles: elige otra fecha o profesional.', 'error');
            return;
        }

        const datos = Object.fromEntries(new FormData(form));
        boton.disabled = true;

        try {
            const reserva = await ReservasAPI.crear({
                cliente: datos.name,
                telefono: datos.phone,
                servicio: datos.service,
                profesional: datos.manager,
                fecha: datos.date,
                hora: datos.time,
            });
            mostrarAviso('✅ Se guardó con éxito');
            form.reset();
            emitir('reservas:cambiaron');
            emitir('horario:ir-a', { fecha: reserva.fecha });
        } catch (error) {
            if (error instanceof ReservasAPI.ErrorReserva) {
                mostrarAviso(error.message, 'error');
            } else {
                console.error(error);
                mostrarAviso('No se pudo guardar la reserva. Intenta de nuevo.', 'error');
            }
        } finally {
            boton.disabled = false;
            await actualizarHoras();
        }
    });

    /* ---------- Prellenar desde el horario ---------- */

    escuchar('reserva:prellenar', async ({ fecha, hora, profesional }) => {
        campoFecha.value = fecha;
        campoProfesional.value = profesional || '';
        // Si aún no hay profesional, la hora se aplica cuando la elijan.
        horaPendiente = hora;
        await actualizarHoras();

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        campoNombre.focus({ preventScroll: true });
    });

    // Si otra sección cambia los datos, refrescar las horas sin tocar lo escrito.
    escuchar('reservas:cambiaron', actualizarHoras);

    /* ---------- Inicio ---------- */

    campoFecha.min = fechaLocal();
    campoFecha.addEventListener('change', actualizarHoras);
    campoProfesional.addEventListener('change', actualizarHoras);
    actualizarHoras();
})();
