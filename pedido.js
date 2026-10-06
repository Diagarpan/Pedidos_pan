// ⚠️ IMPORTANTE: pega aquí la URL de tu Web App de Apps Script
// (Implementar → Gestionar implementaciones → la que termina en /exec).
// Es la MISMA URL que usa la app de gestión, solo que aquí va fija en
// el código porque los clientes no tienen que configurar nada.
const WEB_APP_URL = 'PEGA_AQUI_TU_URL_DEL_WEB_APP';

let telefonoCliente = localStorage.getItem('telefonoCliente') || '';
let nombreCliente = '';
let catalogo = [];
let carrito = {}; // { productoId: cantidad }
let carritoTocado = false;      // ¿el cliente ya ha empezado a añadir cosas?
let categoriaAbierta = null;    // categoría que se está viendo (null = la lista de categorías)
let catalogoDeMemoriaMostrado = false;

// El catálogo (con SUS precios) y el nombre se guardan en el móvil: la próxima vez la app
// los enseña AL INSTANTE y los actualiza por detrás, en vez de esperar a Google.
const CLAVE_MEMORIA_CLIENTE = 'memoriaClienteDA';
function leerMemoriaCliente(tel) {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_MEMORIA_CLIENTE) || 'null');
    return m && m.tel === tel && Array.isArray(m.catalogo) && m.catalogo.length ? m : null;
  } catch (e) { return null; }
}
function guardarMemoriaCliente(tel, nombre, datos) {
  try { localStorage.setItem(CLAVE_MEMORIA_CLIENTE, JSON.stringify({ tel: tel, nombre: nombre, catalogo: datos })); } catch (e) { /* sin espacio: no pasa nada */ }
}
function borrarMemoriaCliente() {
  try { localStorage.removeItem(CLAVE_MEMORIA_CLIENTE); } catch (e) { /* nada */ }
}
let fechaEntregaElegida = 'manana'; // siempre para mañana: se manda cada día

// Si la respuesta llega rota o se corta la conexión, lo que es seguro repetir se reintenta
// solo una vez. Enviar el pedido también lo es: si ya existe uno para mañana, se ACTUALIZA
// (no se duplica).
const ACCIONES_REINTENTABLES = new Set(['clienteIdentificar', 'clienteCatalogo', 'clientePedidoManana', 'clienteCrearPedido']);

async function apiCliente(action, extraParams) {
  const params = new URLSearchParams({ action, ...(extraParams || {}) });
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
    categoriaAbierta = null;
    document.getElementById('vistaProductos').classList.add('tab--hidden');
    document.getElementById('vistaCategorias').classList.remove('tab--hidden');
  });
  document.getElementById('btnVerPedido').addEventListener('click', () => {
    mostrarPantalla('repaso');
    pintarRepaso();
  });
  document.getElementById('btnVolverAlCatalogo').addEventListener('click', () => mostrarPantalla('catalogo'));
  document.getElementById('btnEnviarPedido').addEventListener('click', enviarPedido);
  document.getElementById('btnAnularMiPedido').addEventListener('click', anularMiPedido);
  document.getElementById('btnNuevoPedido').addEventListener('click', async () => {
    carrito = {};
    carritoTocado = false;
    mostrarAvisoPedidoExistente(false);
    mostrarPantalla('catalogo');
    const carga = iniciarCargaCatalogo(telefonoCliente);
    await cargarCatalogo(carga.catalogo, { conservarVista: catalogo.length > 0 });
    await precargarPedidoExistente(carga.existente);
  });

  if (telefonoCliente) arrancarConTelefonoGuardado();
});

// Quien ya entró antes NO ve la pantalla del teléfono: va directo al catálogo (de la memoria
// del móvil si la hay, o con "Cargando…") mientras Google reconoce su teléfono por detrás.
function arrancarConTelefonoGuardado() {
  const memoria = leerMemoriaCliente(telefonoCliente);
  mostrarPantalla('catalogo');
  if (memoria) {
    nombreCliente = memoria.nombre;
    document.getElementById('saludoNombre').textContent = `¿Qué deseas para mañana, ${nombreCliente}?`;
    aplicarCatalogo(memoria.catalogo);
    catalogoDeMemoriaMostrado = true;
  } else {
    document.getElementById('saludoNombre').textContent = '¿Qué deseas para mañana?';
    document.getElementById('vistaCategorias').innerHTML = '<div class="empty-state">Cargando catálogo…</div>';
  }
  identificarCliente(true);
}

// Si no se puede reconocer al cliente al arrancar solo, se le devuelve a la pantalla del teléfono, con el aviso
function volverAPantallaTelefono(texto) {
  mostrarPantalla('telefono');
  document.getElementById('inputTelefono').value = telefonoCliente || '';
  const msg = document.getElementById('msgTelefono');
  msg.textContent = texto;
  msg.className = 'form-msg is-error';
}

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

  // Las tres peticiones salen A LA VEZ (antes iban una detrás de otra). Si el
  // teléfono no está registrado, las otras dos simplemente se descartan.
  const carga = iniciarCargaCatalogo(telefono);
  const r = await apiCliente('clienteIdentificar', { telefono }).catch(() => ({ ok: false }));

  if (!r.ok) {
    if (esAutomatico) { volverAPantallaTelefono('No se pudo conectar. Inténtalo de nuevo en un momento.'); return; }
    msg.textContent = 'No se pudo conectar. Inténtalo de nuevo en un momento.';
    msg.className = 'form-msg is-error';
    return;
  }
  if (!r.encontrado) {
    borrarMemoriaCliente();
    catalogoDeMemoriaMostrado = false;
    if (esAutomatico) { volverAPantallaTelefono('Ese teléfono no está registrado. Contacta con nosotros para darte de alta.'); return; }
    msg.textContent = 'Ese teléfono no está registrado. Contacta con nosotros para darte de alta.';
    msg.className = 'form-msg is-error';
    return;
  }

  telefonoCliente = telefono;
  nombreCliente = r.nombre;
  localStorage.setItem('telefonoCliente', telefono);
  document.getElementById('saludoNombre').textContent = `¿Qué deseas para mañana, ${nombreCliente}?`;

  mostrarPantalla('catalogo');
  await cargarCatalogo(carga.catalogo, { conservarVista: catalogoDeMemoriaMostrado });
  catalogoDeMemoriaMostrado = false;
  await precargarPedidoExistente(carga.existente);
}

// Lanza ya la petición del catálogo (con SUS precios) y la de su pedido de mañana
function iniciarCargaCatalogo(telefono) {
  return {
    catalogo: apiCliente('clienteCatalogo', { telefono }).catch(() => ({ ok: false })),
    existente: apiCliente('clientePedidoManana', { telefono }).catch(() => null),
  };
}

// Si el cliente ya envió un pedido para mañana, se precarga el carrito
// con lo que pidió — así, en vez de duplicarlo, lo ve y lo modifica
// (quita/añade/cambia cantidades) y al enviar se actualiza el mismo
// pedido en vez de crear uno nuevo.
async function precargarPedidoExistente(peticionYaLanzada) {
  const r = await (peticionYaLanzada || apiCliente('clientePedidoManana', { telefono: telefonoCliente }).catch(() => null));
  if (!r || !r.ok || !r.encontrado) return;

  const delPedido = {};
  r.items.forEach((it) => {
    if (it.tipo === 'catalogo' && it.productoId) {
      delPedido[it.productoId] = (delPedido[it.productoId] || 0) + it.cantidad;
    }
  });
  if (carritoTocado) {
    // Ya había empezado a añadir cosas mientras llegaba su pedido: se conserva lo que ha tocado
    // y se añade lo que ya tenía pedido (puede quitarlo en la revisión).
    Object.keys(delPedido).forEach((id) => { if (carrito[id] === undefined) carrito[id] = delPedido[id]; });
  } else {
    carrito = delPedido;
  }
  recalcularCarrito();
  if (categoriaAbierta) abrirCategoria(categoriaAbierta);   // si está mirando productos, se ven ya las cantidades
  mostrarAvisoPedidoExistente(true);
}

// Muestra/oculta el aviso de "ya tienes un pedido" y el botón de anularlo (van juntos)
function mostrarAvisoPedidoExistente(visible) {
  document.getElementById('avisoPedidoExistente').style.display = visible ? 'block' : 'none';
  document.getElementById('btnAnularMiPedido').style.display = visible ? 'block' : 'none';
}

// El cliente anula su pedido de mañana (hasta las 22:00, lo comprueba el servidor)
async function anularMiPedido() {
  if (!confirm('¿Seguro que quieres anular tu pedido de mañana?')) return;
  const r = await apiCliente('clienteAnularPedido', { telefono: telefonoCliente }).catch(() => ({ ok: false, error: 'Sin conexión' }));
  if (!r.ok) { alert(r.error || 'No se ha podido anular. Inténtalo de nuevo.'); return; }
  carrito = {};
  carritoTocado = false;
  mostrarAvisoPedidoExistente(false);
  recalcularCarrito();
  mostrarPantalla('catalogo');
  await cargarCatalogo(undefined, { conservarVista: catalogo.length > 0 });
  alert('Tu pedido de mañana se ha anulado. Si quieres, puedes hacer otro hasta las 22:00.');
}

function olvidarTelefono() {
  localStorage.removeItem('telefonoCliente');
  borrarMemoriaCliente();
  telefonoCliente = '';
  catalogo = [];
  catalogoAgrupado = {};
  categoriaAbierta = null;
  catalogoDeMemoriaMostrado = false;
  carrito = {};
  carritoTocado = false;
  document.getElementById('inputTelefono').value = '';
  document.getElementById('msgTelefono').textContent = '';
  mostrarAvisoPedidoExistente(false);
  mostrarPantalla('telefono');
}

const ORDEN_CATEGORIAS = ['Panadería', 'Dulces', 'Hielo'];
let catalogoAgrupado = {};

async function cargarCatalogo(peticionYaLanzada, opciones) {
  const cont = document.getElementById('vistaCategorias');
  // Si ya se está enseñando un catálogo (el de la memoria del móvil), se deja a la vista mientras llega el actualizado
  const conservarVista = !!(opciones && opciones.conservarVista) && catalogo.length > 0;
  if (!conservarVista) {
    cont.innerHTML = '<div class="empty-state">Cargando catálogo…</div>';
    document.getElementById('vistaProductos').classList.add('tab--hidden');
    cont.classList.remove('tab--hidden');
    categoriaAbierta = null;
  }

  const r = await (peticionYaLanzada || apiCliente('clienteCatalogo', { telefono: telefonoCliente }).catch(() => ({ ok: false })));
  if (!r.ok) {
    if (!conservarVista) cont.innerHTML = '<div class="empty-state">No se pudo cargar el catálogo. Recarga la página.</div>';
    return; // con el de la memoria se sigue; al enviar el pedido el servidor aplica los precios de verdad
  }
  aplicarCatalogo(r.data);
  guardarMemoriaCliente(telefonoCliente, nombreCliente, r.data);
}

// Pone un catálogo en pantalla (el de la memoria del móvil o el que acaba de llegar de Google)
// sin molestar: si el cliente está viendo una categoría, se queda en ella y su carrito no se toca.
function aplicarCatalogo(datos) {
  catalogo = datos;
  catalogoAgrupado = {};
  catalogo.forEach((p) => {
    const cat = p.categoria || 'Panadería';
    const sub = p.subcategoria || '';
    if (!catalogoAgrupado[cat]) catalogoAgrupado[cat] = {};
    if (!catalogoAgrupado[cat][sub]) catalogoAgrupado[cat][sub] = [];
    catalogoAgrupado[cat][sub].push(p);
  });

  if (categoriaAbierta && catalogoAgrupado[categoriaAbierta]) {
    abrirCategoria(categoriaAbierta);
  } else {
    categoriaAbierta = null;
    document.getElementById('vistaProductos').classList.add('tab--hidden');
    document.getElementById('vistaCategorias').classList.remove('tab--hidden');
    pintarCategorias();
  }
  recalcularCarrito();
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
  categoriaAbierta = cat;
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
      carritoTocado = true;
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
  itemsCarrito().forEach((it) => { total += it.producto.precio * it.cantidad * (1 + it.producto.iva + (it.producto.recargo || 0)); });
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
        <span>${it.cantidad}x ${escapeHtml(it.producto.nombre)} — ${formatoEuros(it.producto.precio * it.cantidad * (1 + it.producto.iva + (it.producto.recargo || 0)))}</span>
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
  }).catch((err) => ({
    ok: false,
    error: err && err.respuestaIlegible
      ? 'No hemos podido confirmar tu pedido. Puede que SÍ se haya enviado: vuelve a abrir la app y mira "Tu pedido de mañana" antes de repetirlo.'
      : 'Sin conexión',
  }));

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
