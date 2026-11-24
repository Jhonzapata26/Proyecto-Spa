/* =========================================================
   Configuración del negocio y del servidor.
   Es la única fuente de horas, servicios y profesionales:
   el navegador la recibe en /config.js.
   ========================================================= */
const path = require('node:path');

module.exports = {
    // Franjas de atención: 9 AM a 6 PM, sin las 12 (almuerzo).
    HORAS: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],

    SERVICIOS: [
        { valor: 'manicure', nombre: 'Manicure' },
        { valor: 'pedicure', nombre: 'Pedicure' },
        { valor: 'manicure-pedicure', nombre: 'Manicure & Pedicure' },
        { valor: 'pestanas', nombre: 'Pestañas' },
        { valor: 'masaje', nombre: 'Masaje' },
        { valor: 'facial', nombre: 'Limpieza facial' },
        { valor: 'depilacion', nombre: 'Depilación' },
        { valor: 'maquillaje', nombre: 'Maquillaje' },
        { valor: 'micro', nombre: 'Micropigmentación' },
    ],

    PROFESIONALES: [
        { valor: 'ximena', nombre: 'Ximena' },
        { valor: 'maria', nombre: 'María' },
    ],

    // Servidor
    PUERTO: Number(process.env.PORT) || 3000,
    // Solo este equipo por defecto. Con HOST=0.0.0.0 se abre a la red local (celulares).
    HOST: process.env.HOST || '127.0.0.1',
    RUTA_BD: process.env.RUTA_BD || path.join(__dirname, '..', 'data', 'serena.db'),
    CARPETA_WEB: path.join(__dirname, '..', 'source'),

    // Sesiones e intentos de ingreso
    DURACION_SESION_HORAS: 12,
    MAX_INTENTOS_LOGIN: 5,
    BLOQUEO_LOGIN_MINUTOS: 5,
};
