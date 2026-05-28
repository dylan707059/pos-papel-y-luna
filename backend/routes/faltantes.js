// routes/faltantes.js - productos faltantes o agotados

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// GET /faltantes
router.get('/', verificarToken, async (req, res) => {
  try {
    const { estado, tipo, proveedor_id, desde, hasta } = req.query;

    let query = `
      SELECT f.*, p.nombre AS proveedor_nombre
      FROM faltantes f
      LEFT JOIN proveedores p ON f.proveedor_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (estado)      { params.push(estado);       query += ` AND f.estado = $${params.length}`; }
    if (tipo)        { params.push(tipo);          query += ` AND f.tipo = $${params.length}`; }
    if (proveedor_id){ params.push(proveedor_id);  query += ` AND f.proveedor_id = $${params.length}`; }
    if (desde)       { params.push(desde);         query += ` AND f.fecha::date >= $${params.length}`; }
    if (hasta)       { params.push(hasta);         query += ` AND f.fecha::date <= $${params.length}`; }

    query += ' ORDER BY f.fecha DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /faltantes/reporte - agrupado para planear compras
router.get('/reporte', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT nombre_producto,
             COUNT(*) AS veces_solicitado,
             SUM(COALESCE(cantidad, 1)) AS cantidad_total,
             MAX(fecha) AS ultima_fecha
      FROM faltantes
      WHERE estado = 'pendiente'
      GROUP BY LOWER(TRIM(nombre_producto))
      ORDER BY veces_solicitado DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /faltantes
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nombre_producto, cantidad, tipo, observacion, proveedor_id } = req.body;
    if (!nombre_producto) return res.status(400).json({ error: 'El nombre del producto es requerido.' });

    const { rows } = await pool.query(`
      INSERT INTO faltantes (nombre_producto, cantidad, tipo, observacion, proveedor_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [nombre_producto, cantidad || null, tipo || 'no_registrado', observacion || null, proveedor_id || null]);

    res.status(201).json({ id: rows[0].id, mensaje: 'Faltante registrado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /faltantes/:id/estado
router.put('/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['pendiente', 'resuelto', 'descartado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido.' });
    }

    const { rows } = await pool.query('SELECT id FROM faltantes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Faltante no encontrado.' });

    await pool.query('UPDATE faltantes SET estado = $1 WHERE id = $2', [estado, req.params.id]);
    res.json({ mensaje: `Faltante marcado como ${estado}.` });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /faltantes/:id
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM faltantes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Faltante no encontrado.' });

    await pool.query('DELETE FROM faltantes WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Faltante eliminado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
