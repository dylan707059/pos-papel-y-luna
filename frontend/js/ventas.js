// ventas.js — Módulo de ventas con descuentos
// POS Papel y Luna — MVP 3

import {
    obtenerProductos,
    registrarVenta,
    guardarVentaAbierta,
    cerrarVentaAbierta,
    obtenerVentasAbiertas,
    obtenerDescuentos
} from './database.js';
import { calcularTotalesVenta, validarStockSuficiente } from './logic.js';

// Estado local
let carrito              = [];
let ventaActualId        = null;
let descuentoSeleccionado = null; // { id, nombre, tipo, valor }
let busquedaTimeout      = null;
let cachéProductos       = null;

export async function inicializarVentas() {
    cachéProductos = null;
    const contenedor = document.getElementById('interfaz-venta');
    if (!contenedor) return;

    contenedor.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando...</p></div>`;

    let ventasAbiertas = [];
    let descuentos     = [];

    try { ventasAbiertas = await obtenerVentasAbiertas(); } catch (e) { console.warn(e); }
    try { descuentos     = await obtenerDescuentos();     } catch (e) { console.warn(e); }

    contenedor.innerHTML = `
        ${ventasAbiertas.length > 0 ? `
        <div class="ventas-abiertas-banner">
            <span>📂 Tienes ${ventasAbiertas.length} venta(s) guardada(s)</span>
            <select id="select-venta-abierta">
                <option value="">— Retomar venta —</option>
                ${ventasAbiertas.map(v => `<option value="${v.id}">Venta ${v.id} · $${parseFloat(v.total).toLocaleString()}</option>`).join('')}
            </select>
            <button id="btn-retomar-venta" class="btn-secondary">Retomar</button>
        </div>` : ''}

        <div class="buscador-caja">
            <input type="text" id="buscar-prod" placeholder="🔍 Buscar producto por nombre..." autocomplete="off">
            <div id="resultados-busqueda" class="dropdown-busqueda"></div>
        </div>

        <div class="tabla-wrapper">
            <table id="tabla-venta">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="tabla-carrito"></tbody>
            </table>
        </div>

        <div id="totales-venta">

            <!-- Descuento -->
            ${descuentos.length > 0 ? `
            <div class="campo-grupo" style="margin-bottom:.75rem">
                <label>🎟️ Descuento (opcional)</label>
                <select id="select-descuento">
                    <option value="">— Sin descuento —</option>
                    ${descuentos.map(d => `
                        <option value="${d.id}" data-tipo="${d.tipo}" data-valor="${d.valor}">
                            ${d.nombre} — ${d.tipo === 'porcentaje' ? d.valor + '%' : '$' + parseFloat(d.valor).toLocaleString('es-CO')}
                        </option>
                    `).join('')}
                </select>
            </div>` : ''}

            <div class="total-display">
                <div id="linea-descuento" style="display:none;color:#e74c3c;font-size:.9rem;margin-bottom:.25rem"></div>
                <span>TOTAL</span>
                <span class="total-monto">$<span id="total-valor">0</span></span>
            </div>

            <div class="pago-grid">
                <div class="campo-grupo">
                    <label>Método de pago</label>
                    <select id="metodo-pago">
                        <option value="Efectivo">Efectivo</option>
                        <option value="Nequi">Nequi</option>
                        <option value="Debe">Debe</option>
                    </select>
                </div>
                <div id="seccion-cambio" class="campo-grupo">
                    <label>Dinero recibido</label>
                    <input type="number" id="dinero-recibido" placeholder="0">
                    <p id="vueltas-texto"></p>
                </div>
            </div>

            <div class="botones-venta">
                <button id="btn-guardar-abierta" class="btn-secondary">💾 Guardar</button>
                <button id="btn-cobrar" class="btn-primary btn-grande">✅ Cerrar Venta</button>
            </div>
        </div>
    `;

    // Eventos
    document.getElementById('buscar-prod').addEventListener('input', (e) => {
        clearTimeout(busquedaTimeout);
        busquedaTimeout = setTimeout(() => buscarProductos(e), 300);
    });
    document.getElementById('btn-cobrar').addEventListener('click', cobrarVenta);
    document.getElementById('btn-guardar-abierta').addEventListener('click', guardarVentaEnCurso);

    const selectPago  = document.getElementById('metodo-pago');
    const divCambio   = document.getElementById('seccion-cambio');
    selectPago.addEventListener('change', () => {
        divCambio.style.display = selectPago.value === 'Efectivo' ? 'flex' : 'none';
    });
    document.getElementById('dinero-recibido').addEventListener('input', calcularVueltasEnVivo);

    // Descuento
    const selectDesc = document.getElementById('select-descuento');
    if (selectDesc) {
        selectDesc.addEventListener('change', () => {
            const opt = selectDesc.options[selectDesc.selectedIndex];
            if (!selectDesc.value) {
                descuentoSeleccionado = null;
            } else {
                descuentoSeleccionado = {
                    id:    parseInt(selectDesc.value),
                    tipo:  opt.dataset.tipo,
                    valor: parseFloat(opt.dataset.valor),
                    nombre: opt.textContent.trim()
                };
            }
            actualizarTablaCarrito();
            calcularVueltasEnVivo();
        });
    }

    if (ventasAbiertas.length > 0) {
        document.getElementById('btn-retomar-venta').addEventListener('click', retomarVenta);
    }

    actualizarTablaCarrito();
}

// ─── DESCUENTO ─────────────────────────────────────────────────────────────────

function calcularDescuento(subtotal) {
    if (!descuentoSeleccionado) return 0;
    if (descuentoSeleccionado.tipo === 'porcentaje') {
        return subtotal * (descuentoSeleccionado.valor / 100);
    }
    return Math.min(descuentoSeleccionado.valor, subtotal); // no puede superar el subtotal
}

// ─── CARRITO ───────────────────────────────────────────────────────────────────

function actualizarTablaCarrito() {
    const { items, total: subtotal } = calcularTotalesVenta(carrito);
    const tbody = document.getElementById('tabla-carrito');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="carrito-vacio">El carrito está vacío</td></tr>`;
    } else {
        tbody.innerHTML = items.map((item, i) => `
            <tr>
                <td class="td-nombre">${item.nombre}</td>
                <td>
                    <input type="number" value="${item.cantidad}" min="1"
                        class="input-cantidad"
                        onchange="window.actualizarCantidadVenta(${i}, this.value)">
                </td>
                <td>$${item.precio.toLocaleString('es-CO')}</td>
                <td class="td-subtotal">$${item.subtotal.toLocaleString('es-CO')}</td>
                <td><button onclick="window.eliminarItemCarrito(${i})" class="btn-eliminar-item">✕</button></td>
            </tr>
        `).join('');
    }

    // Mostrar descuento y total final
    const valorDesc = calcularDescuento(subtotal);
    const totalFinal = Math.max(0, subtotal - valorDesc);

    const lineaDesc = document.getElementById('linea-descuento');
    if (lineaDesc) {
        if (valorDesc > 0) {
            lineaDesc.style.display = 'block';
            lineaDesc.textContent   = `🎟️ Descuento: -$${valorDesc.toLocaleString('es-CO')}`;
        } else {
            lineaDesc.style.display = 'none';
        }
    }

    const totalEl = document.getElementById('total-valor');
    if (totalEl) totalEl.textContent = totalFinal.toLocaleString('es-CO');
}

// ─── VUELTAS ───────────────────────────────────────────────────────────────────

function calcularVueltasEnVivo() {
    const totalTexto = document.getElementById('total-valor')?.textContent.replace(/\./g, '').replace(',', '.') || '0';
    const total      = parseFloat(totalTexto) || 0;
    const recibido   = parseFloat(document.getElementById('dinero-recibido')?.value) || 0;
    const texto      = document.getElementById('vueltas-texto');
    if (!texto) return;

    if (!recibido || recibido < total) {
        texto.textContent = recibido > 0 ? 'Dinero insuficiente' : '';
        texto.className   = 'cambio-negativo';
    } else {
        texto.textContent = `Cambio: $${(recibido - total).toLocaleString('es-CO')}`;
        texto.className   = 'cambio-positivo';
    }
}

// ─── RETOMAR VENTA ABIERTA ─────────────────────────────────────────────────────

async function retomarVenta() {
    const select = document.getElementById('select-venta-abierta');
    const id     = select.value;
    if (!id) return mostrarToast('Selecciona una venta para retomar', 'warning');

    try {
        // Pedir el detalle completo con items
        const { obtenerDetalleVenta } = await import('./database.js');
        const venta = await obtenerDetalleVenta(id);
        if (!venta) return;

        ventaActualId = venta.id;
        carrito = venta.items.map(item => ({
            productoId: item.productoId,
            nombre:     item.nombre,
            precio:     parseFloat(item.precioUnitario || item.precio),
            cantidad:   parseInt(item.cantidad),
        }));

        actualizarTablaCarrito();
        mostrarToast(`Venta retomada`, 'success');

        const banner = document.querySelector('.ventas-abiertas-banner');
        if (banner) banner.remove();
    } catch (e) {
        mostrarToast('Error al retomar la venta', 'error');
        console.error(e);
    }
}
// ─── GUARDAR VENTA ABIERTA ─────────────────────────────────────────────────────

async function guardarVentaEnCurso() {
    if (carrito.length === 0) return mostrarToast('El carrito está vacío', 'warning');

    const { items, total } = calcularTotalesVenta(carrito);
    const btn = document.getElementById('btn-guardar-abierta');
    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
        const id = await guardarVentaAbierta({
            id:          ventaActualId || null,
            items,
            total,
            metodoPago:  document.getElementById('metodo-pago').value,
            clienteId:   '',
            dineroRecibido: 0,
        });
        ventaActualId = id;
        mostrarToast('Venta guardada. Puedes retomar más tarde.', 'success');
    } catch (e) {
        mostrarToast('Error al guardar la venta', 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = '💾 Guardar';
    }
}

// ─── COBRAR VENTA ──────────────────────────────────────────────────────────────

async function cobrarVenta() {
    if (carrito.length === 0) return mostrarToast('No hay productos en la venta', 'warning');

    const metodo    = document.getElementById('metodo-pago').value;
    const { items, total: subtotal } = calcularTotalesVenta(carrito);
    const valorDesc  = calcularDescuento(subtotal);
    const total      = Math.max(0, subtotal - valorDesc);
    let recibido     = 0;

    if (metodo === 'Efectivo') {
        recibido = parseFloat(document.getElementById('dinero-recibido').value);
        if (isNaN(recibido) || recibido < total) {
            return mostrarToast('El dinero recibido es insuficiente', 'error');
        }
    }

    const btn = document.getElementById('btn-cobrar');
    btn.disabled    = true;
    btn.textContent = 'Procesando...';

    try {
        const ventaData = {
            items,
            total,
            metodoPago:     metodo,
            dineroRecibido: recibido,
            cambio:         recibido > 0 ? recibido - total : 0,
            clienteId:      '',
            descuentoId:    descuentoSeleccionado?.id   || null,
            descuentoValor: valorDesc || 0,
        };

        let facturaId;
        if (ventaActualId) {
            ventaData.id = ventaActualId;
            await cerrarVentaAbierta(ventaData);
            facturaId = ventaActualId;
        } else {
            facturaId = await registrarVenta(ventaData);
        }

        mostrarConfirmacionVenta(facturaId, total, metodo, recibido > 0 ? recibido - total : 0, valorDesc);

        // Reset
        carrito               = [];
        ventaActualId         = null;
        descuentoSeleccionado = null;
        const selDesc = document.getElementById('select-descuento');
        if (selDesc) selDesc.value = '';
        actualizarTablaCarrito();
        if (document.getElementById('dinero-recibido')) {
            document.getElementById('dinero-recibido').value = '';
            document.getElementById('vueltas-texto').textContent = '';
        }
    } catch (e) {
        mostrarToast('Error al registrar la venta. Intenta de nuevo.', 'error');
        console.error(e);
    } finally {
        btn.disabled    = false;
        btn.textContent = '✅ Cerrar Venta';
    }
}

// ─── BUSCAR PRODUCTOS ──────────────────────────────────────────────────────────

async function buscarProductos(e) {
    const busqueda = e.target.value.toLowerCase().trim();
    const lista    = document.getElementById('resultados-busqueda');
    lista.innerHTML = '';
    if (busqueda.length < 2) return;

    try {
        if (!cachéProductos) cachéProductos = await obtenerProductos();

        const filtrados = cachéProductos.filter(p =>
            p.nombre && p.nombre.toLowerCase().includes(busqueda)
        );

        if (filtrados.length === 0) {
            lista.innerHTML = `<div class="item-busqueda sin-resultados">Sin resultados</div>`;
            return;
        }

        filtrados.forEach(p => {
            const div = document.createElement('div');
            div.className = 'item-busqueda';
            const stockBadge = p.seguimientoInventario
                ? `<span class="stock-badge ${parseInt(p.stock) > 0 ? 'ok' : 'agotado'}">${parseInt(p.stock) > 0 ? `Stock: ${p.stock}` : 'Agotado'}</span>`
                : `<span class="stock-badge libre">Sin límite</span>`;

            div.innerHTML = `
                <div class="resultado-info" style="cursor:pointer;flex:1">
                    <span class="resultado-nombre">${p.nombre}</span>
                    <span class="resultado-precio">$${parseFloat(p.precio).toLocaleString('es-CO')}</span>
                </div>
                <div class="resultado-acciones">
                    ${stockBadge}
                    <button class="btn-editar-producto-venta" data-id="${p.id}" title="Editar producto">✏️</button>
                </div>`;

            div.querySelector('.resultado-info').addEventListener('click', () => agregarAlCarrito(p));
            div.querySelector('.btn-editar-producto-venta').addEventListener('click', (ev) => {
                ev.stopPropagation();
                abrirModalEditarProducto(p);
            });
            lista.appendChild(div);
        });
    } catch (err) {
        lista.innerHTML = `<div class="item-busqueda sin-resultados">Error cargando productos</div>`;
    }
}

function agregarAlCarrito(producto) {
    const existe         = carrito.find(i => i.productoId === producto.id);
    const cantidadActual = existe ? existe.cantidad : 0;
    const nuevaCantidad  = cantidadActual + 1;

    if (!validarStockSuficiente(producto, nuevaCantidad)) {
        mostrarToast(`Stock insuficiente: Solo quedan ${producto.stock} unidades.`, 'error');
        return;
    }

    if (existe) {
        existe.cantidad = nuevaCantidad;
    } else {
        carrito.push({
            productoId: producto.id,
            nombre:     producto.nombre,
            precio:     parseFloat(producto.precio),
            cantidad:   1,
        });
    }

    actualizarTablaCarrito();
    document.getElementById('resultados-busqueda').innerHTML = '';
    document.getElementById('buscar-prod').value = '';
}

window.actualizarCantidadVenta = async (index, nuevaCantidad) => {
    const cant = parseInt(nuevaCantidad);
    if (isNaN(cant) || cant < 1) { actualizarTablaCarrito(); return; }
    const item = carrito[index];
    try {
        const productos = await obtenerProductos();
        const prod      = productos.find(p => p.id === item.productoId);
        if (prod && !validarStockSuficiente(prod, cant)) {
            mostrarToast(`Solo quedan ${prod.stock} unidades.`, 'error');
            actualizarTablaCarrito();
            return;
        }
    } catch (e) { /* continuar */ }
    carrito[index].cantidad = cant;
    actualizarTablaCarrito();
    calcularVueltasEnVivo();
};

window.eliminarItemCarrito = (index) => {
    carrito.splice(index, 1);
    actualizarTablaCarrito();
    calcularVueltasEnVivo();
};

// ─── CONFIRMACIÓN ──────────────────────────────────────────────────────────────

function mostrarConfirmacionVenta(facturaId, total, metodo, cambio, descuento = 0) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-confirmacion">
            <div class="confirmacion-icono">✅</div>
            <h2>¡Venta Exitosa!</h2>
            <p class="confirmacion-id">Factura: <strong>${facturaId}</strong></p>
            ${descuento > 0 ? `<p style="color:#e74c3c;font-size:.9rem">Descuento aplicado: -$${descuento.toLocaleString('es-CO')}</p>` : ''}
            <p class="confirmacion-total">Total: <strong>$${total.toLocaleString('es-CO')}</strong></p>
            <p class="confirmacion-metodo">Método: ${metodo}</p>
            ${cambio > 0 ? `<p class="confirmacion-cambio">Cambio: <strong>$${cambio.toLocaleString('es-CO')}</strong></p>` : ''}
            <div class="confirmacion-botones">
                <button onclick="document.querySelector('.modal-overlay').remove()" class="btn-secondary">Nueva Venta</button>
                <button onclick="window.open('factura/factura.html?id=${facturaId}','_blank'); document.querySelector('.modal-overlay').remove();" class="btn-primary">Ver Factura</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// ─── MODAL EDITAR PRODUCTO ─────────────────────────────────────────────────────

function abrirModalEditarProducto(producto) {
    const existing = document.getElementById('modal-editar-prod');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id        = 'modal-editar-prod';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card">
            <h3>Editar Producto</h3>
            <p class="modal-subtitulo">Editando: <em>${producto.nombre}</em></p>
            <div class="campo-grupo">
                <label>Nombre</label>
                <input type="text" id="ep-nombre" value="${producto.nombre}">
            </div>
            <div class="campo-grupo">
                <label>Precio de venta</label>
                <input type="number" id="ep-precio" value="${producto.precio}">
            </div>
            <div class="campo-grupo">
                <label>Costo</label>
                <input type="number" id="ep-costo" value="${producto.costo || 0}">
            </div>
            <div class="campo-grupo">
                <label>Stock</label>
                <input type="number" id="ep-stock" value="${producto.stock || 0}">
            </div>
            <div class="modal-botones">
                <button onclick="document.getElementById('modal-editar-prod').remove()" class="btn-secondary">Cancelar</button>
                <button id="btn-guardar-edicion-prod" class="btn-primary">Guardar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-guardar-edicion-prod').onclick = async () => {
        const { actualizarProducto } = await import('./database.js');
        const actualizado = {
            ...producto,
            nombre: document.getElementById('ep-nombre').value,
            precio: parseFloat(document.getElementById('ep-precio').value),
            costo:  parseFloat(document.getElementById('ep-costo').value),
            stock:  parseInt(document.getElementById('ep-stock').value),
        };
        try {
            await actualizarProducto(actualizado);
            const enCarrito = carrito.find(i => i.productoId === producto.id);
            if (enCarrito) {
                enCarrito.nombre = actualizado.nombre;
                enCarrito.precio = actualizado.precio;
                actualizarTablaCarrito();
            }
            cachéProductos = null; // limpiar caché
            modal.remove();
            mostrarToast('Producto actualizado', 'success');
        } catch (e) {
            mostrarToast('Error al actualizar', 'error');
        }
    };
}

// ─── TOAST ─────────────────────────────────────────────────────────────────────

export function mostrarToast(mensaje, tipo = 'info') {
    const t = document.createElement('div');
    t.className   = `toast toast-${tipo}`;
    t.textContent = mensaje;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('toast-visible'), 10);
    setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(() => t.remove(), 300); }, 3000);
}
