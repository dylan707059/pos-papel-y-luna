// descuentos.js — Gestión de descuentos
// POS Papel y Luna — MVP 3

import {
    obtenerDescuentos,
    guardarDescuento,
    actualizarDescuento,
    eliminarDescuento
} from './database.js';

let editandoId = null; // null = crear, número = editar

export async function inicializarDescuentos() {
    const contenedor = document.getElementById('interfaz-descuentos');
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="padding:1rem;color:#888">Cargando...</p>';
    editandoId = null;
    await renderizarDescuentos();
}

async function renderizarDescuentos() {
    const contenedor = document.getElementById('interfaz-descuentos');

    let descuentos = [];
    try {
        descuentos = await obtenerDescuentos();
    } catch (e) {
        contenedor.innerHTML = `<p style="color:red;padding:1rem">Error: ${e.message}</p>`;
        return;
    }

    contenedor.innerHTML = `
        <div style="max-width:700px">

            <!-- Formulario crear/editar -->
            <div class="card" style="margin-bottom:1.5rem;padding:1.25rem">
                <h3 id="desc-titulo" style="margin-bottom:1rem;font-size:1rem">Nuevo descuento</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:.75rem;align-items:end">
                    <div>
                        <label class="campo-label">Nombre</label>
                        <input id="desc-nombre" type="text" class="campo-input" placeholder="Ej: Descuento 10%">
                    </div>
                    <div>
                        <label class="campo-label">Tipo</label>
                        <select id="desc-tipo" class="campo-input">
                            <option value="porcentaje">Porcentaje (%)</option>
                            <option value="fijo">Valor fijo ($)</option>
                        </select>
                    </div>
                    <div>
                        <label class="campo-label">Valor</label>
                        <input id="desc-valor" type="number" class="campo-input" placeholder="10" min="0">
                    </div>
                    <button id="btn-guardar-desc" class="btn-primary">Agregar</button>
                    <button id="btn-cancelar-desc" class="btn-secondary" style="display:none">Cancelar</button>
                </div>
                <p id="desc-error" style="color:#e74c3c;font-size:.8rem;margin-top:.5rem;display:none"></p>
            </div>

            <!-- Lista -->
            <div class="card" style="padding:1.25rem">
                <h3 style="margin-bottom:1rem;font-size:1rem">Descuentos registrados</h3>
                ${descuentos.length === 0
                    ? '<p style="color:#888;font-size:.9rem">No hay descuentos registrados.</p>'
                    : `<table style="width:100%;border-collapse:collapse;font-size:.9rem">
                        <thead>
                            <tr style="border-bottom:2px solid #f0f0f0;text-align:left">
                                <th style="padding:.5rem">Nombre</th>
                                <th style="padding:.5rem">Tipo</th>
                                <th style="padding:.5rem">Valor</th>
                                <th style="padding:.5rem"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${descuentos.map(d => `
                                <tr style="border-bottom:1px solid #f5f5f5" id="fila-desc-${d.id}">
                                    <td style="padding:.6rem .5rem">${d.nombre}</td>
                                    <td style="padding:.6rem .5rem">${d.tipo === 'porcentaje' ? 'Porcentaje' : 'Valor fijo'}</td>
                                    <td style="padding:.6rem .5rem">${d.tipo === 'porcentaje' ? d.valor + '%' : '$' + parseFloat(d.valor).toLocaleString()}</td>
                                    <td style="padding:.6rem .5rem;text-align:right;display:flex;gap:.4rem;justify-content:flex-end">
                                        <button onclick="window.editarDesc(${d.id},'${d.nombre}','${d.tipo}',${d.valor})"
                                            style="background:#eff6ff;color:#1d4ed8;border:none;padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.8rem">
                                            Editar
                                        </button>
                                        <button onclick="window.eliminarDesc(${d.id})"
                                            style="background:#fff0f0;color:#e74c3c;border:none;padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.8rem">
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        </div>
    `;

    // Guardar (crear o editar)
    document.getElementById('btn-guardar-desc').addEventListener('click', async () => {
        const nombre = document.getElementById('desc-nombre').value.trim();
        const tipo   = document.getElementById('desc-tipo').value;
        const valor  = parseFloat(document.getElementById('desc-valor').value);
        const errEl  = document.getElementById('desc-error');

        if (!nombre)                    { mostrarError(errEl, 'El nombre es requerido.'); return; }
        if (isNaN(valor) || valor < 0)  { mostrarError(errEl, 'Ingresa un valor válido.'); return; }
        if (tipo === 'porcentaje' && valor > 100) { mostrarError(errEl, 'El porcentaje no puede superar 100.'); return; }

        errEl.style.display = 'none';

        try {
            if (editandoId) {
                await actualizarDescuento({ id: editandoId, nombre, tipo, valor });
            } else {
                await guardarDescuento({ nombre, tipo, valor });
            }
            editandoId = null;
            await renderizarDescuentos();
        } catch (e) {
            mostrarError(errEl, e.message);
        }
    });

    // Cancelar edición
    document.getElementById('btn-cancelar-desc').addEventListener('click', () => {
        editandoId = null;
        renderizarDescuentos();
    });

    // Editar — carga datos en el formulario
    window.editarDesc = (id, nombre, tipo, valor) => {
        editandoId = id;
        document.getElementById('desc-nombre').value = nombre;
        document.getElementById('desc-tipo').value   = tipo;
        document.getElementById('desc-valor').value  = valor;
        document.getElementById('desc-titulo').textContent  = `Editando: ${nombre}`;
        document.getElementById('btn-guardar-desc').textContent = 'Guardar cambios';
        document.getElementById('btn-cancelar-desc').style.display = 'inline-block';

        // Resaltar fila editada
        document.querySelectorAll('tr[id^="fila-desc-"]').forEach(r => r.style.background = '');
        const fila = document.getElementById(`fila-desc-${id}`);
        if (fila) fila.style.background = '#eff6ff';

        document.getElementById('interfaz-descuentos').scrollIntoView({ behavior: 'smooth' });
    };

    // Eliminar
    window.eliminarDesc = async (id) => {
        if (!confirm('¿Eliminar este descuento?')) return;
        try {
            await eliminarDescuento(id);
            await renderizarDescuentos();
        } catch (e) {
            alert(e.message);
        }
    };
}

function mostrarError(el, msg) {
    el.textContent   = msg;
    el.style.display = 'block';
}
