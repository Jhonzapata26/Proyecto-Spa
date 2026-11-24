/* =========================================================
   Crea un usuario desde la consola:  npm run crear-usuario
   ========================================================= */
const { abrir } = require('../db');
const { crearServicioAuth, ROLES } = require('../auth');
const { crearConsola } = require('./consola');

(async () => {
    const db = abrir();
    const auth = crearServicioAuth(db);
    const consola = crearConsola();
    const primero = !auth.hayUsuarios();

    console.log('\n🌸 Crear usuario de Serena\n');
    if (primero) console.log('Es el primer usuario: se recomienda que sea administradora (admin).\n');

    try {
        const usuario = await consola.preguntar('Usuario (para ingresar, sin espacios): ');
        const nombre = await consola.preguntar('Nombre de la persona: ');
        const rol = (await consola.preguntar(`Rol (${ROLES.join(' / ')}) [${primero ? 'admin' : 'recepcionista'}]: `))
            || (primero ? 'admin' : 'recepcionista');
        const clave = await consola.pedirClave();

        auth.crearUsuario({ usuario, nombre, rol, clave });
        console.log(`\n✅ Usuario "${usuario}" creado con rol ${rol}.`);
        console.log('   Si olvidas la contraseña:  npm run cambiar-clave\n');
        process.exitCode = 0;
    } catch (error) {
        console.error(`\n❌ ${error.message}\n`);
        process.exitCode = 1;
    } finally {
        consola.cerrar();
        db.close();
    }
})();
