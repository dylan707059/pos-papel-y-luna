// routes/clientes.js - CRUD de clientes

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
  try {
    const { buscar } = req.query;
    let query = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];

    if (buscar) {
      params.push(`%${buscar}%`);
      query += ` AND (nombre ILIKE $${params.length} OR telefono ILIKE $${params.length})`;
    }

    const { rows } = await pool.query(query + ' ORDER BY nombre ASC', params);
    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    const { nombre, telefono, email } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    const { rows } = await pool.query(
      'INSERT INTO clientes (nombre, telefono, email) VALUES ($1, $2, $3) RETURNING id',
      [nombre, telefono || null, email || null]
    );
    res.status(201).json({ id: rows[0].id, mensaje: 'Cliente creado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { nombre, telefono, email } = req.body;
    const { rows } = await pool.query('SELECT id FROM clientes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });

    await pool.query('UPDATE clientes SET nombre=$1, telefono=$2, email=$3 WHERE id=$4', [nombre, telefono || null, email || null, req.params.id]);
    res.json({ mensaje: 'Cliente actualizado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM clientes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });

    await pool.query('DELETE FROM clientes WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Cliente eliminado.' });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
