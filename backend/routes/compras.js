// routes/compras.js - registro e historial de compras

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// GET /compras
router.get('/', verificarToken, async (req, res) => {
  try {
    const { proveedor_id, desde, hasta } = req.query;

    let query = `
      SELECT c.*, p.nombre AS proveedor_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (proveedor_id) { params.push(proveedor_id); query += ` AND c.proveedor_id = $${params.length}`; }
    if (desde)        { params.push(desde);        query += ` AND c.fecha::date >= $${params.length}`; }
    if (hasta)        { params.push(hasta);        query += ` AND c.fecha::date <= $${params.length}`; }

    query += ' ORDER BY c.fecha DESC';

    const { rows: compras } = await pool.query(query, params);

    // agregar items a cada compra
    for (const compra of compras) {
      const { rows } = await pool.query(`
        SELECT ic.*, p.nombre AS producto_nombre
        FROM items_compra ic
        JOIN productos p ON ic.producto_id = p.id
        WHERE ic.compra_id = $1
      `, [compra.id]);
      compra.items = rows;
    }

    res.json(compras);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /compras/:id
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, p.nombre AS proveedor_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      WHERE c.id = $1
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Compra no encontrada.' });

    const { rows: items } = await pool.query(`
      SELECT ic.*, p.nombre AS producto_nombre
      FROM items_compra ic
      JOIN productos p ON ic.producto_id = p.id
      WHERE ic.compra_id = $1
    `, [req.params.id]);

    rows[0].items = items;
    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /compras
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { proveedor_id, metodo_pago, items, notas } = req.body;

    if (!metodo_pago)              return res.status(400).json({ error: 'El método de pago es requerido.' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'La compra debe tener al menos un producto.' });

    const total = items.reduce((s, i) => s + (i.cantidad * i.costo_unitario), 0);

    await client.query('BEGIN');

    const { rows } = await client.query(
      'INSERT INTO compras (proveedor_id, metodo_pago, total, notas) VALUES ($1, $2, $3, $4) RETURNING id',
      [proveedor_id || null, metodo_pago, total, notas || null]
    );
    const compraId = rows[0].id;

    for (const item of items) {
      const sub = item.cantidad * item.costo_unitario;
      await client.query(
        'INSERT INTO items_compra (compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [compraId, item.producto_id, item.cantidad, item.costo_unitario, sub]
      );
      // actualizar stock y costo del producto
      await client.query(
        'UPDATE productos SET stock = stock + $1, costo = $2 WHERE id = $3 AND seguimiento_inventario = true',
        [item.cantidad, item.costo_unitario, item.producto_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: compraId, mensaje: 'Compra registrada.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

module.exports = router;
