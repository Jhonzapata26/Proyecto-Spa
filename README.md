# Serena – Sistema de agendamiento

Sistema web para agendar citas en **Serena Centro Estético**. Corre en el equipo de recepción
y guarda la información en una base de datos local (SQLite), sin servicios externos.

## Requisitos

- [Node.js](https://nodejs.org/) **22.13 o superior** (trae SQLite incluido).

## Instalación

```bash
npm install
npm run crear-usuario   # crea el primer usuario (se recomienda rol admin)
npm start
```

Luego abre <http://localhost:3000> en el navegador e ingresa con el usuario creado.

## Roles

| Acción                                      | Recepcionista | Administradora |
|---------------------------------------------|:-------------:|:--------------:|
| Agendar, editar y reagendar citas           | ✅            | ✅             |
| Marcar como atendida y cancelar             | ✅            | ✅             |
| Borrar citas definitivamente                | ❌            | ✅             |

Los usuarios se crean con `npm run crear-usuario`. Si alguien olvida su contraseña (o la creó mal),
se cambia con `npm run cambiar-clave`, que además muestra la lista de usuarios registrados.

## Configuración

Variables de entorno opcionales:

| Variable  | Por defecto          | Para qué sirve                                                        |
|-----------|----------------------|-----------------------------------------------------------------------|
| `PORT`    | `3000`               | Puerto del servidor.                                                  |
| `HOST`    | `127.0.0.1`          | `0.0.0.0` para abrirlo a la red local (usar desde el celular).        |
| `RUTA_BD` | `data/serena.db`     | Ubicación del archivo de la base de datos.                            |

Horario de atención, servicios y profesionales se cambian en `server/config.js`.

> ⚠️ Con `HOST=0.0.0.0` las contraseñas viajan sin cifrar por el wifi del local hasta
> que se configure HTTPS. Úsalo solo en una red de confianza.

## Pruebas

```bash
npm test
```

## Estructura

```
server/          servidor (Express + SQLite)
  config.js      horario, servicios, profesionales y ajustes
  db.js          base de datos y migraciones
  reservas.js    reglas de negocio de las citas
  auth.js        usuarios, contraseñas y sesiones
  app.js         rutas de la API
  scripts/       crear-usuario y cambiar-clave
  test/          pruebas de la API
source/          página web (HTML, CSS y JavaScript sin frameworks)
data/            base de datos (no se sube al repositorio)
```
