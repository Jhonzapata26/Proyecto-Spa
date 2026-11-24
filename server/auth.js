/* =========================================================
   Usuarios, contraseñas y sesiones.
   - Contraseñas con scrypt + sal (nunca se guardan en texto plano).
   - Sesión: token aleatorio en cookie HttpOnly; en la base de datos
     solo se guarda su hash.
   ========================================================= */
const crypto = require('node:crypto');
const { DURACION_SESION_HORAS, MAX_INTENTOS_LOGIN, BLOQUEO_LOGIN_MINUTOS } = require('./config');
const { ErrorApp } = require('./errores');

const COOKIE = 'serena_sesion';
const ROLES = ['admin', 'recepcionista'];

/* ---------- Contraseñas ---------- */

function hashClave(clave) {
    const sal = crypto.randomBytes(16);
    const hash = crypto.scryptSync(clave, sal, 64);
    return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

function verificarClave(clave, guardado) {
    const [algoritmo, salHex, hashHex] = String(guardado).split('$');
    if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;
    const esperado = Buffer.from(hashHex, 'hex');
    const calculado = crypto.scryptSync(String(clave), Buffer.from(salHex, 'hex'), esperado.length);
    return crypto.timingSafeEqual(esperado, calculado);
}

// Se usa para que "usuario no existe" tarde lo mismo que "clave incorrecta".
const HASH_FALSO = hashClave(crypto.randomBytes(16).toString('hex'));

const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');

/* ---------- Cookies ---------- */

function leerCookie(req, nombre) {
    const cabecera = req.headers.cookie || '';
    for (const parte of cabecera.split(';')) {
        const [clave, ...valor] = parte.trim().split('=');
        if (clave === nombre) return decodeURIComponent(valor.join('='));
    }
    return null;
}

function opcionesCookie(req, maxAgeSegundos) {
    const partes = [`Path=/`, 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSegundos}`];
    if (req.secure) partes.push('Secure');
    return partes.join('; ');
}

/* ---------- Servicio de usuarios y sesiones ---------- */

function crearServicioAuth(db) {
    const consultas = {
        usuarioPorNombre: db.prepare('SELECT * FROM usuarios WHERE usuario = ?'),
        contarUsuarios: db.prepare('SELECT COUNT(*) AS total FROM usuarios'),
        insertarUsuario: db.prepare(`
            INSERT INTO usuarios (usuario, nombre, rol, clave_hash) VALUES (?, ?, ?, ?)`),
        insertarSesion: db.prepare('INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES (?, ?, ?)'),
        sesion: db.prepare(`
            SELECT u.id, u.usuario, u.nombre, u.rol
            FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.token_hash = ? AND s.expira_en > ? AND u.activo = 1`),
        borrarSesion: db.prepare('DELETE FROM sesiones WHERE token_hash = ?'),
        limpiarVencidas: db.prepare('DELETE FROM sesiones WHERE expira_en <= ?'),
    };

    // Intentos fallidos por IP (en memoria): frena a quien prueba contraseñas.
    const intentos = new Map();

    function revisarBloqueo(ip) {
        const registro = intentos.get(ip);
        if (registro && registro.bloqueadoHasta > Date.now()) {
            const minutos = Math.ceil((registro.bloqueadoHasta - Date.now()) / 60000);
            throw new ErrorApp(429, 'DEMASIADOS_INTENTOS',
                `Demasiados intentos fallidos. Espera ${minutos} minuto${minutos === 1 ? '' : 's'} e intenta de nuevo.`);
        }
    }

    function registrarFallo(ip) {
        const registro = intentos.get(ip) || { fallos: 0, bloqueadoHasta: 0 };
        registro.fallos++;
        if (registro.fallos >= MAX_INTENTOS_LOGIN) {
            registro.fallos = 0;
            registro.bloqueadoHasta = Date.now() + BLOQUEO_LOGIN_MINUTOS * 60000;
        }
        intentos.set(ip, registro);
    }

    const servicio = {
        crearUsuario({ usuario, nombre, rol, clave }) {
            usuario = String(usuario || '').trim();
            nombre = String(nombre || '').trim();
            if (!/^[a-zA-Z0-9._-]{3,30}$/.test(usuario)) {
                throw new ErrorApp(400, 'DATOS_INVALIDOS', 'El usuario debe tener de 3 a 30 letras, números, punto o guion, sin espacios.');
            }
            if (nombre.length < 2) throw new ErrorApp(400, 'DATOS_INVALIDOS', 'Escribe el nombre de la persona.');
            if (!ROLES.includes(rol)) throw new ErrorApp(400, 'DATOS_INVALIDOS', `El rol debe ser: ${ROLES.join(' o ')}.`);
            if (String(clave || '').length < 8) {
                throw new ErrorApp(400, 'DATOS_INVALIDOS', 'La contraseña debe tener al menos 8 caracteres.');
            }
            if (consultas.usuarioPorNombre.get(usuario)) {
                throw new ErrorApp(409, 'USUARIO_EXISTE', 'Ya existe un usuario con ese nombre.');
            }
            consultas.insertarUsuario.run(usuario, nombre, rol, hashClave(clave));
        },

        hayUsuarios() {
            return consultas.contarUsuarios.get().total > 0;
        },

        /** Verifica usuario y contraseña; devuelve { token, usuario }. */
        iniciarSesion(usuario, clave, ip) {
            revisarBloqueo(ip);
            const fila = consultas.usuarioPorNombre.get(String(usuario || '').trim());
            const valida = verificarClave(String(clave || ''), fila ? fila.clave_hash : HASH_FALSO);

            if (!fila || !valida || !fila.activo) {
                registrarFallo(ip);
                throw new ErrorApp(401, 'CREDENCIALES', 'Usuario o contraseña incorrectos.');
            }
            intentos.delete(ip);

            const ahora = Date.now();
            consultas.limpiarVencidas.run(ahora);
            const token = crypto.randomBytes(32).toString('base64url');
            consultas.insertarSesion.run(sha256(token), fila.id, ahora + DURACION_SESION_HORAS * 3600000);
            return { token, usuario: { usuario: fila.usuario, nombre: fila.nombre, rol: fila.rol } };
        },

        cerrarSesion(token) {
            if (token) consultas.borrarSesion.run(sha256(token));
        },

        usuarioDeSesion(token) {
            if (!token) return null;
            return consultas.sesion.get(sha256(token), Date.now()) || null;
        },
    };

    /** Middleware de Express: exige sesión iniciada y deja el usuario en req.usuario. */
    servicio.requiereSesion = (req, res, next) => {
        const usuario = servicio.usuarioDeSesion(leerCookie(req, COOKIE));
        if (!usuario) {
            next(new ErrorApp(401, 'SIN_SESION', 'Tu sesión terminó. Vuelve a ingresar.'));
            return;
        }
        req.usuario = usuario;
        next();
    };

    return servicio;
}

/** Exige uno de los roles indicados (usar después de requiereSesion). */
function requiereRol(...roles) {
    return (req, res, next) => {
        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            next(new ErrorApp(403, 'NO_AUTORIZADO', 'Tu usuario no tiene permiso para esta acción.'));
            return;
        }
        next();
    };
}

module.exports = { crearServicioAuth, requiereRol, leerCookie, opcionesCookie, COOKIE, ROLES };
