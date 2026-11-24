/* =========================================================
   Capa de datos: habla con el servidor (server/app.js).
   El resto de la página solo usa estas funciones.
   ========================================================= */
const ReservasAPI = (() => {
    const { HORAS } = window.SERENA_CONFIG;

    class ErrorReserva extends Error {
        constructor(codigo, mensaje) {
            super(mensaje);
            this.codigo = codigo;
        }
    }

    function irAlLogin() {
        if (!location.pathname.endsWith('/login.html')) location.href = 'login.html';
    }

    async function pedir(metodo, ruta, cuerpo) {
        let respuesta;
        try {
            respuesta = await fetch(`api${ruta}`, {
                method: metodo,
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Serena': '1', // el servidor rechaza cambios sin esta cabecera (CSRF)
                },
                body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
            });
        } catch {
            throw new ErrorReserva('SIN_CONEXION',
                'No se pudo conectar con el servidor. Verifica que esté encendido e intenta de nuevo.');
        }

        if (respuesta.status === 204) return null;

        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            // respuesta sin JSON
        }

        if (!respuesta.ok) {
            if (respuesta.status === 401 && ruta !== '/sesion') irAlLogin();
            throw new ErrorReserva(
                (datos && datos.codigo) || 'ERROR',
                (datos && datos.mensaje) || 'Ocurrió un error. Intenta de nuevo.',
            );
        }
        return datos;
    }

    const id = (valor) => encodeURIComponent(valor);

    return {
        HORAS,
        ErrorReserva,

        /* Reservas */
        listarDelDia: (fecha) => pedir('GET', `/reservas?fecha=${id(fecha)}`),
        listarPendientes: () => pedir('GET', '/reservas?estado=agendada'),
        obtener: (reservaId) => pedir('GET', `/reservas/${id(reservaId)}`),
        horasOcupadas: (fecha, profesional, excluirId = '') =>
            pedir('GET', `/reservas/ocupadas?fecha=${id(fecha)}&profesional=${id(profesional)}&excluir=${id(excluirId || '')}`),
        crear: (datos) => pedir('POST', '/reservas', datos),
        actualizar: (reservaId, datos) => pedir('PATCH', `/reservas/${id(reservaId)}`, datos),
        cancelar: (reservaId) => pedir('POST', `/reservas/${id(reservaId)}/cancelar`),
        marcarAtendida: (reservaId) => pedir('POST', `/reservas/${id(reservaId)}/atender`),
        borrar: (reservaId) => pedir('DELETE', `/reservas/${id(reservaId)}`),

        /* Sesión */
        iniciarSesion: (usuario, clave) => pedir('POST', '/sesion', { usuario, clave }),
        sesionActual: () => pedir('GET', '/sesion').then((r) => r.usuario),
        cerrarSesion: () => pedir('DELETE', '/sesion'),
    };
})();
