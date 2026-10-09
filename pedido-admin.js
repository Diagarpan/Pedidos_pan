// Reutiliza la MISMA conexión que la app de gestión (viven en el mismo
// sitio, así que comparten localStorage) — no hace falta volver a pedir
// la URL ni la clave aquí.
const WEB_APP_URL = localStorage.getItem('webAppUrl') || '';
const API_KEY = localStorage.getItem('apiKey') || '';

let clientesCache = [];
let catalogo = [];
let catalogoAgrupado = {};
let carrito = {}; // { productoId: cantidad }
let clienteSeleccionado = null;
let fechaSeleccionada = 'manana';
let tipoSeleccionado = 'factura';
let idPedidoEnEdicion = null; // si ya existía un pedido para ese cliente+fecha

const ORDEN_CATEGORIAS = ['Panadería', 'Dulces', 'Hielo'];

// Solo se reintenta lo que es seguro repetir (leer datos). Crear o editar un pedido NO se
// repite solo: si la respuesta llega rota se avisa de que puede que sí se haya guardado.
const ACCIONES_REINTENTABLES = new Set(['clientes', 'productos', 'pedidoClienteFecha']);

async function apiAdmin(action, extraParams) {
  const params = new URLSearchParams({ action, key: API_KEY, ...(extraParams || {}) });
  const url = `${WEB_APP_URL}?${params.toString()}`;
  const intentos = ACCIONES_REINTENTABLES.has(action) ? 2 : 1;
  let fallo;
  for (let i = 0; i < intentos; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const res = await fetch(url);
      const texto = await res.text();
      try {
        return JSON.parse(texto);
      } catch (e) {
        fallo = new Error('respuesta ilegible');
        fallo.respuestaIlegible = true;
      }
    } catch (e) {
      fallo = e; // sin conexión
    }
  }
  throw fallo;
}

function errorDeRed(err) {
  return err && err.respuestaIlegible
    ? 'No se pudo confirmar. Puede que SÍ se haya guardado: míralo en la app de gestión (Pedidos → Ver pedidos) antes de repetirlo.'
    : 'Sin conexión';
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
  if (!WEB_APP_URL || !API_KEY) {
    mostrarPantalla('sinConfigurar');
    return;
  }

  mostrarPantalla('cliente');
  BuscadorClientes.activar(document.getElementById('selectClienteAdmin'));
  cargarClientesAdmin();

  document.getElementById('btnContinuarAdmin').addEventListener('click', continuarConCliente);
  // El documento habitual del cliente (factura o albarán) se propone al elegirlo, salvo que ya hayas elegido tú uno a mano
  let tipoElegidoAMano = false;
  document.getElementById('selectTipoAdmin').addEventListener('change', () => { tipoElegidoAMano = true; });
  document.getElementById('selectClienteAdmin').addEventListener('change', () => {
    if (tipoElegidoAMano) return;
    const c = clientesCache.find((x) => String(x.id) === String(document.getElementById('selectClienteAdmin').value));
    if (c) document.getElementById('selectTipoAdmin').value = c.documento === 'albaran' ? 'albaran' : 'factura';
  });
  document.getElementById('btnCambiarCliente').addEventListener('click', () => {
    carrito = {};
    idPedidoEnEdicion = null;
    document.getElementById('avisoPedidoExistente').style.display = 'none';
    mostrarPantalla('cliente');
  });
  document.getElementById('btnVolverCategorias').addEventListener('click', () => {
    document.getElementById('vistaProductos').classList.add('tab--hidden');
    document.getElementById('vistaCategorias').classList.remove('tab--hidden');
  });
  document.getElementById('btnVerPedido').addEventListener('click', () => {
    mostrarPantalla('repaso');
    pintarRepaso();
  });
  document.getElementById('btnVolverAlCatalogo').addEventListener('click', () => mostrarPantalla('catalogo'));
  document.getElementById('btnEnviarPedido').addEventListener('click', guardarPedidoAdmin);
  document.getElementById('btnNuevoPedido').addEventListener('click', () => {
    carrito = {};
    idPedidoEnEdicion = null;
    document.getElementById('avisoPedidoExistente').style.display = 'none';
    mostrarPantalla('cliente');
  });
});

function mostrarPantalla(nombre) {
  document.getElementById('pantallaSinConfigurar').classList.toggle('tab--hidden', nombre !== 'sinConfigurar');
  document.getElementById('pantallaCliente').classList.toggle('tab--hidden', nombre !== 'cliente');
  document.getElementById('pantallaCatalogo').classList.toggle('tab--hidden', nombre !== 'catalogo');
  document.getElementById('pantallaRepaso').classList.toggle('tab--hidden', nombre !== 'repaso');
  document.getElementById('pantallaConfirmacion').classList.toggle('tab--hidden', nombre !== 'confirmacion');
}

async function cargarClientesAdmin() {
  const select = document.getElementById('selectClienteAdmin');
  const r = await apiAdmin('clientes').catch(() => null);
  if (!r || !r.ok) { select.innerHTML = '<option value="">No se pudo cargar</option>'; return; }
  clientesCache = r.data;
  select.innerHTML = '<option value="">Elige un cliente…</option>' +
    clientesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
}

async function continuarConCliente() {
  const msg = document.getElementById('msgClienteAdmin');
  const clienteId = document.getElementById('selectClienteAdmin').value;
  fechaSeleccionada = document.getElementById('selectFechaAdmin').value;
  tipoSeleccionado = document.getElementById('selectTipoAdmin').value;

  if (!clienteId) { msg.textContent = 'Elige un cliente.'; msg.className = 'form-msg is-error'; return; }

  clienteSeleccionado = clientesCache.find((c) => String(c.id) === clienteId);
  msg.textContent = '';

  document.getElementById('saludoNombre').textContent = `${tipoSeleccionado === 'albaran' ? 'Albarán' : 'Pedido'} para ${clienteSeleccionado.nombre} — ${fechaSeleccionada === 'hoy' ? 'HOY' : 'mañana'}`;

  mostrarPantalla('catalogo');
  // Las dos peticiones salen a la vez (antes iban una detrás de otra)
  const existente = apiAdmin('pedidoClienteFecha', { clienteId: clienteSeleccionado.id, fecha: fechaFormateada(fechaSeleccionada), tipoDocumento: tipoSeleccionado }).catch(() => null);
  await cargarCatalogoAdmin();
  await precargarPedidoClienteAdmin(existente);
}

async function cargarCatalogoAdmin() {
  const cont = document.getElementById('vistaCategorias');
  cont.innerHTML = '<div class="empty-state">Cargando catálogo…</div>';
  document.getElementById('vistaProductos').classList.add('tab--hidden');
  cont.classList.remove('tab--hidden');

  const r = await apiAdmin('productos').catch(() => null);
  if (!r || !r.ok) { cont.innerHTML = '<div class="empty-state">No se pudo cargar el catálogo.</div>'; return; }

  catalogo = r.data;
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
    if (!a) return -1;
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
        <div class="producto-fila__precio">${formatoEuros(p.precio)}</div>
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
  document.getElementById('repasoTitulo').textContent = `Pedido de ${clienteSeleccionado.nombre}`;
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

// Si este cliente ya tiene un pedido guardado para la fecha elegida,
// se precarga el carrito con lo que ya tenía — así se edita en vez
// de crear uno duplicado.
async function precargarPedidoClienteAdmin(peticionYaLanzada) {
  const fechaStr = fechaFormateada(fechaSeleccionada);
  const r = await (peticionYaLanzada || apiAdmin('pedidoClienteFecha', { clienteId: clienteSeleccionado.id, fecha: fechaStr, tipoDocumento: tipoSeleccionado }).catch(() => null));
  idPedidoEnEdicion = null;
  document.getElementById('avisoPedidoExistente').style.display = 'none';
  if (!r || !r.ok || !r.data.encontrado) return;

  idPedidoEnEdicion = r.data.idPedido;
  carrito = {};
  r.data.items.forEach((it) => {
    if (it.tipo === 'catalogo' && it.productoId) {
      carrito[it.productoId] = (carrito[it.productoId] || 0) + it.cantidad;
    }
  });
  recalcularCarrito();
  document.getElementById('avisoPedidoExistente').style.display = 'block';
}

function fechaFormateada(cuando) {
  const hoy = new Date();
  const d = new Date(hoy);
  if (cuando === 'manana') d.setDate(d.getDate() + 1);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

async function guardarPedidoAdmin() {
  const msg = document.getElementById('msgPedido');
  const items = Object.entries(carrito)
    .filter(([, cant]) => cant > 0)
    .map(([productoId, cantidad]) => ({ productoId, cantidad }));

  if (!items.length) { msg.textContent = 'Añade al menos un producto.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const itemsDetalle = itemsCarrito(); // para el detalle de confirmación

  let r;
  if (idPedidoEnEdicion) {
    r = await apiAdmin('editarPedido', { idPedido: idPedidoEnEdicion, items: JSON.stringify(items) }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  } else {
    r = await apiAdmin('nuevoPedido', { clienteId: clienteSeleccionado.id, items: JSON.stringify(items), fechaEntrega: fechaSeleccionada, tipoDocumento: tipoSeleccionado }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  }

  if (!r.ok) {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
    return;
  }

  document.getElementById('confirmacionTexto').textContent =
    `${tipoSeleccionado === 'albaran' ? 'Albarán' : 'Pedido'} de ${clienteSeleccionado.nombre} guardado para ${fechaSeleccionada === 'hoy' ? 'HOY' : 'mañana'}, por un total de ${formatoEuros(r.total)}.`;
  document.getElementById('confirmacionDetalle').innerHTML = itemsDetalle.map((it) => `
    <div class="client-row"><span>${it.cantidad}x ${escapeHtml(it.producto.nombre)}</span></div>
  `).join('');
  document.getElementById('confirmacionNum').textContent = idPedidoEnEdicion ? `Nº de pedido: ${idPedidoEnEdicion}` : `Nº de pedido: ${r.idPedido}`;
  mostrarPantalla('confirmacion');
}
