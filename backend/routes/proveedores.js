// routes/proveedores.js - CRUD de proveedores

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proveedores ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proveedores WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, nit, telefono, email } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    const { rows } = await pool.query(
      'INSERT INTO proveedores (nombre, nit, telefono, email) VALUES ($1, $2, $3, $4) RETURNING id',
      [nombre, nit || null, telefono || null, email || null]
    );
    res.status(201).json({ id: rows[0].id, mensaje: 'Proveedor creado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, nit, telefono, email } = req.body;
    const { rows } = await pool.query('SELECT id FROM proveedores WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado.' });

    await pool.query('UPDATE proveedores SET nombre=$1, nit=$2, telefono=$3, email=$4 WHERE id=$5', [nombre, nit || null, telefono || null, email || null, req.params.id]);
    res.json({ mensaje: 'Proveedor actualizado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM proveedores WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado.' });

    await pool.query('DELETE FROM proveedores WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Proveedor eliminado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
