// ⚠️ IMPORTANTE: pega aquí la URL de tu Web App de Apps Script
// (Implementar → Gestionar implementaciones → la que termina en /exec).
// Es la MISMA URL que usa la app de gestión, solo que aquí va fija en
// el código porque los clientes no tienen que configurar nada.
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwirzOGAOMLbaV3DLDNeLAaYg1W3-OnfCnh05NdGpA8a6Gq3dAKJv6s1MV9Kw2kmuI/exec';

let telefonoCliente = localStorage.getItem('telefonoCliente') || '';
let nombreCliente = '';
let catalogo = [];
let carrito = {}; // { productoId: cantidad }
let fechaEntregaElegida = 'manana'; // siempre para mañana: se manda cada día

async function apiCliente(action, extraParams) {
  const params = new URLSearchParams({ action, ...(extraParams || {}) });
  const res = await fetch(`${WEB_APP_URL}?${params.toString()}`);
  return res.json();
}

function formatoEuros(n) {
  return Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnContinuar').addEventListener('click', identificarCliente);
  document.getElementById('inputTelefono').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') identificarCliente();
  });
  document.getElementById('btnCambiarTelefono').addEventListener('click', olvidarTelefono);
  document.getElementById('btnEnviarPedido').addEventListener('click', enviarPedido);
  document.getElementById('btnNuevoPedido').addEventListener('click', () => {
    carrito = {};
    mostrarPantalla('catalogo');
    cargarCatalogo();
  });

  if (telefonoCliente) {
    identificarCliente(true);
  }
});

function mostrarPantalla(nombre) {
  document.getElementById('pantallaTelefono').classList.toggle('tab--hidden', nombre !== 'telefono');
  document.getElementById('pantallaCatalogo').classList.toggle('tab--hidden', nombre !== 'catalogo');
  document.getElementById('pantallaConfirmacion').classList.toggle('tab--hidden', nombre !== 'confirmacion');
}

async function identificarCliente(esAutomatico) {
  const msg = document.getElementById('msgTelefono');
  const telefono = esAutomatico ? telefonoCliente : document.getElementById('inputTelefono').value.trim();

  if (!telefono) { msg.textContent = 'Escribe tu teléfono.'; msg.className = 'form-msg is-error'; return; }

  if (!esAutomatico) {
    msg.textContent = 'Comprobando…';
    msg.className = 'form-msg';
  }

  const r = await apiCliente('clienteIdentificar', { telefono }).catch(() => ({ ok: false }));

  if (!r.ok) {
    msg.textContent = 'No se pudo conectar. Inténtalo de nuevo en un momento.';
    msg.className = 'form-msg is-error';
    return;
  }
  if (!r.encontrado) {
    msg.textContent = 'Ese teléfono no está registrado. Contacta con nosotros para darte de alta.';
    msg.className = 'form-msg is-error';
    return;
  }

  telefonoCliente = telefono;
  nombreCliente = r.nombre;
  localStorage.setItem('telefonoCliente', telefono);
  document.getElementById('saludoNombre').textContent = `¿Qué deseas para mañana, ${nombreCliente}?`;

  mostrarPantalla('catalogo');
  cargarCatalogo();
}

function olvidarTelefono() {
  localStorage.removeItem('telefonoCliente');
  telefonoCliente = '';
  carrito = {};
  document.getElementById('inputTelefono').value = '';
  document.getElementById('msgTelefono').textContent = '';
  mostrarPantalla('telefono');
}

async function cargarCatalogo() {
  const cont = document.getElementById('listaCatalogo');
  cont.innerHTML = '<div class="empty-state">Cargando catálogo…</div>';

  const r = await apiCliente('clienteCatalogo').catch(() => ({ ok: false }));
  if (!r.ok) { cont.innerHTML = '<div class="empty-state">No se pudo cargar el catálogo. Recarga la página.</div>'; return; }

  catalogo = r.data;
  cont.innerHTML = catalogo.map((p) => `
    <div class="producto-fila">
      <div>
        <div class="producto-fila__nombre">${escapeHtml(p.nombre)}</div>
        <div class="producto-fila__precio">${formatoEuros(p.precio)}</div>
      </div>
      <div class="producto-stepper">
        <button class="producto-stepper__btn" data-accion="menos" data-id="${p.id}">−</button>
        <span class="producto-stepper__val" id="cant-${p.id}">0</span>
        <button class="producto-stepper__btn" data-accion="mas" data-id="${p.id}">+</button>
      </div>
    </div>
  `).join('');

  cont.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const delta = btn.dataset.accion === 'mas' ? 1 : -1;
      carrito[id] = Math.max(0, (carrito[id] || 0) + delta);
      document.getElementById(`cant-${id}`).textContent = carrito[id];
      recalcularCarrito();
    });
  });

  recalcularCarrito();
}

function recalcularCarrito() {
  let total = 0;
  Object.entries(carrito).forEach(([id, cant]) => {
    if (cant > 0) {
      const p = catalogo.find((pr) => String(pr.id) === String(id));
      if (p) total += p.precio * cant * (1 + p.iva);
    }
  });
  document.getElementById('carritoTotal').textContent = formatoEuros(total);
}

async function enviarPedido() {
  const msg = document.getElementById('msgPedido');
  const boton = document.getElementById('btnEnviarPedido');
  const items = Object.entries(carrito)
    .filter(([, cant]) => cant > 0)
    .map(([productoId, cantidad]) => ({ productoId, cantidad }));

  if (!items.length) { msg.textContent = 'Añade al menos un producto.'; msg.className = 'form-msg is-error'; return; }

  boton.disabled = true;
  msg.textContent = 'Enviando…';
  msg.className = 'form-msg';

  const r = await apiCliente('clienteCrearPedido', {
    telefono: telefonoCliente,
    items: JSON.stringify(items),
    fechaEntrega: fechaEntregaElegida,
  }).catch(() => ({ ok: false, error: 'Sin conexión' }));

  boton.disabled = false;

  if (!r.ok) {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
    return;
  }

  document.getElementById('confirmacionTexto').textContent =
    `Gracias, ${nombreCliente}. Hemos recibido tu pedido para mañana, por un total de ${formatoEuros(r.total)}.`;
  document.getElementById('confirmacionNum').textContent = `Nº de pedido: ${r.idPedido}`;
  mostrarPantalla('confirmacion');
}
