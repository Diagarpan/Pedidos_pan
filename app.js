/* ============ CONFIG (se guarda en el propio móvil, no en el código) ============ */
let WEB_APP_URL = localStorage.getItem('webAppUrl') || '';
let API_KEY = localStorage.getItem('apiKey') || '';

let productosCache = [];
let clientesCache = [];
let pedidoNuevo = {}; // { productoId: cantidad }

/* ============ ARRANQUE ============ */
document.addEventListener('DOMContentLoaded', () => {
  pintarFecha();
  registrarServiceWorker();
  cablearNavegacion();
  cablearAjustes();
  cablearNuevoPedido();
  cablearClientes();

  document.getElementById('btnRefrescar').addEventListener('click', () => cargarTabActual());

  if (!WEB_APP_URL || !API_KEY) {
    abrirAjustes();
  } else {
    cargarTabActual();
  }
});

function pintarFecha() {
  const hoy = new Date();
  document.getElementById('fechaHoy').textContent = hoy.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

/* ============ LLAMADAS A LA API ============ */
async function apiGet(action, extraParams) {
  const params = new URLSearchParams({ action, key: API_KEY, ...(extraParams || {}) });
  const res = await fetch(`${WEB_APP_URL}?${params.toString()}`);
  return res.json();
}

async function apiPost(action, payload) {
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
    body: JSON.stringify({ action, apiKey: API_KEY, ...payload }),
  });
  return res.json();
}

/* ============ NAVEGACIÓN POR PESTAÑAS ============ */
function cablearNavegacion() {
  document.querySelectorAll('.tabbar__item').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
  });
}

function cambiarTab(nombre) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.add('tab--hidden'));
  document.getElementById(`tab-${nombre}`).classList.remove('tab--hidden');
  document.querySelectorAll('.tabbar__item').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === nombre));
  cargarTabActual(nombre);
}

function cargarTabActual(nombre) {
  const activo = nombre || document.querySelector('.tabbar__item.is-active')?.dataset.tab || 'reparto';
  if (!WEB_APP_URL || !API_KEY) return;
  if (activo === 'reparto') cargarReparto();
  if (activo === 'pedidos') cargarPedidos();
  if (activo === 'nuevo') cargarFormularioNuevo();
  if (activo === 'clientes') cargarClientes();
}

/* ============ AJUSTES / CONEXIÓN ============ */
function cablearAjustes() {
  document.getElementById('btnAjustes').addEventListener('click', abrirAjustes);
  document.getElementById('btnGuardarAjustes').addEventListener('click', async () => {
    const url = document.getElementById('inputUrl').value.trim();
    const key = document.getElementById('inputKey').value.trim();
    const msg = document.getElementById('ajustesMsg');
    if (!url || !key) {
      msg.textContent = 'Rellena la URL y la clave.';
      msg.className = 'form-msg is-error';
      return;
    }
    WEB_APP_URL = url;
    API_KEY = key;
    localStorage.setItem('webAppUrl', url);
    localStorage.setItem('apiKey', key);

    msg.textContent = 'Comprobando conexión…';
    msg.className = 'form-msg';
    const r = await apiGet('clientes').catch(() => ({ ok: false, error: 'Sin respuesta' }));
    if (r.ok) {
      msg.textContent = '¡Conectado!';
      msg.className = 'form-msg is-ok';
      setTimeout(() => {
        document.getElementById('modalAjustes').classList.add('tab--hidden');
        cargarTabActual();
      }, 500);
    } else {
      msg.textContent = 'No se pudo conectar: ' + (r.error || 'revisa la URL y la clave');
      msg.className = 'form-msg is-error';
    }
  });
}

function abrirAjustes() {
  document.getElementById('inputUrl').value = WEB_APP_URL;
  document.getElementById('inputKey').value = API_KEY;
  document.getElementById('modalAjustes').classList.remove('tab--hidden');
}

/* ============ REPARTO ============ */
async function cargarReparto() {
  const contProductos = document.getElementById('repartoProductos');
  const contClientes = document.getElementById('repartoClientes');

  const r = await apiGet('reparto').catch(() => null);
  if (!r || !r.ok) {
    contProductos.innerHTML = `<div class="empty-state">No se pudo cargar (${(r && r.error) || 'sin conexión'})</div>`;
    return;
  }
  guardarCache('reparto', r.data);
  pintarReparto(r.data);
}

function pintarReparto(data) {
  const contProductos = document.getElementById('repartoProductos');
  const contClientes = document.getElementById('repartoClientes');

  if (!data.productos.length) {
    contProductos.innerHTML = '<div class="empty-state">Todavía no hay pedidos hoy.</div>';
  } else {
    contProductos.innerHTML = data.productos.map((p) => `
      <div class="ticket-row">
        <span>${escapeHtml(p.producto)}</span>
        <span class="ticket-row__qty">${p.cantidad}</span>
      </div>
    `).join('');
  }

  if (!data.clientes.length) {
    contClientes.innerHTML = '<div class="empty-state">Sin pedidos todavía.</div>';
  } else {
    contClientes.innerHTML = data.clientes.map((c) => `
      <div class="card">
        <div class="card__top">
          <div>
            <div class="card__name">${escapeHtml(c.cliente)}</div>
            ${c.ruta ? `<div class="card__route">Ruta: ${escapeHtml(c.ruta)}</div>` : ''}
          </div>
          ${stampHtml(c.estado)}
        </div>
        <div class="card__products">${escapeHtml(c.productos)}</div>
      </div>
    `).join('');
  }
}

/* ============ PEDIDOS DEL DÍA ============ */
async function cargarPedidos() {
  const cont = document.getElementById('listaPedidos');
  const r = await apiGet('pedidosHoy').catch(() => null);
  if (!r || !r.ok) {
    cont.innerHTML = `<div class="empty-state">No se pudo cargar (${(r && r.error) || 'sin conexión'})</div>`;
    return;
  }
  guardarCache('pedidosHoy', r.data);
  pintarPedidos(r.data);
}

function pintarPedidos(pedidos) {
  const cont = document.getElementById('listaPedidos');
  const filtro = (document.getElementById('buscarPedido').value || '').toLowerCase();
  const filtrados = pedidos.filter((p) => p.cliente.toLowerCase().includes(filtro));

  if (!filtrados.length) {
    cont.innerHTML = '<div class="empty-state">No hay pedidos que coincidan.</div>';
    return;
  }

  cont.innerHTML = filtrados.map((p) => {
    const estado = p.cobrado ? 'Cobrado' : p.entregado ? 'Entregado' : 'Pendiente';
    return `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.cliente)}</div>
          <div class="card__meta">${escapeHtml(p.hora || '')} · ${escapeHtml(p.canal || '')}</div>
        </div>
        <div style="text-align:right">
          <div class="card__total">${formatoEuros(p.total)}</div>
          ${stampHtml(estado)}
        </div>
      </div>
      <div class="card__products">${escapeHtml(p.pedido)}</div>
      ${p.observaciones ? `<div class="card__meta" style="color:var(--stamp-red); margin-top:6px;">${escapeHtml(p.observaciones)}</div>` : ''}
      <div class="card__actions">
        ${!p.entregado ? `<button class="chip-btn" data-accion="entregado" data-id="${p.id}">Marcar entregado</button>` : ''}
        ${!p.cobrado ? `<button class="chip-btn" data-accion="cobrado" data-id="${p.id}">Marcar cobrado</button>` : ''}
      </div>
    </div>
  `;
  }).join('');

  cont.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarEstadoPedido(btn.dataset.id, btn.dataset.accion));
  });
}

async function cambiarEstadoPedido(idPedido, accion) {
  const action = accion === 'entregado' ? 'marcarEntregado' : 'marcarCobrado';
  await apiPost(action, { idPedido }).catch(() => ({ ok: false }));
  cargarPedidos();
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'buscarPedido') {
    const cache = leerCache('pedidosHoy');
    if (cache) pintarPedidos(cache);
  }
  if (e.target.id === 'buscarCliente') {
    filtrarListaClientes();
  }
});

/* ============ NUEVO PEDIDO ============ */
function cablearNuevoPedido() {
  document.getElementById('btnCrearPedido').addEventListener('click', crearPedidoManual);
}

async function cargarFormularioNuevo() {
  const selectCliente = document.getElementById('selectCliente');
  const contProductos = document.getElementById('listaProductosNuevo');

  if (!clientesCache.length) {
    const rc = await apiGet('clientes').catch(() => null);
    if (rc && rc.ok) clientesCache = rc.data;
  }
  if (!productosCache.length) {
    const rp = await apiGet('productos').catch(() => null);
    if (rp && rp.ok) productosCache = rp.data;
  }

  selectCliente.innerHTML = '<option value="">Selecciona un cliente…</option>' +
    clientesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');

  pedidoNuevo = {};
  contProductos.innerHTML = productosCache.map((p) => `
    <div class="product-row">
      <div>
        <div class="product-row__name">${escapeHtml(p.nombre)}</div>
        <div class="product-row__price">${formatoEuros(p.precio)} · IVA ${p.iva}%</div>
      </div>
      <div class="stepper">
        <button class="stepper__btn" data-accion="menos" data-id="${p.id}">−</button>
        <span class="stepper__val" id="cant-${p.id}">0</span>
        <button class="stepper__btn" data-accion="mas" data-id="${p.id}">+</button>
      </div>
    </div>
  `).join('');

  contProductos.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const delta = btn.dataset.accion === 'mas' ? 1 : -1;
      pedidoNuevo[id] = Math.max(0, (pedidoNuevo[id] || 0) + delta);
      document.getElementById(`cant-${id}`).textContent = pedidoNuevo[id];
      recalcularTotalNuevo();
    });
  });

  recalcularTotalNuevo();
  document.getElementById('nuevoMsg').textContent = '';
}

function recalcularTotalNuevo() {
  let total = 0;
  Object.entries(pedidoNuevo).forEach(([id, cant]) => {
    if (cant > 0) {
      const p = productosCache.find((pr) => String(pr.id) === String(id));
      if (p) total += p.precio * cant * (1 + p.iva / 100);
    }
  });
  document.getElementById('nuevoTotal').textContent = formatoEuros(total);
}

async function crearPedidoManual() {
  const msg = document.getElementById('nuevoMsg');
  const clienteId = document.getElementById('selectCliente').value;
  const items = Object.entries(pedidoNuevo)
    .filter(([, cant]) => cant > 0)
    .map(([productoId, cantidad]) => ({ productoId, cantidad }));

  if (!clienteId) { msg.textContent = 'Selecciona un cliente.'; msg.className = 'form-msg is-error'; return; }
  if (!items.length) { msg.textContent = 'Añade al menos un producto.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiPost('nuevoPedido', { clienteId, items }).catch(() => ({ ok: false, error: 'Sin conexión' }));
  if (r.ok) {
    msg.textContent = `Pedido #${r.idPedido} creado (${formatoEuros(r.total)}).`;
    msg.className = 'form-msg is-ok';
    document.getElementById('selectCliente').value = '';
    cargarFormularioNuevo();
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

/* ============ CLIENTES ============ */
function cablearClientes() {
  document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
    document.getElementById('detalleCliente').classList.add('tab--hidden');
  });
  document.getElementById('btnBuscarFacturas').addEventListener('click', buscarFacturasCliente);
}

let clienteSeleccionado = null;

async function cargarClientes() {
  if (!clientesCache.length) {
    const r = await apiGet('clientes').catch(() => null);
    if (r && r.ok) clientesCache = r.data;
  }
  filtrarListaClientes();
}

function filtrarListaClientes() {
  const cont = document.getElementById('listaClientes');
  const filtro = (document.getElementById('buscarCliente').value || '').toLowerCase();
  const filtrados = clientesCache.filter((c) => c.nombre.toLowerCase().includes(filtro));

  cont.innerHTML = filtrados.map((c) => `
    <div class="client-row" data-id="${c.id}">
      <div>
        <div class="card__name">${escapeHtml(c.nombre)}</div>
        <div class="client-row__ruta">${escapeHtml(c.ruta || '')}</div>
      </div>
      <span>›</span>
    </div>
  `).join('');

  cont.querySelectorAll('.client-row').forEach((row) => {
    row.addEventListener('click', () => abrirDetalleCliente(row.dataset.id));
  });
}

async function abrirDetalleCliente(id) {
  clienteSeleccionado = clientesCache.find((c) => String(c.id) === String(id));
  if (!clienteSeleccionado) return;

  document.getElementById('detalleClienteNombre').textContent = clienteSeleccionado.nombre;
  document.getElementById('detalleCliente').classList.remove('tab--hidden');
  document.getElementById('listaFacturas').innerHTML = '';
  document.getElementById('periodoTotal').textContent = '';

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById('fechaIni').valueAsDate = inicioMes;
  document.getElementById('fechaFin').valueAsDate = hoy;

  const cont = document.getElementById('historialPedidos');
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';

  const r = await apiGet('historialCliente', { clienteId: id }).catch(() => null);
  if (!r || !r.ok) { cont.innerHTML = '<div class="empty-state">No se pudo cargar.</div>'; return; }

  if (!r.data.pedidos.length) {
    cont.innerHTML = '<div class="empty-state">Sin pedidos recientes.</div>';
  } else {
    cont.innerHTML = r.data.pedidos.map((p) => `
      <div class="card">
        <div class="card__top">
          <div class="card__meta">${escapeHtml(p.fecha)}</div>
          <div class="card__total">${formatoEuros(p.total)}</div>
        </div>
        <div class="card__products">${escapeHtml(p.pedido)}</div>
      </div>
    `).join('');
  }
}

async function buscarFacturasCliente() {
  if (!clienteSeleccionado) return;
  const ini = document.getElementById('fechaIni').value;
  const fin = document.getElementById('fechaFin').value;
  const cont = document.getElementById('listaFacturas');
  cont.innerHTML = '<div class="empty-state">Buscando…</div>';

  const r = await apiGet('facturasCliente', {
    clienteId: clienteSeleccionado.id,
    fechaIni: formatoFechaES(ini),
    fechaFin: formatoFechaES(fin),
  }).catch(() => null);

  if (!r || !r.ok) { cont.innerHTML = '<div class="empty-state">No se pudo cargar.</div>'; return; }

  if (!r.data.facturas.length) {
    cont.innerHTML = '<div class="empty-state">Sin facturas en ese periodo.</div>';
  } else {
    cont.innerHTML = r.data.facturas.map((f) => `
      <div class="card">
        <div class="card__top">
          <div>
            <div class="card__meta">Factura #${f.idFactura} · ${escapeHtml(f.fecha)}</div>
          </div>
          <div style="text-align:right">
            <div class="card__total">${formatoEuros(f.total)}</div>
            ${stampHtml(f.estado)}
          </div>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('periodoTotal').textContent = `Total periodo: ${formatoEuros(r.data.total)}`;
}

/* ============ UTILIDADES ============ */
function stampHtml(estado) {
  const clase = estado === 'Cobrado' ? 'stamp--cobrado' : estado === 'Entregado' ? 'stamp--entregado' : 'stamp--pendiente';
  return `<span class="stamp ${clase}">${escapeHtml(estado || 'Pendiente')}</span>`;
}

function formatoEuros(n) {
  return Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

function formatoFechaES(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function guardarCache(clave, data) {
  try { localStorage.setItem('cache_' + clave, JSON.stringify(data)); } catch (e) {}
}
function leerCache(clave) {
  try { return JSON.parse(localStorage.getItem('cache_' + clave)); } catch (e) { return null; }
}
