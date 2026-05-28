// routes/ventas.js - ventas, correcciones y reembolsos

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// GET /ventas - historial con filtros opcionales
router.get('/', verificarToken, async (req, res) => {
  try {
    const { estado, metodo_pago, cliente_id, desde, hasta } = req.query;

    let query = `
      SELECT v.*,
             c.nombre AS cliente_nombre,
             u.nombre AS corregida_por_nombre,
             (SELECT COUNT(*) FROM reembolsos r WHERE r.venta_id = v.id) AS total_reembolsos
      FROM ventas v
      LEFT JOIN clientes  c ON v.cliente_id    = c.id
      LEFT JOIN usuarios  u ON v.corregida_por = u.id
      WHERE 1=1
    `;
    const params = [];

    if (estado)      { params.push(estado);      query += ` AND v.estado = $${params.length}`; }
    if (metodo_pago) { params.push(metodo_pago); query += ` AND v.metodo_pago = $${params.length}`; }
    if (cliente_id)  { params.push(cliente_id);  query += ` AND v.cliente_id = $${params.length}`; }
    if (desde)       { params.push(desde);       query += ` AND v.fecha::date >= $${params.length}`; }
    if (hasta)       { params.push(hasta);       query += ` AND v.fecha::date <= $${params.length}`; }

    query += ' ORDER BY v.fecha DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /ventas/:id - detalle con items y reembolsos
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows: ventaRows } = await pool.query(`
      SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS corregida_por_nombre
      FROM ventas v
      LEFT JOIN clientes  c ON v.cliente_id    = c.id
      LEFT JOIN usuarios  u ON v.corregida_por = u.id
      WHERE v.id = $1
    `, [req.params.id]);

    const venta = ventaRows[0];
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    // items de la venta
    const { rows: items } = await pool.query(`
      SELECT iv.*, p.nombre AS producto_nombre
      FROM items_venta iv
      JOIN productos p ON iv.producto_id = p.id
      WHERE iv.venta_id = $1
    `, [req.params.id]);

    // reembolsos con sus items
    const { rows: reembolsos } = await pool.query(`
      SELECT r.*, u.nombre AS usuario_nombre
      FROM reembolsos r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.venta_id = $1
      ORDER BY r.fecha DESC
    `, [req.params.id]);

    for (const r of reembolsos) {
      const { rows: itemsR } = await pool.query(`
        SELECT ir.*, p.nombre AS producto_nombre
        FROM items_reembolso ir
        JOIN productos p ON ir.producto_id = p.id
        WHERE ir.reembolso_id = $1
      `, [r.id]);
      r.items = itemsR;
    }

    // cuánto se ha reembolsado por producto (para el modal de reembolso)
    const { rows: reembolsadoPorProd } = await pool.query(`
      SELECT ir.producto_id, SUM(ir.cantidad) AS cantidad
      FROM items_reembolso ir
      JOIN reembolsos r ON ir.reembolso_id = r.id
      WHERE r.venta_id = $1
      GROUP BY ir.producto_id
    `, [req.params.id]);

    const ya_reembolsado = {};
    for (const r of reembolsadoPorProd) {
      ya_reembolsado[r.producto_id] = parseFloat(r.cantidad);
    }

    venta.items          = items;
    venta.reembolsos     = reembolsos;
    venta.ya_reembolsado = ya_reembolsado;

    res.json(venta);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /ventas - crear y cerrar una venta
router.post('/', verificarToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { cliente_id, metodo_pago, items, descuento_id, descuento_valor, dinero_recibido, estado } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un producto.' });

    const descVal    = descuento_valor || 0;
    const subtotal   = items.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0);
    const total      = Math.max(0, subtotal - descVal);
    const estadoFinal = estado || 'cerrada';
    const cambio     = metodo_pago === 'Efectivo' ? Math.max(0, (dinero_recibido || 0) - total) : 0;

    await client.query('BEGIN');

    const { rows } = await client.query(`
      INSERT INTO ventas (cliente_id, metodo_pago, descuento_id, descuento_valor, total, dinero_recibido, cambio, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [cliente_id || null, metodo_pago || null, descuento_id || null, descVal, total, dinero_recibido || 0, cambio, estadoFinal]);

    const ventaId = rows[0].id;

    for (const item of items) {
      const sub = item.cantidad * item.precio_unitario;
      await client.query(
        'INSERT INTO items_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [ventaId, item.producto_id, item.cantidad, item.precio_unitario, sub]
      );
    }

    if (estadoFinal === 'cerrada') {
      for (const item of items) {
        await client.query(
          'UPDATE productos SET stock = stock - $1 WHERE id = $2 AND seguimiento_inventario = true',
          [item.cantidad, item.producto_id]
        );
      }

      if (metodo_pago === 'Debe' && cliente_id) {
        await client.query('UPDATE clientes SET saldo_debe = saldo_debe + $1 WHERE id = $2', [total, cliente_id]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ id: ventaId, total, cambio, mensaje: 'Venta registrada.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// PUT /ventas/:id - corregir o cerrar una venta guardada
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { cliente_id, metodo_pago, items, descuento_id, descuento_valor, dinero_recibido, estado } = req.body;

    const { rows: ventaRows } = await client.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
    const venta = ventaRows[0];

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });
    if (venta.estado !== 'cerrada' && venta.estado !== 'guardada') {
      return res.status(400).json({ error: 'Solo se pueden modificar ventas cerradas o guardadas.' });
    }
    if (!items || items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un producto.' });

    // no dejar corregir si ya tiene reembolsos
    const { rows: rCount } = await client.query('SELECT COUNT(*) AS total FROM reembolsos WHERE venta_id = $1', [req.params.id]);
    if (parseInt(rCount[0].total) > 0) {
      return res.status(400).json({ error: 'No se puede corregir una venta que ya tiene reembolsos.' });
    }

    const eraGuardada = venta.estado === 'guardada';

    await client.query('BEGIN');

    // restaurar inventario de los items anteriores
    const { rows: itemsAnteriores } = await client.query('SELECT * FROM items_venta WHERE venta_id = $1', [req.params.id]);
    if (!eraGuardada) {
      for (const item of itemsAnteriores) {
        await client.query(
          'UPDATE productos SET stock = stock + $1 WHERE id = $2 AND seguimiento_inventario = true',
          [item.cantidad, item.producto_id]
        );
      }
    }

    // borrar items anteriores
    await client.query('DELETE FROM items_venta WHERE venta_id = $1', [req.params.id]);

    // calcular nuevo total
    const descVal  = descuento_valor || 0;
    const subtotal = items.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0);
    const total    = Math.max(0, subtotal - descVal);
    const cambio   = metodo_pago === 'Efectivo' ? Math.max(0, (dinero_recibido || 0) - total) : 0;

    // insertar nuevos items
    for (const item of items) {
      const sub = item.cantidad * item.precio_unitario;
      await client.query(
        'INSERT INTO items_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [req.params.id, item.producto_id, item.cantidad, item.precio_unitario, sub]
      );
      // descontar inventario
      await client.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2 AND seguimiento_inventario = true',
        [item.cantidad, item.producto_id]
      );
    }

    // actualizar la venta
    await client.query(`
      UPDATE ventas
      SET cliente_id=$1, metodo_pago=$2, descuento_id=$3, descuento_valor=$4,
          total=$5, dinero_recibido=$6, cambio=$7, estado='cerrada',
          corregida=$8, corregida_por=$9, corregida_en=$10
      WHERE id=$11
    `, [
      cliente_id   || null,
      metodo_pago,
      descuento_id || null,
      descVal,
      total,
      dinero_recibido || 0,
      cambio,
      eraGuardada ? false : true,
      eraGuardada ? null  : req.usuario.id,
      eraGuardada ? null  : new Date(),
      req.params.id
    ]);

    await client.query('COMMIT');
    res.json({ total, cambio, mensaje: eraGuardada ? 'Venta cerrada.' : 'Venta corregida.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// DELETE /ventas/:id - anular venta
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
    const venta = rows[0];

    if (!venta)                    return res.status(404).json({ error: 'Venta no encontrada.' });
    if (venta.estado === 'anulada') return res.status(400).json({ error: 'La venta ya está anulada.' });

    await client.query('BEGIN');

    if (venta.estado === 'cerrada') {
      const { rows: items } = await client.query('SELECT * FROM items_venta WHERE venta_id = $1', [req.params.id]);

      // calcular lo que ya fue devuelto por reembolsos
      const { rows: yaDevuelto } = await client.query(`
        SELECT ir.producto_id, SUM(ir.cantidad) AS cantidad
        FROM items_reembolso ir
        JOIN reembolsos r ON ir.reembolso_id = r.id
        WHERE r.venta_id = $1 AND ir.retorna_inventario = true
        GROUP BY ir.producto_id
      `, [req.params.id]);

      const devueltoPorProd = {};
      for (const d of yaDevuelto) devueltoPorProd[d.producto_id] = parseFloat(d.cantidad);

      // solo restaurar lo que no fue devuelto ya
      for (const item of items) {
        const yaRestaurado = devueltoPorProd[item.producto_id] || 0;
        const pendiente    = parseFloat(item.cantidad) - yaRestaurado;
        if (pendiente > 0) {
          await client.query(
            'UPDATE productos SET stock = stock + $1 WHERE id = $2 AND seguimiento_inventario = true',
            [pendiente, item.producto_id]
          );
        }
      }
    }

    await client.query("UPDATE ventas SET estado = 'anulada' WHERE id = $1", [req.params.id]);
    await client.query('COMMIT');
    res.json({ mensaje: 'Venta anulada.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// POST /ventas/:id/reembolso
router.post('/:id/reembolso', verificarToken, soloAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tipo, items, fuente } = req.body;

    const { rows: ventaRows } = await client.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
    const venta = ventaRows[0];

    if (!venta)                    return res.status(404).json({ error: 'Venta no encontrada.' });
    if (venta.estado !== 'cerrada') return res.status(400).json({ error: 'Solo se reembolsan ventas cerradas.' });
    if (!tipo)                     return res.status(400).json({ error: 'Indica el tipo de reembolso.' });

    const { rows: itemsVenta } = await client.query('SELECT * FROM items_venta WHERE venta_id = $1', [req.params.id]);

    // para reembolso total, calcular lo que queda por reembolsar
    let itemsAReembolsar = items;

    if (tipo === 'total') {
      const { rows: yaRemb } = await client.query(`
        SELECT ir.producto_id, SUM(ir.cantidad) AS cantidad
        FROM items_reembolso ir
        JOIN reembolsos r ON ir.reembolso_id = r.id
        WHERE r.venta_id = $1
        GROUP BY ir.producto_id
      `, [req.params.id]);

      const yaRembPorProd = {};
      for (const r of yaRemb) yaRembPorProd[r.producto_id] = parseFloat(r.cantidad);

      itemsAReembolsar = itemsVenta
        .map(i => {
          const yaR   = yaRembPorProd[i.producto_id] || 0;
          const resta = parseFloat(i.cantidad) - yaR;
          const precio = parseFloat(i.precio_unitario);
          return { producto_id: i.producto_id, cantidad: resta, subtotal: resta * precio, retorna_inventario: true };
        })
        .filter(i => i.cantidad > 0);
    }

    if (!itemsAReembolsar || itemsAReembolsar.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un producto.' });
    }

    const total_reembolsado = itemsAReembolsar.reduce((s, i) => s + parseFloat(i.subtotal), 0);

    // verificar que no exceda el total de la venta
    const { rows: yaRow } = await client.query(
      'SELECT COALESCE(SUM(total_reembolsado), 0) AS total FROM reembolsos WHERE venta_id = $1',
      [req.params.id]
    );
    if ((parseFloat(yaRow[0].total) + total_reembolsado) > parseFloat(venta.total)) {
      return res.status(400).json({ error: `Ya se reembolsaron $${Math.round(yaRow[0].total).toLocaleString()} de esta venta.` });
    }

    await client.query('BEGIN');

    const { rows: rRows } = await client.query(
      'INSERT INTO reembolsos (venta_id, tipo, total_reembolsado, fuente, usuario_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.id, tipo, total_reembolsado, fuente || 'Caja', req.usuario.id]
    );
    const reembolsoId = rRows[0].id;

    for (const item of itemsAReembolsar) {
      await client.query(
        'INSERT INTO items_reembolso (reembolso_id, producto_id, cantidad, subtotal, retorna_inventario) VALUES ($1, $2, $3, $4, $5)',
        [reembolsoId, item.producto_id, item.cantidad, item.subtotal, item.retorna_inventario ? true : false]
      );

      if (item.retorna_inventario) {
        await client.query(
          'UPDATE productos SET stock = stock + $1 WHERE id = $2 AND seguimiento_inventario = true',
          [item.cantidad, item.producto_id]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ id: reembolsoId, total_reembolsado, mensaje: 'Reembolso registrado.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

module.exports = router;
