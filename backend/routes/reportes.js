// routes/reportes.js - reportes básicos del negocio

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken } = require('../middleware/auth');

// GET /reportes/ventas?desde=&hasta=
router.get('/ventas', verificarToken, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { where, params } = filtroFechas('v.fecha', desde, hasta);

    const { rows: resumen } = await pool.query(`
      SELECT
        COUNT(*) AS total_ventas,
        SUM(v.total) AS ingresos_totales,
        AVG(v.total) AS ticket_promedio,
        SUM(CASE WHEN v.metodo_pago='Efectivo' THEN 1 ELSE 0 END) AS ventas_efectivo,
        SUM(CASE WHEN v.metodo_pago='Nequi'    THEN 1 ELSE 0 END) AS ventas_nequi,
        SUM(CASE WHEN v.metodo_pago='Debe'     THEN 1 ELSE 0 END) AS ventas_debe
      FROM ventas v
      WHERE v.estado = 'cerrada' ${where}
    `, params);

    const { rows: porDia } = await pool.query(`
      SELECT v.fecha::date AS dia, COUNT(*) AS cantidad, SUM(v.total) AS total
      FROM ventas v
      WHERE v.estado = 'cerrada' ${where}
      GROUP BY v.fecha::date
      ORDER BY dia ASC
    `, params);

    res.json({ resumen: resumen[0], porDia });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /reportes/productos-mas-vendidos?desde=&hasta=
router.get('/productos-mas-vendidos', verificarToken, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { where, params } = filtroFechas('v.fecha', desde, hasta);

    const { rows } = await pool.query(`
      SELECT p.id, p.nombre,
             SUM(iv.cantidad) AS unidades_vendidas,
             SUM(iv.subtotal) AS total_generado
      FROM items_venta iv
      JOIN ventas    v ON iv.venta_id    = v.id
      JOIN productos p ON iv.producto_id = p.id
      WHERE v.estado = 'cerrada' ${where}
      GROUP BY p.id, p.nombre
      ORDER BY unidades_vendidas DESC
      LIMIT 10
    `, params);

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /reportes/compras?desde=&hasta=
router.get('/compras', verificarToken, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { where, params } = filtroFechas('c.fecha', desde, hasta);

    const { rows: resumen } = await pool.query(`
      SELECT COUNT(*) AS total_compras, SUM(total) AS gasto_total
      FROM compras c WHERE 1=1 ${where}
    `, params);

    const { rows: detalle } = await pool.query(`
      SELECT c.*, p.nombre AS proveedor_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      WHERE 1=1 ${where}
      ORDER BY c.fecha DESC
    `, params);

    res.json({ resumen: resumen[0], detalle });

  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /reportes/faltantes
router.get('/faltantes', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT MIN(nombre_producto) AS nombre_producto,
             COUNT(*) AS veces_solicitado,
             SUM(COALESCE(cantidad, 1)) AS cantidad_total,
             MAX(fecha) AS ultima_fecha
      FROM faltantes
      GROUP BY LOWER(TRIM(nombre_producto))
      ORDER BY veces_solicitado DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// helper para construir filtros de fecha
function filtroFechas(campo, desde, hasta) {
  let where  = '';
  const params = [];

  if (desde) { params.push(desde); where += ` AND ${campo}::date >= $${params.length}`; }
  if (hasta) { params.push(hasta); where += ` AND ${campo}::date <= $${params.length}`; }

  return { where, params };
}

module.exports = router;
