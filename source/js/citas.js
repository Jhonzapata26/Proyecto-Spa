/* =========================================================
   Sección "Citas agendadas" (próximas citas)
   ========================================================= */
(() => {
    const { fechaLocal, formatoHora, partesFecha, nombreServicio, nombreProfesional, emitir, escuchar, el } = Utils;

    const lista = document.getElementById('appointments-list');
    const contador = document.getElementById('appointments-count');

    function horaActual() {
        const ahora = new Date();
        return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    }

    function tarjetaCita(reserva) {
        const { dia, mes, semana } = partesFecha(reserva.fecha);

        const item = el('li', 'appointment');
        const boton = el('button', 'appointment-body');
        boton.type = 'button';
        boton.title = 'Ver en el horario del día';
        boton.addEventListener('click', () => {
            emitir('horario:ir-a', { fecha: reserva.fecha });
            document.getElementById('day-schedule').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        const fecha = el('div', 'appointment-date');
        fecha.append(el('span', 'appointment-weekday', semana), el('strong', null, dia), el('span', null, mes));

        const info = el('div', 'appointment-info');
        info.append(
            el('strong', 'appointment-name', reserva.cliente),
            el('span', 'appointment-detail',
                `${nombreServicio(reserva.servicio)} · ${nombreProfesional(reserva.profesional)}`),
            el('span', 'appointment-phone', `📞 ${reserva.telefono}`),
        );

        boton.append(fecha, info, el('span', 'appointment-time', formatoHora(reserva.hora)));
        item.append(boton);
        return item;
    }

    async function pintar() {
        const proximas = await ReservasAPI.listarDesde(fechaLocal(), horaActual());

        contador.textContent = proximas.length === 1 ? '1 cita' : `${proximas.length} citas`;

        if (proximas.length === 0) {
            const vacio = el('li', 'appointments-empty');
            vacio.append(
                el('span', 'appointments-empty-icon', '🗓️'),
                el('span', null, 'No hay citas próximas. Las nuevas reservas aparecerán aquí.'),
            );
            lista.replaceChildren(vacio);
            return;
        }

        lista.replaceChildren(...proximas.map(tarjetaCita));
    }

    escuchar('reservas:cambiaron', pintar);
    pintar();
})();
