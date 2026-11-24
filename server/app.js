/* =========================================================
   Aplicación Express: API de sesiones y reservas + archivos web.
   Se separa de index.js para poder probarla sin abrir un puerto.
   ========================================================= */
const express = require('express');
const config = require('./config');
const { ErrorApp } = require('./errores');
const { crearServicioReservas } = require('./reservas');
const { crearServicioAuth, requiereRol, leerCookie, opcionesCookie, COOKIE } = require('./auth');

function crearApp(db) {
    const app = express();
    const reservas = crearServicioReservas(db);
    const auth = crearServicioAuth(db);

    app.disable('x-powered-by');

    // Cabeceras de seguridad básicas.
    app.use((req, res, next) => {
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'same-origin',
            'Content-Security-Policy':
                "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
        });
        next();
    });

    app.use(express.json({ limit: '20kb' }));

    // Las peticiones que cambian datos deben traer esta cabecera: un formulario
    // de otro sitio no puede ponerla, así se evitan envíos falsificados (CSRF).
    app.use('/api', (req, res, next) => {
        if (req.method !== 'GET' && req.get('X-Serena') !== '1') {
            next(new ErrorApp(403, 'NO_AUTORIZADO', 'Petición no permitida.'));
            return;
        }
        next();
    });

    /* ---------- Configuración para el navegador ---------- */

    app.get('/config.js', (req, res) => {
        const publica = {
            HORAS: config.HORAS,
            SERVICIOS: config.SERVICIOS,
            PROFESIONALES: config.PROFESIONALES,
        };
        res.type('application/javascript')
            .set('Cache-Control', 'no-cache')
            .send(`window.SERENA_CONFIG = Object.freeze(${JSON.stringify(publica)});\n`);
    });

    /* ---------- Sesión ---------- */

    app.post('/api/sesion', (req, res) => {
        const { usuario, clave } = req.body || {};
        const sesion = auth.iniciarSesion(usuario, clave, req.ip);
        res.set('Set-Cookie', `${COOKIE}=${sesion.token}; ${opcionesCookie(req, config.DURACION_SESION_HORAS * 3600)}`);
        res.json({ usuario: sesion.usuario });
    });

    app.get('/api/sesion', auth.requiereSesion, (req, res) => {
        const { usuario, nombre, rol } = req.usuario;
        res.json({ usuario: { usuario, nombre, rol } });
    });

    app.delete('/api/sesion', (req, res) => {
        auth.cerrarSesion(leerCookie(req, COOKIE));
        res.set('Set-Cookie', `${COOKIE}=; ${opcionesCookie(req, 0)}`);
        res.status(204).end();
    });

    /* ---------- Reservas (todas exigen sesión) ---------- */

    const api = express.Router();
    api.use(auth.requiereSesion);

    // ?fecha=YYYY-MM-DD -> citas del día | ?estado=agendada -> pendientes
    api.get('/reservas', (req, res) => {
        if (req.query.fecha) return res.json(reservas.delDia(String(req.query.fecha)));
        if (req.query.estado === 'agendada') return res.json(reservas.pendientes());
        throw new ErrorApp(400, 'DATOS_INVALIDOS', 'Indica una fecha o estado=agendada.');
    });

    api.get('/reservas/ocupadas', (req, res) => {
        const { fecha, profesional, excluir } = req.query;
        res.json(reservas.horasOcupadas(String(fecha || ''), String(profesional || ''), excluir));
    });

    api.get('/reservas/:id', (req, res) => res.json(reservas.obtener(req.params.id)));

    api.post('/reservas', (req, res) => {
        res.status(201).json(reservas.crear(req.body || {}, req.usuario.id));
    });

    api.patch('/reservas/:id', (req, res) => res.json(reservas.actualizar(req.params.id, req.body || {})));

    api.post('/reservas/:id/cancelar', (req, res) => res.json(reservas.cancelar(req.params.id)));

    api.post('/reservas/:id/atender', (req, res) => res.json(reservas.marcarAtendida(req.params.id)));

    // Borrar es definitivo: solo la administradora.
    api.delete('/reservas/:id', requiereRol('admin'), (req, res) => {
        reservas.borrar(req.params.id);
        res.status(204).end();
    });

    app.use('/api', api);
    app.use('/api', (req, res, next) => next(new ErrorApp(404, 'NO_EXISTE', 'Ruta no encontrada.')));

    /* ---------- Archivos de la página ---------- */

    app.use(express.static(config.CARPETA_WEB, { index: 'index.html' }));

    /* ---------- Errores ---------- */

    // eslint-disable-next-line no-unused-vars
    app.use((error, req, res, next) => {
        if (error instanceof ErrorApp) {
            res.status(error.status).json({ codigo: error.codigo, mensaje: error.message });
            return;
        }
        if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
            res.status(400).json({ codigo: 'DATOS_INVALIDOS', mensaje: 'Los datos enviados no son válidos.' });
            return;
        }
        console.error(error);
        res.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error en el servidor. Intenta de nuevo.' });
    });

    return app;
}

module.exports = { crearApp };
