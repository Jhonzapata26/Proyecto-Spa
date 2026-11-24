/* =========================================================
   Cambia la contraseña de un usuario:  npm run cambiar-clave
   Sirve cuando alguien la olvidó o la creó mal.
   Solo puede usarlo quien tenga acceso al equipo del servidor.
   ========================================================= */
const { abrir } = require('../db');
const { crearServicioAuth } = require('../auth');
const { crearConsola } = require('./consola');

(async () => {
    const db = abrir();
    const auth = crearServicioAuth(db);
    const consola = crearConsola();

    console.log('\n🌸 Cambiar contraseña de un usuario de Serena\n');

    try {
        const usuarios = auth.listarUsuarios();
        if (usuarios.length === 0) {
            throw new Error('Todavía no hay usuarios. Crea uno con:  npm run crear-usuario');
        }

        console.log('Usuarios registrados:');
        for (const u of usuarios) {
            console.log(`   • ${u.usuario.padEnd(20)} ${u.nombre} (${u.rol})`);
        }
        console.log('');

        const usuario = await consola.preguntar('Usuario al que le cambias la contraseña: ');
        const clave = await consola.pedirClave('Nueva contraseña');

        auth.cambiarClave(usuario, clave);
        console.log(`\n✅ Contraseña de "${usuario}" actualizada. Ya puede ingresar con la nueva.\n`);
        process.exitCode = 0;
    } catch (error) {
        console.error(`\n❌ ${error.message}\n`);
        process.exitCode = 1;
    } finally {
        consola.cerrar();
        db.close();
    }
})();
