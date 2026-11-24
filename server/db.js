/* =========================================================
   Base de datos SQLite (archivo local en data/serena.db).
   Usa el módulo sqlite que trae Node (sin dependencias extra).
   ========================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { RUTA_BD } = require('./config');

// Cada migración se aplica una sola vez; PRAGMA user_version guarda la última aplicada.
const MIGRACIONES = [
    `
    CREATE TABLE usuarios (
        id          INTEGER PRIMARY KEY,
        usuario     TEXT NOT NULL UNIQUE COLLATE NOCASE,
        nombre      TEXT NOT NULL,
        rol         TEXT NOT NULL CHECK (rol IN ('admin', 'recepcionista')),
        clave_hash  TEXT NOT NULL,
        activo      INTEGER NOT NULL DEFAULT 1,
        creado_en   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE sesiones (
        token_hash  TEXT PRIMARY KEY,
        usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        expira_en   INTEGER NOT NULL
    );

    CREATE TABLE reservas (
        id            TEXT PRIMARY KEY,
        cliente       TEXT NOT NULL,
        telefono      TEXT NOT NULL,
        servicio      TEXT NOT NULL,
        profesional   TEXT NOT NULL,
        fecha         TEXT NOT NULL,
        hora          TEXT NOT NULL,
        estado        TEXT NOT NULL DEFAULT 'agendada'
                      CHECK (estado IN ('agendada', 'atendida', 'cancelada')),
        creada_en     TEXT NOT NULL,
        creada_por    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        modificada_en TEXT,
        atendida_en   TEXT,
        cancelada_en  TEXT
    );

    -- Garantía final contra dobles reservas (HU #06), aunque lleguen dos al mismo tiempo.
    CREATE UNIQUE INDEX reservas_sin_cruce
        ON reservas (fecha, hora, profesional)
        WHERE estado <> 'cancelada';

    CREATE INDEX reservas_por_fecha ON reservas (fecha);
    CREATE INDEX reservas_por_estado ON reservas (estado, fecha, hora);
    `,
];

function abrir(ruta = RUTA_BD) {
    if (ruta !== ':memory:') fs.mkdirSync(path.dirname(ruta), { recursive: true });
    const db = new DatabaseSync(ruta);

    db.exec(`
        PRAGMA journal_mode = WAL;     -- lecturas y escrituras sin bloquearse
        PRAGMA synchronous = FULL;     -- no perder datos ante un corte de energía (HU #09)
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
    `);

    const version = db.prepare('PRAGMA user_version').get().user_version;
    for (let i = version; i < MIGRACIONES.length; i++) {
        db.exec('BEGIN');
        try {
            db.exec(MIGRACIONES[i]);
            db.exec(`PRAGMA user_version = ${i + 1}`);
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }
    return db;
}

/** Ejecuta `fn` dentro de una transacción. */
function transaccion(db, fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const resultado = fn();
        db.exec('COMMIT');
        return resultado;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = { abrir, transaccion };
