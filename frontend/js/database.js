// database.js — Capa de datos conectada al backend real
// POS Papel y Luna — MVP 3

const API_URL = 'https://pos-papel-y-luna.onrender.com';

// ─── AUTENTICACIÓN ─────────────────────────────────────────────────────────────

export function getToken() {
    return localStorage.getItem('pos_token');
}

export function getUsuario() {
    const u = localStorage.getItem('pos_usuario');
    return u ? JSON.parse(u) : null;
}

export function cerrarSesion() {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_usuario');
    window.location.href = 'login.html';
}

export async function iniciarSesion(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al iniciar sesión');

    localStorage.setItem('pos_token', json.token);
    localStorage.setItem('pos_usuario', JSON.stringify(json.usuario));
    return json.usuario;
}

// ─── UTILIDADES INTERNAS ───────────────────────────────────────────────────────

// Hace una petición GET al backend con el token
async function apiGet(ruta, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url   = query ? `${API_URL}${ruta}?${query}` : `${API_URL}${ruta}`;

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (res.status === 401) { cerrarSesion(); return; }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error del servidor');
    return json;
}

// Hace una petición POST, PUT o DELETE al backend con el token
async function apiEnviar(metodo, ruta, datos = null) {
    const opciones = {
        method:  metodo,
        headers: {
            'Authorization':  `Bearer ${getToken()}`,
            'Content-Type':   'application/json'
        }
    };
    if (datos) opciones.body = JSON.stringify(datos);

    const res  = await fetch(`${API_URL}${ruta}`, opciones);
    if (res.status === 401) { cerrarSesion(); return; }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error del servidor');
    return json;
}

// ─── PRODUCTOS ─────────────────────────────────────────────────────────────────

export async function obtenerProductos() {
    const productos = await apiGet('/productos');
    return productos.map(normalizarProducto);
}

export async function guardarProducto(producto) {
    const r = await apiEnviar('POST', '/productos', desnormalizarProducto(producto));
    return r.id;
}

export async function actualizarProducto(producto) {
    await apiEnviar('PUT', `/productos/${producto.id}`, desnormalizarProducto(producto));
}

export async function eliminarProducto(id) {
    await apiEnviar('DELETE', `/productos/${id}`);
}

// Convierte del formato del backend al formato que usa el frontend
function normalizarProducto(p) {
    return {
        id:                    p.id,
        nombre:                p.nombre,
        categoria:             p.categoria_nombre || '',
        categoriaId:           p.categoria_id,
        precio:                parseFloat(p.precio)  || 0,
        costo:                 parseFloat(p.costo)   || 0,
        stock:                 parseFloat(p.stock)   || 0,
        seguimientoInventario: p.seguimiento_inventario === 1 || p.seguimiento_inventario === true,
        codigoInterno:         p.codigo_interno  || '',
        codigoBarras:          p.codigo_barras   || '',
        imagenUrl:             p.imagen_url      || '',
    };
}

// Convierte del formato del frontend al formato que espera el backend
function desnormalizarProducto(p) {
    return {
        nombre:                 p.nombre,
        categoria_id:           p.categoriaId || null,
        precio:                 p.precio,
        costo:                  p.costo       || 0,
        stock:                  p.stock       || 0,
        seguimiento_inventario: p.seguimientoInventario ? 1 : 0,
        codigo_interno:         p.codigoInterno  || null,
        codigo_barras:          p.codigoBarras   || null,
        imagen_url:             p.imagenUrl      || null,
    };
}

// ─── VENTAS ────────────────────────────────────────────────────────────────────

export async function obtenerVentas() {
    const ventas = await apiGet('/ventas');
    return ventas.map(normalizarVenta);
}

export async function obtenerVentasAbiertas() {
    const ventas = await apiGet('/ventas', { estado: 'guardada' });
    return ventas.map(normalizarVenta);
}

export async function obtenerDetalleVenta(id) {
    const venta = await apiGet(`/ventas/${id}`);
    return normalizarVenta(venta);
}

export async function registrarVenta(venta) {
    const r = await apiEnviar('POST', '/ventas', {
        cliente_id:       venta.clienteId     || null,
        metodo_pago:      venta.metodoPago,
        items:            venta.items.map(desnormalizarItem),
        descuento_id:     venta.descuentoId   || null,
        descuento_valor:  venta.descuentoValor || 0,
        dinero_recibido:  venta.dineroRecibido || 0,
        estado:           'cerrada'
    });
    return r.id;
}

export async function guardarVentaAbierta(venta) {
    if (venta.id) {
        await apiEnviar('PUT', `/ventas/${venta.id}`, {
            cliente_id:  venta.clienteId || null,
            metodo_pago: venta.metodoPago || null,
            items:       (venta.items || []).map(desnormalizarItem),
            estado:      'guardada'
        });
        return venta.id;
    } else {
        const r = await apiEnviar('POST', '/ventas', {
            cliente_id:  venta.clienteId || null,
            metodo_pago: venta.metodoPago || null,
            items:       (venta.items || []).map(desnormalizarItem),
            estado:      'guardada'
        });
        return r.id;
    }
}

export async function cerrarVentaAbierta(venta) {
    if (venta.id) {
        // Actualizar la venta guardada existente
        await apiEnviar('PUT', `/ventas/${venta.id}`, {
            cliente_id:      venta.clienteId    || null,
            metodo_pago:     venta.metodoPago,
            items:           venta.items.map(desnormalizarItem),
            descuento_id:    venta.descuentoId  || null,
            descuento_valor: venta.descuentoValor || 0,
            dinero_recibido: venta.dineroRecibido || 0,
            estado:          'cerrada'
        });
        return venta.id;
    } else {
        const r = await apiEnviar('POST', '/ventas', {
            cliente_id:      venta.clienteId    || null,
            metodo_pago:     venta.metodoPago,
            items:           venta.items.map(desnormalizarItem),
            descuento_id:    venta.descuentoId  || null,
            descuento_valor: venta.descuentoValor || 0,
            dinero_recibido: venta.dineroRecibido || 0,
            estado:          'cerrada'
        });
        return r.id;
    }
}

export async function corregirVenta(id, venta) {
    return await apiEnviar('PUT', `/ventas/${id}`, {
        cliente_id:      venta.clienteId    || null,
        metodo_pago:     venta.metodoPago,
        items:           venta.items.map(desnormalizarItem),
        descuento_id:    venta.descuentoId  || null,
        descuento_valor: venta.descuentoValor || 0,
        dinero_recibido: venta.dineroRecibido || 0,
    });
}

export async function anularVenta(id) {
    return await apiEnviar('DELETE', `/ventas/${id}`);
}

export async function registrarReembolso(ventaId, datos) {
    return await apiEnviar('POST', `/ventas/${ventaId}/reembolso`, {
        tipo:  datos.tipo,
        items: datos.items,
        fuente: datos.fuente || 'Caja'
    });
}

// Convierte venta del backend al formato del frontend
function normalizarVenta(v) {
    return {
        id:              v.id,
        fecha:           v.fecha,
        estado:          v.estado,
        clienteId:       v.cliente_id,
        clienteNombre:   v.cliente_nombre  || '',
        metodoPago:      v.metodo_pago     || '',
        total:           parseFloat(v.total)           || 0,
        dineroRecibido:  parseFloat(v.dinero_recibido) || 0,
        cambio:          parseFloat(v.cambio)          || 0,
        descuentoId:     v.descuento_id,
        descuentoValor:  parseFloat(v.descuento_valor) || 0,
        corregida:       v.corregida === 1,
        corregidaPor:    v.corregida_por_nombre || '',
        corregidaEn:     v.corregida_en || '',
        items:           (v.items || []).map(normalizarItem),
        reembolsos:      v.reembolsos || [],
        totalReembolsos: v.total_reembolsos || 0,
    };
}

function normalizarItem(i) {
    return {
        productoId:      i.producto_id,
        nombre:          i.producto_nombre || '',
        cantidad:        parseFloat(i.cantidad)        || 0,
        precioUnitario:  parseFloat(i.precio_unitario) || 0,
        subtotal:        parseFloat(i.subtotal)        || 0,
    };
}

function desnormalizarItem(i) {
    return {
        producto_id:     i.productoId,
        cantidad:        i.cantidad,
        precio_unitario: i.precioUnitario || i.precio,
    };
}

// ─── COMPRAS ───────────────────────────────────────────────────────────────────

export async function obtenerCompras() {
    const compras = await apiGet('/compras');
    return compras.map(c => ({
        id:              c.id,
        fecha:           c.fecha,
        proveedorId:     c.proveedor_id,
        proveedorNombre: c.proveedor_nombre || '',
        metodoPago:      c.metodo_pago,
        total:           parseFloat(c.total) || 0,
        items:           (c.items || []).map(i => ({
            productoId:    i.producto_id,
            nombre:        i.producto_nombre || '',
            cantidad:      parseFloat(i.cantidad)       || 0,
            costoUnitario: parseFloat(i.costo_unitario) || 0,
            subtotal:      parseFloat(i.subtotal)       || 0,
        }))
    }));
}

export async function registrarCompra(compra) {
    const r = await apiEnviar('POST', '/compras', {
        proveedor_id: compra.proveedorId || null,
        metodo_pago:  compra.metodoPago,
        notas:        compra.notas || null,
        items:        compra.items.map(i => ({
            producto_id:    i.productoId,
            cantidad:       i.cantidad,
            costo_unitario: i.costoUnitario || i.costo || 0,
        }))
    });
    return r.id;
}

// ─── CLIENTES ──────────────────────────────────────────────────────────────────

export async function obtenerClientes() {
    return await apiGet('/clientes');
}

export async function guardarCliente(cliente) {
    const r = await apiEnviar('POST', '/clientes', cliente);
    return r.id;
}

export async function actualizarCliente(cliente) {
    await apiEnviar('PUT', `/clientes/${cliente.id}`, cliente);
}

export async function eliminarCliente(id) {
    await apiEnviar('DELETE', `/clientes/${id}`);
}

// ─── PROVEEDORES ───────────────────────────────────────────────────────────────

export async function obtenerProveedores() {
    return await apiGet('/proveedores');
}

export async function guardarProveedor(proveedor) {
    const r = await apiEnviar('POST', '/proveedores', proveedor);
    return r.id;
}

export async function actualizarProveedor(proveedor) {
    await apiEnviar('PUT', `/proveedores/${proveedor.id}`, proveedor);
}

export async function eliminarProveedor(id) {
    await apiEnviar('DELETE', `/proveedores/${id}`);
}

// ─── CATEGORÍAS ────────────────────────────────────────────────────────────────

export async function obtenerCategorias() {
    return await apiGet('/categorias');
}

export async function guardarCategoria(categoria) {
    const r = await apiEnviar('POST', '/categorias', categoria);
    return r.id;
}

export async function actualizarCategoria(categoria) {
    await apiEnviar('PUT', `/categorias/${categoria.id}`, categoria);
}

export async function eliminarCategoria(id) {
    await apiEnviar('DELETE', `/categorias/${id}`);
}

// ─── DESCUENTOS ────────────────────────────────────────────────────────────────

export async function obtenerDescuentos() {
    return await apiGet('/descuentos');
}

export async function guardarDescuento(descuento) {
    const r = await apiEnviar('POST', '/descuentos', descuento);
    return r.id;
}

export async function actualizarDescuento(descuento) {
    await apiEnviar('PUT', `/descuentos/${descuento.id}`, descuento);
}

export async function eliminarDescuento(id) {
    await apiEnviar('DELETE', `/descuentos/${id}`);
}

// ─── FALTANTES ─────────────────────────────────────────────────────────────────

export async function obtenerFaltantes(filtros = {}) {
    return await apiGet('/faltantes', filtros);
}

export async function registrarFaltante(faltante) {
    const r = await apiEnviar('POST', '/faltantes', {
        nombre_producto: faltante.nombreProducto,
        cantidad:        faltante.cantidad   || null,
        tipo:            faltante.tipo       || 'no_registrado',
        observacion:     faltante.observacion || null,
        proveedor_id:    faltante.proveedorId || null,
    });
    return r.id;
}

export async function actualizarEstadoFaltante(id, estado) {
    return await apiEnviar('PUT', `/faltantes/${id}/estado`, { estado });
}

export async function eliminarFaltante(id) {
    await apiEnviar('DELETE', `/faltantes/${id}`);
}

// ─── REPORTES ──────────────────────────────────────────────────────────────────

export async function reporteVentas(desde, hasta) {
    return await apiGet('/reportes/ventas', { desde, hasta });
}

export async function reporteProductosMasVendidos(desde, hasta) {
    return await apiGet('/reportes/productos-mas-vendidos', { desde, hasta });
}

export async function reporteCompras(desde, hasta) {
    return await apiGet('/reportes/compras', { desde, hasta });
}

export async function reporteFaltantes() {
    return await apiGet('/reportes/faltantes');
}
