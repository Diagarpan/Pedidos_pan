/* ============ CONFIG (se guarda en el propio móvil, no en el código) ============ */
let WEB_APP_URL = localStorage.getItem('webAppUrl') || '';
let API_KEY = localStorage.getItem('apiKey') || '';
let ROL = localStorage.getItem('rol') || 'admin'; // 'admin' | 'repartidor'
let RUTA = localStorage.getItem('ruta') || '';

let productosCache = [];
let clientesCache = [];
let pedidoNuevo = {}; // { productoId: cantidad }

/* ============ ARRANQUE ============ */
document.addEventListener('DOMContentLoaded', async () => {
  const vinoDeEnlace = aplicarConfigDesdeURL();
  pintarFecha();
  registrarServiceWorker();
  cablearNavegacion();
  cablearNavegacionFecha();
  cablearAjustes();
  cablearNuevoPedido();
  cablearClientes();

  document.getElementById('btnRefrescar').addEventListener('click', () => cargarTabActual());

  if (!WEB_APP_URL || !API_KEY || vinoDeEnlace) {
    abrirAjustes();
    return;
  }

  const r = await apiGet('quienSoy').catch(() => ({ ok: false }));
  if (r.ok) {
    ROL = r.data.rol;
    RUTA = r.data.ruta || '';
    localStorage.setItem('rol', ROL);
    localStorage.setItem('ruta', RUTA);
    aplicarModoUI();
    cargarTabActual();
  } else {
    abrirAjustes();
  }
});

// El enlace solo lleva la URL del Web App (para no tener que teclear esa
// parte larga y complicada). La clave NUNCA va en el enlace — así que
// cada vez que alguien lo pulsa, la app le pide su clave personal a mano.
// Si abre la app luego desde el icono (sin pasar por el enlace), sí
// recuerda la última clave que puso.
function aplicarConfigDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url');
  if (!url) return false;

  WEB_APP_URL = url;
  API_KEY = '';
  localStorage.setItem('webAppUrl', WEB_APP_URL);

  window.history.replaceState({}, '', window.location.pathname);
  return true;
}

// Repartidor: solo ve Reparto y Pedidos (de su ruta), sin crear pedidos ni ver clientes
function aplicarModoUI() {
  const esRepartidor = ROL === 'repartidor';
  document.querySelectorAll('.tabbar__item').forEach((btn) => {
    if (btn.dataset.tab === 'nuevo' || btn.dataset.tab === 'clientes') {
      btn.classList.toggle('tab--hidden', esRepartidor);
      btn.style.display = esRepartidor ? 'none' : '';
    }
  });
  document.querySelectorAll('.home-btn[data-solo-admin]').forEach((btn) => {
    btn.style.display = esRepartidor ? 'none' : '';
  });
  const tabActivo = document.querySelector('.tabbar__item.is-active')?.dataset.tab;
  if (esRepartidor && (tabActivo === 'nuevo' || tabActivo === 'clientes')) {
    cambiarTab('inicio');
  }
}

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
  document.querySelectorAll('.home-btn').forEach((btn) => {
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
  const activo = nombre || document.querySelector('.tabbar__item.is-active')?.dataset.tab || 'inicio';
  if (!WEB_APP_URL || !API_KEY) return;
  if (activo === 'inicio') pintarInicio();
  if (activo === 'reparto') cargarReparto();
  if (activo === 'pedidos') cargarPedidos();
  if (activo === 'nuevo') cargarFormularioNuevo();
  if (activo === 'clientes') cargarClientes();
}

function pintarInicio() {
  document.getElementById('homeSub').textContent =
    ROL === 'repartidor' ? `Repartidor · Ruta ${RUTA}` : 'Administración';
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
    const r = await apiGet('quienSoy').catch(() => ({ ok: false, error: 'Sin respuesta' }));
    if (r.ok) {
      ROL = r.data.rol;
      RUTA = r.data.ruta || '';
      localStorage.setItem('rol', ROL);
      localStorage.setItem('ruta', RUTA);
      aplicarModoUI();

      msg.textContent = ROL === 'repartidor' ? `¡Conectado como repartidor (ruta ${RUTA})!` : '¡Conectado como administración!';
      msg.className = 'form-msg is-ok';
      setTimeout(() => {
        document.getElementById('modalAjustes').classList.add('tab--hidden');
        cargarTabActual();
      }, 700);
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
/* ============ REPARTO ============ */
let offsetRepartoSeleccionado = 0; // 0 = hoy, -1 = ayer, 1 = mañana...

function cablearNavegacionFecha() {
  document.getElementById('btnRepartoAnterior').addEventListener('click', () => {
    offsetRepartoSeleccionado -= 1;
    cargarReparto();
  });
  document.getElementById('btnRepartoSiguiente').addEventListener('click', () => {
    offsetRepartoSeleccionado += 1;
    cargarReparto();
  });
  document.getElementById('btnRepartoHoy').addEventListener('click', () => {
    offsetRepartoSeleccionado = 0;
    cargarReparto();
  });
}

function etiquetaFechaOffset(offset) {
  if (offset === 0) return 'Hoy';
  if (offset === -1) return 'Ayer';
  if (offset === 1) return 'Mañana';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function fechaOffsetDDMMYYYY(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

async function cargarReparto() {
  const contProductos = document.getElementById('repartoProductos');
  const contClientes = document.getElementById('repartoClientes');
  document.getElementById('btnRepartoHoy').textContent = etiquetaFechaOffset(offsetRepartoSeleccionado);

  const r = await apiGet('reparto', { fecha: fechaOffsetDDMMYYYY(offsetRepartoSeleccionado) }).catch(() => null);
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
            <div class="card__meta">${c.ruta ? 'Ruta: ' + escapeHtml(c.ruta) : ''}</div>
          </div>
          <div style="display:flex; gap:6px;">
            ${stampHtml(c.entregado ? 'Entregado' : 'Pendiente')}
            ${stampHtml(c.cobrado ? 'Cobrado' : 'Sin cobrar')}
          </div>
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
      ${p.entregado && p.horaEntrega ? `<div class="card__meta" style="margin-top:6px;">Entregado a las ${escapeHtml(p.horaEntrega)}</div>` : ''}
      ${p.observaciones ? `<div class="card__meta" style="color:var(--stamp-red); margin-top:6px;">${escapeHtml(p.observaciones)}</div>` : ''}
      <div class="card__actions">
        ${!p.entregado ? `<button class="chip-btn" data-accion="entregado" data-id="${p.id}">Marcar entregado</button>` : ''}
        ${!p.cobrado ? `<button class="chip-btn" data-accion="cobrado" data-id="${p.id}">Marcar cobrado</button>` : ''}
        <button class="chip-btn" data-accion="albaran" data-id="${p.id}">Albarán PDF</button>
        ${ROL === 'admin' ? `<button class="chip-btn" data-accion="factura" data-id="${p.id}">Factura PDF</button>` : ''}
      </div>
    </div>
  `;
  }).join('');

  cont.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.accion;
      if (accion === 'entregado' || accion === 'cobrado') {
        cambiarEstadoPedido(btn.dataset.id, accion);
      } else {
        generarDocumento(btn.dataset.id, accion);
      }
    });
  });
}

async function cambiarEstadoPedido(idPedido, accion) {
  const action = accion === 'entregado' ? 'marcarEntregado' : 'marcarCobrado';
  const r = await apiGet(action, { idPedido }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) {
    alert('No se pudo actualizar: ' + (r.error || 'error desconocido'));
  }
  cargarPedidos();
}

async function generarDocumento(idPedido, tipo) {
  const action = tipo === 'factura' ? 'facturaPdf' : 'albaranPdf';
  const r = await apiGet(action, { idPedido }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) {
    alert('No se pudo generar el PDF: ' + (r.error || 'error desconocido'));
    return;
  }
  descargarPDF(r.base64, r.nombre);
}

function descargarPDF(base64, nombreArchivo) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // Abre el PDF en una pestaña nueva (desde ahí se puede imprimir o guardar)
  window.open(url, '_blank');

  // Y además dispara la descarga directa
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
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
let fechaPedidoSeleccion = 'hoy';

function cablearNuevoPedido() {
  document.getElementById('btnCrearPedido').addEventListener('click', crearPedidoManual);
  document.getElementById('btnPedidoHoy').addEventListener('click', () => seleccionarFechaPedido('hoy'));
  document.getElementById('btnPedidoManana').addEventListener('click', () => seleccionarFechaPedido('manana'));
}

function seleccionarFechaPedido(valor) {
  fechaPedidoSeleccion = valor;
  document.getElementById('btnPedidoHoy').classList.toggle('is-active', valor === 'hoy');
  document.getElementById('btnPedidoManana').classList.toggle('is-active', valor === 'manana');
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
  seleccionarFechaPedido('hoy');
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

  const r = await apiGet('nuevoPedido', { clienteId, items: JSON.stringify(items), fechaEntrega: fechaPedidoSeleccion }).catch(() => ({ ok: false, error: 'Sin conexión' }));
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

  const info = [];
  if (clienteSeleccionado.telefono) info.push('📞 ' + clienteSeleccionado.telefono);
  if (clienteSeleccionado.direccion) info.push('📍 ' + clienteSeleccionado.direccion);
  if (clienteSeleccionado.ruta) info.push('Ruta ' + clienteSeleccionado.ruta);
  if (clienteSeleccionado.descuento > 0) info.push(`Descuento: ${(clienteSeleccionado.descuento * 100).toFixed(0)}%`);
  document.getElementById('detalleClienteInfo').innerHTML = info.map((l) => `<div>${escapeHtml(l)}</div>`).join('');

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
