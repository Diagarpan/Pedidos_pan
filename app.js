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
  aplicarTemaGuardado();
  const vinoDeEnlace = aplicarConfigDesdeURL();
  pintarFecha();
  registrarServiceWorker();
  cablearNavegacion();
  cablearAjustes();
  cablearTema();
  cablearNuevoPedido();
  cablearFacturaDirecta();
  cablearClientes();
  cablearClientesForm();
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
  document.querySelectorAll('.home-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
  });
  document.querySelectorAll('.sidebar__item[data-tab]').forEach((btn) => {
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
  if (activo === 'factura-crear') cargarFormularioFactura();
  if (activo === 'factura-resumen') prepararResumenFacturas();
  if (activo === 'factura-por-cliente') prepararFacturaPorCliente();
  if (activo === 'empresa') cargarEmpresa();
  if (activo === 'productos') cargarProductosGestion();
  if (activo === 'estadisticas') prepararEstadisticas();
}

function pintarInicio() {
  document.getElementById('homeSub').textContent =
    ROL === 'repartidor' ? `Repartidor · Ruta ${RUTA}` : 'Administración';
}

/* ============ AJUSTES / CONEXIÓN ============ */
function cablearAjustes() {
  document.getElementById('btnAjustes').addEventListener('click', abrirAjustes);
  document.getElementById('btnAjustesSidebar').addEventListener('click', abrirAjustes);

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

  const esAyer = offsetRepartoSeleccionado < 0;
  contClientes.innerHTML = data.clientes.map((c) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(c.cliente)}</div>
          <div class="card__meta">${escapeHtml(c.fecha || '')}${c.hora ? ' · ' + escapeHtml(c.hora) : ''}${c.ruta ? ' · Ruta ' + escapeHtml(c.ruta) : ''}</div>
        </div>
        ${esAyer ? stampHtml(c.entregado ? 'Entregado' : 'No entregado') : ''}
      </div>
      <div class="card__products">${escapeHtml(c.productos)}</div>
      ${esAyer && c.entregado && c.horaEntrega ? `<div class="card__meta" style="margin-top:6px;">Entregado a las ${escapeHtml(c.horaEntrega)}</div>` : ''}
    </div>
  `).join('');
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
    d.sinPedido.map((c) => `
      <div class="client-row">
        <span>${escapeHtml(c.nombre)}</span>
        ${c.telefono ? `<a class="chip-btn" href="https://wa.me/34${String(c.telefono).replace(/\D/g, '')}" target="_blank" rel="noopener">Avisar</a>` : ''}
      </div>
    `).join('');
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
        ${ROL === 'admin' ? `<button class="chip-btn" data-accion="anular" data-id="${p.id}" style="border-color:var(--warn-red); color:var(--warn-red);">Anular</button>` : ''}
      </div>
    </div>
  `;
  }).join('');

  cont.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.accion;
      if (accion === 'entregado' || accion === 'cobrado') {
        cambiarEstadoPedido(btn.dataset.id, accion);
      } else if (accion === 'anular') {
        anularPedido(btn.dataset.id);
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
    const estado = p.cobrado ? 'Cobrado' : p.entregado ? 'Entregado' : 'Pendiente';
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

  if (!r.data.facturas.length) {
    cont.innerHTML = '<div class="empty-state">Sin facturas en ese periodo.</div>';
    document.getElementById('resumenFacturasTotal').textContent = '';
    return;
  }

  cont.innerHTML = r.data.facturas.map((f) => `
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
      ${f.estado !== 'Cobrado' ? `<div class="card__actions"><button class="chip-btn" data-ver-factura="${f.idFactura}">Ver factura</button><button class="chip-btn" data-marcar-cobrada="${f.idFactura}">Marcar cobrada</button></div>` : `<div class="card__actions"><button class="chip-btn" data-ver-factura="${f.idFactura}">Ver factura</button></div>`}
    </div>
  `).join('');
  document.getElementById('resumenFacturasTotal').textContent = `Total periodo: ${formatoEuros(r.data.total)}`;
  cont.querySelectorAll('[data-marcar-cobrada]').forEach((btn) => {
    btn.addEventListener('click', () => marcarFacturaCobrada(btn.dataset.marcarCobrada, buscarResumenFacturas));
  });
  cont.querySelectorAll('[data-ver-factura]').forEach((btn) => {
    btn.addEventListener('click', () => verFacturaPDF(btn.dataset.verFactura));
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
        ${f.estado !== 'Cobrado' ? `<button class="chip-btn" data-marcar-cobrada="${f.idFactura}">Marcar cobrada</button>` : ''}
      </div>
    </div>
  `).join('');
  document.getElementById('facturaPorClienteTotal').textContent = `Total periodo: ${formatoEuros(r.data.total)}`;
  cont.querySelectorAll('[data-marcar-cobrada]').forEach((btn) => {
    btn.addEventListener('click', () => marcarFacturaCobrada(btn.dataset.marcarCobrada, buscarFacturaPorCliente));
  });
  cont.querySelectorAll('[data-ver-factura]').forEach((btn) => {
    btn.addEventListener('click', () => verFacturaPDF(btn.dataset.verFactura));
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
  fechaPedidoSeleccion = 'hoy';
  document.getElementById('selectFechaPedido').value = 'hoy';
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

/* ============ FACTURAS DIRECTAS (sin pedido) ============ */
let facturaNueva = {};

function cablearFacturaDirecta() {
  document.getElementById('btnCrearFactura').addEventListener('click', crearFacturaDirecta);
}

async function cargarFormularioFactura() {
  const selectCliente = document.getElementById('selectClienteFactura');
  const contProductos = document.getElementById('listaProductosFactura');

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

  facturaNueva = {};
  contProductos.innerHTML = productosCache.map((p) => `
    <div class="product-row">
      <div>
        <div class="product-row__name">${escapeHtml(p.nombre)}</div>
        <div class="product-row__price">${formatoEuros(p.precio)} · IVA ${(p.iva * 100).toFixed(0)}%</div>
      </div>
      <div class="stepper">
        <button class="stepper__btn" data-accion="menos" data-id="${p.id}">−</button>
        <span class="stepper__val" id="cant-f-${p.id}">0</span>
        <button class="stepper__btn" data-accion="mas" data-id="${p.id}">+</button>
      </div>
    </div>
  `).join('');

  contProductos.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const delta = btn.dataset.accion === 'mas' ? 1 : -1;
      facturaNueva[id] = Math.max(0, (facturaNueva[id] || 0) + delta);
      document.getElementById(`cant-f-${id}`).textContent = facturaNueva[id];
      recalcularTotalFactura();
    });
  });

  recalcularTotalFactura();
  document.getElementById('facturaMsg').textContent = '';
}

function recalcularTotalFactura() {
  let total = 0;
  Object.entries(facturaNueva).forEach(([id, cant]) => {
    if (cant > 0) {
      const p = productosCache.find((pr) => String(pr.id) === String(id));
      if (p) total += p.precio * cant * (1 + p.iva);
    }
  });
  document.getElementById('facturaTotal').textContent = formatoEuros(total);
}

async function crearFacturaDirecta() {
  const msg = document.getElementById('facturaMsg');
  const clienteId = document.getElementById('selectClienteFactura').value;
  const items = Object.entries(facturaNueva)
    .filter(([, cant]) => cant > 0)
    .map(([productoId, cantidad]) => ({ productoId, cantidad }));

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

/* ============ ANULAR PEDIDO ============ */
async function anularPedido(idPedido) {
  if (!confirm('¿Seguro que quieres anular este pedido? Se borrará también su factura. Esto no se puede deshacer.')) return;
  const r = await apiGet('anularPedido', { idPedido }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { alert('No se pudo anular: ' + (r.error || 'error')); return; }
  cargarPedidos();
}

/* ============ HOJA DE RUTA ============ */
function cablearHojaRuta() {
  document.getElementById('btnHojaRuta').addEventListener('click', async () => {
    const r = await apiGet('hojaRutaPdf', { fecha: fechaOffsetDDMMYYYY(offsetRepartoSeleccionado) }).catch((err) => ({ ok: false, error: String(err) }));
    if (!r.ok) { alert('No se pudo generar: ' + (r.error || 'error')); return; }
    descargarPDF(r.base64, r.nombre);
  });
  document.getElementById('btnResumenDia').addEventListener('click', async () => {
    const r = await apiGet('resumenDiaPdf', { fecha: fechaOffsetDDMMYYYY(offsetRepartoSeleccionado) }).catch((err) => ({ ok: false, error: String(err) }));
    if (!r.ok) { alert('No se pudo generar: ' + (r.error || 'error')); return; }
    descargarPDF(r.base64, r.nombre);
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
          <div class="card__meta">${p.codigo ? escapeHtml(p.codigo) + ' · ' : ''}${formatoEuros(p.precio)} · IVA ${(p.iva * 100).toFixed(0)}%</div>
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
  document.getElementById('btnEditarCliente').addEventListener('click', () => abrirFormularioCliente(clienteSeleccionado));
  document.getElementById('btnGuardarCliente').addEventListener('click', guardarCliente);
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
