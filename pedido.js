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
  document.getElementById('btnContinuar').addEventListener('click', () => identificarCliente(false));
  document.getElementById('inputTelefono').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') identificarCliente();
  });
  document.getElementById('btnCambiarTelefono').addEventListener('click', olvidarTelefono);
  document.getElementById('btnVolverCategorias').addEventListener('click', () => {
    document.getElementById('vistaProductos').classList.add('tab--hidden');
    document.getElementById('vistaCategorias').classList.remove('tab--hidden');
  });
  document.getElementById('btnVerPedido').addEventListener('click', () => {
    mostrarPantalla('repaso');
    pintarRepaso();
  });
  document.getElementById('btnVolverAlCatalogo').addEventListener('click', () => mostrarPantalla('catalogo'));
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
  document.getElementById('pantallaRepaso').classList.toggle('tab--hidden', nombre !== 'repaso');
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

const ORDEN_CATEGORIAS = ['Panadería', 'Dulces', 'Hielo'];
const ICONO_CATEGORIA = {
  'Panadería': `<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="21" rx="21" ry="9.5" fill="#B9782E"/>
    <ellipse cx="24" cy="17.5" rx="19.5" ry="8" fill="#E3A85E"/>
    <path d="M12.5 11 L9.5 21.5 M18.5 9 L16.5 22.5 M24 8 L23 23 M29.5 9 L31.5 22.5 M35.5 11 L38.5 21.5"
          stroke="#A8672A" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  </svg>`,
  'Dulces': `<svg viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.5 21 L29.5 21 L26.8 37.5 Q26.4 39.5 24 39.5 L16 39.5 Q13.6 39.5 13.2 37.5 Z" fill="#A8611E"/>
    <path d="M11.3 21 L28.7 21 L27.9 25.5 L12.1 25.5 Z" fill="#7A4413"/>
    <path d="M8 21 Q6 14.5 10.5 12.5 Q10.5 6.5 16.5 8.5 Q18.5 3.5 22 6.5 Q26 3.5 28 8.5 Q34 6.5 31.5 13.5 Q36 16.5 32 21 Z" fill="#FFF4E3"/>
    <circle cx="20" cy="7" r="2.4" fill="#C62828"/>
  </svg>`,
  'Hielo': `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="17" width="17" height="17" rx="2.5" fill="#CDEBFB" stroke="#8FC9EA" stroke-width="1.2"/>
    <rect x="20" y="5" width="17" height="17" rx="2.5" fill="#E4F5FD" stroke="#8FC9EA" stroke-width="1.2"/>
    <path d="M8.5 21.5l3.5 3.5M24.5 9.5l3.5 3.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
};
let catalogoAgrupado = {};

async function cargarCatalogo() {
  const cont = document.getElementById('vistaCategorias');
  cont.innerHTML = '<div class="empty-state">Cargando catálogo…</div>';
  document.getElementById('vistaProductos').classList.add('tab--hidden');
  cont.classList.remove('tab--hidden');

  const r = await apiCliente('clienteCatalogo').catch(() => ({ ok: false }));
  if (!r.ok) { cont.innerHTML = '<div class="empty-state">No se pudo cargar el catálogo. Recarga la página.</div>'; return; }

  catalogo = r.data;

  // Agrupar por categoría y, dentro, por subcategoría
  catalogoAgrupado = {};
  catalogo.forEach((p) => {
    const cat = p.categoria || 'Panadería';
    const sub = p.subcategoria || '';
    if (!catalogoAgrupado[cat]) catalogoAgrupado[cat] = {};
    if (!catalogoAgrupado[cat][sub]) catalogoAgrupado[cat][sub] = [];
    catalogoAgrupado[cat][sub].push(p);
  });

  pintarCategorias();
}

function pintarCategorias() {
  const cont = document.getElementById('vistaCategorias');
  const categorias = Object.keys(catalogoAgrupado).sort((a, b) => {
    const ia = ORDEN_CATEGORIAS.indexOf(a);
    const ib = ORDEN_CATEGORIAS.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  cont.innerHTML = `<div class="catalogo-titulo">Catálogo</div><div class="lista-categorias">` +
    categorias.map((cat) => `
      <button class="fila-categoria" data-categoria="${escapeHtml(cat)}">
        <span>${escapeHtml(cat)}</span>
        <span class="fila-categoria__flecha">›</span>
      </button>
    `).join('') + `</div>`;

  cont.querySelectorAll('[data-categoria]').forEach((btn) => {
    btn.addEventListener('click', () => abrirCategoria(btn.dataset.categoria));
  });
}

function abrirCategoria(cat) {
  document.getElementById('vistaCategorias').classList.add('tab--hidden');
  document.getElementById('vistaProductos').classList.remove('tab--hidden');

  const cont = document.getElementById('listaCatalogo');
  let html = `<div class="categoria-titulo">${escapeHtml(cat)}</div>`;

  const subcategorias = Object.keys(catalogoAgrupado[cat]).sort((a, b) => {
    if (!a) return -1; // los productos sin subcategoría van primero
    if (!b) return 1;
    return a.localeCompare(b);
  });
  subcategorias.forEach((sub) => {
    if (sub) html += `<div class="subcategoria-titulo">${escapeHtml(sub)}</div>`;
    html += catalogoAgrupado[cat][sub].map(pintarFilaProducto).join('');
  });
  cont.innerHTML = html;

  cont.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const delta = btn.dataset.accion === 'mas' ? 1 : -1;
      carrito[id] = Math.max(0, (carrito[id] || 0) + delta);
      document.getElementById(`cant-${id}`).textContent = carrito[id];
      recalcularCarrito();
    });
  });
}

function pintarFilaProducto(p) {
  return `
    <div class="producto-fila">
      <div>
        <div class="producto-fila__nombre">${escapeHtml(p.nombre)}</div>
        <div class="producto-fila__precio">${formatoEuros(p.precio)}${p.unidadesCaja ? ` · ${escapeHtml(String(p.unidadesCaja))}` : ''}</div>
      </div>
      <div class="producto-stepper">
        <button class="producto-stepper__btn" data-accion="menos" data-id="${p.id}">−</button>
        <span class="producto-stepper__val" id="cant-${p.id}">${carrito[p.id] || 0}</span>
        <button class="producto-stepper__btn" data-accion="mas" data-id="${p.id}">+</button>
      </div>
    </div>
  `;
}

function itemsCarrito() {
  return Object.entries(carrito)
    .filter(([, cant]) => cant > 0)
    .map(([id, cant]) => ({ producto: catalogo.find((pr) => String(pr.id) === String(id)), cantidad: cant }))
    .filter((it) => it.producto);
}

function recalcularCarrito() {
  let total = 0;
  itemsCarrito().forEach((it) => { total += it.producto.precio * it.cantidad * (1 + it.producto.iva); });
  document.getElementById('carritoTotal').textContent = formatoEuros(total);
  const repasoTotal = document.getElementById('repasoTotal');
  if (repasoTotal) repasoTotal.textContent = formatoEuros(total);
}

function pintarRepaso() {
  const cont = document.getElementById('listaRepaso');
  const items = itemsCarrito();

  if (!items.length) {
    cont.innerHTML = '<div class="empty-state">Todavía no has añadido nada.</div>';
  } else {
    cont.innerHTML = items.map((it) => `
      <div class="client-row">
        <span>${it.cantidad}x ${escapeHtml(it.producto.nombre)} — ${formatoEuros(it.producto.precio * it.cantidad * (1 + it.producto.iva))}</span>
        <button class="chip-btn" data-quitar-repaso="${it.producto.id}" style="border-color:var(--warn-red); color:var(--warn-red);">Quitar</button>
      </div>
    `).join('');
    cont.querySelectorAll('[data-quitar-repaso]').forEach((btn) => {
      btn.addEventListener('click', () => {
        carrito[btn.dataset.quitarRepaso] = 0;
        pintarRepaso();
        recalcularCarrito();
      });
    });
  }
  recalcularCarrito();
}

async function enviarPedido() {
  const msg = document.getElementById('msgPedido');
  const boton = document.getElementById('btnEnviarPedido');
  const itemsDetalle = itemsCarrito(); // se guarda antes de limpiar, para poder mostrarlo en la confirmación
  const items = itemsDetalle.map((it) => ({ productoId: it.producto.id, cantidad: it.cantidad }));

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

  document.getElementById('confirmacionDetalle').innerHTML = itemsDetalle.map((it) => `
    <div class="client-row"><span>${it.cantidad}x ${escapeHtml(it.producto.nombre)}</span></div>
  `).join('');

  document.getElementById('confirmacionTexto').textContent =
    `Gracias, ${nombreCliente}. Hemos recibido tu pedido para mañana, por un total de ${formatoEuros(r.total)}.`;
  document.getElementById('confirmacionNum').textContent = `Nº de pedido: ${r.idPedido}`;
  mostrarPantalla('confirmacion');
}
