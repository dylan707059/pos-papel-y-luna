// entidades.js — CRUD de Categorías, Clientes y Proveedores
// POS Papel y Luna — MVP 2

import {
    obtenerCategorias, guardarCategoria, actualizarCategoria, eliminarCategoria,
    obtenerClientes, guardarCliente, actualizarCliente, eliminarCliente,
    obtenerProveedores, guardarProveedor, actualizarProveedor, eliminarProveedor
} from './database.js';
import { validarCategoria, validarCliente, validarProveedor } from './logic.js';
import { mostrarToast } from './logic.js';

// ─── FÁBRICA GENÉRICA DE CRUD ──────────────────────────────────────────────────
// Reutilizamos la misma lógica para los 3 módulos cambiando la config

function crearModuloCrud(config) {
    const {
        contenedorId, titulo, campos, obtener, guardar, actualizar, eliminar, validar, prefixId
    } = config;

    let modoEdicion = null;

    async function inicializar() {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;
        contenedor.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

        contenedor.innerHTML = `
            <div class="admin-grid">
                <div class="formulario-card">
                    <h3 id="titulo-form-${prefixId}">${titulo} nuevo</h3>
                    ${campos.map(c => `
                        <div class="campo-grupo">
                            <label>${c.label}${c.req ? ' *' : ''}</label>
                            <input type="${c.type || 'text'}" id="${prefixId}-${c.key}" placeholder="${c.placeholder || ''}">
                        </div>
                    `).join('')}
                    <div class="form-botones">
                        <button id="btn-submit-${prefixId}" class="btn-primary">Crear</button>
                        <button id="btn-cancelar-${prefixId}" class="btn-secondary" style="display:none">Cancelar</button>
                    </div>
                </div>
                <div class="tabla-card">
                    <h3>Listado</h3>
                    <div class="tabla-wrapper" id="tabla-${prefixId}-container"></div>
                </div>
            </div>
        `;

        document.getElementById(`btn-submit-${prefixId}`).addEventListener('click', handleSubmit);
        document.getElementById(`btn-cancelar-${prefixId}`).addEventListener('click', resetForm);
        await renderTabla();
    }

   async function renderTabla() {
    const container = document.getElementById(`tabla-${prefixId}-container`);
    if (!container) return;
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
        const items = await obtener();
        if (items.length === 0) {
            container.innerHTML = `<p class="sin-datos">No hay registros aún.</p>`;
            return;
        }

        container.innerHTML = `
            <div class="buscador-caja" style="margin-bottom: 12px;">
                <input type="text" id="buscar-${prefixId}" placeholder="🔍 Buscar por nombre..." 
                    style="width:100%; background:var(--surface-2); border:1px solid var(--border); 
                    border-radius:var(--radius); color:var(--text); font-family:var(--font); 
                    font-size:.9rem; padding:9px 12px; outline:none;">
            </div>
            <div id="lista-${prefixId}"></div>
        `;

        // Guardar items en variable para filtrar sin llamar API de nuevo
        let itemsFiltrados = [...items];

        function renderLista(datos) {
            const lista = document.getElementById(`lista-${prefixId}`);
            if (!lista) return;
            if (datos.length === 0) {
                lista.innerHTML = `<p class="sin-datos">Sin resultados.</p>`;
                return;
            }
            lista.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            ${campos.map(c => `<th>${c.label}</th>`).join('')}
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${datos.map(item => `
                            <tr>
                                ${campos.map(c => `<td>${item[c.key] || '—'}</td>`).join('')}
                                <td class="td-acciones">
                                    <button onclick="window['editar_${prefixId}']('${item.id}')" class="btn-tabla-edit">Editar</button>
                                    <button onclick="window['borrar_${prefixId}']('${item.id}', '${String(item.nombre || item.id).replace(/'/g, "\\'")}')" class="btn-tabla-delete">Borrar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
        }

        renderLista(items);

        // Evento del buscador
        document.getElementById(`buscar-${prefixId}`).addEventListener('input', (e) => {
            const busqueda = e.target.value.toLowerCase().trim();
            if (busqueda.length === 0) {
                itemsFiltrados = [...items];
            } else {
                itemsFiltrados = items.filter(item =>
                    item.nombre && item.nombre.toLowerCase().includes(busqueda)
                );
            }
            renderLista(itemsFiltrados);
        });

    } catch (e) {
        container.innerHTML = `<p class="error-datos">Error cargando datos.</p>`;
    }
}

    async function handleSubmit() {
        const datos = {};
        for (const c of campos) {
            const el = document.getElementById(`${prefixId}-${c.key}`);
            datos[c.key] = el ? el.value.trim() : '';
        }

        const error = validar(datos);
        if (error) return mostrarToast(error, 'error');

        const btn = document.getElementById(`btn-submit-${prefixId}`);
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            if (modoEdicion) {
                await actualizar({ ...datos, id: modoEdicion });
                mostrarToast('Actualizado correctamente', 'success');
                resetForm();
            } else {
                await guardar(datos);
                mostrarToast('Creado correctamente', 'success');
                resetForm();
            }
            await renderTabla();
        } catch (e) {
            mostrarToast('Error al guardar', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = modoEdicion ? 'Actualizar' : 'Crear';
        }
    }

    function resetForm() {
        campos.forEach(c => {
            const el = document.getElementById(`${prefixId}-${c.key}`);
            if (el) el.value = '';
        });
        modoEdicion = null;
        const btn = document.getElementById(`btn-submit-${prefixId}`);
        if (btn) btn.textContent = 'Crear';
        const btnC = document.getElementById(`btn-cancelar-${prefixId}`);
        if (btnC) btnC.style.display = 'none';
        const titulo = document.getElementById(`titulo-form-${prefixId}`);
        if (titulo) titulo.textContent = `${config.titulo} nuevo`;
    }

    // Registrar funciones globales para los botones de la tabla
    window[`editar_${prefixId}`] = async (id) => {
        try {
            const items = await obtener();
            const item = items.find(x => x.id === id);
            if (!item) return;

            campos.forEach(c => {
                const el = document.getElementById(`${prefixId}-${c.key}`);
                if (el) el.value = item[c.key] || '';
            });

            modoEdicion = id;
            const btn = document.getElementById(`btn-submit-${prefixId}`);
            if (btn) btn.textContent = 'Actualizar';
            const btnC = document.getElementById(`btn-cancelar-${prefixId}`);
            if (btnC) btnC.style.display = 'inline-flex';
            const tituloEl = document.getElementById(`titulo-form-${prefixId}`);
            if (tituloEl) tituloEl.textContent = `Editando: ${item.nombre || id}`;
        } catch (e) {
            mostrarToast('Error al cargar registro', 'error');
        }
    };

    window[`borrar_${prefixId}`] = async (id, nombre) => {
        if (!confirm(`¿Eliminar "${nombre}"?`)) return;
        try {
            await eliminar(id);
            mostrarToast('Eliminado', 'success');
            await renderTabla();
        } catch (e) {
            mostrarToast('Error al eliminar', 'error');
        }
    };

    return { inicializar };
}

// ─── INSTANCIAS ────────────────────────────────────────────────────────────────

const moduloCategorias = crearModuloCrud({
    contenedorId: 'interfaz-categorias',
    titulo: 'Categoría',
    prefixId: 'cat',
    campos: [
        { key: 'nombre', label: 'Nombre', req: true, placeholder: 'Ej: Útiles escolares' },
    ],
    obtener: obtenerCategorias,
    guardar: guardarCategoria,
    actualizar: actualizarCategoria,
    eliminar: eliminarCategoria,
    validar: validarCategoria,
});

const moduloClientes = crearModuloCrud({
    contenedorId: 'interfaz-clientes',
    titulo: 'Cliente',
    prefixId: 'cli',
    campos: [
        { key: 'nombre', label: 'Nombre', req: true, placeholder: 'Nombre completo' },
        { key: 'telefono', label: 'Teléfono', placeholder: '300 000 0000' },
        { key: 'correo', label: 'Correo', type: 'email', placeholder: 'correo@ejemplo.com' },
    ],
    obtener: obtenerClientes,
    guardar: guardarCliente,
    actualizar: actualizarCliente,
    eliminar: eliminarCliente,
    validar: validarCliente,
});

const moduloProveedores = crearModuloCrud({
    contenedorId: 'interfaz-proveedores',
    titulo: 'Proveedor',
    prefixId: 'prov',
    campos: [
        { key: 'nombre', label: 'Nombre', req: true, placeholder: 'Nombre del proveedor' },
        { key: 'nit', label: 'NIT', placeholder: '900.000.000-0' },
        { key: 'telefono', label: 'Teléfono', placeholder: '300 000 0000' },
    ],
    obtener: obtenerProveedores,
    guardar: guardarProveedor,
    actualizar: actualizarProveedor,
    eliminar: eliminarProveedor,
    validar: validarProveedor,
});

export const inicializarCategorias = () => moduloCategorias.inicializar();
export const inicializarClientes = () => moduloClientes.inicializar();
export const inicializarProveedores = () => moduloProveedores.inicializar();