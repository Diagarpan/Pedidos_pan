/* ============ CONFIG (se guarda en el propio móvil, no en el código) ============ */
let WEB_APP_URL = localStorage.getItem('webAppUrl') || '';
let API_KEY = localStorage.getItem('apiKey') || '';
let ROL = localStorage.getItem('rol') || 'admin'; // 'admin' | 'repartidor'
let RUTA = localStorage.getItem('ruta') || '';

let productosCache = [];
let clientesCache = [];
let itemsNuevo = []; // { tipo:'catalogo'|'libre', productoId?, nombre, precio, iva (fracción), cantidad, uid }
let itemsFactura = [];
let itemsEditarPedido = [];
let itemsEditarFactura = [];
let idPedidoEnEdicion = null;
let idFacturaEnEdicion = null;

/* ============ ARRANQUE ============ */
document.addEventListener('DOMContentLoaded', async () => {
  aplicarTemaGuardado();
  aplicarIconos();
  const vinoDeEnlace = aplicarConfigDesdeURL();
  pintarFecha();
  registrarServiceWorker();
  cablearNavegacion();
  cablearNavegacionPedidos();
  cablearAjustes();
  cablearTema();
  cablearNuevoPedido();
  cablearFacturaDirecta();
  cablearProductosLibres();
  cablearEdicion();
  cablearAlbaranSuelto();
  cablearInformesFacturacion();
  cablearClientes();
  cablearClientesForm();
  cablearPreciosEspeciales();
  cablearEmpresa();
  cablearHojaRuta();
  cablearProductos();
  cablearEstadisticas();
  cablearBusquedaGlobal();

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

/* ============ ICONOS (SVG, sustituyen a los data-icon del HTML) ============ */
const ICONOS = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1H9.5v-6h5v6H17.5a1 1 0 0 0 1-1V10"/></svg>',
  reparto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="13" height="10"/><path d="M14 10h4l4 3v3h-8z"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>',
  pedidos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M9 3v2.5h6V3"/><path d="M8 11h8M8 14.5h8M8 8h3"/></svg>',
  nuevo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/></svg>',
  facturas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 2.5h13v19l-2.2-1.3-2.1 1.3-2.2-1.3-2.1 1.3-2.2-1.3-2.2 1.3v-19z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 20.5v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.7v1.8"/><circle cx="9.8" cy="7.8" r="3.6"/><path d="M21 20.5v-1.8a3.6 3.6 0 0 0-2.7-3.5"/><path d="M14.8 3.4a3.6 3.6 0 0 1 0 7"/></svg>',
  productos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5c0-4.5 3.2-8 8-8s8 3.5 8 8-2.3 8.5-8 8.5-8-4-8-8.5z"/><path d="M9.3 8.3 8.2 15M13 7.4l-.6 9.2M16.7 8.3 15.6 15"/></svg>',
  estadisticas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 3.5v17h17"/><rect x="7.5" y="12.5" width="3" height="5.5"/><rect x="12.5" y="8.5" width="3" height="9.5"/><rect x="17.5" y="5.5" width="3" height="12.5"/></svg>',
  empresa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="2.5" width="15" height="19" rx="1"/><path d="M9 6.5h1M14 6.5h1M9 10.5h1M14 10.5h1M9 14.5h1M14 14.5h1"/><path d="M9.5 21.5v-4h5v4"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/></svg>',
  tema: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.5A9 9 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg>',
  refrescar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 3.5v6h-6"/><path d="M2.5 20.5v-6h6"/><path d="M4 9.5a8 8 0 0 1 13.2-3l4.3 3M20 14.5a8 8 0 0 1-13.2 3L2.5 14.5"/></svg>',
  manana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 21 7v10l-9 4.5-9-4.5V7z"/><path d="M3 7l9 4.5L21 7M12 11.5V21"/></svg>',
  ayer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8.5"/><path d="M12 8.5V13l3 2M9 2.5h6"/></svg>',
  historial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="19" height="5" rx="1"/><path d="M4 11.5v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"/><path d="M10 15h4"/></svg>',
  buscar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="7"/><path d="M20.5 20.5 15.5 15.5"/></svg>',
};

function aplicarIconos() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    if (ICONOS[el.dataset.icon]) el.innerHTML = ICONOS[el.dataset.icon];
  });
}

/* ============ MODO OSCURO ============ */
function aplicarTemaGuardado() {
  const tema = localStorage.getItem('tema') || 'claro';
  document.documentElement.setAttribute('data-tema', tema);
}

function cablearTema() {
  document.getElementById('btnTema').addEventListener('click', alternarTema);
  document.getElementById('btnTemaSidebar').addEventListener('click', alternarTema);
}

function alternarTema() {
  const actual = document.documentElement.getAttribute('data-tema') || 'claro';
  const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
  document.documentElement.setAttribute('data-tema', nuevo);
  localStorage.setItem('tema', nuevo);
}

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
  document.querySelectorAll('.sidebar__item[data-solo-admin]').forEach((btn) => {
    btn.style.display = esRepartidor ? 'none' : '';
  });
  document.querySelectorAll('.toolbar-btn[data-solo-admin]').forEach((btn) => {
    btn.style.display = esRepartidor ? 'none' : '';
  });
  const tabActivo = document.querySelector('.tabbar__item.is-active')?.dataset.tab;
  if (esRepartidor && (tabActivo === 'nuevo' || tabActivo === 'clientes')) {
    cambiarTab('inicio');
  }
}

function pintarFecha() {
  const hoy = new Date();
  const texto = hoy.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  document.getElementById('fechaHoySidebar').textContent = texto;
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

/* ============ MIGAS DE PAN ============ */
const BREADCRUMBS = {
  reparto: [{ label: 'Reparto', tab: 'reparto' }],
  'reparto-dia': [{ label: 'Reparto', tab: 'reparto' }, { label: 'Detalle', tab: 'reparto-dia' }],
  pedidos: [{ label: 'Pedidos', tab: 'pedidos' }],
  'pedidos-hoy': [{ label: 'Pedidos', tab: 'pedidos' }, { label: 'Pedidos de hoy', tab: 'pedidos-hoy' }],
  'pedido-editar': [{ label: 'Pedidos', tab: 'pedidos' }, { label: 'Pedidos de hoy', tab: 'pedidos-hoy' }, { label: 'Editar pedido', tab: 'pedido-editar' }],
  'pedidos-historial': [{ label: 'Pedidos', tab: 'pedidos' }, { label: 'Historial', tab: 'pedidos-historial' }],
  'albaran-suelto': [{ label: 'Pedidos', tab: 'pedidos' }, { label: 'Nuevo albarán', tab: 'albaran-suelto' }],
  'factura-347': [{ label: 'Facturas', tab: 'factura' }, { label: 'Modelo 347', tab: 'factura-347' }],
  'factura-periodo': [{ label: 'Facturas', tab: 'factura' }, { label: 'Facturación por periodo', tab: 'factura-periodo' }],
  nuevo: [{ label: 'Nuevo pedido', tab: 'nuevo' }],
  clientes: [{ label: 'Clientes', tab: 'clientes' }],
  'clientes-lista': [{ label: 'Clientes', tab: 'clientes' }, { label: 'Ver clientes', tab: 'clientes-lista' }],
  'clientes-historial': [{ label: 'Clientes', tab: 'clientes' }, { label: 'Historial de pedidos', tab: 'clientes-historial' }],
  'cliente-form': [{ label: 'Clientes', tab: 'clientes' }, { label: 'Ver clientes', tab: 'clientes-lista' }, { label: 'Cliente', tab: 'cliente-form' }],
  factura: [{ label: 'Facturas', tab: 'factura' }],
  'factura-resumen': [{ label: 'Facturas', tab: 'factura' }, { label: 'Resumen', tab: 'factura-resumen' }],
  'factura-por-cliente': [{ label: 'Facturas', tab: 'factura' }, { label: 'Por cliente', tab: 'factura-por-cliente' }],
  'factura-crear': [{ label: 'Facturas', tab: 'factura' }, { label: 'Generar factura', tab: 'factura-crear' }],
  'factura-editar': [{ label: 'Facturas', tab: 'factura' }, { label: 'Editar factura', tab: 'factura-editar' }],
  productos: [{ label: 'Productos', tab: 'productos' }],
  'producto-form': [{ label: 'Productos', tab: 'productos' }, { label: 'Producto', tab: 'producto-form' }],
  estadisticas: [{ label: 'Estadísticas', tab: 'estadisticas' }],
  empresa: [{ label: 'Empresa', tab: 'empresa' }],
};

function pintarBreadcrumb(nombre) {
  const cont = document.getElementById('breadcrumb');
  if (nombre === 'inicio' || !BREADCRUMBS[nombre]) {
    cont.classList.add('tab--hidden');
    cont.innerHTML = '';
    return;
  }
  cont.classList.remove('tab--hidden');
  const segmentos = BREADCRUMBS[nombre];
  let html = `<button data-tab="inicio">Inicio</button>`;
  segmentos.forEach((s, i) => {
    html += `<span class="breadcrumb__sep">›</span>`;
    html += (i === segmentos.length - 1)
      ? `<span class="breadcrumb__current">${escapeHtml(s.label)}</span>`
      : `<button data-tab="${s.tab}">${escapeHtml(s.label)}</button>`;
  });
  cont.innerHTML = html;
  cont.querySelectorAll('button[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
  });
}
/* ============ NAVEGACIÓN POR PESTAÑAS ============ */
function cablearNavegacion() {
  document.querySelectorAll('.tabbar__item').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
  });
  document.querySelectorAll('.home-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
  });
  document.querySelectorAll('.sidebar__item[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
  });
  document.querySelectorAll('.toolbar-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-volver]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.volver));
  });
  document.querySelectorAll('[data-reparto-offset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      offsetRepartoSeleccionado = Number(btn.dataset.repartoOffset);
      cambiarTab('reparto-dia');
    });
  });
}

// Las subpáginas (ej. "pedidos-hoy") resaltan el menú padre ("pedidos") en
// el menú lateral y en la barra inferior, no un ítem propio (no existe).
function claveMenuPadre(nombre) {
  if (nombre.startsWith('pedidos')) return 'pedidos';
  if (nombre.startsWith('clientes') || nombre === 'cliente-form') return 'clientes';
  if (nombre.startsWith('factura')) return 'factura';
  if (nombre.startsWith('reparto')) return 'reparto';
  if (nombre.startsWith('producto')) return 'productos';
  return nombre;
}

function cambiarTab(nombre) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.add('tab--hidden'));
  document.getElementById(`tab-${nombre}`).classList.remove('tab--hidden');
  const clave = claveMenuPadre(nombre);
  document.querySelectorAll('.tabbar__item').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === clave));
  document.querySelectorAll('.sidebar__item[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === clave));
  document.querySelectorAll('.toolbar-btn[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === clave));
  pintarBreadcrumb(nombre);
  cargarTabActual(nombre);
}

function cargarTabActual(nombre) {
  const activo = nombre || document.querySelector('.tabbar__item.is-active')?.dataset.tab || 'inicio';
  if (!WEB_APP_URL || !API_KEY) return;
  if (activo === 'inicio') pintarInicio();
  if (activo === 'reparto-dia') cargarReparto();
  if (activo === 'pedidos-hoy') cargarPedidos();
  if (activo === 'pedidos-historial') prepararHistorialPedidos();
  if (activo === 'nuevo') cargarFormularioNuevo();
  if (activo === 'clientes-lista') cargarClientes();
  if (activo === 'clientes-historial') cargarClientesHistorial();
  if (activo === 'factura-crear') cargarFormularioFactura();
  if (activo === 'factura-resumen') prepararResumenFacturas();
  if (activo === 'factura-por-cliente') prepararFacturaPorCliente();
  if (activo === 'pedido-editar') cargarPedidoParaEditar();
  if (activo === 'factura-editar') cargarFacturaParaEditar();
  if (activo === 'albaran-suelto') cargarFormularioAlbaran();
  if (activo === 'empresa') cargarEmpresa();
  if (activo === 'productos') cargarProductosGestion();
  if (activo === 'estadisticas') prepararEstadisticas();
}

function pintarInicio() {
  document.getElementById('homeSub').textContent =
    ROL === 'repartidor' ? `Repartidor · Ruta ${RUTA}` : 'Administración';
  cargarBadgesInicio();
}

async function cargarBadgesInicio() {
  const badgeReparto = document.getElementById('badgeReparto');
  const badgePedidos = document.getElementById('badgePedidos');
  badgeReparto.textContent = '';
  badgePedidos.textContent = '';

  const r = await apiGet('pedidosHoy').catch(() => null);
  if (!r || !r.ok) return;

  const total = r.data.length;
  const pendientes = r.data.filter((p) => !p.entregado).length;
  badgeReparto.textContent = total ? `${total} hoy` : '';
  badgePedidos.textContent = pendientes ? `${pendientes} pendientes` : (total ? 'Al día' : '');
}

/* ============ AJUSTES / CONEXIÓN ============ */
function cablearAjustes() {
  document.getElementById('btnAjustes').addEventListener('click', abrirAjustes);
  document.getElementById('btnAjustesSidebar').addEventListener('click', abrirAjustes);
  document.getElementById('btnCopiarEnlace').addEventListener('click', copiarEnlaceCompartir);

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

async function copiarEnlaceCompartir() {
  const msg = document.getElementById('enlaceMsg');
  const url = document.getElementById('inputUrl').value.trim();
  if (!url) {
    msg.textContent = 'Primero pon la URL del Web App arriba.';
    msg.className = 'form-msg is-error';
    return;
  }

  const enlace = `${window.location.origin}${window.location.pathname}?url=${encodeURIComponent(url)}`;

  try {
    await navigator.clipboard.writeText(enlace);
    msg.textContent = '¡Enlace copiado! Pégalo donde quieras mandarlo (la clave no va incluida, cada uno pone la suya).';
    msg.className = 'form-msg is-ok';
  } catch (e) {
    msg.textContent = 'No se pudo copiar automáticamente. Enlace: ' + enlace;
    msg.className = 'form-msg is-error';
  }
}

function abrirAjustes() {
  document.getElementById('inputUrl').value = WEB_APP_URL;
  document.getElementById('inputKey').value = API_KEY;
  document.getElementById('enlaceMsg').textContent = '';
  document.getElementById('modalAjustes').classList.remove('tab--hidden');
}

/* ============ REPARTO ============ */
let offsetRepartoSeleccionado = 0; // 0 = hoy, -1 = ayer, 1 = mañana

function etiquetaFechaOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const fecha = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  if (offset === 0) return `Reparto de hoy — ${fecha}`;
  if (offset === -1) return `Reparto de ayer — ${fecha}`;
  if (offset === 1) return `Reparto de mañana — ${fecha}`;
  return `Reparto — ${fecha}`;
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
  document.getElementById('repartoDiaTitulo').textContent = etiquetaFechaOffset(offsetRepartoSeleccionado);

  const r = await apiGet('reparto', { fecha: fechaOffsetDDMMYYYY(offsetRepartoSeleccionado) }).catch(() => null);
  if (!r || !r.ok) {
    contProductos.innerHTML = `<div class="empty-state">No se pudo cargar (${(r && r.error) || 'sin conexión'})</div>`;
    return;
  }
  pintarReparto(r.data);

  const bloqueFaltan = document.getElementById('bloqueFaltanManana');
  if (offsetRepartoSeleccionado === 1) {
    bloqueFaltan.classList.remove('tab--hidden');
    cargarFaltanManana();
  } else {
    bloqueFaltan.classList.add('tab--hidden');
  }
}

function pintarReparto(data) {
  const contProductos = document.getElementById('repartoProductos');
  const contClientes = document.getElementById('repartoClientes');

  if (!data.productos.length) {
    contProductos.innerHTML = '<div class="empty-state">Todavía no hay pedidos para este día.</div>';
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
    return;
  }

  const mostrarSeguimiento = offsetRepartoSeleccionado <= 0; // Hoy y Ayer, no Mañana (todavía no se ha repartido)

  if (mostrarSeguimiento) {
    const total = data.clientes.length;
    const entregados = data.clientes.filter((c) => c.entregado).length;
    const cobrados = data.clientes.filter((c) => c.cobrado).length;
    const recaudado = data.clientes.filter((c) => c.cobrado).reduce((s, c) => s + Number(c.total || 0), 0);
    const totalEsperado = data.clientes.reduce((s, c) => s + Number(c.total || 0), 0);

    document.getElementById('repartoResumen').innerHTML = `
      <div class="stats-row">
        <div class="stats-row__item"><span class="stats-row__num">${entregados}/${total}</span><span class="stats-row__label">Entregados</span></div>
        <div class="stats-row__item"><span class="stats-row__num">${cobrados}/${total}</span><span class="stats-row__label">Cobrados</span></div>
        <div class="stats-row__item"><span class="stats-row__num">${formatoEuros(recaudado)}</span><span class="stats-row__label">Recaudado de ${formatoEuros(totalEsperado)}</span></div>
      </div>
    `;
    document.getElementById('repartoResumen').classList.remove('tab--hidden');
  } else {
    document.getElementById('repartoResumen').classList.add('tab--hidden');
  }

  contClientes.innerHTML = data.clientes.map((c) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(c.cliente)}</div>
          <div class="card__meta">${escapeHtml(c.fecha || '')}${c.hora ? ' · ' + escapeHtml(c.hora) : ''}${c.ruta ? ' · Ruta ' + escapeHtml(c.ruta) : ''} · ${formatoEuros(c.total)}</div>
        </div>
        ${mostrarSeguimiento ? stampHtml(c.cobrado ? 'Cobrado' : c.entregado ? 'Entregado' : 'Pendiente') : ''}
      </div>
      <div class="card__products">${escapeHtml(c.productos)}</div>
      ${mostrarSeguimiento && c.entregado && c.horaEntrega ? `<div class="card__meta" style="margin-top:4px;">Entregado a las ${escapeHtml(c.horaEntrega)}</div>` : ''}
      ${mostrarSeguimiento ? `
        <div class="card__actions">
          ${!c.entregado ? `<button class="chip-btn" data-reparto-accion="entregado" data-id="${c.id}">Marcar entregado</button>` : ''}
          ${!c.cobrado ? `<button class="chip-btn" data-reparto-accion="cobrado" data-id="${c.id}">Marcar cobrado</button>` : ''}
        </div>` : ''}
    </div>
  `).join('');

  contClientes.querySelectorAll('[data-reparto-accion]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const r = await apiGet('marcar' + (btn.dataset.repartoAccion === 'entregado' ? 'Entregado' : 'Cobrado'), { idPedido: btn.dataset.id }).catch(() => ({ ok: false }));
      if (!r.ok) { alert('No se pudo actualizar: ' + (r.error || 'error')); btn.disabled = false; return; }
      cargarReparto();
    });
  });
}

async function cargarFaltanManana() {
  const cont = document.getElementById('repartoFaltan');
  cont.innerHTML = '<div class="empty-state">Comprobando…</div>';

  const r = await apiGet('resumenManana').catch((err) => ({ ok: false, error: String(err) }));
  if (!r || !r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo comprobar: ${escapeHtml(r ? r.error : 'sin conexión')}</div>`; return; }

  const d = r.data;
  if (d.sinPedido.length === 0) {
    cont.innerHTML = '<div class="empty-state">¡Están todos! Ya ha pedido toda la cartera de clientes activa.</div>';
    return;
  }

  cont.innerHTML = `<div class="card__meta" style="margin-bottom:8px;">${d.conPedido} de ${d.totalClientes} clientes ya han pedido</div>` +
    d.sinPedido.map((c) => {
      const mensaje = `Hola ${c.nombre}! 👋 Te escribimos porque todavía no hemos recibido tu pedido de pan para mañana. Si quieres que te llevemos mañana, no olvides rellenar el formulario antes de las 21:00. ¡Gracias!`;
      const enlace = c.telefono
        ? `https://wa.me/34${String(c.telefono).replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
        : '';
      return `
      <div class="client-row">
        <span>${escapeHtml(c.nombre)}</span>
        ${enlace ? `<a class="chip-btn" href="${enlace}" target="_blank" rel="noopener">Avisar</a>` : ''}
      </div>
    `;
    }).join('');
}

/* ============ PEDIDOS DEL DÍA ============ */
async function cargarPedidos() {
  const cont = document.getElementById('listaPedidos');
  const inputFecha = document.getElementById('pedidosFechaSeleccionada');
  if (!inputFecha.value) inputFecha.valueAsDate = new Date();

  const fecha = formatoFechaES(inputFecha.value);
  const r = await apiGet('pedidosHoy', { fecha }).catch(() => null);
  if (!r || !r.ok) {
    cont.innerHTML = `<div class="empty-state">No se pudo cargar (${(r && r.error) || 'sin conexión'})</div>`;
    return;
  }
  guardarCache('pedidosHoy', r.data);
  pintarPedidos(r.data);
}

function cablearNavegacionPedidos() {
  const inputFecha = document.getElementById('pedidosFechaSeleccionada');
  inputFecha.addEventListener('change', cargarPedidos);
  document.getElementById('btnPedidosDiaAnterior').addEventListener('click', () => {
    const d = inputFecha.valueAsDate || new Date();
    d.setDate(d.getDate() - 1);
    inputFecha.valueAsDate = d;
    cargarPedidos();
  });
  document.getElementById('btnPedidosDiaSiguiente').addEventListener('click', () => {
    const d = inputFecha.valueAsDate || new Date();
    d.setDate(d.getDate() + 1);
    inputFecha.valueAsDate = d;
    cargarPedidos();
  });
}

function pintarPedidos(pedidos) {
  const cont = document.getElementById('listaPedidos');
  const filtroTexto = (document.getElementById('buscarPedido').value || '').toLowerCase();
  const filtroEstado = document.getElementById('filtroEstadoPedido').value;

  const filtrados = pedidos.filter((p) => {
    if (!p.cliente.toLowerCase().includes(filtroTexto)) return false;
    if (filtroEstado === 'todos') return true;
    const estado = p.cobrado ? 'cobrado' : p.entregado ? 'entregado' : 'pendiente';
    return estado === filtroEstado;
  });

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
        ${ROL === 'admin' ? `<button class="chip-btn" data-accion="editar" data-id="${p.id}">Editar pedido</button>` : ''}
        ${ROL === 'admin' ? `<button class="chip-btn" data-accion="anular" data-id="${p.id}" style="border-color:var(--warn-red); color:var(--warn-red);">Anular</button>` : ''}
      </div>
    </div>
  `;
  }).join('');

  cont.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const accion = btn.dataset.accion;
      if (accion === 'entregado' || accion === 'cobrado') {
        cambiarEstadoPedido(btn.dataset.id, accion);
      } else if (accion === 'anular') {
        anularPedido(btn.dataset.id);
      } else if (accion === 'editar') {
        idPedidoEnEdicion = btn.dataset.id;
        cambiarTab('pedido-editar');
      } else {
        conEstadoCarga(e.target, 'Generando…', () => generarDocumento(btn.dataset.id, accion));
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

// Desactiva el botón y le cambia el texto mientras dura la tarea (evita
// que le den varias veces seguidas mientras espera, ej. generando un PDF).
async function conEstadoCarga(boton, textoCarga, tarea) {
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = textoCarga;
  try {
    await tarea();
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

async function descargarPDF(base64, nombreArchivo) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });

  // En móvil, si el navegador lo soporta, ofrece compartir directamente
  // (WhatsApp, Mail, etc.) usando el panel nativo de compartir.
  try {
    const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: nombreArchivo });
      return;
    }
  } catch (e) {
    // el usuario canceló el panel de compartir, o no está soportado: seguimos con la descarga normal
  }

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

document.addEventListener('change', (e) => {
  if (e.target.id === 'filtroEstadoPedido') {
    const cache = leerCache('pedidosHoy');
    if (cache) pintarPedidos(cache);
  }
});

/* ============ NUEVO PEDIDO ============ */
let fechaPedidoSeleccion = 'hoy';

/* ============ HISTORIAL DE PEDIDOS (rango de fechas) ============ */
function prepararHistorialPedidos() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (!document.getElementById('histFechaIni').value) document.getElementById('histFechaIni').valueAsDate = inicioMes;
  if (!document.getElementById('histFechaFin').value) document.getElementById('histFechaFin').valueAsDate = hoy;
}

async function buscarHistorialPedidos() {
  const cont = document.getElementById('listaHistorialPedidos');
  const ini = document.getElementById('histFechaIni').value;
  const fin = document.getElementById('histFechaFin').value;
  if (!ini || !fin) { cont.innerHTML = '<div class="empty-state">Elige las dos fechas.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('pedidosPorRango', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r || !r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r ? r.error : 'sin conexión')}</div>`; return; }

  if (!r.data.length) {
    cont.innerHTML = '<div class="empty-state">Sin pedidos en ese periodo.</div>';
    return;
  }

  cont.innerHTML = r.data.map((p) => {
    const estado = p.anulado ? 'Anulado' : p.cobrado ? 'Cobrado' : p.entregado ? 'Entregado' : 'Pendiente';
    return `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.cliente)}</div>
          <div class="card__meta">${escapeHtml(p.fecha)} · ${escapeHtml(p.hora || '')}</div>
        </div>
        <div style="text-align:right">
          <div class="card__total">${formatoEuros(p.total)}</div>
          ${stampHtml(estado)}
        </div>
      </div>
      <div class="card__products">${escapeHtml(p.pedido)}</div>
    </div>`;
  }).join('');
}

/* ============ RESUMEN DE FACTURAS (todas, por rango) ============ */
let resumenFacturasCache = [];

function prepararResumenFacturas() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (!document.getElementById('resFechaIni').value) document.getElementById('resFechaIni').valueAsDate = inicioMes;
  if (!document.getElementById('resFechaFin').value) document.getElementById('resFechaFin').valueAsDate = hoy;
}

async function buscarResumenFacturas() {
  const cont = document.getElementById('listaResumenFacturas');
  const ini = document.getElementById('resFechaIni').value;
  const fin = document.getElementById('resFechaFin').value;
  if (!ini || !fin) { cont.innerHTML = '<div class="empty-state">Elige las dos fechas.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('resumenFacturas', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r || !r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r ? r.error : 'sin conexión')}</div>`; return; }

  resumenFacturasCache = r.data.facturas;
  document.getElementById('resumenFacturasTotal').textContent =
    `Facturado: ${formatoEuros(r.data.total)}  ·  Cobrado: ${formatoEuros(r.data.totalCobrado)}  ·  Pendiente: ${formatoEuros(r.data.totalPendiente)}` +
    (r.data.numAnuladas ? `  ·  ${r.data.numAnuladas} anulada(s)` : '');
  pintarResumenFacturas();
}

function pintarResumenFacturas() {
  const cont = document.getElementById('listaResumenFacturas');
  const filtro = document.getElementById('filtroEstadoFactura').value;
  const facturas = filtro === 'todas' ? resumenFacturasCache : resumenFacturasCache.filter((f) => f.estado === filtro);

  if (!facturas.length) {
    cont.innerHTML = '<div class="empty-state">Sin facturas con ese filtro en este periodo.</div>';
    return;
  }

  cont.innerHTML = facturas.map((f) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(f.cliente)}</div>
          <div class="card__meta">Factura #${f.idFactura} · ${escapeHtml(f.fecha)}</div>
        </div>
        <div style="text-align:right">
          <div class="card__total">${formatoEuros(f.total)}</div>
          ${stampHtml(f.estado)}
        </div>
      </div>
      <div class="card__actions">
        <button class="chip-btn" data-ver-factura="${f.idFactura}">Ver factura</button>
        ${(!f.idPedido && f.estado !== 'Anulada') ? `<button class="chip-btn" data-editar-factura="${f.idFactura}">Editar factura</button>` : ''}
        ${(f.estado !== 'Cobrado' && f.estado !== 'Anulada') ? `<button class="chip-btn" data-marcar-cobrada="${f.idFactura}">Marcar cobrada</button>` : ''}
      </div>
    </div>
  `).join('');
  cont.querySelectorAll('[data-marcar-cobrada]').forEach((btn) => {
    btn.addEventListener('click', () => marcarFacturaCobrada(btn.dataset.marcarCobrada, buscarResumenFacturas));
  });
  cont.querySelectorAll('[data-ver-factura]').forEach((btn) => {
    btn.addEventListener('click', (e) => conEstadoCarga(e.target, 'Abriendo…', () => verFacturaPDF(btn.dataset.verFactura)));
  });
  cont.querySelectorAll('[data-editar-factura]').forEach((btn) => {
    btn.addEventListener('click', () => {
      idFacturaEnEdicion = btn.dataset.editarFactura;
      cambiarTab('factura-editar');
    });
  });
}

/* ============ VER FACTURA POR CLIENTE (desde el menú Facturas) ============ */
async function prepararFacturaPorCliente() {
  const select = document.getElementById('selectClienteBuscarFactura');
  if (!clientesCache.length) {
    const rc = await apiGet('clientes').catch(() => null);
    if (rc && rc.ok) clientesCache = rc.data;
  }
  if (select.options.length <= 1) {
    select.innerHTML = '<option value="">Selecciona un cliente…</option>' +
      clientesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  }
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (!document.getElementById('pcFechaIni').value) document.getElementById('pcFechaIni').valueAsDate = inicioMes;
  if (!document.getElementById('pcFechaFin').value) document.getElementById('pcFechaFin').valueAsDate = hoy;
}

async function buscarFacturaPorCliente() {
  const cont = document.getElementById('listaFacturaPorCliente');
  const clienteId = document.getElementById('selectClienteBuscarFactura').value;
  const ini = document.getElementById('pcFechaIni').value;
  const fin = document.getElementById('pcFechaFin').value;
  if (!clienteId) { cont.innerHTML = '<div class="empty-state">Selecciona un cliente.</div>'; return; }
  if (!ini || !fin) { cont.innerHTML = '<div class="empty-state">Elige las dos fechas.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('facturasCliente', { clienteId, fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r || !r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r ? r.error : 'sin conexión')}</div>`; return; }

  if (!r.data.facturas.length) {
    cont.innerHTML = '<div class="empty-state">Sin facturas en ese periodo.</div>';
    document.getElementById('facturaPorClienteTotal').textContent = '';
    return;
  }

  cont.innerHTML = r.data.facturas.map((f) => `
    <div class="card">
      <div class="card__top">
        <div class="card__meta">Factura #${f.idFactura} · ${escapeHtml(f.fecha)}</div>
        <div style="text-align:right">
          <div class="card__total">${formatoEuros(f.total)}</div>
          ${stampHtml(f.estado)}
        </div>
      </div>
      <div class="card__actions">
        <button class="chip-btn" data-ver-factura="${f.idFactura}">Ver factura</button>
        ${(!f.idPedido && f.estado !== 'Anulada') ? `<button class="chip-btn" data-editar-factura="${f.idFactura}">Editar factura</button>` : ''}
        ${f.estado !== 'Cobrado' ? `<button class="chip-btn" data-marcar-cobrada="${f.idFactura}">Marcar cobrada</button>` : ''}
      </div>
    </div>
  `).join('');
  document.getElementById('facturaPorClienteTotal').textContent = `Total periodo: ${formatoEuros(r.data.total)}`;
  cont.querySelectorAll('[data-marcar-cobrada]').forEach((btn) => {
    btn.addEventListener('click', () => marcarFacturaCobrada(btn.dataset.marcarCobrada, buscarFacturaPorCliente));
  });
  cont.querySelectorAll('[data-ver-factura]').forEach((btn) => {
    btn.addEventListener('click', (e) => conEstadoCarga(e.target, 'Abriendo…', () => verFacturaPDF(btn.dataset.verFactura)));
  });
  cont.querySelectorAll('[data-editar-factura]').forEach((btn) => {
    btn.addEventListener('click', () => {
      idFacturaEnEdicion = btn.dataset.editarFactura;
      cambiarTab('factura-editar');
    });
  });
}

async function verFacturaPDF(idFactura) {
  const r = await apiGet('facturaDirectaPdf', { idFactura }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { alert('No se pudo abrir la factura: ' + (r.error || 'error')); return; }
  descargarPDF(r.base64, r.nombre);
}

async function marcarFacturaCobrada(idFactura, recargar) {
  const r = await apiGet('marcarFacturaCobrada', { idFactura }).catch(() => ({ ok: false }));
  if (!r.ok) { alert('No se pudo marcar: ' + (r.error || 'error')); return; }
  recargar();
}

/* ============ DATOS DE LA EMPRESA ============ */
function cablearEmpresa() {
  document.getElementById('btnGuardarEmpresa').addEventListener('click', guardarEmpresa);
  document.getElementById('btnBuscarHistorialPedidos').addEventListener('click', buscarHistorialPedidos);
  document.getElementById('btnBuscarResumenFacturas').addEventListener('click', buscarResumenFacturas);
  document.getElementById('filtroEstadoFactura').addEventListener('change', pintarResumenFacturas);
  document.getElementById('btnResumenHoy').addEventListener('click', () => {
    const hoy = new Date();
    document.getElementById('resFechaIni').valueAsDate = hoy;
    document.getElementById('resFechaFin').valueAsDate = hoy;
    buscarResumenFacturas();
  });
  document.getElementById('btnBuscarFacturaPorCliente').addEventListener('click', buscarFacturaPorCliente);
}

async function cargarEmpresa() {
  const msg = document.getElementById('empresaMsg');
  msg.textContent = 'Cargando…';
  msg.className = 'form-msg';
  const r = await apiGet('empresa').catch(() => ({ ok: false }));
  if (!r.ok) { msg.textContent = 'No se pudo cargar.'; msg.className = 'form-msg is-error'; return; }

  document.getElementById('empNombre').value = r.data.nombre || '';
  document.getElementById('empNif').value = r.data.nif || '';
  document.getElementById('empDireccion').value = r.data.direccion || '';
  document.getElementById('empTelefono').value = r.data.telefono || '';
  document.getElementById('empEmail').value = r.data.email || '';
  document.getElementById('empLogoFileId').value = r.data.logoFileId || '';
  msg.textContent = '';
}

async function guardarEmpresa() {
  const msg = document.getElementById('empresaMsg');
  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet('guardarEmpresa', {
    nombre: document.getElementById('empNombre').value.trim(),
    nif: document.getElementById('empNif').value.trim(),
    direccion: document.getElementById('empDireccion').value.trim(),
    telefono: document.getElementById('empTelefono').value.trim(),
    email: document.getElementById('empEmail').value.trim(),
    logoFileId: document.getElementById('empLogoFileId').value.trim(),
  }).catch(() => ({ ok: false }));

  if (r.ok) {
    msg.textContent = 'Datos guardados.';
    msg.className = 'form-msg is-ok';
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

function cablearNuevoPedido() {
  document.getElementById('btnCrearPedido').addEventListener('click', crearPedidoManual);
  document.getElementById('selectFechaPedido').addEventListener('change', (e) => {
    fechaPedidoSeleccion = e.target.value;
  });
}

async function cargarFormularioNuevo() {
  const selectCliente = document.getElementById('selectCliente');
  const selectProducto = document.getElementById('nProductoSelect');

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
  selectProducto.innerHTML = '<option value="">Elige un producto…</option>' +
    productosCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)} — ${formatoEuros(p.precio)}</option>`).join('');

  itemsNuevo = [];
  pintarItems('nuevo');

  fechaPedidoSeleccion = 'hoy';
  document.getElementById('selectFechaPedido').value = 'hoy';
  document.getElementById('nuevoMsg').textContent = '';
}

function recalcularTotalNuevo() { recalcularTotal('nuevo'); }

async function crearPedidoManual() {
  const msg = document.getElementById('nuevoMsg');
  const clienteId = document.getElementById('selectCliente').value;
  const items = itemsNuevo.map((it) => it.tipo === 'catalogo'
    ? { productoId: it.productoId, cantidad: it.cantidad }
    : { nombre: it.nombre, precio: it.precio, iva: it.iva, cantidad: it.cantidad }
  );

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

/* ============ FACTURAS DIRECTAS (sin pedido) ============ */
function cablearFacturaDirecta() {
  document.getElementById('btnCrearFactura').addEventListener('click', crearFacturaDirecta);
}

async function cargarFormularioFactura() {
  const selectCliente = document.getElementById('selectClienteFactura');
  const selectProducto = document.getElementById('fProductoSelect');

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
  selectProducto.innerHTML = '<option value="">Elige un producto…</option>' +
    productosCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)} — ${formatoEuros(p.precio)}</option>`).join('');

  itemsFactura = [];
  pintarItems('factura');
  document.getElementById('facturaMsg').textContent = '';
}

function recalcularTotalFactura() { recalcularTotal('factura'); }

async function crearFacturaDirecta() {
  const msg = document.getElementById('facturaMsg');
  const clienteId = document.getElementById('selectClienteFactura').value;
  const items = itemsFactura.map((it) => it.tipo === 'catalogo'
    ? { productoId: it.productoId, cantidad: it.cantidad }
    : { nombre: it.nombre, precio: it.precio, iva: it.iva, cantidad: it.cantidad }
  );

  if (!clienteId) { msg.textContent = 'Selecciona un cliente.'; msg.className = 'form-msg is-error'; return; }
  if (!items.length) { msg.textContent = 'Añade al menos un producto.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet('nuevaFactura', { clienteId, items: JSON.stringify(items) }).catch(() => ({ ok: false, error: 'Sin conexión' }));
  if (r.ok) {
    msg.textContent = `Factura #${r.idFactura} creada (${formatoEuros(r.total)}). Generando PDF…`;
    msg.className = 'form-msg is-ok';

    const rPdf = await apiGet('facturaDirectaPdf', { idFactura: r.idFactura }).catch(() => ({ ok: false }));
    if (rPdf.ok) {
      descargarPDF(rPdf.base64, rPdf.nombre);
      msg.textContent = `Factura #${r.idFactura} creada (${formatoEuros(r.total)}).`;
    }

    document.getElementById('selectClienteFactura').value = '';
    cargarFormularioFactura();
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

/* ============ CLIENTES ============ */
function cablearClientes() {
  document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
    document.getElementById('detalleCliente').classList.add('tab--hidden');
    document.getElementById('clientesListaVista').classList.remove('tab--hidden');
  });
  document.getElementById('btnBuscarFacturas').addEventListener('click', buscarFacturasCliente);
}

let clienteSeleccionado = null;

async function cargarClientes() {
  document.getElementById('detalleCliente').classList.add('tab--hidden');
  document.getElementById('clientesListaVista').classList.remove('tab--hidden');
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
  document.getElementById('clientesListaVista').classList.add('tab--hidden');
  document.getElementById('detalleCliente').classList.remove('tab--hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.getElementById('listaFacturas').innerHTML = '';
  document.getElementById('periodoTotal').textContent = '';

  const info = [];
  if (clienteSeleccionado.telefono) info.push('📞 ' + clienteSeleccionado.telefono);
  if (clienteSeleccionado.direccion) info.push('📍 ' + clienteSeleccionado.direccion);
  if (clienteSeleccionado.ruta) info.push('Ruta ' + clienteSeleccionado.ruta);
  if (clienteSeleccionado.descuento > 0) info.push(`Descuento: ${(clienteSeleccionado.descuento * 100).toFixed(0)}%`);
  document.getElementById('detalleClienteInfo').innerHTML = info.map((l) => `<div>${escapeHtml(l)}</div>`).join('');

  cargarPreciosEspeciales(id);

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
  let clase = 'stamp--pendiente';
  if (estado === 'Cobrado' || estado === 'Entregado') clase = 'stamp--cobrado';
  else if (estado === 'Anulado' || estado === 'Anulada') clase = 'stamp--anulado';
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

/* ============ ANULAR PEDIDO ============ */
async function anularPedido(idPedido) {
  if (!confirm('¿Seguro que quieres anular este pedido? Se borrará también su factura. Esto no se puede deshacer.')) return;
  const r = await apiGet('anularPedido', { idPedido }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { alert('No se pudo anular: ' + (r.error || 'error')); return; }
  cargarPedidos();
}

/* ============ HOJA DE RUTA ============ */
function cablearHojaRuta() {
  document.getElementById('btnHojaRuta').addEventListener('click', (e) => {
    conEstadoCarga(e.target, 'Generando…', async () => {
      const r = await apiGet('hojaRutaPdf', { fecha: fechaOffsetDDMMYYYY(offsetRepartoSeleccionado) }).catch((err) => ({ ok: false, error: String(err) }));
      if (!r.ok) { alert('No se pudo generar: ' + (r.error || 'error')); return; }
      descargarPDF(r.base64, r.nombre);
    });
  });
  document.getElementById('btnResumenDia').addEventListener('click', (e) => {
    conEstadoCarga(e.target, 'Generando…', async () => {
      const r = await apiGet('resumenDiaPdf', { fecha: fechaOffsetDDMMYYYY(offsetRepartoSeleccionado) }).catch((err) => ({ ok: false, error: String(err) }));
      if (!r.ok) { alert('No se pudo generar: ' + (r.error || 'error')); return; }
      descargarPDF(r.base64, r.nombre);
    });
  });
  document.getElementById('btnFacturasDia').addEventListener('click', (e) => {
    conEstadoCarga(e.target, 'Generando…', async () => {
      const r = await apiGet('facturasDiaPdf', { fecha: fechaOffsetDDMMYYYY(offsetRepartoSeleccionado) }).catch((err) => ({ ok: false, error: String(err) }));
      if (!r.ok) { alert('No se pudo generar: ' + (r.error || 'error')); return; }
      descargarPDF(r.base64, r.nombre);
      if (r.omitidas) alert(`Aviso: ${r.omitidas} pedido(s) no tenían factura enlazada y no se incluyeron.`);
    });
  });
}

/* ============ PRODUCTOS (alta/edición) ============ */
let productosGestionCache = [];

function cablearProductos() {
  document.getElementById('btnNuevoProducto').addEventListener('click', () => abrirFormularioProducto(null));
  document.getElementById('btnGuardarProducto').addEventListener('click', guardarProducto);
}

async function cargarProductosGestion() {
  const cont = document.getElementById('listaProductosGestion');
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';
  const r = await apiGet('todosProductos').catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  productosGestionCache = r.data;
  productosCache = []; // fuerza a refrescar el caché de productos activos en otras pantallas

  if (!r.data.length) { cont.innerHTML = '<div class="empty-state">Sin productos todavía.</div>'; return; }

  cont.innerHTML = r.data.map((p) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.nombre)}</div>
          <div class="card__meta">${p.codigo ? escapeHtml(p.codigo) + ' · ' : ''}${formatoEuros(p.precio)} · IVA ${(p.iva * 100).toFixed(0)}% · ${escapeHtml(p.categoria || 'Panadería')}${p.subcategoria ? ' — ' + escapeHtml(p.subcategoria) : ''}${p.unidadesCaja ? ' · ' + escapeHtml(p.unidadesCaja) : ''}</div>
        </div>
        ${stampHtml(p.activo ? 'Activo' : 'Inactivo')}
      </div>
      <div class="card__actions">
        <button class="chip-btn" data-editar-producto="${p.id}">Editar</button>
      </div>
    </div>
  `).join('');

  cont.querySelectorAll('[data-editar-producto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = productosGestionCache.find((x) => String(x.id) === String(btn.dataset.editarProducto));
      abrirFormularioProducto(p);
    });
  });
}

function abrirFormularioProducto(producto) {
  document.getElementById('productoFormTitulo').textContent = producto ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('prFormId').value = producto ? producto.id : '';
  document.getElementById('prFormNombre').value = producto ? producto.nombre : '';
  document.getElementById('prFormCodigo').value = producto ? producto.codigo : '';
  document.getElementById('prFormPrecio').value = producto ? producto.precio : '';
  document.getElementById('prFormIva').value = producto ? Math.round(producto.iva * 100) : '';
  document.getElementById('prFormCategoria').value = producto && producto.categoria ? producto.categoria : 'Panadería';
  document.getElementById('prFormSubcategoria').value = producto ? (producto.subcategoria || '') : '';
  document.getElementById('prFormUnidadesCaja').value = producto ? (producto.unidadesCaja || '') : '';
  document.getElementById('prFormActivo').value = producto ? String(producto.activo) : 'true';
  document.getElementById('productoFormMsg').textContent = '';
  cambiarTab('producto-form');
}

async function guardarProducto() {
  const msg = document.getElementById('productoFormMsg');
  const nombre = document.getElementById('prFormNombre').value.trim();
  if (!nombre) { msg.textContent = 'Pon un nombre.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet('guardarProducto', {
    id: document.getElementById('prFormId').value,
    nombre: nombre,
    codigo: document.getElementById('prFormCodigo').value.trim(),
    precio: document.getElementById('prFormPrecio').value || '0',
    iva: String((Number(document.getElementById('prFormIva').value) || 0) / 100),
    categoria: document.getElementById('prFormCategoria').value,
    subcategoria: document.getElementById('prFormSubcategoria').value.trim(),
    unidadesCaja: document.getElementById('prFormUnidadesCaja').value.trim(),
    activo: document.getElementById('prFormActivo').value,
  }).catch((err) => ({ ok: false, error: String(err) }));

  if (r.ok) {
    msg.textContent = 'Producto guardado.';
    msg.className = 'form-msg is-ok';
    setTimeout(() => cambiarTab('productos'), 500);
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

/* ============ CLIENTES (alta/edición) ============ */
function cablearClientesForm() {
  document.getElementById('btnNuevoCliente').addEventListener('click', () => abrirFormularioCliente(null));
  document.getElementById('btnNuevoClienteHub').addEventListener('click', () => abrirFormularioCliente(null));
  document.getElementById('btnEditarCliente').addEventListener('click', () => abrirFormularioCliente(clienteSeleccionado));
  document.getElementById('btnGuardarCliente').addEventListener('click', guardarCliente);
  document.getElementById('selectClienteHistorial').addEventListener('change', cargarHistorialClientePorSeleccion);
}

async function cargarClientesHistorial() {
  const select = document.getElementById('selectClienteHistorial');
  if (!clientesCache.length) {
    const r = await apiGet('clientes').catch(() => null);
    if (r && r.ok) clientesCache = r.data;
  }
  select.innerHTML = '<option value="">Elige un cliente…</option>' +
    clientesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  document.getElementById('historialClienteResultado').innerHTML = '';
}

async function cargarHistorialClientePorSeleccion() {
  const clienteId = document.getElementById('selectClienteHistorial').value;
  const cont = document.getElementById('historialClienteResultado');
  if (!clienteId) { cont.innerHTML = ''; return; }

  cont.innerHTML = '<div class="empty-state">Cargando…</div>';
  const r = await apiGet('historialCliente', { clienteId }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  if (!r.data.pedidos.length) {
    cont.innerHTML = '<div class="empty-state">Este cliente no tiene pedidos todavía.</div>';
    return;
  }
  cont.innerHTML = r.data.pedidos.map((p) => `
    <div class="card">
      <div class="card__top">
        <div class="card__meta">${escapeHtml(p.fecha)}</div>
        <div style="text-align:right">
          <div class="card__total">${formatoEuros(p.total)}</div>
          ${stampHtml(p.cobrado ? 'Cobrado' : p.entregado ? 'Entregado' : 'Pendiente')}
        </div>
      </div>
      <div class="card__products">${escapeHtml(p.pedido)}</div>
    </div>
  `).join('');
}

function abrirFormularioCliente(cliente) {
  document.getElementById('clienteFormTitulo').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('clFormId').value = cliente ? cliente.id : '';
  document.getElementById('clFormNombre').value = cliente ? cliente.nombre || '' : '';
  document.getElementById('clFormTelefono').value = cliente ? cliente.telefono || '' : '';
  document.getElementById('clFormDireccion').value = cliente ? cliente.direccion || '' : '';
  document.getElementById('clFormNif').value = cliente ? cliente.nif || '' : '';
  document.getElementById('clFormRuta').value = cliente ? cliente.ruta || '' : '';
  document.getElementById('clFormFormaPago').value = cliente ? cliente.formaPago || '' : '';
  document.getElementById('clFormDescuento').value = cliente && cliente.descuento ? Math.round(cliente.descuento * 100) : '';
  document.getElementById('clFormRecargo').value = cliente && cliente.recargoEquivalencia ? 'true' : 'false';
  document.getElementById('clFormActivo').value = 'true';
  document.getElementById('clienteFormMsg').textContent = '';
  cambiarTab('cliente-form');
}

async function guardarCliente() {
  const msg = document.getElementById('clienteFormMsg');
  const nombre = document.getElementById('clFormNombre').value.trim();
  if (!nombre) { msg.textContent = 'Pon un nombre.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet('guardarCliente', {
    id: document.getElementById('clFormId').value,
    nombre: nombre,
    telefono: document.getElementById('clFormTelefono').value.trim(),
    direccion: document.getElementById('clFormDireccion').value.trim(),
    nif: document.getElementById('clFormNif').value.trim(),
    ruta: document.getElementById('clFormRuta').value.trim(),
    formaPago: document.getElementById('clFormFormaPago').value.trim(),
    descuento: String((Number(document.getElementById('clFormDescuento').value) || 0) / 100),
    recargoEquivalencia: document.getElementById('clFormRecargo').value,
    activo: document.getElementById('clFormActivo').value,
  }).catch((err) => ({ ok: false, error: String(err) }));

  if (r.ok) {
    msg.textContent = 'Cliente guardado.';
    msg.className = 'form-msg is-ok';
    clientesCache = []; // fuerza a refrescar el caché en otras pantallas
    setTimeout(() => cambiarTab('clientes-lista'), 500);
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

/* ============ ESTADÍSTICAS ============ */
function cablearEstadisticas() {
  document.getElementById('btnVerEstadisticas').addEventListener('click', buscarEstadisticas);
}

function prepararEstadisticas() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (!document.getElementById('statsFechaIni').value) document.getElementById('statsFechaIni').valueAsDate = inicioMes;
  if (!document.getElementById('statsFechaFin').value) document.getElementById('statsFechaFin').valueAsDate = hoy;
}

async function buscarEstadisticas() {
  const cont = document.getElementById('statsResumen');
  const ini = document.getElementById('statsFechaIni').value;
  const fin = document.getElementById('statsFechaFin').value;
  if (!ini || !fin) { cont.innerHTML = '<div class="empty-state">Elige las dos fechas.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Calculando…</div>';
  const r = await apiGet('estadisticas', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  const d = r.data;
  let html = `
    <div class="card">
      <div class="card__top"><div class="card__name">Pedidos del periodo</div><div class="card__total">${d.totalPedidos}</div></div>
    </div>
    <div class="card">
      <div class="card__top"><div class="card__name">Ventas totales</div><div class="card__total">${formatoEuros(d.totalVentas)}</div></div>
    </div>
    <div class="card">
      <div class="card__top"><div class="card__name">Cobrado</div><div class="card__total" style="color:var(--ok-green);">${formatoEuros(d.totalCobrado)}</div></div>
    </div>
    <div class="card">
      <div class="card__top"><div class="card__name">Pendiente de cobro</div><div class="card__total" style="color:var(--warn-red);">${formatoEuros(d.totalPendiente)}</div></div>
    </div>
  `;

  html += '<div class="section-label">Productos más vendidos</div>';
  html += d.topProductos.length
    ? '<div class="ticket">' + d.topProductos.map((p) => `<div class="ticket-row"><span>${escapeHtml(p.nombre)}</span><span class="ticket-row__qty">${p.cantidad}</span></div>`).join('') + '</div>'
    : '<div class="empty-state">Sin datos.</div>';

  html += '<div class="section-label">Clientes con más pedidos</div>';
  html += d.topClientes.length
    ? '<div class="ticket">' + d.topClientes.map((c) => `<div class="ticket-row"><span>${escapeHtml(c.nombre)}</span><span class="ticket-row__qty">${c.pedidos}</span></div>`).join('') + '</div>'
    : '<div class="empty-state">Sin datos.</div>';

  cont.innerHTML = html;
}

/* ============ BÚSQUEDA GLOBAL (desde Inicio) ============ */
let temporizadorBusqueda = null;

function cablearBusquedaGlobal() {
  document.getElementById('buscarGlobal').addEventListener('input', (e) => {
    clearTimeout(temporizadorBusqueda);
    const termino = e.target.value.trim();
    if (!termino) { document.getElementById('resultadosBusquedaGlobal').innerHTML = ''; return; }
    temporizadorBusqueda = setTimeout(() => buscarGlobal(termino), 350);
  });
}

async function buscarGlobal(termino) {
  const cont = document.getElementById('resultadosBusquedaGlobal');
  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('busquedaGlobal', { termino }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo buscar: ${escapeHtml(r.error || '')}</div>`; return; }

  const d = r.data;
  const sinResultados = !d.clientes.length && !d.pedidos.length && !d.facturas.length;
  if (sinResultados) { cont.innerHTML = '<div class="empty-state">Sin resultados.</div>'; return; }

  let html = '';
  if (d.clientes.length) {
    html += '<div class="section-label">Clientes</div><div class="stack">' + d.clientes.map((c) => `
      <div class="client-row"><span>${escapeHtml(c.nombre)}</span><span class="client-row__ruta">${escapeHtml(c.telefono || '')}</span></div>
    `).join('') + '</div>';
  }
  if (d.pedidos.length) {
    html += '<div class="section-label">Pedidos</div><div class="stack">' + d.pedidos.map((p) => `
      <div class="card">
        <div class="card__top">
          <div><div class="card__name">${escapeHtml(p.cliente)}</div><div class="card__meta">${escapeHtml(p.fecha)}</div></div>
          <div class="card__total">${formatoEuros(p.total)}</div>
        </div>
        <div class="card__products">${escapeHtml(p.pedido)}</div>
      </div>
    `).join('') + '</div>';
  }
  if (d.facturas.length) {
    html += '<div class="section-label">Facturas</div><div class="stack">' + d.facturas.map((f) => `
      <div class="card">
        <div class="card__top">
          <div class="card__meta">${escapeHtml(f.cliente)} · Factura #${f.idFactura} · ${escapeHtml(f.fecha)}</div>
          <div style="text-align:right"><div class="card__total">${formatoEuros(f.total)}</div>${stampHtml(f.estado)}</div>
        </div>
      </div>
    `).join('') + '</div>';
  }
  cont.innerHTML = html;
}

/* ============ PRECIOS ESPECIALES (por cliente + producto) ============ */
function cablearPreciosEspeciales() {
  document.getElementById('btnAnadirPrecioEspecial').addEventListener('click', anadirPrecioEspecial);
}

async function cargarPreciosEspeciales(idCliente) {
  const cont = document.getElementById('listaPreciosEspeciales');
  const select = document.getElementById('peSelectProducto');
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';

  if (!productosCache.length) {
    const rp = await apiGet('productos').catch(() => null);
    if (rp && rp.ok) productosCache = rp.data;
  }
  select.innerHTML = '<option value="">Producto…</option>' +
    productosCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');

  const r = await apiGet('preciosEspecialesCliente', { clienteId: idCliente }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  if (!r.data.length) {
    cont.innerHTML = '<div class="empty-state">Este cliente paga el precio normal en todos los productos.</div>';
    return;
  }

  cont.innerHTML = r.data.map((pe) => `
    <div class="client-row">
      <span>${escapeHtml(pe.producto)}</span>
      <span style="display:flex; align-items:center; gap:8px;">
        <span class="card__total">${formatoEuros(pe.precio)}</span>
        <button class="chip-btn" data-quitar-precio="${pe.idProducto}" style="border-color:var(--warn-red); color:var(--warn-red);">Quitar</button>
      </span>
    </div>
  `).join('');

  cont.querySelectorAll('[data-quitar-precio]').forEach((btn) => {
    btn.addEventListener('click', () => quitarPrecioEspecial(idCliente, btn.dataset.quitarPrecio));
  });
}

async function anadirPrecioEspecial() {
  if (!clienteSeleccionado) return;
  const idProducto = document.getElementById('peSelectProducto').value;
  const precio = document.getElementById('peInputPrecio').value;
  if (!idProducto) { alert('Selecciona un producto.'); return; }
  if (precio === '' || Number(precio) < 0) { alert('Pon un precio válido.'); return; }

  const producto = productosCache.find((p) => String(p.id) === String(idProducto));

  const r = await apiGet('guardarPrecioEspecial', {
    idCliente: clienteSeleccionado.id,
    clienteNombre: clienteSeleccionado.nombre,
    idProducto: idProducto,
    productoNombre: producto ? producto.nombre : '',
    precio: precio,
  }).catch((err) => ({ ok: false, error: String(err) }));

  if (!r.ok) { alert('No se pudo guardar: ' + (r.error || 'error')); return; }

  document.getElementById('peInputPrecio').value = '';
  document.getElementById('peSelectProducto').value = '';
  cargarPreciosEspeciales(clienteSeleccionado.id);
}

async function quitarPrecioEspecial(idCliente, idProducto) {
  const r = await apiGet('eliminarPrecioEspecial', { idCliente, idProducto }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { alert('No se pudo quitar: ' + (r.error || 'error')); return; }
  cargarPreciosEspeciales(idCliente);
}

/* ============ PRODUCTOS EN NUEVO PEDIDO / GENERAR FACTURA / EDITAR
   (catálogo + fuera de catálogo, todo en una sola lista por pantalla) ============ */
const CONFIG_ITEMS = {
  nuevo: { prefijo: 'n', obtener: () => itemsNuevo, poner: (l) => { itemsNuevo = l; }, listaId: 'listaProductosNuevo', totalId: 'nuevoTotal' },
  factura: { prefijo: 'f', obtener: () => itemsFactura, poner: (l) => { itemsFactura = l; }, listaId: 'listaProductosFactura', totalId: 'facturaTotal' },
  editarPedido: { prefijo: 'ep', obtener: () => itemsEditarPedido, poner: (l) => { itemsEditarPedido = l; }, listaId: 'listaEditarPedido', totalId: 'editarPedidoTotal' },
  editarFactura: { prefijo: 'ef', obtener: () => itemsEditarFactura, poner: (l) => { itemsEditarFactura = l; }, listaId: 'listaEditarFactura', totalId: 'editarFacturaTotal' },
};

function cablearProductosLibres() {
  Object.keys(CONFIG_ITEMS).forEach((tipo) => {
    const p = CONFIG_ITEMS[tipo].prefijo;
    document.getElementById(`btnAnadirProducto_${tipo}`)?.addEventListener('click', () => agregarProductoCatalogo(tipo));
    document.getElementById(`btnAnadirLibre_${tipo}`)?.addEventListener('click', () => agregarProductoLibre(tipo));
  });
}

function agregarProductoCatalogo(tipo) {
  const p = CONFIG_ITEMS[tipo].prefijo;
  const productoId = document.getElementById(`${p}ProductoSelect`).value;
  const cantidad = Number(document.getElementById(`${p}ProductoCantidad`).value) || 1;
  if (!productoId) { alert('Elige un producto.'); return; }

  const producto = productosCache.find((pr) => String(pr.id) === String(productoId));
  if (!producto) return;

  const lista = CONFIG_ITEMS[tipo].obtener();
  const existente = lista.find((it) => it.tipo === 'catalogo' && String(it.productoId) === String(productoId));
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    lista.push({ tipo: 'catalogo', productoId, nombre: producto.nombre, precio: producto.precio, iva: producto.iva, cantidad, uid: 'c-' + productoId });
  }

  pintarItems(tipo);
  document.getElementById(`${p}ProductoSelect`).value = '';
  document.getElementById(`${p}ProductoCantidad`).value = '1';
}

function agregarProductoLibre(tipo) {
  const p = CONFIG_ITEMS[tipo].prefijo;
  const nombre = document.getElementById(`${p}LibreNombre`).value.trim();
  const precio = Number(document.getElementById(`${p}LibrePrecio`).value);
  const ivaPct = Number(document.getElementById(`${p}LibreIva`).value) || 0;
  const cantidad = Number(document.getElementById(`${p}LibreCantidad`).value) || 1;

  if (!nombre) { alert('Pon un nombre para el producto.'); return; }
  if (!precio || precio <= 0) { alert('Pon un precio válido.'); return; }

  const lista = CONFIG_ITEMS[tipo].obtener();
  const uid = 'libre-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  lista.push({ tipo: 'libre', nombre, precio, iva: ivaPct / 100, cantidad, uid });

  pintarItems(tipo);
  document.getElementById(`${p}LibreNombre`).value = '';
  document.getElementById(`${p}LibrePrecio`).value = '';
  document.getElementById(`${p}LibreIva`).value = '';
  document.getElementById(`${p}LibreCantidad`).value = '1';
}

function pintarItems(tipo) {
  const cfg = CONFIG_ITEMS[tipo];
  const lista = cfg.obtener();
  const cont = document.getElementById(cfg.listaId);

  if (!lista.length) {
    cont.innerHTML = '<div class="empty-state">Todavía no has añadido ningún producto.</div>';
  } else {
    cont.innerHTML = lista.map((it) => `
      <div class="client-row">
        <span>${it.cantidad}x ${escapeHtml(it.nombre)} — ${formatoEuros(it.precio)}${it.tipo === 'libre' ? ' <span class="card__meta">(fuera de catálogo)</span>' : ''}</span>
        <button class="chip-btn" data-quitar-item="${it.uid}" style="border-color:var(--warn-red); color:var(--warn-red);">Quitar</button>
      </div>
    `).join('');
    cont.querySelectorAll('[data-quitar-item]').forEach((btn) => {
      btn.addEventListener('click', () => quitarItem(tipo, btn.dataset.quitarItem));
    });
  }

  recalcularTotal(tipo);
}

function quitarItem(tipo, uid) {
  const cfg = CONFIG_ITEMS[tipo];
  cfg.poner(cfg.obtener().filter((it) => it.uid !== uid));
  pintarItems(tipo);
}

function recalcularTotal(tipo) {
  const cfg = CONFIG_ITEMS[tipo];
  let total = 0;
  cfg.obtener().forEach((it) => { total += it.precio * it.cantidad * (1 + it.iva); }); // iva ya es fracción en los dos tipos
  document.getElementById(cfg.totalId).textContent = formatoEuros(total);
}

// Rellena el desplegable de productos del catálogo de una pantalla dada
function rellenarSelectProductos(tipo) {
  const p = CONFIG_ITEMS[tipo].prefijo;
  const select = document.getElementById(`${p}ProductoSelect`);
  select.innerHTML = '<option value="">Elige un producto…</option>' +
    productosCache.map((pr) => `<option value="${pr.id}">${escapeHtml(pr.nombre)} — ${formatoEuros(pr.precio)}</option>`).join('');
}

// Da formato con uid a los items reconstruidos desde el backend
// (obtenerItemsPedidoJSON / obtenerItemsFacturaJSON) para poder pintarlos
function prepararItemsParaEditar(itemsBackend) {
  return itemsBackend.map((it, i) => ({
    ...it,
    uid: it.tipo === 'catalogo' ? 'c-' + it.productoId : 'libre-existente-' + i,
  }));
}

/* ============ EDITAR PEDIDO ============ */
async function cargarPedidoParaEditar() {
  const cont = document.getElementById('listaEditarPedido');
  document.getElementById('editarPedidoCliente').textContent = '';
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';

  if (!productosCache.length) {
    const rp = await apiGet('productos').catch(() => null);
    if (rp && rp.ok) productosCache = rp.data;
  }
  rellenarSelectProductos('editarPedido');

  const r = await apiGet('itemsPedido', { idPedido: idPedidoEnEdicion }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok || !r.data) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml((r && r.error) || 'pedido no encontrado')}</div>`; return; }

  document.getElementById('editarPedidoCliente').textContent = `Pedido #${idPedidoEnEdicion} · ${r.data.cliente}`;
  itemsEditarPedido = prepararItemsParaEditar(r.data.items);
  pintarItems('editarPedido');
  document.getElementById('editarPedidoMsg').textContent = '';
}

async function guardarEdicionPedido() {
  const msg = document.getElementById('editarPedidoMsg');
  const items = itemsEditarPedido.map((it) => it.tipo === 'catalogo'
    ? { productoId: it.productoId, cantidad: it.cantidad }
    : { nombre: it.nombre, precio: it.precio, iva: it.iva, cantidad: it.cantidad }
  );

  if (!items.length) { msg.textContent = 'El pedido no puede quedarse sin productos.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet('editarPedido', { idPedido: idPedidoEnEdicion, items: JSON.stringify(items) }).catch(() => ({ ok: false, error: 'Sin conexión' }));
  if (r.ok) {
    msg.textContent = `Pedido actualizado (${formatoEuros(r.total)}).`;
    msg.className = 'form-msg is-ok';
    setTimeout(() => cambiarTab('pedidos-hoy'), 700);
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

/* ============ EDITAR FACTURA (solo las que no vienen de un pedido) ============ */
async function cargarFacturaParaEditar() {
  const cont = document.getElementById('listaEditarFactura');
  document.getElementById('editarFacturaCliente').textContent = '';
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';

  if (!productosCache.length) {
    const rp = await apiGet('productos').catch(() => null);
    if (rp && rp.ok) productosCache = rp.data;
  }
  rellenarSelectProductos('editarFactura');

  const r = await apiGet('itemsFactura', { idFactura: idFacturaEnEdicion }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok || !r.data) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml((r && r.error) || 'factura no encontrada')}</div>`; return; }
  if (r.data.error) { cont.innerHTML = `<div class="empty-state">${escapeHtml(r.data.error)}</div>`; return; }

  document.getElementById('editarFacturaCliente').textContent = `Factura #${idFacturaEnEdicion} · ${r.data.cliente}`;
  itemsEditarFactura = prepararItemsParaEditar(r.data.items);
  pintarItems('editarFactura');
  document.getElementById('editarFacturaMsg').textContent = '';
}

async function guardarEdicionFactura() {
  const msg = document.getElementById('editarFacturaMsg');
  const items = itemsEditarFactura.map((it) => it.tipo === 'catalogo'
    ? { productoId: it.productoId, cantidad: it.cantidad }
    : { nombre: it.nombre, precio: it.precio, iva: it.iva, cantidad: it.cantidad }
  );

  if (!items.length) { msg.textContent = 'La factura no puede quedarse sin productos.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet('editarFactura', { idFactura: idFacturaEnEdicion, items: JSON.stringify(items) }).catch(() => ({ ok: false, error: 'Sin conexión' }));
  if (r.ok) {
    msg.textContent = `Factura actualizada (${formatoEuros(r.total)}).`;
    msg.className = 'form-msg is-ok';
    setTimeout(() => cambiarTab('factura'), 700);
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

function cablearEdicion() {
  document.getElementById('btnGuardarEdicionPedido').addEventListener('click', guardarEdicionPedido);
  document.getElementById('btnGuardarEdicionFactura').addEventListener('click', guardarEdicionFactura);
}

/* ============ NUEVO ALBARÁN (sin factura) ============ */
let itemsAlbaran = []; // { tipo:'catalogo'|'libre', productoId?, nombre, cantidad, uid }

async function cargarFormularioAlbaran() {
  const selectCliente = document.getElementById('selectClienteAlbaran');
  const selectProducto = document.getElementById('albaranProductoSelect');

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
  selectProducto.innerHTML = '<option value="">Elige un producto…</option>' +
    productosCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');

  itemsAlbaran = [];
  pintarItemsAlbaran();
  document.getElementById('albaranSueltoMsg').textContent = '';
}

function agregarProductoAlbaran() {
  const productoId = document.getElementById('albaranProductoSelect').value;
  const cantidad = Number(document.getElementById('albaranProductoCantidad').value) || 1;
  if (!productoId) { alert('Elige un producto.'); return; }
  const p = productosCache.find((pr) => String(pr.id) === String(productoId));
  if (!p) return;

  const existente = itemsAlbaran.find((it) => it.tipo === 'catalogo' && String(it.productoId) === String(productoId));
  if (existente) existente.cantidad += cantidad;
  else itemsAlbaran.push({ tipo: 'catalogo', productoId, nombre: p.nombre, cantidad, uid: 'c-' + productoId });

  pintarItemsAlbaran();
  document.getElementById('albaranProductoSelect').value = '';
  document.getElementById('albaranProductoCantidad').value = '1';
}

function agregarLibreAlbaran() {
  const nombre = document.getElementById('albaranLibreNombre').value.trim();
  const cantidad = Number(document.getElementById('albaranLibreCantidad').value) || 1;
  if (!nombre) { alert('Pon un nombre para el producto.'); return; }

  const uid = 'libre-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  itemsAlbaran.push({ tipo: 'libre', nombre, cantidad, uid });

  pintarItemsAlbaran();
  document.getElementById('albaranLibreNombre').value = '';
  document.getElementById('albaranLibreCantidad').value = '1';
}

function pintarItemsAlbaran() {
  const cont = document.getElementById('listaAlbaran');
  if (!itemsAlbaran.length) {
    cont.innerHTML = '<div class="empty-state">Todavía no has añadido ningún producto.</div>';
  } else {
    cont.innerHTML = itemsAlbaran.map((it) => `
      <div class="client-row">
        <span>${it.cantidad}x ${escapeHtml(it.nombre)}</span>
        <button class="chip-btn" data-quitar-albaran="${it.uid}" style="border-color:var(--warn-red); color:var(--warn-red);">Quitar</button>
      </div>
    `).join('');
    cont.querySelectorAll('[data-quitar-albaran]').forEach((btn) => {
      btn.addEventListener('click', () => {
        itemsAlbaran = itemsAlbaran.filter((it) => it.uid !== btn.dataset.quitarAlbaran);
        pintarItemsAlbaran();
      });
    });
  }
}

async function generarAlbaranSuelto() {
  const msg = document.getElementById('albaranSueltoMsg');
  const clienteId = document.getElementById('selectClienteAlbaran').value;
  if (!clienteId) { msg.textContent = 'Elige un cliente.'; msg.className = 'form-msg is-error'; return; }
  if (!itemsAlbaran.length) { msg.textContent = 'Añade al menos un producto.'; msg.className = 'form-msg is-error'; return; }

  const items = itemsAlbaran.map((it) => it.tipo === 'catalogo'
    ? { productoId: it.productoId, cantidad: it.cantidad }
    : { nombre: it.nombre, cantidad: it.cantidad }
  );

  msg.textContent = 'Generando…';
  msg.className = 'form-msg';

  const r = await apiGet('albaranSuelto', { clienteId, items: JSON.stringify(items) }).catch(() => ({ ok: false, error: 'Sin conexión' }));
  if (!r.ok) { msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo'); msg.className = 'form-msg is-error'; return; }

  await descargarPDF(r.base64, r.nombre);
  msg.textContent = 'Albarán generado.';
  msg.className = 'form-msg is-ok';
  itemsAlbaran = [];
  pintarItemsAlbaran();
}

function cablearAlbaranSuelto() {
  document.getElementById('btnAnadirProducto_albaran').addEventListener('click', agregarProductoAlbaran);
  document.getElementById('btnAnadirLibre_albaran').addEventListener('click', agregarLibreAlbaran);
  document.getElementById('btnGenerarAlbaranSuelto').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', generarAlbaranSuelto));
}

/* ============ MODELO 347 ============ */
async function buscarModelo347() {
  const anio = document.getElementById('anio347').value.trim();
  const cont = document.getElementById('lista347');
  if (!anio) { cont.innerHTML = '<div class="empty-state">Escribe un año.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('modelo347', { anio }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  if (!r.data.clientes.length) { cont.innerHTML = '<div class="empty-state">Sin facturas en ese año.</div>'; return; }

  cont.innerHTML = r.data.clientes.map((c) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(c.nombre)}</div>
          <div class="card__meta">${c.nif ? 'NIF: ' + escapeHtml(c.nif) : 'Sin NIF registrado'}${c.superaUmbral ? ' · supera 3.005,06€' : ''}</div>
        </div>
        <div class="card__total">${formatoEuros(c.total)}</div>
      </div>
      <div class="card__products">T1: ${formatoEuros(c.trimestres[0])} · T2: ${formatoEuros(c.trimestres[1])} · T3: ${formatoEuros(c.trimestres[2])} · T4: ${formatoEuros(c.trimestres[3])}</div>
    </div>
  `).join('');
}

/* ============ FACTURACIÓN POR PERIODO ============ */
async function buscarFacturacionPeriodo() {
  const anio = document.getElementById('anioPeriodo').value.trim();
  const agrupacion = document.getElementById('agrupacionPeriodo').value;
  const cont = document.getElementById('listaPeriodo');
  if (!anio) { cont.innerHTML = '<div class="empty-state">Escribe un año.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('facturacionPeriodo', { anio, agrupacion }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  const periodosConDatos = r.data.periodos.filter((p) => p.numFacturas > 0 || p.numAnuladas > 0);
  if (!periodosConDatos.length) {
    cont.innerHTML = '<div class="empty-state">Sin facturas en ese año.</div>';
    document.getElementById('periodoTotalAnual').textContent = '';
    return;
  }

  cont.innerHTML = periodosConDatos.map((p) => `
    <div class="card">
      <div class="card__top">
        <div class="card__name">${escapeHtml(p.periodo)}</div>
        <div class="card__total">${formatoEuros(p.total)}</div>
      </div>
      <div class="card__products">${p.numFacturas} factura(s)${p.numAnuladas ? ` · ${p.numAnuladas} anulada(s)` : ''} · Base: ${formatoEuros(p.base)} · IVA: ${formatoEuros(p.iva)}${p.recargo ? ' · Recargo: ' + formatoEuros(p.recargo) : ''}</div>
      <div class="card__products">Cobrado: ${formatoEuros(p.cobrado)} · Pendiente: ${formatoEuros(p.pendiente)}</div>
    </div>
  `).join('');
  document.getElementById('periodoTotalAnual').textContent = `Total del año ${r.data.anio}: ${formatoEuros(r.data.totalAnual)}`;
}

function cablearInformesFacturacion() {
  document.getElementById('btnBuscar347').addEventListener('click', buscarModelo347);
  document.getElementById('btnBuscarPeriodo').addEventListener('click', buscarFacturacionPeriodo);
}
