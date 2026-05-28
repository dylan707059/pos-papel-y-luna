// routes/descuentos.js - CRUD de descuentos

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM descuentos WHERE activo = true ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, tipo, valor } = req.body;

    if (!nombre)       return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!tipo)         return res.status(400).json({ error: 'El tipo es requerido.' });
    if (valor == null) return res.status(400).json({ error: 'El valor es requerido.' });
    if (!['porcentaje', 'fijo'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });

    const { rows } = await pool.query(
      'INSERT INTO descuentos (nombre, tipo, valor) VALUES ($1, $2, $3) RETURNING id',
      [nombre, tipo, valor]
    );
    res.status(201).json({ id: rows[0].id, mensaje: 'Descuento creado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, tipo, valor } = req.body;
    const { rows } = await pool.query('SELECT id FROM descuentos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Descuento no encontrado.' });

    await pool.query('UPDATE descuentos SET nombre=$1, tipo=$2, valor=$3 WHERE id=$4', [nombre, tipo, valor, req.params.id]);
    res.json({ mensaje: 'Descuento actualizado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM descuentos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Descuento no encontrado.' });

    // soft delete para no romper ventas antiguas que usaron este descuento
    await pool.query('UPDATE descuentos SET activo = false WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Descuento eliminado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
