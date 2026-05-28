// reportes.js — Reportes básicos del negocio
// POS Papel y Luna — MVP 3

import {
    reporteVentas,
    reporteProductosMasVendidos,
    reporteCompras,
    reporteFaltantes
} from './database.js';

export async function inicializarReportes() {
    const contenedor = document.getElementById('interfaz-reportes');
    if (!contenedor) return;

    // Fechas por defecto: este mes
    const hoy    = new Date();
    const desde  = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const hasta  = hoy.toISOString().split('T')[0];

    contenedor.innerHTML = `
        <div style="max-width:900px">

            <!-- Filtro de fechas -->
            <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap">
                <div>
                    <label class="campo-label">Desde</label>
                    <input id="rep-desde" type="date" class="campo-input" value="${desde}">
                </div>
                <div>
                    <label class="campo-label">Hasta</label>
                    <input id="rep-hasta" type="date" class="campo-input" value="${hasta}">
                </div>
                <button id="btn-generar-reporte" class="btn-primary">Generar reporte</button>
            </div>

            <div id="reporte-contenido">
                <p style="color:#888;font-size:.9rem">Selecciona un rango de fechas y haz clic en "Generar reporte".</p>
            </div>

        </div>
    `;

    document.getElementById('btn-generar-reporte').addEventListener('click', cargarReporte);
    cargarReporte(); // Cargar automáticamente al abrir
}

async function cargarReporte() {
    const desde     = document.getElementById('rep-desde').value;
    const hasta     = document.getElementById('rep-hasta').value;
    const contenido = document.getElementById('reporte-contenido');

    contenido.innerHTML = '<p style="color:#888;padding:1rem">Cargando reportes...</p>';

    try {
        const [ventas, productos, compras, faltantes] = await Promise.all([
            reporteVentas(desde, hasta),
            reporteProductosMasVendidos(desde, hasta),
            reporteCompras(desde, hasta),
            reporteFaltantes()
        ]);

        contenido.innerHTML = `

            <!-- Tarjetas resumen ventas -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem">
                ${tarjeta('🛒', 'Total ventas',    ventas.resumen?.total_ventas    ?? 0, '')}
                ${tarjeta('💰', 'Ingresos',        formatoPeso(ventas.resumen?.ingresos_totales ?? 0), '')}
                ${tarjeta('🎟', 'Ticket promedio', formatoPeso(ventas.resumen?.ticket_promedio  ?? 0), '')}
                ${tarjeta('💵', 'En efectivo',     ventas.resumen?.ventas_efectivo ?? 0, 'ventas')}
            </div>

            <!-- Ventas por método de pago -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
                <div class="card" style="padding:1.25rem">
                    <h3 style="font-size:.95rem;margin-bottom:1rem">💳 Ventas por método de pago</h3>
                    ${filaPago('💵 Efectivo', ventas.resumen?.ventas_efectivo ?? 0)}
                    ${filaPago('📱 Nequi',    ventas.resumen?.ventas_nequi    ?? 0)}
                    ${filaPago('📒 Debe',     ventas.resumen?.ventas_debe     ?? 0)}
                </div>

                <div class="card" style="padding:1.25rem">
                    <h3 style="font-size:.95rem;margin-bottom:1rem">🏪 Resumen compras</h3>
                    ${filaPago('Total compras', compras.resumen?.total_compras ?? 0)}
                    <div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid #f5f5f5;font-size:.9rem">
                        <span>💸 Gasto total</span>
                        <strong>${formatoPeso(compras.resumen?.gasto_total ?? 0)}</strong>
                    </div>
                </div>
            </div>

            <!-- Productos más vendidos -->
            <div class="card" style="padding:1.25rem;margin-bottom:1rem">
                <h3 style="font-size:.95rem;margin-bottom:1rem">🏆 Productos más vendidos</h3>
                ${productos.length === 0
                    ? '<p style="color:#888;font-size:.9rem">Sin datos en este período.</p>'
                    : `<table style="width:100%;border-collapse:collapse;font-size:.9rem">
                        <thead>
                            <tr style="border-bottom:2px solid #f0f0f0;text-align:left">
                                <th style="padding:.5rem">#</th>
                                <th style="padding:.5rem">Producto</th>
                                <th style="padding:.5rem">Unidades</th>
                                <th style="padding:.5rem">Total generado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productos.map((p, i) => `
                                <tr style="border-bottom:1px solid #f5f5f5">
                                    <td style="padding:.5rem;color:#888">${i + 1}</td>
                                    <td style="padding:.5rem;font-weight:500">${p.nombre}</td>
                                    <td style="padding:.5rem">${p.unidades_vendidas}</td>
                                    <td style="padding:.5rem">${formatoPeso(p.total_generado)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`
                }
            </div>

            <!-- Faltantes frecuentes -->
            <div class="card" style="padding:1.25rem">
                <h3 style="font-size:.95rem;margin-bottom:1rem">📭 Faltantes más frecuentes</h3>
                ${faltantes.length === 0
                    ? '<p style="color:#888;font-size:.9rem">No hay faltantes registrados.</p>'
                    : `<table style="width:100%;border-collapse:collapse;font-size:.9rem">
                        <thead>
                            <tr style="border-bottom:2px solid #f0f0f0;text-align:left">
                                <th style="padding:.5rem">Producto</th>
                                <th style="padding:.5rem">Veces solicitado</th>
                                <th style="padding:.5rem">Última vez</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${faltantes.slice(0,10).map(f => `
                                <tr style="border-bottom:1px solid #f5f5f5">
                                    <td style="padding:.5rem;font-weight:500">${f.nombre_producto}</td>
                                    <td style="padding:.5rem">${f.veces_solicitado}</td>
                                    <td style="padding:.5rem;color:#888;font-size:.85rem">${f.ultima_fecha?.split('T')[0] ?? f.ultima_fecha}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`
                }
            </div>

        `;
    } catch (e) {
        contenido.innerHTML = `<p style="color:red;padding:1rem">Error al cargar reportes: ${e.message}</p>`;
    }
}

// ─── HELPERS UI ────────────────────────────────────────────────────────────────

function tarjeta(icono, titulo, valor, sufijo) {
    return `
        <div class="card" style="padding:1rem 1.25rem">
            <p style="font-size:.8rem;color:#888;margin-bottom:.25rem">${icono} ${titulo}</p>
            <p style="font-size:1.5rem;font-weight:700;color:#1a1a1a">${valor} <span style="font-size:.85rem;font-weight:400;color:#888">${sufijo}</span></p>
        </div>
    `;
}

function filaPago(label, valor) {
    return `
        <div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid #f5f5f5;font-size:.9rem">
            <span>${label}</span>
            <strong>${valor}</strong>
        </div>
    `;
}

function formatoPeso(valor) {
    return '$' + Math.round(valor || 0).toLocaleString('es-CO');
}
