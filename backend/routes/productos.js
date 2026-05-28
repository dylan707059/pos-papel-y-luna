// routes/productos.js - CRUD de productos

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// GET /productos
router.get('/', verificarToken, async (req, res) => {
  try {
    const { buscar, categoria_id } = req.query;

    let query  = `
      SELECT p.*, c.nombre AS categoria_nombre, c.color AS categoria_color
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = true
    `;
    const params = [];

    if (categoria_id) {
      params.push(categoria_id);
      query += ` AND p.categoria_id = $${params.length}`;
    }
    if (buscar) {
      params.push(`%${buscar}%`);
      query += ` AND (p.nombre ILIKE $${params.length} OR p.codigo_interno ILIKE $${params.length} OR p.codigo_barras ILIKE $${params.length})`;
    }

    query += ' ORDER BY p.nombre ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /productos/:id
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = $1 AND p.activo = true
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /productos
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, categoria_id, precio, costo, stock, seguimiento_inventario, codigo_interno, codigo_barras, imagen_url } = req.body;

    if (!nombre)        return res.status(400).json({ error: 'El nombre es requerido.' });
    if (precio == null) return res.status(400).json({ error: 'El precio es requerido.' });

    const { rows } = await pool.query(`
      INSERT INTO productos (nombre, categoria_id, precio, costo, stock, seguimiento_inventario, codigo_interno, codigo_barras, imagen_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [nombre, categoria_id || null, precio, costo || 0, stock || 0, seguimiento_inventario ?? true, codigo_interno || null, codigo_barras || null, imagen_url || null]);

    res.status(201).json({ id: rows[0].id, mensaje: 'Producto creado.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /productos/:id
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, categoria_id, precio, costo, stock, seguimiento_inventario, codigo_interno, codigo_barras, imagen_url } = req.body;

    const { rows } = await pool.query('SELECT id FROM productos WHERE id = $1 AND activo = true', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });

    await pool.query(`
      UPDATE productos
      SET nombre=$1, categoria_id=$2, precio=$3, costo=$4, stock=$5,
          seguimiento_inventario=$6, codigo_interno=$7, codigo_barras=$8, imagen_url=$9
      WHERE id = $10
    `, [nombre, categoria_id || null, precio, costo || 0, stock || 0, seguimiento_inventario ?? true, codigo_interno || null, codigo_barras || null, imagen_url || null, req.params.id]);

    res.json({ mensaje: 'Producto actualizado.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /productos/:id - soft delete
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM productos WHERE id = $1 AND activo = true', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });

    await pool.query('UPDATE productos SET activo = false WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Producto eliminado.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
