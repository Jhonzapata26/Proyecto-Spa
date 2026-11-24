/** Error con código y estado HTTP que se devuelve tal cual al navegador. */
class ErrorApp extends Error {
    constructor(status, codigo, mensaje) {
        super(mensaje);
        this.status = status;
        this.codigo = codigo;
    }
}

module.exports = { ErrorApp };
