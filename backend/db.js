// db.js - conexión a la base de datos PostgreSQL
// usamos pg (node-postgres) para conectarnos

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// El Pool maneja las conexiones automáticamente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // en producción (Render) necesita SSL, en local no
  ssl: { rejectUnauthorized: false }
});

// Crear todas las tablas si no existen
async function iniciarDB() {
  const client = await pool.connect();

  try {
    await client.query(`

      CREATE TABLE IF NOT EXISTS usuarios (
        id         SERIAL PRIMARY KEY,
        nombre     TEXT NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        rol        TEXT NOT NULL CHECK(rol IN ('admin', 'cajero')),
        creado_en  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categorias (
        id     SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE,
        color  TEXT DEFAULT '#6B7280',
        icono  TEXT DEFAULT '📦'
      );

      CREATE TABLE IF NOT EXISTS productos (
        id                     SERIAL PRIMARY KEY,
        nombre                 TEXT NOT NULL,
        categoria_id           INTEGER REFERENCES categorias(id),
        precio                 NUMERIC NOT NULL DEFAULT 0,
        costo                  NUMERIC NOT NULL DEFAULT 0,
        stock                  NUMERIC DEFAULT 0,
        seguimiento_inventario BOOLEAN DEFAULT TRUE,
        codigo_interno         TEXT,
        codigo_barras          TEXT,
        imagen_url             TEXT,
        activo                 BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS clientes (
        id         SERIAL PRIMARY KEY,
        nombre     TEXT NOT NULL,
        telefono   TEXT,
        email      TEXT,
        saldo_debe NUMERIC DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS proveedores (
        id       SERIAL PRIMARY KEY,
        nombre   TEXT NOT NULL,
        nit      TEXT,
        telefono TEXT,
        email    TEXT
      );

      CREATE TABLE IF NOT EXISTS descuentos (
        id     SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        tipo   TEXT NOT NULL CHECK(tipo IN ('porcentaje', 'fijo')),
        valor  NUMERIC NOT NULL,
        activo BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS ventas (
        id              SERIAL PRIMARY KEY,
        fecha           TIMESTAMP DEFAULT NOW(),
        estado          TEXT DEFAULT 'cerrada' CHECK(estado IN ('abierta','guardada','cerrada','anulada')),
        cliente_id      INTEGER REFERENCES clientes(id),
        metodo_pago     TEXT,
        descuento_id    INTEGER REFERENCES descuentos(id),
        descuento_valor NUMERIC DEFAULT 0,
        total           NUMERIC DEFAULT 0,
        dinero_recibido NUMERIC DEFAULT 0,
        cambio          NUMERIC DEFAULT 0,
        corregida       BOOLEAN DEFAULT FALSE,
        corregida_por   INTEGER REFERENCES usuarios(id),
        corregida_en    TIMESTAMP,
        notas           TEXT
      );

      CREATE TABLE IF NOT EXISTS items_venta (
        id              SERIAL PRIMARY KEY,
        venta_id        INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id     INTEGER NOT NULL REFERENCES productos(id),
        cantidad        NUMERIC NOT NULL,
        precio_unitario NUMERIC NOT NULL,
        subtotal        NUMERIC NOT NULL
      );

      CREATE TABLE IF NOT EXISTS compras (
        id           SERIAL PRIMARY KEY,
        proveedor_id INTEGER REFERENCES proveedores(id),
        fecha        TIMESTAMP DEFAULT NOW(),
        metodo_pago  TEXT NOT NULL,
        total        NUMERIC DEFAULT 0,
        notas        TEXT
      );

      CREATE TABLE IF NOT EXISTS items_compra (
        id             SERIAL PRIMARY KEY,
        compra_id      INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
        producto_id    INTEGER NOT NULL REFERENCES productos(id),
        cantidad       NUMERIC NOT NULL,
        costo_unitario NUMERIC NOT NULL,
        subtotal       NUMERIC NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reembolsos (
        id                SERIAL PRIMARY KEY,
        venta_id          INTEGER NOT NULL REFERENCES ventas(id),
        fecha             TIMESTAMP DEFAULT NOW(),
        tipo              TEXT NOT NULL CHECK(tipo IN ('total','parcial')),
        total_reembolsado NUMERIC NOT NULL,
        fuente            TEXT DEFAULT 'Caja',
        usuario_id        INTEGER REFERENCES usuarios(id)
      );

      CREATE TABLE IF NOT EXISTS items_reembolso (
        id                 SERIAL PRIMARY KEY,
        reembolso_id       INTEGER NOT NULL REFERENCES reembolsos(id) ON DELETE CASCADE,
        producto_id        INTEGER NOT NULL REFERENCES productos(id),
        cantidad           NUMERIC NOT NULL,
        subtotal           NUMERIC NOT NULL,
        retorna_inventario BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS faltantes (
        id              SERIAL PRIMARY KEY,
        nombre_producto TEXT NOT NULL,
        fecha           TIMESTAMP DEFAULT NOW(),
        cantidad        INTEGER,
        tipo            TEXT DEFAULT 'no_registrado' CHECK(tipo IN ('agotado','no_registrado')),
        estado          TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','resuelto','descartado')),
        observacion     TEXT,
        proveedor_id    INTEGER REFERENCES proveedores(id)
      );

    `);

    // crear usuarios por defecto si no existen
    const { rows } = await client.query("SELECT id FROM usuarios WHERE email = 'admin@pos.com'");

    if (rows.length === 0) {
      const passAdmin  = bcrypt.hashSync('admin123', 10);
      const passCajero = bcrypt.hashSync('cajero123', 10);

      await client.query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
        ['Administrador', 'admin@pos.com', passAdmin, 'admin']
      );
      await client.query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
        ['Cajero', 'cajero@pos.com', passCajero, 'cajero']
      );

      // categorías de ejemplo para la papelería
      await client.query("INSERT INTO categorias (nombre, color, icono) VALUES ($1, $2, $3)", ['Útiles escolares', '#3B82F6', '✏️']);
      await client.query("INSERT INTO categorias (nombre, color, icono) VALUES ($1, $2, $3)", ['Papelería', '#10B981', '📄']);
      await client.query("INSERT INTO categorias (nombre, color, icono) VALUES ($1, $2, $3)", ['Manualidades', '#F59E0B', '🎨']);
      await client.query("INSERT INTO categorias (nombre, color, icono) VALUES ($1, $2, $3)", ['Miscelánea', '#8B5CF6', '🛍️']);

      console.log('Base de datos lista. Usuarios creados:');
      console.log('  admin@pos.com / admin123');
      console.log('  cajero@pos.com / cajero123');
    }

  } finally {
    client.release();
  }
}

module.exports = { pool, iniciarDB };
