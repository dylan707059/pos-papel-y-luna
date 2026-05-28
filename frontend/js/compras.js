// compras.js — Módulo de registro de compras
// POS Papel y Luna — MVP 2

import { obtenerProductos, obtenerProveedores, registrarCompra } from './database.js';
import { calcularTotalesCompra } from './logic.js';
import { mostrarToast } from './logic.js';

let itemsCompra = [];

export async function inicializarCompras() {
    const contenedor = document.getElementById('interfaz-compras');
    if (!contenedor) return;
    contenedor.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando...</p></div>`;

    let proveedores = [];
    try { proveedores = await obtenerProveedores(); } catch (e) {}

    contenedor.innerHTML = `
        <div class="admin-grid">
            <div class="formulario-card">
                <h3>Nueva Compra</h3>

                <div class="campo-grupo">
                    <label>Proveedor</label>
                    <select id="compra-proveedor">
                        <option value="">— Sin proveedor —</option>
                        ${proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                    </select>
                </div>

                <div class="campo-grupo">
                    <label>Método de pago</label>
                    <select id="compra-metodo">
                        <option value="Efectivo">Efectivo</option>
                        <option value="Nequi">Nequi</option>
                        <option value="Consignación">Consignación</option>
                    </select>
                </div>

                <div class="separador-seccion">Agregar productos</div>

                <div class="buscador-caja">
                    <input type="text" id="buscar-prod-compra" placeholder="🔍 Buscar producto..." autocomplete="off">
                    <div id="resultados-busqueda-compra" class="dropdown-busqueda"></div>
                </div>

                <div class="total-display" style="margin-top: 16px;">
                    <span>TOTAL COMPRA</span>
                    <span class="total-monto">$<span id="total-compra">0</span></span>
                </div>

                <p id="compra-error" style="color:#e74c3c;font-size:.85rem;margin-bottom:.5rem;display:none"></p>
                <button id="btn-registrar-compra" class="btn-primary btn-grande" style="margin-top: 16px; width: 100%;">
                    📦 Registrar Compra
                </button>
            </div>

            <div class="tabla-card">
                <h3>Productos a comprar</h3>
                <div class="tabla-wrapper">
                    <table id="tabla-compra">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cant.</th>
                                <th>Costo unit.</th>
                                <th>Subtotal</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-compra"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('buscar-prod-compra').addEventListener('input', buscarParaCompra);
    document.getElementById('btn-registrar-compra').addEventListener('click', registrarCompraHandler);

    itemsCompra = [];
    renderTablaCompra();
}

async function buscarParaCompra(e) {
    const busqueda = e.target.value.toLowerCase().trim();
    const lista = document.getElementById('resultados-busqueda-compra');
    lista.innerHTML = '';
    if (busqueda.length < 2) return;

    try {
        const productos = await obtenerProductos();
        const filtrados = productos.filter(p => p.nombre && p.nombre.toLowerCase().includes(busqueda));

        if (filtrados.length === 0) {
            lista.innerHTML = `<div class="item-busqueda sin-resultados">Sin resultados</div>`;
            return;
        }

        filtrados.forEach(p => {
            const div = document.createElement('div');
            div.className = 'item-busqueda';
            div.innerHTML = `
                <div class="resultado-info" style="cursor:pointer; flex:1;">
                    <span class="resultado-nombre">${p.nombre}</span>
                    <span class="resultado-precio">Costo: $${parseFloat(p.costo || 0).toLocaleString('es-CO')}</span>
                </div>`;
            div.querySelector('.resultado-info').addEventListener('click', () => agregarItemCompra(p));
            lista.appendChild(div);
        });
    } catch (e) {
        lista.innerHTML = `<div class="item-busqueda sin-resultados">Error cargando productos</div>`;
    }
}

function agregarItemCompra(producto) {
    const existe = itemsCompra.find(i => i.productoId === producto.id);
    if (existe) {
        existe.cantidad += 1;
    } else {
        itemsCompra.push({
            productoId: producto.id,
            nombre: producto.nombre,
            costo: parseFloat(producto.costo) || 0,
            cantidad: 1,
        });
    }
    renderTablaCompra();
    document.getElementById('resultados-busqueda-compra').innerHTML = '';
    document.getElementById('buscar-prod-compra').value = '';
}

function renderTablaCompra() {
    const { items, total } = calcularTotalesCompra(itemsCompra);
    const tbody = document.getElementById('tbody-compra');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="carrito-vacio">Sin productos agregados</td></tr>`;
    } else {
        tbody.innerHTML = items.map((item, i) => `
            <tr>
                <td>${item.nombre}</td>
                <td>
                    <input type="number" value="${item.cantidad}" min="1" class="input-cantidad"
                        onchange="window.actualizarCantidadCompra(${i}, this.value)">
                </td>
                <td>
                    <input type="number" value="${item.costo}" min="0" class="input-costo"
                        onchange="window.actualizarCostoCompra(${i}, this.value)">
                </td>
                <td class="td-subtotal">$${item.subtotal.toLocaleString('es-CO')}</td>
                <td><button onclick="window.eliminarItemCompra(${i})" class="btn-eliminar-item">✕</button></td>
            </tr>
        `).join('');
    }

    const totalEl = document.getElementById('total-compra');
    if (totalEl) totalEl.textContent = total.toLocaleString('es-CO');
}

window.actualizarCantidadCompra = (i, val) => {
    const cant = parseInt(val);
    if (cant > 0) { itemsCompra[i].cantidad = cant; renderTablaCompra(); }
};

window.actualizarCostoCompra = (i, val) => {
    const costo = parseFloat(val);
    if (costo >= 0) { itemsCompra[i].costo = costo; renderTablaCompra(); }
};

window.eliminarItemCompra = (i) => {
    itemsCompra.splice(i, 1);
    renderTablaCompra();
};

async function registrarCompraHandler() {
    const errComp = document.getElementById('compra-error');
if (errComp) errComp.style.display = 'none';

if (itemsCompra.length === 0) {
    if (errComp) { errComp.textContent = 'Agrega al menos un producto.'; errComp.style.display = 'block'; }
    return;
}

const itemInvalido = itemsCompra.find(i => i.cantidad <= 0 || i.costo < 0);
if (itemInvalido) {
    if (errComp) { errComp.textContent = 'La cantidad debe ser mayor a 0 y el costo no puede ser negativo.'; errComp.style.display = 'block'; }
    return;
}

    const { items, total } = calcularTotalesCompra(itemsCompra);
    const btn = document.getElementById('btn-registrar-compra');
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
        await registrarCompra({
            proveedorId: document.getElementById('compra-proveedor').value,
            metodoPago: document.getElementById('compra-metodo').value,
            items,
            total,
        });
        mostrarToast('Compra registrada exitosamente', 'success');
        itemsCompra = [];
        renderTablaCompra();
        document.getElementById('compra-proveedor').value = '';
    } catch (e) {
        mostrarToast('Error al registrar la compra', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📦 Registrar Compra';
    }
}