/* =========================================================
   Sección "Citas agendadas": citas pendientes.
   Primero las que ya pasaron sin cerrarse ("Por cerrar"),
   luego las próximas, de la más cercana a la más lejana.
   ========================================================= */
(() => {
    const { formatoHora, partesFecha, yaPaso, nombreServicio, nombreProfesional, emitir, escuchar, el } = Utils;

    const lista = document.getElementById('appointments-list');
    const contador = document.getElementById('appointments-count');

    function tarjetaCita(reserva) {
        const { dia, mes, semana } = partesFecha(reserva.fecha);
        const porCerrar = yaPaso(reserva.fecha, reserva.hora);

        const item = el('li', 'appointment');
        const boton = el('button', 'appointment-body' + (porCerrar ? ' appointment-body--overdue' : ''));
        boton.type = 'button';
        boton.title = 'Ver detalle de la cita';
        boton.addEventListener('click', () => emitir('reserva:abrir', { id: reserva.id }));

        const fecha = el('div', 'appointment-date');
        fecha.append(el('span', 'appointment-weekday', semana), el('strong', null, dia), el('span', null, mes));

        const info = el('div', 'appointment-info');
        const nombre = el('strong', 'appointment-name', reserva.cliente);
        if (porCerrar) nombre.append(el('span', 'booked-tag booked-tag--overdue', 'Por cerrar'));
        info.append(
            nombre,
            el('span', 'appointment-detail',
                `${nombreServicio(reserva.servicio)} · ${nombreProfesional(reserva.profesional)}`),
            el('span', 'appointment-phone', `📞 ${reserva.telefono}`),
        );

        boton.append(fecha, info, el('span', 'appointment-time', formatoHora(reserva.hora)));
        item.append(boton);
        return item;
    }

    async function pintar() {
        const pendientes = await ReservasAPI.listarPendientes();

        contador.textContent = pendientes.length === 1 ? '1 cita' : `${pendientes.length} citas`;

        if (pendientes.length === 0) {
            const vacio = el('li', 'appointments-empty');
            vacio.append(
                el('span', 'appointments-empty-icon', '🗓️'),
                el('span', null, 'No hay citas pendientes. Las nuevas reservas aparecerán aquí.'),
            );
            lista.replaceChildren(vacio);
            return;
        }

        lista.replaceChildren(...pendientes.map(tarjetaCita));
    }

    escuchar('reservas:cambiaron', pintar);
    pintar();
})();
