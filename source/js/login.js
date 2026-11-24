/* =========================================================
   Página de ingreso
   ========================================================= */
(() => {
    const form = document.getElementById('login-form');
    const error = document.getElementById('login-error');
    const boton = form.querySelector('button[type="submit"]');

    function mostrarError(mensaje) {
        error.textContent = mensaje;
        error.hidden = !mensaje;
    }

    // Si ya hay una sesión abierta, entrar directo.
    ReservasAPI.sesionActual()
        .then(() => location.replace('./'))
        .catch(() => { /* sin sesión: quedarse en el login */ });

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        mostrarError('');
        if (!form.reportValidity()) return;

        boton.disabled = true;
        boton.textContent = 'Ingresando…';
        try {
            await ReservasAPI.iniciarSesion(form.usuario.value.trim(), form.clave.value);
            location.replace('./');
        } catch (e) {
            mostrarError(e.message);
            form.clave.value = '';
            form.clave.focus();
            boton.disabled = false;
            boton.textContent = 'Ingresar';
        }
    });
})();
