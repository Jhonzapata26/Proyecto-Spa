/* =========================================================
   Arranque del servidor:  npm start
   ========================================================= */
const config = require('./config');
const { abrir } = require('./db');
const { crearApp } = require('./app');
const { crearServicioAuth } = require('./auth');

const db = abrir();
const app = crearApp(db);

if (!crearServicioAuth(db).hayUsuarios()) {
    console.warn('\n⚠️  Todavía no hay usuarios. Crea el primero con:  npm run crear-usuario\n');
}

const servidor = app.listen(config.PUERTO, config.HOST, () => {
    const host = config.HOST === '0.0.0.0' ? 'localhost' : config.HOST;
    console.log(`🌸 Serena funcionando en http://${host}:${config.PUERTO}`);
    if (config.HOST === '0.0.0.0') {
        console.log('   Abierto a la red local: desde el celular usa la IP de este equipo.');
    }
});

// Cerrar ordenadamente (Ctrl+C) para dejar la base de datos consistente.
function apagar() {
    servidor.close(() => {
        db.close();
        process.exit(0);
    });
}
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
