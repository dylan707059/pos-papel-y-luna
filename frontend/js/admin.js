// admin.js — Productos, historial, correcciones y reembolsos
// POS Papel y Luna — MVP 3

import {
    obtenerProductos, guardarProducto, actualizarProducto, eliminarProducto,
    obtenerVentas, obtenerDetalleVenta, obtenerCategorias, obtenerCompras,
    corregirVenta, anularVenta, registrarReembolso
} from './database.js';
import { validarProducto, mostrarToast } from './logic.js';

// ─── PRODUCTOS ─────────────────────────────────────────────────────────────────

export async function inicializarAdmin() {
    const contenedor = document.getElementById('interfaz-productos');
    if (!contenedor) return;
    contenedor.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando productos...</p></div>`;

    let categorias = [];
    try { categorias = await obtenerCategorias(); } catch (e) {}

    contenedor.innerHTML = `
        <div class="admin-grid">
            <div class="formulario-card">
                <h3 id="titulo-form-prod">Nuevo Producto</h3>
                <div class="campo-grupo">
                    <label>Nombre *</label>
                    <input type="text" id="prod-nombre" placeholder="Nombre del producto">
                </div>
                <div class="campo-grupo">
                    <label>Categoría</label>
                    <select id="prod-categoria">
                        <option value="">Sin categoría</option>
                        ${categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-fila-2">
                    <div class="campo-grupo">
                        <label>Precio de venta *</label>
                        <input type="number" id="prod-precio" placeholder="0">
                    </div>
                    <div class="campo-grupo">
                        <label>Costo *</label>
                        <input type="number" id="prod-costo" placeholder="0">
                    </div>
                </div>
                <div class="form-fila-2">
                    <div class="campo-grupo">
                        <label>Stock inicial</label>
                        <input type="number" id="prod-stock" placeholder="0">
                    </div>
                    <div class="campo-grupo campo-check">
                        <label class="check-label">
                            <input type="checkbox" id="prod-seg" checked>
                            <span>Seguir inventario</span>
                        </label>
                    </div>
                </div>
                <div class="form-botones">
                    <button id="btn-submit-prod" class="btn-primary">Crear Producto</button>
                    <button id="btn-cancelar-edicion" class="btn-secondary" style="display:none">Cancelar</button>
                </div>
            </div>

            <div class="tabla-card">
                <h3>Productos registrados</h3>
                <div class="tabla-wrapper" id="tabla-productos-container">
                    <div class="loading-state"><div class="spinner"></div></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-submit-prod').addEventListener('click', manejarProducto);
    document.getElementById('btn-cancelar-edicion').addEventListener('click', resetFormProducto);
    await renderizarTablaProductos();
}

async function renderizarTablaProductos() {
    const container = document.getElementById('tabla-productos-container');
    if (!container) return;

    try {
        const productos = await obtenerProductos();
        if (productos.length === 0) {
            container.innerHTML = `<p class="sin-datos">No hay productos registrados aún.</p>`;
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th><th>Categoría</th><th>Precio</th>
                        <th>Costo</th><th>Stock</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${productos.map(p => `
                        <tr>
                            <td>${p.nombre}</td>
                            <td>${p.categoria || '—'}</td>
                            <td>$${parseFloat(p.precio).toLocaleString('es-CO')}</td>
                            <td>$${parseFloat(p.costo || 0).toLocaleString('es-CO')}</td>
                            <td>${p.seguimientoInventario ? p.stock : '∞'}</td>
                            <td class="td-acciones">
                                <button onclick="window.editarProducto(${p.id})" class="btn-tabla-edit">Editar</button>
                                <button onclick="window.borrarProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" class="btn-tabla-delete">Borrar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    } catch (e) {
        container.innerHTML = `<p class="error-datos">Error cargando productos.</p>`;
    }
}

async function manejarProducto() {
    const btn    = document.getElementById('btn-submit-prod');
    const editId = btn.dataset.editId;

    const datos = {
        nombre:                document.getElementById('prod-nombre').value.trim(),
        categoriaId:           parseInt(document.getElementById('prod-categoria').value) || null,
        precio:                parseFloat(document.getElementById('prod-precio').value),
        costo:                 parseFloat(document.getElementById('prod-costo').value),
        stock:                 parseInt(document.getElementById('prod-stock').value) || 0,
        seguimientoInventario: document.getElementById('prod-seg').checked,
    };

    const error = validarProducto(datos);
    if (error) return mostrarToast(error, 'error');

    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
        if (editId) {
            await actualizarProducto({ ...datos, id: parseInt(editId) });
            mostrarToast('Producto actualizado', 'success');
        } else {
            await guardarProducto(datos);
            mostrarToast('Producto creado', 'success');
        }
        resetFormProducto();
        await renderizarTablaProductos();
    } catch (e) {
        mostrarToast('Error al guardar el producto', 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = editId ? 'Actualizar' : 'Crear Producto';
    }
}

function resetFormProducto() {
    ['prod-nombre','prod-precio','prod-costo','prod-stock'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const segEl = document.getElementById('prod-seg');
    if (segEl) segEl.checked = true;
    const btn = document.getElementById('btn-submit-prod');
    if (btn) { btn.textContent = 'Crear Producto'; delete btn.dataset.editId; }
    const btnCancel = document.getElementById('btn-cancelar-edicion');
    if (btnCancel) btnCancel.style.display = 'none';
    const titulo = document.getElementById('titulo-form-prod');
    if (titulo) titulo.textContent = 'Nuevo Producto';
}

window.editarProducto = async (id) => {
    try {
        const productos = await obtenerProductos();
        const p = productos.find(x => x.id === id);
        if (!p) return;

        document.getElementById('prod-nombre').value  = p.nombre;
        document.getElementById('prod-precio').value  = p.precio;
        document.getElementById('prod-costo').value   = p.costo || 0;
        document.getElementById('prod-stock').value   = p.stock || 0;
        document.getElementById('prod-seg').checked   = p.seguimientoInventario;

        const catSelect = document.getElementById('prod-categoria');
        if (catSelect) catSelect.value = p.categoriaId || '';

        const btn = document.getElementById('btn-submit-prod');
        btn.textContent    = 'Actualizar';
        btn.dataset.editId = id;
        document.getElementById('btn-cancelar-edicion').style.display = 'inline-flex';
        document.getElementById('titulo-form-prod').textContent = `Editando: ${p.nombre}`;
        document.getElementById('interfaz-productos').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        mostrarToast('Error al cargar el producto', 'error');
    }
};

window.borrarProducto = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
        await eliminarProducto(id);
        mostrarToast('Producto eliminado', 'success');
        await renderizarTablaProductos();
    } catch (e) {
        mostrarToast('Error al eliminar', 'error');
    }
};

// ─── HISTORIAL VENTAS ──────────────────────────────────────────────────────────

export async function renderizarHistorial() {
    const contenedor = document.getElementById('lista-historial');
    if (!contenedor) return;
    contenedor.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando historial...</p></div>`;

    try {
        const ventas   = await obtenerVentas();
        const cerradas = ventas.filter(v => v.estado === 'cerrada' || v.estado === 'anulada');

        if (cerradas.length === 0) {
            contenedor.innerHTML = `<p class="sin-datos">No hay ventas registradas aún.</p>`;
            return;
        }

        contenedor.innerHTML = cerradas.map(v => `
            <div class="card-venta ${v.estado === 'anulada' ? 'venta-anulada' : ''}">
                <div class="card-venta-header">
                    <span class="factura-id">#${v.id}</span>
                    <span class="factura-fecha">${v.fecha?.split('T')[0] ?? v.fecha}</span>
                    <span class="badge-metodo badge-${(v.metodoPago || '').toLowerCase()}">${v.metodoPago || '—'}</span>
                    ${v.estado === 'anulada' ? `<span style="background:#fee2e2;color:#c0392b;font-size:.75rem;padding:2px 8px;border-radius:20px">ANULADA</span>` : ''}
                    ${v.corregida ? `<span style="background:#fef9c3;color:#92400e;font-size:.75rem;padding:2px 8px;border-radius:20px">CORREGIDA</span>` : ''}
                </div>

                ${v.clienteNombre ? `<p style="font-size:.85rem;color:#888;margin:.25rem 0">👤 ${v.clienteNombre}</p>` : ''}

                <ul class="lista-items-venta">
                    ${(v.items || []).map(item =>
                        `<li>${item.nombre} × ${item.cantidad} — <strong>$${parseFloat(item.subtotal).toLocaleString('es-CO')}</strong></li>`
                    ).join('')}
                </ul>

                <div class="card-venta-footer">
                    <span class="total-venta-hist">Total: $${parseFloat(v.total).toLocaleString('es-CO')}</span>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                        <a href="factura/factura.html?id=${v.id}" target="_blank" class="btn-ver-factura">Ver factura</a>
                        ${v.estado === 'cerrada' ? `
                            ${v.totalReembolsos === 0 ? `
                            <button onclick="window.abrirModalCorreccion(${v.id})"
                                style="background:#eff6ff;color:#1d4ed8;border:none;padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.8rem">
                                ✏️ Corregir
                            </button>` : `
                            <span style="font-size:.75rem;color:#888;padding:.3rem .5rem">✏️ Sin corrección</span>`}
                            ${!v.corregida ? `
                            <button onclick="window.abrirModalReembolso(${v.id})"
                                style="background:#f0fdf4;color:#15803d;border:none;padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.8rem">
                                💸 Reembolso
                            </button>` : `
                            <span style="font-size:.75rem;color:#888;padding:.3rem .5rem">💸 Sin reembolso</span>`}
                            <button onclick="window.anularVentaHistorial(${v.id})"
                                style="background:#fff0f0;color:#e74c3c;border:none;padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.8rem">
                                🗑 Anular
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (e) {
        contenedor.innerHTML = `<p class="error-datos">Error cargando historial.</p>`;
    }
}

// ─── MODAL CORREGIR VENTA ──────────────────────────────────────────────────────

window.abrirModalCorreccion = async (ventaId) => {
    try {
        const venta = await obtenerDetalleVenta(ventaId);

        // Descuento original de la venta
        const descOriginal = venta.descuentoValor || 0;
        const descId       = venta.descuentoId    || null;

        const modal = crearModal(`
            <h3>✏️ Corregir Venta #${ventaId}</h3>
            <p style="color:#888;font-size:.85rem;margin-bottom:.75rem">
                💰 Ya pagado: <strong>$${venta.total.toLocaleString('es-CO')}</strong>
                ${descOriginal > 0 ? ` <span style="color:#e74c3c;font-size:.8rem">(incluye descuento -$${descOriginal.toLocaleString('es-CO')})</span>` : ''}
            </p>

            <div id="items-correccion">
                ${venta.items.map((item, i) => `
                    <div class="item-correccion" id="item-corr-${i}"
                        style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem">
                        <span style="flex:1;font-size:.9rem">${item.nombre}</span>
                        <span style="font-size:.8rem;color:#888">$${item.precioUnitario.toLocaleString('es-CO')} c/u</span>
                        <input type="number" value="${item.cantidad}" min="1"
                            style="width:60px;padding:.3rem;border:1px solid #e0e0e0;border-radius:6px;text-align:center"
                            data-producto-id="${item.productoId}"
                            data-precio="${item.precioUnitario}"
                            oninput="window.recalcularCorreccion(${venta.total}, ${venta.dineroRecibido}, ${descOriginal})">
                        <button onclick="document.getElementById('item-corr-${i}').remove(); window.recalcularCorreccion(${venta.total}, ${venta.dineroRecibido}, ${descOriginal})"
                            style="background:#fff0f0;color:#e74c3c;border:none;padding:.3rem .5rem;border-radius:6px;cursor:pointer">✕</button>
                    </div>
                `).join('')}
            </div>

            <!-- Descuento -->
            ${descOriginal > 0 ? `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;background:#fef9c3;border-radius:8px;margin:.5rem 0;font-size:.9rem">
                <span style="flex:1">🎟️ Descuento aplicado</span>
                <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
                    <input type="checkbox" id="corr-mantener-desc" checked
                        onchange="window.recalcularCorreccion(${venta.total}, ${venta.dineroRecibido}, ${descOriginal})">
                    Mantener descuento (-$${descOriginal.toLocaleString('es-CO')})
                </label>
            </div>` : ''}

            <!-- Resumen financiero en vivo -->
            <div id="resumen-correccion" style="background:#f8fafc;border-radius:8px;padding:.75rem 1rem;margin:.75rem 0;font-size:.9rem">
                <div id="corr-linea-desc" style="display:${descOriginal > 0 ? 'flex' : 'none'};justify-content:space-between;margin-bottom:.3rem;color:#e74c3c">
                    <span>Descuento:</span>
                    <strong id="corr-desc-mostrado">-$${descOriginal.toLocaleString('es-CO')}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
                    <span>Nuevo total:</span>
                    <strong id="corr-nuevo-total">$${venta.total.toLocaleString('es-CO')}</strong>
                </div>
                <div id="corr-diferencia-wrap" style="display:flex;justify-content:space-between;margin-bottom:.3rem">
                    <span id="corr-dif-label">Diferencia:</span>
                    <strong id="corr-dif-valor" style="color:#888">$0</strong>
                </div>
                <div id="corr-vueltas-wrap" style="display:none;justify-content:space-between">
                    <span id="corr-vueltas-label" style="color:#16a34a">Dar vueltas al cliente:</span>
                    <strong id="corr-vueltas-valor" style="color:#16a34a">$0</strong>
                </div>
            </div>

            <div style="margin-top:.5rem">
                <label class="campo-label">Método de pago</label>
                <select id="corr-metodo" class="campo-input"
                    onchange="window.recalcularCorreccion(${venta.total}, ${venta.dineroRecibido}, ${descOriginal})">
                    <option value="Efectivo" ${venta.metodoPago === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                    <option value="Nequi"    ${venta.metodoPago === 'Nequi'    ? 'selected' : ''}>Nequi</option>
                    <option value="Debe"     ${venta.metodoPago === 'Debe'     ? 'selected' : ''}>Debe</option>
                </select>
            </div>

            <div id="corr-efectivo-sec" style="margin-top:.5rem">
                <label class="campo-label">Dinero recibido adicional</label>
                <input type="number" id="corr-recibido" class="campo-input" placeholder="0" min="0"
                    oninput="window.recalcularCorreccion(${venta.total}, ${venta.dineroRecibido}, ${descOriginal})">
                <p id="corr-vueltas-texto" style="font-size:.85rem;margin-top:.3rem;color:#888"></p>
            </div>

            <div style="display:flex;gap:.75rem;margin-top:1.25rem;justify-content:flex-end">
                <button onclick="document.getElementById('modal-pos').remove()" class="btn-secondary">Cancelar</button>
                <button id="btn-confirmar-correccion" class="btn-primary" disabled>Confirmar corrección</button>
            </div>
        `);

        // Lógica financiera en vivo — ahora considera el descuento
        window.recalcularCorreccion = (totalOriginal, dineroOriginal, descuento) => {
            const inputs = document.querySelectorAll('#items-correccion input[type="number"]');
            let subtotal = 0;
            inputs.forEach(inp => {
                subtotal += parseInt(inp.value || 0) * parseFloat(inp.dataset.precio || 0);
            });

            // Aplicar descuento si el checkbox está marcado
            const mantenerDesc = document.getElementById('corr-mantener-desc')?.checked ?? true;
            const descAplicado  = mantenerDesc ? (descuento || 0) : 0;
            const nuevoTotal    = Math.max(0, subtotal - descAplicado);

            // Actualizar línea de descuento
            const lineaDesc = document.getElementById('corr-linea-desc');
            const descMostrado = document.getElementById('corr-desc-mostrado');
            if (lineaDesc) lineaDesc.style.display = descAplicado > 0 ? 'flex' : 'none';
            if (descMostrado) descMostrado.textContent = '-$' + Math.round(descAplicado).toLocaleString('es-CO');

            const metodo    = document.getElementById('corr-metodo')?.value;
            const adicional = parseFloat(document.getElementById('corr-recibido')?.value) || 0;
            const diferencia = nuevoTotal - totalOriginal;

            const elTotal      = document.getElementById('corr-nuevo-total');
            const difWrap      = document.getElementById('corr-diferencia-wrap');
            const difLabel     = document.getElementById('corr-dif-label');
            const difValor     = document.getElementById('corr-dif-valor');
            const vueltasWrap  = document.getElementById('corr-vueltas-wrap');
            const vueltasLabel = document.getElementById('corr-vueltas-label');
            const vueltasValor = document.getElementById('corr-vueltas-valor');
            const vueltasTexto = document.getElementById('corr-vueltas-texto');
            const efectivoSec  = document.getElementById('corr-efectivo-sec');
            const btnConfirmar = document.getElementById('btn-confirmar-correccion');

            if (elTotal) elTotal.textContent = '$' + Math.round(nuevoTotal).toLocaleString('es-CO');

            if (diferencia > 0) {
                if (difWrap)  difWrap.style.display  = 'flex';
                if (difLabel) difLabel.textContent   = 'Cliente debe pagar adicional:';
                if (difValor) { difValor.textContent = '$' + Math.round(diferencia).toLocaleString('es-CO'); difValor.style.color = '#e74c3c'; }
                if (vueltasWrap) vueltasWrap.style.display = 'none';
                if (efectivoSec) efectivoSec.style.display = metodo === 'Efectivo' ? 'block' : 'none';

                if (metodo === 'Efectivo') {
                    const cambio = adicional - diferencia;
                    if (adicional >= diferencia) {
                        if (vueltasTexto) { vueltasTexto.textContent = cambio > 0 ? `Cambio: $${Math.round(cambio).toLocaleString('es-CO')}` : 'Exacto ✓'; vueltasTexto.style.color = '#16a34a'; }
                        if (btnConfirmar) btnConfirmar.disabled = false;
                    } else {
                        if (vueltasTexto) { vueltasTexto.textContent = adicional > 0 ? 'Dinero insuficiente' : ''; vueltasTexto.style.color = '#e74c3c'; }
                        if (btnConfirmar) btnConfirmar.disabled = true;
                    }
                } else {
                    if (btnConfirmar) btnConfirmar.disabled = false;
                    if (vueltasTexto) vueltasTexto.textContent = '';
                }
            } else if (diferencia < 0) {
                if (difWrap)      difWrap.style.display      = 'none';
                if (vueltasWrap)  vueltasWrap.style.display  = 'flex';
                if (vueltasLabel) vueltasLabel.textContent   = 'Dar vueltas al cliente:';
                if (vueltasValor) vueltasValor.textContent   = '$' + Math.round(Math.abs(diferencia)).toLocaleString('es-CO');
                if (efectivoSec)  efectivoSec.style.display  = 'none';
                if (btnConfirmar) btnConfirmar.disabled       = false;
                if (vueltasTexto) vueltasTexto.textContent    = '';
            } else {
                if (difWrap)      difWrap.style.display      = 'none';
                if (vueltasWrap)  vueltasWrap.style.display  = 'none';
                if (efectivoSec)  efectivoSec.style.display  = 'none';
                if (btnConfirmar) btnConfirmar.disabled       = false;
                if (vueltasTexto) vueltasTexto.textContent    = '';
            }
        };

        // Calcular al abrir
        window.recalcularCorreccion(venta.total, venta.dineroRecibido, descOriginal);

        document.getElementById('btn-confirmar-correccion').addEventListener('click', async () => {
            const itemsEls = document.querySelectorAll('#items-correccion .item-correccion');
            const items    = [];
            itemsEls.forEach(el => {
                const input = el.querySelector('input[type="number"]');
                if (!input) return;
                items.push({
                    productoId:     parseInt(input.dataset.productoId),
                    cantidad:       parseInt(input.value),
                    precioUnitario: parseFloat(input.dataset.precio),
                });
            });

            if (items.length === 0) { mostrarToast('La venta debe tener al menos un producto', 'error'); return; }

            const metodo        = document.getElementById('corr-metodo').value;
            const adicional     = parseFloat(document.getElementById('corr-recibido')?.value) || 0;
            const mantenerDesc  = document.getElementById('corr-mantener-desc')?.checked ?? true;
            const descAplicado  = mantenerDesc ? descOriginal : 0;

            // Calcular dinero recibido total para el backend
            const inputs = document.querySelectorAll('#items-correccion input[type="number"]');
            let subtotalItems = 0;
            inputs.forEach(inp => { subtotalItems += parseInt(inp.value || 0) * parseFloat(inp.dataset.precio || 0); });
            const nuevoTotal    = Math.max(0, subtotalItems - descAplicado);
            const diferencia    = nuevoTotal - venta.total;
            const totalRecibido = diferencia > 0 ? venta.dineroRecibido + adicional : venta.dineroRecibido;

            try {
                await corregirVenta(ventaId, {
                    metodoPago:     metodo,
                    dineroRecibido: totalRecibido,
                    descuentoId:    mantenerDesc ? descId : null,
                    descuentoValor: descAplicado,
                    items,
                });
                document.getElementById('modal-pos').remove();
                mostrarToast('Venta corregida exitosamente', 'success');
                await renderizarHistorial();
            } catch (e) {
                mostrarToast(e.message || 'Error al corregir', 'error');
            }
        });

    } catch (e) {
        mostrarToast('Error al cargar la venta', 'error');
    }
};

// ─── MODAL REEMBOLSO ──────────────────────────────────────────────────────────

window.abrirModalReembolso = async (ventaId) => {
    try {
        const venta = await obtenerDetalleVenta(ventaId);

        // Calcular cantidad disponible por producto (original - ya reembolsado)
        const yaRembolsado = venta.yaReembolsado || venta.ya_reembolsado || {};

        // Prorratear descuento entre items para calcular precio efectivo real
        // Ej: 5 items × $1.000 = $5.000, descuento $500 → ratio=0.9 → precio efectivo $900
        const subtotalBruto = venta.items.reduce((s, i) => s + i.subtotal, 0);
        const ratio = subtotalBruto > 0 ? venta.total / subtotalBruto : 1;

        const itemsDisponibles = venta.items
            .map(item => ({
                ...item,
                cantidadDisponible: item.cantidad - (yaRembolsado[item.productoId] || 0),
                precioEfectivo:     item.precioUnitario * ratio,
            }))
            .filter(item => item.cantidadDisponible > 0);

        if (itemsDisponibles.length === 0) {
            mostrarToast('Esta venta ya fue reembolsada completamente', 'warning');
            return;
        }

        const modal = crearModal(`
            <h3>💸 Reembolso — Venta #${ventaId}</h3>
            <p style="color:#888;font-size:.85rem;margin-bottom:.75rem">
                Total original: <strong>$${venta.total.toLocaleString('es-CO')}</strong>
            </p>

            <div style="margin-bottom:1rem">
                <label class="campo-label">Tipo de reembolso</label>
                <select id="tipo-reembolso" class="campo-input">
                    <option value="total">Total (todos los productos disponibles)</option>
                    <option value="parcial">Parcial (seleccionar productos)</option>
                </select>
            </div>

            <div id="items-reembolso-lista">
                ${itemsDisponibles.map((item, idx) => `
                    <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;padding:.6rem;background:#f9f9f9;border-radius:8px;flex-wrap:wrap">
                        <input type="checkbox" data-idx="${idx}" class="chk-item-r" checked
                            style="width:16px;height:16px;cursor:pointer"
                            onchange="window.recalcularReembolso()">
                        <span style="flex:1;font-size:.9rem;min-width:80px">${item.nombre}</span>
                        <span style="font-size:.8rem;color:#888">
                            Disp: ${item.cantidadDisponible} × $${Math.round(item.precioEfectivo).toLocaleString('es-CO')}
                            ${ratio < 0.999 ? `<span style="color:#e74c3c">(con desc.)</span>` : ''}
                        </span>
                        <input type="number" value="${item.cantidadDisponible}"
                            min="1" max="${item.cantidadDisponible}"
                            data-idx="${idx}"
                            data-precio="${item.precioUnitario}"
                            data-precio-efectivo="${item.precioEfectivo}"
                            data-producto-id="${item.productoId}"
                            data-max="${item.cantidadDisponible}"
                            class="inp-cant-r"
                            style="width:55px;padding:.3rem;border:1px solid #e0e0e0;border-radius:6px;text-align:center"
                            oninput="window.recalcularReembolso()">
                        <label style="font-size:.78rem;color:#888;display:flex;align-items:center;gap:3px">
                            <input type="checkbox" data-idx="${idx}" class="chk-inv-r" checked>
                            Devolver inventario
                        </label>
                    </div>
                `).join('')}
            </div>

            <!-- Resumen reembolso -->
            <div style="background:#f0fdf4;border-radius:8px;padding:.6rem 1rem;margin-top:.5rem;font-size:.9rem">
                <div style="display:flex;justify-content:space-between;margin-bottom:.2rem">
                    <span>A reembolsar:</span>
                    <strong id="rem-total" style="color:#16a34a">$0</strong>
                </div>
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#555">💵 Dar al cliente:</span>
                    <strong id="rem-devolver" style="color:#16a34a">$0</strong>
                </div>
            </div>

            <div style="display:flex;gap:.75rem;margin-top:1.25rem;justify-content:flex-end">
                <button onclick="document.getElementById('modal-pos').remove()" class="btn-secondary">Cancelar</button>
                <button id="btn-confirmar-reembolso" class="btn-primary">Confirmar reembolso</button>
            </div>
        `);

        // Calcular total reembolso en vivo
        window.recalcularReembolso = () => {
            const tipo = document.getElementById('tipo-reembolso')?.value;
            let total  = 0;

            document.querySelectorAll('.chk-item-r').forEach(chk => {
                if (!chk.checked) return;
                const idx   = chk.dataset.idx;
                const cant  = parseInt(document.querySelector(`.inp-cant-r[data-idx="${idx}"]`)?.value || 0);
                const precio = parseFloat(document.querySelector(`.inp-cant-r[data-idx="${idx}"]`)?.dataset.precioEfectivo || document.querySelector(`.inp-cant-r[data-idx="${idx}"]`)?.dataset.precio || 0);
                total += cant * precio;
            });

            const elTotal   = document.getElementById('rem-total');
            const elDev     = document.getElementById('rem-devolver');
            if (elTotal) elTotal.textContent = '$' + Math.round(total).toLocaleString('es-CO');
            if (elDev)   elDev.textContent   = '$' + Math.round(total).toLocaleString('es-CO');
        };

        // Sync tipo total/parcial con checkboxes
        document.getElementById('tipo-reembolso').addEventListener('change', (e) => {
            const esParcial = e.target.value === 'parcial';
            // En total: marcar todos y deshabilitar edición
            document.querySelectorAll('.chk-item-r').forEach(chk => {
                chk.checked  = true;
                chk.disabled = !esParcial;
            });
            document.querySelectorAll('.inp-cant-r').forEach(inp => {
                inp.disabled = !esParcial;
                if (!esParcial) inp.value = inp.dataset.max;
            });
            window.recalcularReembolso();
        });

        // Validar que cantidad no supere el máximo disponible
        document.querySelectorAll('.inp-cant-r').forEach(inp => {
            inp.addEventListener('change', () => {
                const max = parseInt(inp.dataset.max);
                if (parseInt(inp.value) > max) inp.value = max;
                if (parseInt(inp.value) < 1)   inp.value = 1;
            });
        });

        window.recalcularReembolso();

        document.getElementById('btn-confirmar-reembolso').addEventListener('click', async () => {
            const tipo  = document.getElementById('tipo-reembolso').value;
            const items = [];

            document.querySelectorAll('.chk-item-r').forEach(chk => {
                if (!chk.checked) return;
                const idx      = chk.dataset.idx;
                const cantInp  = document.querySelector(`.inp-cant-r[data-idx="${idx}"]`);
                const invChk   = document.querySelector(`.chk-inv-r[data-idx="${idx}"]`);
                const item     = itemsDisponibles[parseInt(idx)];
                const cantidad = parseInt(cantInp?.value || item.cantidadDisponible);
                items.push({
                    producto_id:        item.productoId,
                    cantidad,
                    subtotal:           Math.round(cantidad * (item.precioEfectivo || item.precioUnitario)),
                    retorna_inventario: invChk?.checked ? 1 : 0,
                });
            });

            if (items.length === 0) { mostrarToast('Selecciona al menos un producto', 'error'); return; }

            try {
                await registrarReembolso(ventaId, { tipo, items });
                document.getElementById('modal-pos').remove();
                mostrarToast('Reembolso registrado exitosamente', 'success');
                await renderizarHistorial();
            } catch (e) {
                mostrarToast(e.message || 'Error al registrar reembolso', 'error');
            }
        });

    } catch (e) {
        mostrarToast('Error al cargar la venta', 'error');
    }
};

// ─── ANULAR VENTA ──────────────────────────────────────────────────────────────

window.anularVentaHistorial = async (ventaId) => {
    if (!confirm(`¿Anular la venta #${ventaId}? Se restaurará el inventario.`)) return;
    try {
        await anularVenta(ventaId);
        mostrarToast('Venta anulada', 'success');
        await renderizarHistorial();
    } catch (e) {
        mostrarToast(e.message || 'Error al anular', 'error');
    }
};

// ─── HISTORIAL COMPRAS ─────────────────────────────────────────────────────────

export async function renderizarHistorialCompras() {
    const contenedor = document.getElementById('lista-historial-compras');
    if (!contenedor) return;
    contenedor.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando historial...</p></div>`;

    try {
        const compras = await obtenerCompras();
        if (compras.length === 0) {
            contenedor.innerHTML = `<p class="sin-datos">No hay compras registradas aún.</p>`;
            return;
        }

        contenedor.innerHTML = compras.map(c => `
            <div class="card-venta">
                <div class="card-venta-header">
                    <span class="factura-id">#${c.id}</span>
                    <span class="factura-fecha">${c.fecha?.split('T')[0] ?? c.fecha}</span>
                    <span class="badge-metodo badge-${(c.metodoPago || '').toLowerCase().replace(' ', '')}">
                        ${c.metodoPago || '—'}
                    </span>
                </div>
                ${c.proveedorNombre ? `<p style="font-size:.85rem;color:#888;margin:.25rem 0">🏭 ${c.proveedorNombre}</p>` : ''}
                <ul class="lista-items-venta">
                    ${(c.items || []).map(item => `
                        <li>${item.nombre} × ${item.cantidad} — Costo: <strong>$${parseFloat(item.costoUnitario).toLocaleString('es-CO')}</strong> — Subtotal: <strong>$${parseFloat(item.subtotal).toLocaleString('es-CO')}</strong></li>
                    `).join('')}
                </ul>
                <div class="card-venta-footer">
                    <span class="total-venta-hist">Total: $${parseFloat(c.total).toLocaleString('es-CO')}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        contenedor.innerHTML = `<p class="error-datos">Error cargando historial de compras.</p>`;
    }
}

// ─── HELPER MODAL ─────────────────────────────────────────────────────────────

function crearModal(html) {
    const existing = document.getElementById('modal-pos');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id        = 'modal-pos';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:520px;max-height:85vh;overflow-y:auto">
            ${html}
        </div>
    `;
    document.body.appendChild(modal);

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    return modal;
}
