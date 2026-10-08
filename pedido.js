// ⚠️ IMPORTANTE: pega aquí la URL de tu Web App de Apps Script
// (Implementar → Gestionar implementaciones → la que termina en /exec).
// Es la MISMA URL que usa la app de gestión, solo que aquí va fija en
// el código porque los clientes no tienen que configurar nada.
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwirzOGAOMLbaV3DLDNeLAaYg1W3-OnfCnh05NdGpA8a6Gq3dAKJv6s1MV9Kw2kmuI/exec';

// Versión de esta app (aparece en el diagnóstico, para saber qué copia tiene cada cliente)
const VERSION_APP = '2026.10.9';
// ¿Está pegada la URL del servidor? (cualquier dirección de script.google.com; solo se queja si sigue el texto de relleno)
const URL_CONFIGURADA = /^https:\/\/script\.google\.com\//.test(WEB_APP_URL) && WEB_APP_URL.indexOf('PEGA_AQUI') === -1;
const TIEMPO_MAXIMO_MS = 12000;            // lecturas
const TIEMPO_MAXIMO_ESCRITURA_MS = 45000;   // guardar un pedido puede tardar mucho más (el servidor hace unas 40 operaciones en la hoja) // si Google no contesta en este tiempo, se avisa (antes se quedaba cargando para siempre)

// El almacenamiento del móvil puede estar bloqueado (iPhone con "bloquear cookies", navegadores
// integrados…): en ese caso la app sigue funcionando, solo que no recuerda el teléfono.
const almacen = {
  leer: function (clave) { try { return window.localStorage.getItem(clave); } catch (e) { return null; } },
  guardar: function (clave, valor) { try { window.localStorage.setItem(clave, valor); return true; } catch (e) { return false; } },
  borrar: function (clave) { try { window.localStorage.removeItem(clave); } catch (e) { /* nada */ } },
  funciona: function () { try { window.localStorage.setItem('_prueba', '1'); window.localStorage.removeItem('_prueba'); return true; } catch (e) { return false; } },
};

let telefonoCliente = almacen.leer('telefonoCliente') || '';
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
    const m = JSON.parse(almacen.leer(CLAVE_MEMORIA_CLIENTE) || 'null');
    return m && m.tel === tel && Array.isArray(m.catalogo) && m.catalogo.length ? m : null;
  } catch (e) { return null; }
}
function guardarMemoriaCliente(tel, nombre, datos) {
  almacen.guardar(CLAVE_MEMORIA_CLIENTE, JSON.stringify({ tel: tel, nombre: nombre, catalogo: datos }));
}
function borrarMemoriaCliente() {
  almacen.borrar(CLAVE_MEMORIA_CLIENTE);
}
let fechaEntregaElegida = 'manana'; // siempre para mañana: se manda cada día

// Lo que es seguro repetir se reintenta solo UNA vez si falla (enviar el pedido también lo es: si ya
// existe uno para mañana, se ACTUALIZA, no se duplica).
const ACCIONES_REINTENTABLES = new Set(['clienteInicio', 'clienteIdentificar', 'clienteCatalogo', 'clientePedidoManana']);

// Cada fallo tiene su causa y su código (C1…C8), para que el cliente y la panadería sepan qué pasa
function crearError(tipo) { const e = new Error(tipo); e.tipo = tipo; return e; }
function describirError(err) {
  switch (err && err.tipo) {
    case 'sin-configurar': return { codigo: 'C1', texto: 'La aplicación no está bien configurada (falta la dirección del servidor). Avisa a la panadería.' };
    case 'sin-conexion': return { codigo: 'C2', texto: 'No hay conexión con Internet. Comprueba tu cobertura o el wifi y vuelve a intentarlo.' };
    case 'tiempo': return { codigo: 'C3', texto: 'La conexión va muy lenta y no hemos podido cargar tus datos. Inténtalo de nuevo.' };
    case 'ilegible': return { codigo: 'C4', texto: 'El servidor no ha respondido bien (puede estar muy ocupado). Inténtalo de nuevo en un minuto.' };
    case 'navegador-antiguo': return { codigo: 'C8', texto: 'Tu navegador es demasiado antiguo para esta aplicación. Actualízalo o prueba con otro (Chrome o Safari).' };
    default: return { codigo: 'C5', texto: 'No se ha podido conectar. Inténtalo de nuevo en un momento.' };
  }
}
// Cuando el servidor SÍ contesta pero con un error (por ejemplo, está a medio actualizar)
function describirRespuesta(r) {
  if (r && r.tipoError === 'desactualizado') return { codigo: 'C6', texto: 'Estamos actualizando la aplicación. Vuelve a intentarlo en unos minutos.' };
  if (r && r.tipoError === 'servidor') return { codigo: 'C7', texto: 'El servidor ha tenido un problema. Inténtalo de nuevo en un momento.' };
  return null;
}
let ultimoErrorCodigo = '';
let ultimoErrorHora = 0;
function anotarError(d) { ultimoErrorCodigo = d.codigo; ultimoErrorHora = Date.now(); return d; }
const conCodigo = (d) => d.texto + ' (' + d.codigo + ')';

function pedirTexto(url, tiempoMaximo) {
  return new Promise(function (resolve, reject) {
    let terminado = false;
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    const temporizador = setTimeout(function () {
      if (terminado) return;
      terminado = true;
      if (control) { try { control.abort(); } catch (e) { /* nada */ } }
      reject(crearError('tiempo'));
    }, tiempoMaximo || TIEMPO_MAXIMO_MS);
    fetch(url, control ? { signal: control.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (texto) { if (terminado) return; terminado = true; clearTimeout(temporizador); resolve(texto); })
      .catch(function () { if (terminado) return; terminado = true; clearTimeout(temporizador); reject(crearError('sin-conexion')); });
  });
}

async function apiCliente(action, extraParams, opciones) {
  if (!URL_CONFIGURADA) throw crearError('sin-configurar');
  if (typeof fetch !== 'function') throw crearError('navegador-antiguo');
  // "_" distinto en cada petición: el móvil o Google nunca reutilizan una respuesta guardada de antes
  const url = WEB_APP_URL + '?' + new URLSearchParams(Object.assign({ action: action }, extraParams || {}, { _: String(Date.now()) })).toString();
  const intentos = ACCIONES_REINTENTABLES.has(action) ? 2 : 1;
  let fallo;
  for (let i = 0; i < intentos; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const texto = await pedirTexto(url, opciones && opciones.tiempoMaximo);
      try {
        return JSON.parse(texto);
      } catch (e) {
        fallo = crearError('ilegible');
        fallo.respuestaIlegible = true;
      }
    } catch (e) {
      fallo = e && e.tipo ? e : crearError('sin-conexion');
      if (fallo.tipo === 'tiempo') fallo.respuestaIlegible = true; // pudo llegar al servidor aunque no volviera la respuesta
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
  cablearDiagnostico();
  if (!URL_CONFIGURADA) mostrarAvisoConexion(anotarError(describirError({ tipo: 'sin-configurar' })), false);
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
    const carga = cargarEntrada(telefonoCliente);
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
    // si tarda, se le dice (no es que se haya colgado)
    temporizadorLentoArranque = setTimeout(() => {
      if (!catalogo.length && document.getElementById('avisoConexion').classList.contains('tab--hidden')) {
        document.getElementById('vistaCategorias').innerHTML = '<div class="empty-state">Sigue cargando… la conexión va un poco lenta. Un momento.</div>';
      }
    }, 6000);
  }
  identificarCliente(true);
}
let temporizadorLentoArranque = null;

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

// Al teclear el teléfono: el botón se bloquea mientras comprueba (si no, cada toque lanza otra petición y todo va
// más lento) y, si tarda, se le dice por qué. Al entrar solo (teléfono guardado) no hace falta nada de esto.
async function identificarCliente(esAutomatico) {
  if (esAutomatico) return identificarClienteInterno(true);
  const boton = document.getElementById('btnContinuar');
  const msg = document.getElementById('msgTelefono');
  if (boton.disabled) return;
  boton.disabled = true;
  const lento = setTimeout(() => {
    if (/^Comprobando/.test(msg.textContent)) msg.textContent = 'Sigue comprobando… la primera vez del día puede tardar unos segundos. No hace falta pulsar otra vez.';
  }, 6000);
  try {
    await identificarClienteInterno(false);
  } finally {
    clearTimeout(lento);
    boton.disabled = false;
  }
}

async function identificarClienteInterno(esAutomatico) {
  const msg = document.getElementById('msgTelefono');
  const telefono = esAutomatico ? telefonoCliente : document.getElementById('inputTelefono').value.trim();

  if (!telefono) { msg.textContent = 'Escribe tu teléfono.'; msg.className = 'form-msg is-error'; return; }

  if (!esAutomatico) {
    msg.textContent = 'Comprobando…';
    msg.className = 'form-msg';
  }
  ocultarAvisoConexion();

  // Una sola petición trae todo (si el teléfono no está registrado, solo trae eso).
  const carga = cargarEntrada(telefono);
  const r = await carga.identificar;

  if (!r.ok) {
    const d = anotarError(r._err ? describirError(r._err) : (describirRespuesta(r) || describirError(null)));
    if (esAutomatico) { mostrarErrorDeCarga(d); return; }
    msg.textContent = conCodigo(d);
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
  almacen.guardar('telefonoCliente', telefono);
  document.getElementById('saludoNombre').textContent = `¿Qué deseas para mañana, ${nombreCliente}?`;

  mostrarPantalla('catalogo');
  await cargarCatalogo(carga.catalogo, { conservarVista: catalogoDeMemoriaMostrado });
  catalogoDeMemoriaMostrado = false;
  await precargarPedidoExistente(carga.existente);
}

// Aviso de conexión: se ve en cualquier pantalla, con el motivo y un botón para reintentar
function mostrarAvisoConexion(d, conReintento) {
  const aviso = document.getElementById('avisoConexion');
  aviso.innerHTML = '<div>⚠ ' + escapeHtml(conCodigo(d)) + '</div>' +
    (conReintento ? '<button type="button" class="btn-secondary" id="btnReintentar" style="width:100%; margin-top:8px;">Reintentar</button>' : '');
  aviso.classList.remove('tab--hidden');
  if (conReintento) document.getElementById('btnReintentar').addEventListener('click', reintentarCarga);
}
function ocultarAvisoConexion() { document.getElementById('avisoConexion').classList.add('tab--hidden'); }
function reintentarCarga() {
  ocultarAvisoConexion();
  const cont = document.getElementById('vistaCategorias');
  if (!catalogo.length) cont.innerHTML = '<div class="empty-state">Cargando catálogo…</div>';
  identificarCliente(true);
}

// No se ha podido cargar: si ya se está viendo el catálogo de la memoria del móvil, se deja y se avisa;
// si no, se explica la causa en su sitio, con el botón de reintentar (antes: "Cargando…" para siempre)
function mostrarErrorDeCarga(d) {
  if (temporizadorLentoArranque) { clearTimeout(temporizadorLentoArranque); temporizadorLentoArranque = null; }
  catalogoDeMemoriaMostrado = false;
  mostrarPantalla('catalogo');
  if (catalogo.length) { mostrarAvisoConexion(d, true); return; }
  document.getElementById('vistaCategorias').innerHTML = '<div class="empty-state"></div>';
  mostrarAvisoConexion(d, true);
  document.getElementById('vistaCategorias').firstChild.textContent = 'No se ha podido cargar el catálogo.';
}

// UNA sola petición para entrar: reconoce al cliente y trae su catálogo (con SUS precios) y su pedido de mañana.
// Antes eran tres a la vez: tres ejecuciones en Google, que se pisaban entre sí y entre los demás clientes (y a
// Google no le gusta). Si el servidor aún es el antiguo (no conoce "clienteInicio"), se usan las tres de siempre.
let servidorSinInicio = false;

function cargarEntrada(telefono) {
  const antigua = () => ({
    identificar: apiCliente('clienteIdentificar', { telefono: telefono }).catch((err) => ({ ok: false, _err: err })),
    catalogo: apiCliente('clienteCatalogo', { telefono: telefono }).catch((err) => ({ ok: false, _err: err })),
    existente: apiCliente('clientePedidoManana', { telefono: telefono }).catch(() => null),
  });
  if (servidorSinInicio) return antigua();

  const todo = apiCliente('clienteInicio', { telefono: telefono })
    .then((r) => {
      if (r && r.identificar) return { nuevo: r };
      // servidor antiguo: no conoce la acción y la trata como una petición de administrador
      if (r && /clave|acci[oó]n/i.test(String(r.error || ''))) { servidorSinInicio = true; return { antigua: antigua() }; }
      return { error: r || { ok: false } };    // el servidor contestó con un error
    })
    .catch((err) => ({ error: { ok: false, _err: err } }));

  const parte = (nombre) => todo.then((x) => {
    if (x.nuevo) return nombre === 'existente' ? (x.nuevo.existente || null) : (x.nuevo[nombre] || { ok: false, error: 'Respuesta incompleta del servidor.' });
    if (x.antigua) return x.antigua[nombre];
    return nombre === 'existente' ? null : x.error;
  });
  return { identificar: parte('identificar'), catalogo: parte('catalogo'), existente: parte('existente') };
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
  describirPedidoExistente(r, delPedido);
}

// Dice QUÉ tiene guardado el servidor (productos, cantidades y total), para que el cliente no tenga dudas
function describirPedidoExistente(r, delPedido) {
  const resumen = Object.keys(delPedido).map((id) => {
    const prod = catalogo.find((x) => String(x.id) === String(id));
    return delPedido[id] + '× ' + (prod ? prod.nombre : 'producto');
  }).join(', ');
  const aviso = document.getElementById('avisoPedidoExistente');
  aviso.innerHTML = '✏️ <strong>Tu pedido de mañana</strong>' + (r.idPedido ? ' (nº ' + escapeHtml(String(r.idPedido)) + ')' : '') + ': ' + escapeHtml(resumen) +
    (typeof r.total === 'number' && r.total > 0 ? ' — ' + escapeHtml(formatoEuros(r.total)) : '') +
    '.<br>Puedes añadir, quitar o cambiar cantidades y volver a enviarlo.';
}

// Muestra/oculta el aviso de "ya tienes un pedido" y el botón de anularlo (van juntos)
function mostrarAvisoPedidoExistente(visible) {
  document.getElementById('avisoPedidoExistente').style.display = visible ? 'block' : 'none';
  document.getElementById('btnAnularMiPedido').style.display = visible ? 'block' : 'none';
}

// El cliente anula su pedido de mañana (hasta las 22:00, lo comprueba el servidor)
async function anularMiPedido() {
  if (!confirm('¿Seguro que quieres anular tu pedido de mañana?')) return;
  const r = await apiCliente('clienteAnularPedido', { telefono: telefonoCliente }).catch((err) => ({ ok: false, error: conCodigo(anotarError(describirError(err))) }));
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
  almacen.borrar('telefonoCliente');
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
  let temporizadorLento = null;
  if (!conservarVista) {
    cont.innerHTML = '<div class="empty-state">Cargando catálogo…</div>';
    document.getElementById('vistaProductos').classList.add('tab--hidden');
    cont.classList.remove('tab--hidden');
    categoriaAbierta = null;
    // si tarda, se le dice (no es que se haya colgado)
    temporizadorLento = setTimeout(() => { if (!catalogo.length) cont.innerHTML = '<div class="empty-state">Sigue cargando… la conexión va un poco lenta. Un momento.</div>'; }, 6000);
  }

  const r = await (peticionYaLanzada || apiCliente('clienteCatalogo', { telefono: telefonoCliente }).catch((err) => ({ ok: false, _err: err })));
  if (temporizadorLento) clearTimeout(temporizadorLento);
  if (!r.ok) {
    // con el catálogo de la memoria se sigue; al enviar el pedido el servidor aplica los precios de verdad
    mostrarErrorDeCarga(anotarError(r._err ? describirError(r._err) : (describirRespuesta(r) || describirError(null))));
    return;
  }
  aplicarCatalogo(r.data);
  guardarMemoriaCliente(telefonoCliente, nombreCliente, r.data);
}

// Pone un catálogo en pantalla (el de la memoria del móvil o el que acaba de llegar de Google)
// sin molestar: si el cliente está viendo una categoría, se queda en ella y su carrito no se toca.
function aplicarCatalogo(datos) {
  if (temporizadorLentoArranque) { clearTimeout(temporizadorLentoArranque); temporizadorLentoArranque = null; }
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

// ¿Es el pedido que el servidor tiene guardado el MISMO que hemos mandado? (mismos productos y cantidades)
function mismoPedido(items, existente) {
  if (!existente || !existente.ok || !existente.encontrado) return false;
  const mandado = {};
  items.forEach((i) => { mandado[i.productoId] = (mandado[i.productoId] || 0) + i.cantidad; });
  const guardado = {};
  let hayOtrosProductos = false;
  (existente.items || []).forEach((i) => {
    if (i.tipo === 'catalogo') guardado[i.productoId] = (guardado[i.productoId] || 0) + i.cantidad; else hayOtrosProductos = true;
  });
  if (hayOtrosProductos) return false;
  const claves = Object.keys(mandado);
  return claves.length === Object.keys(guardado).length && claves.every((k) => guardado[k] === mandado[k]);
}

// Cuando no sabemos si el pedido llegó (Google tardó o la respuesta se perdió) NO se vuelve a mandar: se COMPRUEBA
// leyendo si el servidor ya lo tiene. Mientras guarda (puede tardar) se mira cada pocos segundos.
async function comprobarSiSeGuardo(items, msg) {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    msg.textContent = 'Estamos comprobando que tu pedido ha llegado… (' + (i + 1) + ')';
    const e = await apiCliente('clientePedidoManana', { telefono: telefonoCliente }).catch(() => null);
    if (mismoPedido(items, e)) return e;
  }
  return null;
}

let enviandoPedido = false;

async function enviarPedido() {
  if (enviandoPedido) return;   // segundo toque mientras envía: se ignora
  const msg = document.getElementById('msgPedido');
  const boton = document.getElementById('btnEnviarPedido');
  const itemsDetalle = itemsCarrito(); // se guarda antes de limpiar, para poder mostrarlo en la confirmación
  const items = itemsDetalle.map((it) => ({ productoId: it.producto.id, cantidad: it.cantidad }));

  if (!items.length) { msg.textContent = 'Añade al menos un producto.'; msg.className = 'form-msg is-error'; return; }

  enviandoPedido = true;
  boton.disabled = true;
  msg.textContent = 'Enviando tu pedido… puede tardar unos segundos. No cierres la app.';
  msg.className = 'form-msg';
  const lento = setTimeout(() => { msg.textContent = 'Sigue enviando… Google va un poco lento. No cierres la app ni pulses otra vez.'; }, 8000);

  try {
    let r = await apiCliente('clienteCrearPedido', {
      telefono: telefonoCliente,
      items: JSON.stringify(items),
      fechaEntrega: fechaEntregaElegida,
    }, { tiempoMaximo: TIEMPO_MAXIMO_ESCRITURA_MS }).catch((err) => ({ ok: false, _err: err }));

    if (!r.ok && r._err) {
      // No sabemos si llegó: se comprueba (sin volver a mandar nada)
      const d = anotarError(describirError(r._err));
      msg.textContent = 'Estamos comprobando que tu pedido ha llegado…';
      const guardado = await comprobarSiSeGuardo(items, msg);
      if (guardado) {
        r = { ok: true, idPedido: guardado.idPedido, total: guardado.total, comprobado: true };
      } else {
        msg.textContent = 'No hemos podido confirmar que tu pedido haya llegado (' + d.texto.replace(/\.$/, '') + ' ' + d.codigo + '). ' +
          'Pulsa «Enviar pedido» otra vez: es seguro, tu pedido de mañana se sustituye, no se duplica.';
        msg.className = 'form-msg is-error';
        return;
      }
    }

    if (!r.ok) {
      const dr = describirRespuesta(r);
      msg.textContent = dr ? conCodigo(anotarError(dr)) : 'Error: ' + (r.error || 'inténtalo de nuevo');
      msg.className = 'form-msg is-error';
      return;
    }

    document.getElementById('confirmacionDetalle').innerHTML = itemsDetalle.map((it) => `
      <div class="client-row"><span>${it.cantidad}x ${escapeHtml(it.producto.nombre)}</span></div>
    `).join('');

    const total = typeof r.total === 'number' ? `, por un total de ${formatoEuros(r.total)}` : '';
    document.getElementById('confirmacionTexto').textContent =
      `Gracias, ${nombreCliente}. Hemos recibido tu pedido para mañana${total}.${r.comprobado ? ' (Hemos comprobado que está guardado.)' : ''}`;
    document.getElementById('confirmacionNum').textContent = r.idPedido ? `Nº de pedido: ${r.idPedido}` : '';
    mostrarPantalla('confirmacion');
  } finally {
    clearTimeout(lento);
    enviandoPedido = false;
    boton.disabled = false;
  }
}

/* ============ DIAGNÓSTICO: "no me carga" ============
 * El cliente lo abre, pulsa Comprobar y le manda una captura a la panadería: se ve de un vistazo
 * si falla la configuración, el móvil, la conexión o el servidor. */
async function ejecutarDiagnostico() {
  const pantalla = document.getElementById('diagnosticoTexto');
  pantalla.textContent = 'Comprobando…';
  const lineas = [];
  const ok = (t) => '✓ ' + t, mal = (t) => '✗ ' + t;
  lineas.push('Versión de la app: ' + VERSION_APP);
  lineas.push(URL_CONFIGURADA ? ok('Dirección del servidor: configurada') : mal('Dirección del servidor: FALTA configurarla (C1)'));
  lineas.push(almacen.funciona() ? ok('Memoria del móvil: funciona') : mal('Memoria del móvil: bloqueada (no recordará tu teléfono, pero puedes pedir)'));
  lineas.push(typeof navigator.onLine === 'boolean' && !navigator.onLine ? mal('Internet: el móvil dice que no hay conexión') : ok('Internet: conectado'));
  lineas.push('Teléfono guardado: ' + (telefonoCliente ? 'sí (termina en ' + String(telefonoCliente).replace(/\D/g, '').slice(-3) + ')' : 'no'));

  if (URL_CONFIGURADA) {
    const t0 = Date.now();
    try {
      const r = await apiCliente('ping');
      const ms = Date.now() - t0;
      if (r && r.ok) {
        lineas.push(ok('Servidor: responde en ' + ms + ' ms · versión ' + r.version));
        lineas.push(r.coherente ? ok('Servidor: archivos al día') : mal('Servidor: a medio actualizar (' + (r.faltan || []).length + ' piezas)'));
      } else {
        lineas.push(mal('Servidor: responde pero no entiende la comprobación (' + (r && r.error ? String(r.error).slice(0, 60) : 'sin detalle') + ')'));
      }
    } catch (err) {
      lineas.push(mal('Servidor: no responde — ' + conCodigo(describirError(err))));
    }
    if (telefonoCliente) {
      try {
        const r2 = await apiCliente('clienteIdentificar', { telefono: telefonoCliente });
        lineas.push(r2 && r2.ok ? (r2.encontrado ? ok('Tu teléfono: reconocido') : mal('Tu teléfono: NO está registrado en la panadería')) : mal('Tu teléfono: no se pudo comprobar'));
      } catch (err) {
        lineas.push(mal('Tu teléfono: no se pudo comprobar — ' + conCodigo(describirError(err))));
      }
    }
  }
  lineas.push(ultimoErrorCodigo ? 'Último error en esta sesión: ' + ultimoErrorCodigo + ' (hace ' + Math.round((Date.now() - ultimoErrorHora) / 1000) + ' s)' : 'Último error en esta sesión: ninguno');
  lineas.push('Navegador: ' + String(navigator.userAgent || '').replace(/\s+/g, ' ').slice(0, 110));
  lineas.push('Hora del móvil: ' + new Date().toLocaleString('es-ES'));
  pantalla.textContent = lineas.join('\n');
}

function cablearDiagnostico() {
  document.getElementById('btnDiagnostico').addEventListener('click', () => {
    document.getElementById('modalDiagnostico').classList.remove('tab--hidden');
    ejecutarDiagnostico();
  });
  document.getElementById('btnComprobarDiagnostico').addEventListener('click', ejecutarDiagnostico);
  document.getElementById('btnCerrarDiagnostico').addEventListener('click', () => document.getElementById('modalDiagnostico').classList.add('tab--hidden'));
  document.getElementById('btnCopiarDiagnostico').addEventListener('click', () => {
    const texto = document.getElementById('diagnosticoTexto').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).catch(() => {});
  });
}
