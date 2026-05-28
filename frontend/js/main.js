// main.js — Orquestador principal
// POS Papel y Luna — MVP 3

import { getUsuario, cerrarSesion }                                     from './database.js';
import { inicializarVentas }                                             from './ventas.js';
import { inicializarAdmin, renderizarHistorial, renderizarHistorialCompras } from './admin.js';
import { inicializarCompras }                                            from './compras.js';
import { inicializarCategorias, inicializarClientes, inicializarProveedores } from './entidades.js';
import { inicializarDescuentos }                                         from './descuentos.js';
import { inicializarFaltantes }                                          from './faltantes.js';
import { inicializarReportes }                                           from './reportes.js';

document.addEventListener('DOMContentLoaded', () => {

    // ── Verificar sesión ────────────────────────────────────────────────────────
    const usuario = getUsuario();
    if (!usuario) {
        window.location.href = 'login.html';
        return;
    }

    // Mostrar nombre y rol del usuario en el navbar
    const infoEl = document.getElementById('usuario-info');
    if (infoEl) {
        const icono = usuario.rol === 'admin' ? '👑' : '🧾';
        infoEl.textContent = `${icono} ${usuario.nombre}`;
    }

    // Botón cerrar sesión
    document.getElementById('btn-cerrar-sesion')?.addEventListener('click', () => {
        if (confirm('¿Deseas cerrar sesión?')) cerrarSesion();
    });

    // ── Navegación ──────────────────────────────────────────────────────────────
    const vistas = [
        { btnId: 'btn-ventas',            vistaId: 'seccion-ventas',            init: inicializarVentas },
        { btnId: 'btn-productos',         vistaId: 'seccion-productos',         init: inicializarAdmin },
        { btnId: 'btn-compras',           vistaId: 'seccion-compras',           init: inicializarCompras },
        { btnId: 'btn-historial',         vistaId: 'seccion-historial',         init: renderizarHistorial },
        { btnId: 'btn-historial-compras', vistaId: 'seccion-historial-compras', init: renderizarHistorialCompras },
        { btnId: 'btn-clientes',          vistaId: 'seccion-clientes',          init: inicializarClientes },
        { btnId: 'btn-proveedores',       vistaId: 'seccion-proveedores',       init: inicializarProveedores },
        { btnId: 'btn-categorias',        vistaId: 'seccion-categorias',        init: inicializarCategorias },
        { btnId: 'btn-descuentos',        vistaId: 'seccion-descuentos',        init: inicializarDescuentos },
        { btnId: 'btn-faltantes',         vistaId: 'seccion-faltantes',         init: inicializarFaltantes },
        { btnId: 'btn-reportes',          vistaId: 'seccion-reportes',          init: inicializarReportes },
    ];

    vistas.forEach(({ btnId, vistaId, init }) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                cambiarVista(vistaId, btn);
                init();
            });
        }
    });

    // Menú hamburguesa móvil
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks   = document.getElementById('nav-links');
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => navLinks.classList.toggle('nav-open'));
        navLinks.addEventListener('click',   () => navLinks.classList.remove('nav-open'));
    }

    // Vista por defecto
    document.getElementById('btn-ventas')?.click();
});

function cambiarVista(vistaId, btnActivo) {
    document.querySelectorAll('.vista').forEach(v => v.style.display = 'none');
    const vista = document.getElementById(vistaId);
    if (vista) vista.style.display = 'block';

    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    if (btnActivo) btnActivo.classList.add('active');
}
