// routes/categorias.js - CRUD de categorías

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categorias ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, color, icono } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    const { rows } = await pool.query(
      'INSERT INTO categorias (nombre, color, icono) VALUES ($1, $2, $3) RETURNING id',
      [nombre, color || '#6B7280', icono || '📦']
    );
    res.status(201).json({ id: rows[0].id, mensaje: 'Categoría creada.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, color, icono } = req.body;
    const { rows } = await pool.query('SELECT id FROM categorias WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Categoría no encontrada.' });

    await pool.query('UPDATE categorias SET nombre=$1, color=$2, icono=$3 WHERE id=$4', [nombre, color, icono, req.params.id]);
    res.json({ mensaje: 'Categoría actualizada.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM categorias WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Categoría no encontrada.' });

    await pool.query('DELETE FROM categorias WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Categoría eliminada.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
