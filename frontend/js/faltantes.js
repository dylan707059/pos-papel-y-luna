// faltantes.js — Gestión de productos faltantes
// POS Papel y Luna — MVP 3

import {
    obtenerFaltantes,
    registrarFaltante,
    actualizarEstadoFaltante,
    eliminarFaltante,
    obtenerProveedores
} from './database.js';

export async function inicializarFaltantes() {
    const contenedor = document.getElementById('interfaz-faltantes');
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="padding:1rem;color:#888">Cargando...</p>';
    await renderizarFaltantes({});
}

async function renderizarFaltantes(filtros = {}) {
    const contenedor = document.getElementById('interfaz-faltantes');

    let faltantes = [], proveedores = [];
    try {
        [faltantes, proveedores] = await Promise.all([
            obtenerFaltantes(filtros),
            obtenerProveedores()
        ]);
    } catch (e) {
        contenedor.innerHTML = `<p style="color:red;padding:1rem">Error: ${e.message}</p>`;
        return;
    }

    const pendientes = faltantes.filter(f => f.estado === 'pendiente');
    const resueltos  = faltantes.filter(f => f.estado !== 'pendiente');

    contenedor.innerHTML = `
        <div style="max-width:860px">

            <!-- Formulario -->
            <div class="card" style="margin-bottom:1.5rem;padding:1.25rem">
                <h3 style="margin-bottom:1rem;font-size:1rem">Registrar producto faltante</h3>
                <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:.75rem;align-items:end">
                    <div>
                        <label class="campo-label">Nombre del producto</label>
                        <input id="falt-nombre" type="text" class="campo-input" placeholder="Ej: Colores Faber Castell x12">
                    </div>
                    <div>
                        <label class="campo-label">Cantidad</label>
                        <input id="falt-cantidad" type="number" class="campo-input" placeholder="1" min="1">
                    </div>
                    <div>
                        <label class="campo-label">Tipo</label>
                        <select id="falt-tipo" class="campo-input">
                            <option value="no_registrado">No registrado</option>
                            <option value="agotado">Agotado</option>
                        </select>
                    </div>
                    <div>
                        <label class="campo-label">Proveedor</label>
                        <select id="falt-proveedor" class="campo-input">
                            <option value="">— Ninguno —</option>
                            ${proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <button id="btn-agregar-falt" class="btn-primary">Registrar</button>
                </div>
                <div style="margin-top:.75rem">
                    <label class="campo-label">Observación (opcional)</label>
                    <input id="falt-obs" type="text" class="campo-input" placeholder="Ej: Cliente lo solicitó varias veces">
                </div>
                <p id="falt-error" style="color:#e74c3c;font-size:.8rem;margin-top:.5rem;display:none"></p>
            </div>

            <!-- Filtros -->
            <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap">
                <div>
                    <label class="campo-label">Filtrar por tipo</label>
                    <select id="filtro-tipo" class="campo-input" style="min-width:150px">
                        <option value="">Todos</option>
                        <option value="no_registrado" ${filtros.tipo === 'no_registrado' ? 'selected' : ''}>No registrado</option>
                        <option value="agotado" ${filtros.tipo === 'agotado' ? 'selected' : ''}>Agotado</option>
                    </select>
                </div>
                <div>
                    <label class="campo-label">Filtrar por proveedor</label>
                    <select id="filtro-proveedor" class="campo-input" style="min-width:150px">
                        <option value="">Todos</option>
                        ${proveedores.map(p => `<option value="${p.id}" ${String(filtros.proveedor_id) === String(p.id) ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="campo-label">Estado</label>
                    <select id="filtro-estado" class="campo-input" style="min-width:130px">
                        <option value="" ${!filtros.estado ? 'selected' : ''}>Todos</option>
                        <option value="pendiente" ${filtros.estado === 'pendiente' ? 'selected' : ''}>Pendientes</option>
                        <option value="resuelto" ${filtros.estado === 'resuelto' ? 'selected' : ''}>Resueltos</option>
                        <option value="descartado" ${filtros.estado === 'descartado' ? 'selected' : ''}>Descartados</option>
                    </select>
                </div>
                <button id="btn-filtrar" class="btn-primary">Filtrar</button>
                <button id="btn-limpiar" class="btn-secondary">Limpiar</button>
            </div>

            <!-- Pendientes -->
            <div class="card" style="padding:1.25rem;margin-bottom:1rem">
                <h3 style="margin-bottom:1rem;font-size:1rem">
                    📭 Pendientes
                    <span style="background:#fef3c7;color:#92400e;font-size:.75rem;padding:2px 8px;border-radius:20px;margin-left:.5rem">${pendientes.length}</span>
                </h3>
                ${pendientes.length === 0
                    ? '<p style="color:#888;font-size:.9rem">No hay faltantes pendientes.</p>'
                    : tablaFaltantes(pendientes, true)
                }
            </div>

            <!-- Resueltos/Descartados -->
            ${resueltos.length > 0 ? `
            <div class="card" style="padding:1.25rem">
                <h3 style="margin-bottom:1rem;font-size:1rem">✅ Resueltos / Descartados</h3>
                ${tablaFaltantes(resueltos, false)}
            </div>` : ''}

        </div>
    `;

    // Registrar faltante
    document.getElementById('btn-agregar-falt').addEventListener('click', async () => {
        const nombre      = document.getElementById('falt-nombre').value.trim();
        const cantidad    = parseInt(document.getElementById('falt-cantidad').value) || null;
        const tipo        = document.getElementById('falt-tipo').value;
        const proveedorId = document.getElementById('falt-proveedor').value || null;
        const obs         = document.getElementById('falt-obs').value.trim();
        const errEl       = document.getElementById('falt-error');

        if (!nombre) { errEl.textContent = 'El nombre es requerido.'; errEl.style.display = 'block'; return; }

const cantidadNum = parseInt(document.getElementById('falt-cantidad').value);
if (document.getElementById('falt-cantidad').value && cantidadNum <= 0) {
    errEl.textContent = 'La cantidad debe ser mayor a 0.';
    errEl.style.display = 'block';
    return;
}

errEl.style.display = 'none';

        try {
            await registrarFaltante({ nombreProducto: nombre, cantidad, tipo, observacion: obs, proveedorId });
            await renderizarFaltantes(obtenerFiltrosActuales());
        } catch (e) {
            errEl.textContent = e.message; errEl.style.display = 'block';
        }
    });

    // Aplicar filtros
    document.getElementById('btn-filtrar').addEventListener('click', () => {
        renderizarFaltantes(obtenerFiltrosActuales());
    });

    // Limpiar filtros
    document.getElementById('btn-limpiar').addEventListener('click', () => {
        renderizarFaltantes({});
    });

    window.resolverFaltante  = async (id) => { await actualizarEstadoFaltante(id, 'resuelto');   await renderizarFaltantes(obtenerFiltrosActuales()); };
    window.descartarFaltante = async (id) => { await actualizarEstadoFaltante(id, 'descartado'); await renderizarFaltantes(obtenerFiltrosActuales()); };
    window.borrarFaltante    = async (id) => {
        if (!confirm('¿Eliminar este registro?')) return;
        await eliminarFaltante(id);
        await renderizarFaltantes(obtenerFiltrosActuales());
    };
}

function obtenerFiltrosActuales() {
    const tipo        = document.getElementById('filtro-tipo')?.value;
    const proveedorId = document.getElementById('filtro-proveedor')?.value;
    const estado      = document.getElementById('filtro-estado')?.value;
    const filtros     = {};
    if (tipo)        filtros.tipo         = tipo;
    if (proveedorId) filtros.proveedor_id = proveedorId;
    if (estado)      filtros.estado       = estado;
    return filtros;
}

function tablaFaltantes(lista, mostrarAcciones) {
    return `
        <table style="width:100%;border-collapse:collapse;font-size:.9rem">
            <thead>
                <tr style="border-bottom:2px solid #f0f0f0;text-align:left">
                    <th style="padding:.5rem">Producto</th>
                    <th style="padding:.5rem">Cant.</th>
                    <th style="padding:.5rem">Tipo</th>
                    <th style="padding:.5rem">Fecha</th>
                    <th style="padding:.5rem">Observación</th>
                    <th style="padding:.5rem">${mostrarAcciones ? 'Acciones' : 'Estado'}</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(f => `
                    <tr style="border-bottom:1px solid #f5f5f5">
                        <td style="padding:.6rem .5rem;font-weight:500">${f.nombre_producto}</td>
                        <td style="padding:.6rem .5rem">${f.cantidad ?? '—'}</td>
                        <td style="padding:.6rem .5rem">${f.tipo === 'agotado' ? '🔴 Agotado' : '🟡 No registrado'}</td>
                        <td style="padding:.6rem .5rem;color:#888;font-size:.8rem">${f.fecha?.split('T')[0] ?? f.fecha}</td>
                        <td style="padding:.6rem .5rem;color:#888;font-size:.85rem">${f.observacion ?? '—'}</td>
                        <td style="padding:.6rem .5rem;white-space:nowrap">
                            ${mostrarAcciones
                                ? `<button onclick="resolverFaltante(${f.id})"  style="background:#f0fdf4;color:#16a34a;border:none;padding:.3rem .6rem;border-radius:6px;cursor:pointer;font-size:.8rem;margin-right:4px">✅ Resolver</button>
                                   <button onclick="descartarFaltante(${f.id})" style="background:#fff7ed;color:#c2410c;border:none;padding:.3rem .6rem;border-radius:6px;cursor:pointer;font-size:.8rem">🗑 Descartar</button>`
                                : `<span style="font-size:.8rem;color:#888">${f.estado}</span>`
                            }
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
