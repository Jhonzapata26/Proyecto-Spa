/* =========================================================
   Crea un usuario desde la consola:  npm run crear-usuario
   ========================================================= */
const readline = require('node:readline');
const { abrir } = require('../db');
const { crearServicioAuth, ROLES } = require('../auth');

const esConsola = Boolean(process.stdin.isTTY);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: esConsola });
const lineas = rl[Symbol.asyncIterator]();

// Mientras se escribe la contraseña no se muestra nada en pantalla.
let ocultar = false;
const escribirOriginal = rl._writeToOutput.bind(rl);
rl._writeToOutput = (texto) => { if (!ocultar) escribirOriginal(texto); };

async function preguntar(texto, { oculto = false } = {}) {
    process.stdout.write(texto);
    ocultar = oculto;
    const { value, done } = await lineas.next();
    ocultar = false;
    if (oculto && esConsola) process.stdout.write('\n');
    if (done) throw new Error('Se cerró la entrada antes de terminar. No se creó el usuario.');
    return value.trim();
}

(async () => {
    const db = abrir();
    const auth = crearServicioAuth(db);
    const primero = !auth.hayUsuarios();

    console.log('\n🌸 Crear usuario de Serena\n');
    if (primero) console.log('Es el primer usuario: se recomienda que sea administradora (admin).\n');

    try {
        const usuario = await preguntar('Usuario (para ingresar, sin espacios): ');
        const nombre = await preguntar('Nombre de la persona: ');
        const rol = (await preguntar(`Rol (${ROLES.join(' / ')}) [${primero ? 'admin' : 'recepcionista'}]: `))
            || (primero ? 'admin' : 'recepcionista');
        const clave = await preguntar('Contraseña (mínimo 8 caracteres, no se ve al escribir): ', { oculto: true });
        const repetida = await preguntar('Repite la contraseña: ', { oculto: true });

        if (clave !== repetida) throw new Error('Las contraseñas no coinciden.');
        auth.crearUsuario({ usuario, nombre, rol, clave });
        console.log(`\n✅ Usuario "${usuario}" creado con rol ${rol}.\n`);
        process.exitCode = 0;
    } catch (error) {
        console.error(`\n❌ ${error.message}\n`);
        process.exitCode = 1;
    } finally {
        rl.close();
        db.close();
    }
})();
