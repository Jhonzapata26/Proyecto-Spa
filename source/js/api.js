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

    /** Citas pendientes (estado "agendada") desde una fecha/hora en adelante, ordenadas. */
    async function listarDesde(fecha, hora = '00:00') {
        const desde = fecha + hora;
        return leer()
            .filter((r) => r.estado === 'agendada' && r.fecha + r.hora >= desde)
            .sort(ordenarPorFechaYHora);
    }

    /** Horas ya tomadas por una profesional en una fecha (YYYY-MM-DD). */
    async function horasOcupadas(fecha, profesional) {
        return leer()
            .filter((r) => estaActiva(r) && r.fecha === fecha && r.profesional === profesional)
            .map((r) => r.hora);
    }

    async function crear(datos) {
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

        const reservas = leer();
        const choca = reservas.some((r) =>
            estaActiva(r) &&
            r.fecha === reserva.fecha &&
            r.hora === reserva.hora &&
            r.profesional === reserva.profesional
        );
        if (choca) {
            throw new ErrorReserva('HORA_OCUPADA', 'Esa hora ya está reservada para esta profesional.');
        }

        const nueva = {
            id: generarId(),
            ...reserva,
            estado: 'agendada',
            creadaEn: new Date().toISOString(),
        };
        reservas.push(nueva);
        escribir(reservas);
        return nueva;
    }

    return { HORAS, ErrorReserva, listar, listarDelDia, listarDesde, horasOcupadas, crear };
})();
