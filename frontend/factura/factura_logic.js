// factura_logic.js — Carga la factura desde Google Sheets
// POS Papel y Luna — MVP 2

const API_URL = 'https://script.google.com/macros/s/AKfycbwm5jTJBvHRExRJLsz2BS8jMKJGRzv56I3h0HLmLzAQ4XuN0AySJtJ-XA8fViFEAd15DQ/exec';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const facturaId = params.get('id');

    if (!facturaId) {
        document.getElementById('nro-factura').textContent = 'FACTURA: (sin ID)';
        return;
    }

    document.getElementById('nro-factura').textContent = `FACTURA: ${facturaId}`;

    const estadoEl = document.getElementById('estado-carga');
    if (estadoEl) { estadoEl.style.display = 'block'; estadoEl.textContent = 'Cargando factura...'; }

    try {
        const res = await fetch(`${API_URL}?resource=ventas`);
        const json = await res.json();

        if (!json.success || !json.data) throw new Error('Sin datos');

        const ventas = json.data;
        const venta = ventas.find(v => v.id === facturaId);

        if (!venta) {
            if (estadoEl) estadoEl.textContent = 'Factura no encontrada.';
            return;
        }

        if (estadoEl) estadoEl.style.display = 'none';

        // Parsear items
        let items = [];
        try {
            items = typeof venta.itemsJson === 'string'
                ? JSON.parse(venta.itemsJson)
                : (venta.itemsJson || []);
        } catch (e) { items = []; }

        document.getElementById('fecha').textContent = venta.fecha || '';
        document.getElementById('total').textContent = parseFloat(venta.total || 0).toLocaleString('es-CO');
        document.getElementById('recibido').textContent = parseFloat(venta.dineroRecibido || venta.total || 0).toLocaleString('es-CO');
        document.getElementById('cambio').textContent = parseFloat(venta.cambio || 0).toLocaleString('es-CO');

        const tabla = document.getElementById('items-tabla');
        tabla.innerHTML = items.map(item => `
            <tr>
                <td>${item.cantidad}</td>
                <td>${String(item.nombre).toUpperCase()}</td>
                <td class="derecha">$${parseFloat(item.subtotal).toLocaleString('es-CO')}</td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('Error cargando factura:', err);
        if (estadoEl) estadoEl.textContent = 'Error al cargar la factura. Verifica la conexión.';
    }
});