/* =========================================================
   Reglas de negocio de las reservas (el servidor es la autoridad:
   el navegador valida para ayudar, pero aquí se decide).
   ========================================================= */
const crypto = require('node:crypto');
const { HORAS, SERVICIOS, PROFESIONALES } = require('./config');
const { ErrorApp } = require('./errores');
const { transaccion } = require('./db');

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_TELEFONO = /^\d{10}$/;

function fechaLocal(fecha = new Date()) {
    const a = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${a}-${m}-${d}`;
}

function horaLocal(fecha = new Date()) {
    return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

function esFechaValida(fecha) {
    if (typeof fecha !== 'string' || !RE_FECHA.test(fecha)) return false;
    const [a, m, d] = fecha.split('-').map(Number);
    const f = new Date(a, m - 1, d);
    return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d;
}

function yaPaso(fecha, hora) {
    return fecha + hora <= fechaLocal() + horaLocal();
}

const invalido = (mensaje) => new ErrorApp(400, 'DATOS_INVALIDOS', mensaje);
const noExiste = () => new ErrorApp(404, 'NO_EXISTE', 'La cita ya no existe. Pudo haber sido borrada.');
const horaOcupada = () => new ErrorApp(409, 'HORA_OCUPADA', 'Esa hora ya está reservada para esta profesional.');

/** Fila de la base de datos -> objeto que usa el navegador. */
function aReserva(fila) {
    if (!fila) return null;
    return {
        id: fila.id,
        cliente: fila.cliente,
        telefono: fila.telefono,
        servicio: fila.servicio,
        profesional: fila.profesional,
        fecha: fila.fecha,
        hora: fila.hora,
        estado: fila.estado,
        creadaEn: fila.creada_en,
        modificadaEn: fila.modificada_en,
        atendidaEn: fila.atendida_en,
        canceladaEn: fila.cancelada_en,
    };
}

/** Limpia y valida los datos de una cita. */
function validar(datos) {
    const reserva = {
        cliente: String(datos.cliente ?? '').trim().replace(/\s+/g, ' '),
        telefono: String(datos.telefono ?? '').trim(),
        servicio: String(datos.servicio ?? ''),
        profesional: String(datos.profesional ?? ''),
        fecha: String(datos.fecha ?? ''),
        hora: String(datos.hora ?? ''),
    };

    if (reserva.cliente.length < 3 || reserva.cliente.length > 60) {
        throw invalido('El nombre de la clienta debe tener entre 3 y 60 letras.');
    }
    if (!RE_TELEFONO.test(reserva.telefono)) throw invalido('El teléfono debe tener 10 dígitos.');
    if (!SERVICIOS.some((s) => s.valor === reserva.servicio)) throw invalido('El servicio no existe.');
    if (!PROFESIONALES.some((p) => p.valor === reserva.profesional)) throw invalido('La profesional no existe.');
    if (!esFechaValida(reserva.fecha)) throw invalido('La fecha no es válida.');
    if (!HORAS.includes(reserva.hora)) throw invalido('La hora elegida no está dentro del horario de atención.');
    return reserva;
}

function esChoqueUnico(error) {
    return /UNIQUE constraint failed/i.test(error && error.message);
}

function crearServicioReservas(db) {
    const consultas = {
        porId: db.prepare('SELECT * FROM reservas WHERE id = ?'),
        delDia: db.prepare(`
            SELECT * FROM reservas WHERE fecha = ? AND estado <> 'cancelada' ORDER BY hora`),
        pendientes: db.prepare(`
            SELECT * FROM reservas WHERE estado = 'agendada' ORDER BY fecha, hora`),
        ocupadas: db.prepare(`
            SELECT hora FROM reservas
            WHERE fecha = ? AND profesional = ? AND estado <> 'cancelada' AND id <> ?`),
        choque: db.prepare(`
            SELECT 1 FROM reservas
            WHERE fecha = ? AND hora = ? AND profesional = ? AND estado <> 'cancelada' AND id <> ?`),
        insertar: db.prepare(`
            INSERT INTO reservas (id, cliente, telefono, servicio, profesional, fecha, hora, estado, creada_en, creada_por)
            VALUES (:id, :cliente, :telefono, :servicio, :profesional, :fecha, :hora, 'agendada', :creada_en, :creada_por)`),
        actualizar: db.prepare(`
            UPDATE reservas SET cliente = :cliente, telefono = :telefono, servicio = :servicio,
                profesional = :profesional, fecha = :fecha, hora = :hora, modificada_en = :ahora
            WHERE id = :id`),
        cancelar: db.prepare(`UPDATE reservas SET estado = 'cancelada', cancelada_en = ? WHERE id = ?`),
        atender: db.prepare(`UPDATE reservas SET estado = 'atendida', atendida_en = ? WHERE id = ?`),
        borrar: db.prepare('DELETE FROM reservas WHERE id = ?'),
    };

    const ahora = () => new Date().toISOString();

    function obtener(id) {
        const reserva = aReserva(consultas.porId.get(String(id)));
        if (!reserva) throw noExiste();
        return reserva;
    }

    function obtenerPendiente(id) {
        const reserva = obtener(id);
        if (reserva.estado !== 'agendada') {
            throw new ErrorApp(409, 'NO_EDITABLE', `La cita ya está ${reserva.estado} y no se puede cambiar.`);
        }
        return reserva;
    }

    function verificarHoraLibre({ fecha, hora, profesional }, excluirId = '') {
        if (consultas.choque.get(fecha, hora, profesional, excluirId)) throw horaOcupada();
    }

    return {
        delDia(fecha) {
            if (!esFechaValida(fecha)) throw invalido('La fecha no es válida.');
            return consultas.delDia.all(fecha).map(aReserva);
        },

        pendientes() {
            return consultas.pendientes.all().map(aReserva);
        },

        obtener,

        horasOcupadas(fecha, profesional, excluirId = '') {
            if (!esFechaValida(fecha)) throw invalido('La fecha no es válida.');
            return consultas.ocupadas.all(fecha, String(profesional), String(excluirId || '')).map((f) => f.hora);
        },

        crear(datos, usuarioId = null) {
            const reserva = validar(datos);
            if (yaPaso(reserva.fecha, reserva.hora)) throw invalido('No se puede agendar en una hora que ya pasó.');

            try {
                return transaccion(db, () => {
                    verificarHoraLibre(reserva);
                    const id = crypto.randomUUID();
                    consultas.insertar.run({ id, ...reserva, creada_en: ahora(), creada_por: usuarioId });
                    return obtener(id);
                });
            } catch (error) {
                if (esChoqueUnico(error)) throw horaOcupada();
                throw error;
            }
        },

        actualizar(id, datos) {
            try {
                return transaccion(db, () => {
                    const actual = obtenerPendiente(id);
                    const reserva = validar({ ...actual, ...datos });
                    const cambiaHorario = reserva.fecha !== actual.fecha || reserva.hora !== actual.hora;
                    if (cambiaHorario && yaPaso(reserva.fecha, reserva.hora)) {
                        throw invalido('No se puede reagendar a una hora que ya pasó.');
                    }
                    verificarHoraLibre(reserva, actual.id);
                    consultas.actualizar.run({ id: actual.id, ...reserva, ahora: ahora() });
                    return obtener(actual.id);
                });
            } catch (error) {
                if (esChoqueUnico(error)) throw horaOcupada();
                throw error;
            }
        },

        cancelar(id) {
            return transaccion(db, () => {
                const reserva = obtenerPendiente(id);
                consultas.cancelar.run(ahora(), reserva.id);
                return obtener(reserva.id);
            });
        },

        marcarAtendida(id) {
            return transaccion(db, () => {
                const reserva = obtenerPendiente(id);
                if (reserva.fecha > fechaLocal()) {
                    throw new ErrorApp(409, 'NO_EDITABLE', 'La cita solo se puede marcar como atendida desde el día de la cita.');
                }
                consultas.atender.run(ahora(), reserva.id);
                return obtener(reserva.id);
            });
        },

        borrar(id) {
            const { changes } = consultas.borrar.run(String(id));
            if (changes === 0) throw noExiste();
        },
    };
}

module.exports = { crearServicioReservas };
