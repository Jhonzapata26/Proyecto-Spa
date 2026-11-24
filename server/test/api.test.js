/* Pruebas de la API:  npm test
   Usan una base de datos en memoria: no tocan data/serena.db. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrir } = require('../db');
const { crearApp } = require('../app');
const { crearServicioAuth } = require('../auth');

let servidor;
let base;

function fechaMas(dias) {
    const f = new Date();
    f.setDate(f.getDate() + dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}
const MANANA = fechaMas(1);

/** Cliente HTTP con su propia cookie de sesión. */
function cliente() {
    let cookie = '';
    return async function pedir(metodo, ruta, cuerpo, { sinCabecera = false } = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (!sinCabecera) headers['X-Serena'] = '1';
        if (cookie) headers.Cookie = cookie;
        const res = await fetch(base + ruta, {
            method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        const texto = await res.text();
        return { status: res.status, body: texto ? JSON.parse(texto) : null, headers: res.headers };
    };
}

const cita = (extra = {}) => ({
    cliente: 'Ana Gómez', telefono: '3001234567', servicio: 'masaje',
    profesional: 'ximena', fecha: MANANA, hora: '10:00', ...extra,
});

let admin;
let recepcion;

before(async () => {
    const db = abrir(':memory:');
    const auth = crearServicioAuth(db);
    auth.crearUsuario({ usuario: 'admin', nombre: 'Admin', rol: 'admin', clave: 'clave-admin-123' });
    auth.crearUsuario({ usuario: 'recepcion', nombre: 'Recepción', rol: 'recepcionista', clave: 'clave-recep-123' });
    servidor = crearApp(db).listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;

    admin = cliente();
    recepcion = cliente();
    assert.equal((await admin('POST', '/api/sesion', { usuario: 'admin', clave: 'clave-admin-123' })).status, 200);
    assert.equal((await recepcion('POST', '/api/sesion', { usuario: 'RECEPCION', clave: 'clave-recep-123' })).status, 200);
});

after(() => servidor.close());

test('sin sesión no se ven ni crean reservas', async () => {
    const anonimo = cliente();
    assert.equal((await anonimo('GET', `/api/reservas?fecha=${MANANA}`)).status, 401);
    assert.equal((await anonimo('POST', '/api/reservas', cita())).status, 401);
});

test('la cookie de sesión es HttpOnly y SameSite=Strict', async () => {
    const c = cliente();
    const r = await c('POST', '/api/sesion', { usuario: 'recepcion', clave: 'clave-recep-123' });
    assert.equal(r.status, 200);
    const set = r.headers.get('set-cookie');
    assert.match(set, /HttpOnly/);
    assert.match(set, /SameSite=Strict/);
});

test('sin la cabecera X-Serena se rechazan cambios (CSRF)', async () => {
    const r = await recepcion('POST', '/api/reservas', cita(), { sinCabecera: true });
    assert.equal(r.status, 403);
});

test('crear, consultar y bloquear doble reserva', async () => {
    const r = await recepcion('POST', '/api/reservas', cita());
    assert.equal(r.status, 201);
    assert.equal(r.body.estado, 'agendada');

    const doble = await recepcion('POST', '/api/reservas', cita({ cliente: 'Otra' }));
    assert.equal(doble.status, 409);
    assert.equal(doble.body.codigo, 'HORA_OCUPADA');

    const otraProfesional = await recepcion('POST', '/api/reservas', cita({ profesional: 'maria' }));
    assert.equal(otraProfesional.status, 201);

    const dia = await recepcion('GET', `/api/reservas?fecha=${MANANA}`);
    assert.equal(dia.body.length, 2);

    const ocupadas = await recepcion('GET', `/api/reservas/ocupadas?fecha=${MANANA}&profesional=ximena`);
    assert.deepEqual(ocupadas.body, ['10:00']);
});

test('dos reservas simultáneas a la misma hora: solo una entra', async () => {
    const intentos = await Promise.all(
        Array.from({ length: 5 }, (_, i) => recepcion('POST', '/api/reservas', cita({ cliente: `Clienta ${i}`, hora: '15:00' }))),
    );
    assert.equal(intentos.filter((r) => r.status === 201).length, 1);
    assert.equal(intentos.filter((r) => r.status === 409).length, 4);
});

test('validaciones del servidor', async () => {
    const casos = [
        cita({ hora: '12:00' }),            // almuerzo
        cita({ telefono: '123' }),          // teléfono corto
        cita({ cliente: '  ' }),            // sin nombre
        cita({ servicio: 'inventado' }),    // servicio inexistente
        cita({ fecha: '2026-02-30' }),      // fecha imposible
        cita({ fecha: fechaMas(-1) }),      // en el pasado
    ];
    for (const datos of casos) {
        const r = await recepcion('POST', '/api/reservas', datos);
        assert.equal(r.status, 400, JSON.stringify(datos));
    }
});

test('editar, cancelar, atender y borrar con permisos', async () => {
    const { body: creada } = await recepcion('POST', '/api/reservas', cita({ hora: '11:00', cliente: 'Bea' }));

    // Editar: cambiar a una hora ocupada falla; a una libre funciona.
    assert.equal((await recepcion('PATCH', `/api/reservas/${creada.id}`, { hora: '10:00' })).status, 409);
    const editada = await recepcion('PATCH', `/api/reservas/${creada.id}`, { hora: '13:00', cliente: 'Beatriz' });
    assert.equal(editada.status, 200);
    assert.equal(editada.body.hora, '13:00');
    assert.equal(editada.body.cliente, 'Beatriz');

    // Atender una cita de mañana no se permite todavía.
    assert.equal((await recepcion('POST', `/api/reservas/${creada.id}/atender`)).status, 409);

    // Cancelar libera la hora y ya no se puede volver a cancelar.
    assert.equal((await recepcion('POST', `/api/reservas/${creada.id}/cancelar`)).status, 200);
    assert.equal((await recepcion('POST', `/api/reservas/${creada.id}/cancelar`)).status, 409);
    const ocupadas = await recepcion('GET', `/api/reservas/ocupadas?fecha=${MANANA}&profesional=ximena`);
    assert.ok(!ocupadas.body.includes('13:00'));

    // Borrar: la recepcionista no puede; la administradora sí.
    const borrarRecep = await recepcion('DELETE', `/api/reservas/${creada.id}`);
    assert.equal(borrarRecep.status, 403);
    assert.equal(borrarRecep.body.codigo, 'NO_AUTORIZADO');
    assert.equal((await admin('DELETE', `/api/reservas/${creada.id}`)).status, 204);
    assert.equal((await admin('GET', `/api/reservas/${creada.id}`)).status, 404);
});

test('cerrar sesión invalida la cookie', async () => {
    const c = cliente();
    assert.equal((await c('POST', '/api/sesion', { usuario: 'admin', clave: 'clave-admin-123' })).status, 200);
    assert.equal((await c('GET', '/api/sesion')).status, 200);
    assert.equal((await c('DELETE', '/api/sesion')).status, 204);
    assert.equal((await c('GET', '/api/sesion')).status, 401);
});

test('config.js entrega el catálogo al navegador', async () => {
    const res = await fetch(`${base}/config.js`);
    const texto = await res.text();
    assert.match(texto, /window\.SERENA_CONFIG/);
    assert.match(texto, /"ximena"/);
});

// Va al final: deja bloqueada la IP de las pruebas por 5 minutos.
test('contraseña incorrecta y bloqueo tras 5 intentos', async () => {
    const intruso = cliente();
    const r = await intruso('POST', '/api/sesion', { usuario: 'admin', clave: 'mala' });
    assert.equal(r.status, 401);
    assert.equal(r.body.mensaje, 'Usuario o contraseña incorrectos.');
    for (let i = 0; i < 4; i++) await intruso('POST', '/api/sesion', { usuario: 'admin', clave: 'mala' });
    // Aun con la contraseña correcta, queda bloqueado.
    const bloqueado = await intruso('POST', '/api/sesion', { usuario: 'admin', clave: 'clave-admin-123' });
    assert.equal(bloqueado.status, 429);
});
