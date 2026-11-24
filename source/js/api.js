/* =========================================================
   Capa de datos de reservas.
   Por ahora guarda en localStorage. Cuando exista el backend,
   solo hay que cambiar este archivo (las funciones ya devuelven
   promesas, igual que lo haría fetch()).
   ========================================================= */
const ReservasAPI = (() => {
    const CLAVE = 'serena.reservas';

    // Franjas de atención: 9 AM a 6 PM, sin las 12 (almuerzo).
    const HORAS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    class ErrorReserva extends Error {
        constructor(codigo, mensaje) {
            super(mensaje);
            this.codigo = codigo;
        }
    }

    function leer() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE));
            return Array.isArray(datos) ? datos : [];
        } catch {
            return [];
        }
    }

    function escribir(reservas) {
        localStorage.setItem(CLAVE, JSON.stringify(reservas));
    }

    function estaActiva(reserva) {
        return reserva.estado !== 'cancelada';
    }

    function generarId() {
        if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function ordenarPorFechaYHora(a, b) {
        return (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
    }

    async function listar() {
        return leer();
    }

    /** Reservas activas de un día (YYYY-MM-DD), ordenadas por hora. */
    async function listarDelDia(fecha) {
        return leer()
            .filter((r) => estaActiva(r) && r.fecha === fecha)
            .sort(ordenarPorFechaYHora);
    }

    /** Citas pendientes (estado "agendada"), ordenadas. Incluye las que ya pasaron sin cerrarse. */
    async function listarPendientes() {
        return leer()
            .filter((r) => r.estado === 'agendada')
            .sort(ordenarPorFechaYHora);
    }

    async function obtener(id) {
        const reserva = leer().find((r) => r.id === id);
        if (!reserva) throw new ErrorReserva('NO_EXISTE', 'La cita ya no existe. Pudo haber sido borrada.');
        return reserva;
    }

    /** Horas ya tomadas por una profesional en una fecha. `excluirId` sirve al editar una cita. */
    async function horasOcupadas(fecha, profesional, excluirId = null) {
        return leer()
            .filter((r) => estaActiva(r) && r.id !== excluirId && r.fecha === fecha && r.profesional === profesional)
            .map((r) => r.hora);
    }

    /** Limpia y valida los datos de una cita; lanza ErrorReserva si algo falla. */
    function validar(datos, reservas, excluirId = null) {
        const reserva = {
            cliente: String(datos.cliente || '').trim(),
            telefono: String(datos.telefono || '').trim(),
            servicio: datos.servicio,
            profesional: datos.profesional,
            fecha: datos.fecha,
            hora: datos.hora,
        };

        const faltante = Object.keys(reserva).find((campo) => !reserva[campo]);
        if (faltante) {
            throw new ErrorReserva('DATOS_INVALIDOS', `Falta el campo "${faltante}".`);
        }
        if (!HORAS.includes(reserva.hora)) {
            throw new ErrorReserva('DATOS_INVALIDOS', 'La hora elegida no está dentro del horario de atención.');
        }

        const choca = reservas.some((r) =>
            estaActiva(r) &&
            r.id !== excluirId &&
            r.fecha === reserva.fecha &&
            r.hora === reserva.hora &&
            r.profesional === reserva.profesional
        );
        if (choca) {
            throw new ErrorReserva('HORA_OCUPADA', 'Esa hora ya está reservada para esta profesional.');
        }
        return reserva;
    }

    async function crear(datos) {
        const reservas = leer();
        const nueva = {
            id: generarId(),
            ...validar(datos, reservas),
            estado: 'agendada',
            creadaEn: new Date().toISOString(),
        };
        reservas.push(nueva);
        escribir(reservas);
        return nueva;
    }

    function buscarPendiente(reservas, id) {
        const reserva = reservas.find((r) => r.id === id);
        if (!reserva) throw new ErrorReserva('NO_EXISTE', 'La cita ya no existe. Pudo haber sido borrada.');
        if (reserva.estado !== 'agendada') {
            throw new ErrorReserva('NO_EDITABLE', `La cita ya está ${reserva.estado} y no se puede cambiar.`);
        }
        return reserva;
    }

    /** Modifica los datos de una cita pendiente (reagendar, corregir nombre, etc.). */
    async function actualizar(id, datos) {
        const reservas = leer();
        const reserva = buscarPendiente(reservas, id);
        Object.assign(reserva, validar({ ...reserva, ...datos }, reservas, id), {
            modificadaEn: new Date().toISOString(),
        });
        escribir(reservas);
        return reserva;
    }

    /** Cancela una cita pendiente: queda en el historial y la hora se libera. */
    async function cancelar(id) {
        const reservas = leer();
        const reserva = buscarPendiente(reservas, id);
        reserva.estado = 'cancelada';
        reserva.canceladaEn = new Date().toISOString();
        escribir(reservas);
        return reserva;
    }

    /** Cierra el servicio: marca la cita como atendida. */
    async function marcarAtendida(id) {
        const reservas = leer();
        const reserva = buscarPendiente(reservas, id);
        reserva.estado = 'atendida';
        reserva.atendidaEn = new Date().toISOString();
        escribir(reservas);
        return reserva;
    }

    /** Borra la cita del sistema de forma permanente. */
    async function borrar(id) {
        const reservas = leer();
        const restantes = reservas.filter((r) => r.id !== id);
        if (restantes.length === reservas.length) {
            throw new ErrorReserva('NO_EXISTE', 'La cita ya no existe. Pudo haber sido borrada.');
        }
        escribir(restantes);
    }

    return {
        HORAS, ErrorReserva,
        listar, listarDelDia, listarPendientes, obtener, horasOcupadas,
        crear, actualizar, cancelar, marcarAtendida, borrar,
    };
})();
