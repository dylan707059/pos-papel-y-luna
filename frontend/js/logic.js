// logic.js — Funciones puras de cálculo y validación
// POS Papel y Luna — MVP 2

export function calcularTotalesVenta(itemsCarrito) {
    let total = 0;
    const itemsConSubtotal = itemsCarrito.map(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        return { ...item, subtotal };
    });
    return { items: itemsConSubtotal, total };
}

export function calcularTotalesCompra(itemsCompra) {
    let total = 0;
    const itemsConSubtotal = itemsCompra.map(item => {
        const subtotal = item.costo * item.cantidad;
        total += subtotal;
        return { ...item, subtotal };
    });
    return { items: itemsConSubtotal, total };
}

export function calcularCambio(total, recibido) {
    if (recibido < total) return null;
    return recibido - total;
}

export function validarProducto(p) {
    if (!p.nombre || p.nombre.trim() === '') return 'El nombre es obligatorio';
    if (isNaN(p.precio) || p.precio <= 0) return 'El precio de venta debe ser mayor a 0';
    if (isNaN(p.costo) || p.costo < 0) return 'El costo no puede ser negativo';
    if (isNaN(p.stock) || p.stock < 0) return 'El stock no puede ser negativo';
    return null;
}

export function validarCliente(c) {
    if (!c.nombre || c.nombre.trim() === '') return 'El nombre es obligatorio';
    return null;
}

export function validarProveedor(p) {
    if (!p.nombre || p.nombre.trim() === '') return 'El nombre es obligatorio';
    return null;
}

export function validarCategoria(c) {
    if (!c.nombre || c.nombre.trim() === '') return 'El nombre es obligatorio';
    return null;
}

export function validarStockSuficiente(producto, cantidadPedida) {
    if (String(producto.seguimientoInventario) !== 'true') return true;
    return parseInt(producto.stock) >= cantidadPedida;
}

export function obtenerUsuarioActual() {
    return { nombre: 'Miguel', rol: 'Administrador' };
}
export function mostrarToast(mensaje, tipo = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = mensaje;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('toast-visible'), 10);
    setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(() => t.remove(), 300); }, 3000);
}