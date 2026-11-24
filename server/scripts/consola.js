/* =========================================================
   Preguntas por consola para los scripts (crear-usuario, cambiar-clave).
   ========================================================= */
const readline = require('node:readline');

function crearConsola() {
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
        if (done) throw new Error('Se cerró la entrada antes de terminar. No se guardó ningún cambio.');
        return value.trim();
    }

    /** Pide la contraseña dos veces y avisa si no coinciden. */
    async function pedirClave(texto = 'Contraseña') {
        const clave = await preguntar(`${texto} (mínimo 8 caracteres, no se ve al escribir): `, { oculto: true });
        const repetida = await preguntar('Repite la contraseña: ', { oculto: true });
        if (clave !== repetida) throw new Error('Las contraseñas no coinciden. Intenta de nuevo.');
        return clave;
    }

    return { preguntar, pedirClave, cerrar: () => rl.close() };
}

module.exports = { crearConsola };
