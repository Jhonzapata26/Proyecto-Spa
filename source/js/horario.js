/* =========================================================
   Tarjeta "Horario del día"
   ========================================================= */
(() => {
    const {
        fechaLocal, sumarDias, formatoHora, formatoFechaLarga, yaPaso,
        profesionales, nombreServicio, nombreProfesional, emitir, escuchar, el,
    } = Utils;

    const textoFecha = document.getElementById('schedule-date');
    const contador = document.getElementById('schedule-count');
    const lista = document.getElementById('schedule-slots');
    const campoFecha = document.getElementById('schedule-picker');
    const botonAnterior = document.getElementById('schedule-prev');
    const botonSiguiente = document.getElementById('schedule-next');
    const botonHoy = document.getElementById('schedule-today');

    let fechaActual = fechaLocal();

    function bloqueReservado(reserva) {
        const atendida = reserva.estado === 'atendida';
        const bloque = el('button', 'time-block-booked' + (atendida ? ' time-block-booked--done' : ''));
        bloque.type = 'button';
        bloque.title = 'Ver detalle de la cita';

        const nombre = el('strong', 'booked-name', reserva.cliente);
        if (atendida) nombre.append(el('span', 'booked-tag', '✓ Atendida'));

        bloque.append(
            nombre,
            el('span', 'booked-detail',
                `${nombreServicio(reserva.servicio)} · ${nombreProfesional(reserva.profesional)}`),
        );
        bloque.addEventListener('click', () => emitir('reserva:abrir', { id: reserva.id }));
        return bloque;
    }

    function bloqueLibre(fecha, hora, libres) {
        const bloque = el('button', 'time-block-empty');
        bloque.type = 'button';
        const texto = libres.length === profesionales.length
            ? 'Hora disponible'
            : `Disponible con ${libres.map((p) => p.nombre).join(' y ')}`;
        bloque.append(el('span', null, texto));
        bloque.addEventListener('click', () => {
            emitir('reserva:prellenar', {
                fecha,
                hora,
                // Si solo queda una profesional libre, se elige sola.
                profesional: libres.length === 1 ? libres[0].valor : '',
            });
        });
        return bloque;
    }

    async function pintar() {
        const fecha = fechaActual;
        const reservas = await ReservasAPI.listarDelDia(fecha);
        if (fecha !== fechaActual) return; // cambiaron de día mientras cargaba

        const esHoy = fecha === fechaLocal();
        textoFecha.textContent = (esHoy ? 'Hoy · ' : '') + formatoFechaLarga(fecha);
        campoFecha.value = fecha;
        botonHoy.hidden = esHoy;

        let cuposLibres = 0;
        const filas = ReservasAPI.HORAS.map((hora) => {
            const fila = el('div', 'time-slot');
            fila.append(el('div', 'time-label', formatoHora(hora)));

            const bloques = el('div', 'time-blocks');
            const deEstaHora = reservas.filter((r) => r.hora === hora);
            deEstaHora.forEach((r) => bloques.append(bloqueReservado(r)));

            const libres = profesionales.filter((p) => !deEstaHora.some((r) => r.profesional === p.valor));
            if (yaPaso(fecha, hora)) {
                if (deEstaHora.length === 0) bloques.append(el('div', 'time-block-past', 'Hora pasada'));
            } else if (libres.length > 0) {
                bloques.append(bloqueLibre(fecha, hora, libres));
                cuposLibres += libres.length;
            }

            fila.append(bloques);
            return fila;
        });

        lista.replaceChildren(...filas);
        contador.textContent = cuposLibres === 1 ? '1 cupo libre' : `${cuposLibres} cupos libres`;
    }

    function irA(fecha) {
        if (!fecha) return;
        fechaActual = fecha;
        pintar();
    }

    botonAnterior.addEventListener('click', () => irA(sumarDias(fechaActual, -1)));
    botonSiguiente.addEventListener('click', () => irA(sumarDias(fechaActual, 1)));
    botonHoy.addEventListener('click', () => irA(fechaLocal()));
    campoFecha.addEventListener('change', () => irA(campoFecha.value));

    escuchar('horario:ir-a', ({ fecha }) => irA(fecha));
    escuchar('reservas:cambiaron', pintar);

    pintar();
})();
