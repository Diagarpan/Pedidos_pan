/* ============ CONFIG (se guarda en el propio móvil, no en el código) ============ */
let WEB_APP_URL = localStorage.getItem('webAppUrl') || '';
let API_KEY = localStorage.getItem('apiKey') || '';
let ROL = localStorage.getItem('rol') || 'admin'; // 'admin' | 'repartidor'
let RUTA = localStorage.getItem('ruta') || '';

let productosCache = [];
let clientesCache = [];
let itemsNuevo = []; // { tipo:'catalogo'|'libre', productoId?, nombre, precio, iva (fracción), cantidad, uid }
let itemsEditarPedido = [];
let editarPedidoEsAlbaran = false; // el pedido que se está editando es un albarán (no lleva IVA)
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
  // Buscador con sugerencias en todos los desplegables de cliente
  ['selectCliente', 'selectClientePedidos', 'selectClienteFacturas']
    .forEach((id) => BuscadorClientes.activar(document.getElementById(id)));
  cablearNuevoPedido();
  cablearProductosLibres();
  cablearEdicion();
  cablearListaFacturas();
  cablearIncidencias();
  cablearTelefonosYServidor();
  cablearDuplicados();
  cablearPedidoProveedores();
  cablearVistasRapidas();
  cablearInformesFacturacion();
  cablearCompras();
  cablearCerrarAnio();
  cablearBalance();
  cablearCopias();
  cablearClientes();
  cablearClientesForm();
  cablearPreciosEspeciales();
  cablearEmpresa();
  cablearHojaRuta();
  cablearProductos();
  cablearEstadisticas();
  cablearBusquedaGlobal();

  document.getElementById('btnRefrescar').addEventListener('click', actualizarTodo);
  document.getElementById('avisoEstado').addEventListener('click', () => document.getElementById('avisoEstado').classList.add('tab--hidden'));

  if (!WEB_APP_URL || !API_KEY || vinoDeEnlace) {
    abrirAjustes();
    return;
  }

  // Si ya sabemos quién eres de la última vez, se arranca YA (sin esperar a
  // Google) y la clave se comprueba en segundo plano. El servidor sigue
  // decidiendo qué puede hacer cada clave: esto solo ahorra la espera.
  if (localStorage.getItem('rol')) {
    aplicarModoUI();
    cargarTabActual();
    apiGet('quienSoy', undefined, { fondo: true }).then((r) => {
      if (!r.ok) { abrirAjustes(); return; }
      const cambio = r.data.rol !== ROL || (r.data.ruta || '') !== RUTA;
      ROL = r.data.rol;
      RUTA = r.data.ruta || '';
      localStorage.setItem('rol', ROL);
      localStorage.setItem('ruta', RUTA);
      if (cambio) { invalidarVistas(); aplicarModoUI(); cargarTabActual(); precargarListas(); }
    }).catch(() => { /* sin conexión: se queda con lo que ya hay */ });
    precargarListas();   // después de la comprobación de clave: lo de fondo va de uno en uno
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
    precargarListas();
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
  compras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4.5h2.5l2 11.5h10.5l1.8-8H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="16.5" cy="19.5" r="1.4"/></svg>',
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
  document.querySelectorAll('.solo-admin').forEach((el) => { el.style.display = esRepartidor ? 'none' : ''; });
  document.getElementById('resumenInicio').style.display = esRepartidor ? 'none' : '';
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
// Acciones que se pueden repetir sin riesgo (leer datos, o guardar "lo mismo" otra vez):
// si la respuesta llega rota o se corta la conexión, se reintentan solas UNA vez.
// Las que CREAN algo (pedido, factura, gasto…) no se reintentan nunca solas, para no duplicarlas.
const ACCIONES_REINTENTABLES = new Set([
  'quienSoy', 'resumenInicio', 'reparto', 'pedidos', 'facturas', 'clientes', 'productos',
  'preciosEspecialesCliente', 'resumenPeriodo', 'resumenManana', 'empresa', 'estadoCopias',
  'itemsPedido', 'itemsFactura', 'revisarTelefonos', 'buscarDuplicados',
  'guardarPrecioEspecial', 'eliminarPrecioEspecial', 'marcarEntregado', 'marcarCobrado', 'marcarFacturaCobrada', 'guardarIncidencia',
]);
const MENSAJE_RESPUESTA_ILEGIBLE = 'Google devolvió una respuesta que no se pudo leer (tardó demasiado o hubo demasiadas peticiones seguidas). Puede que la operación SÍ se haya guardado: compruébalo antes de repetirla.';

// Texto del error cuando una petición no llegó a buen puerto
function errorDeRed(err) {
  return err && err.toString && String(err) === MENSAJE_RESPUESTA_ILEGIBLE ? MENSAJE_RESPUESTA_ILEGIBLE : 'Sin conexión';
}

// Cuántas peticiones a Google hay en marcha, y (solo mientras se pulsa Actualizar) los fallos que van saliendo
let peticionesEnCurso = 0;
let registroFallos = null;

async function apiGet(action, extraParams, opciones) {
  peticionesEnCurso++;
  const larga = esAccionLarga(action);
  if (larga) peticionesLargasEnCurso++;
  const cambio = registrarCambioLocal(action, extraParams);   // marcar entregado/cobrado o incidencia: se apunta mientras viaja
  try {
    const respuesta = await pedirConTurno(action, extraParams, opciones);
    if (registroFallos && respuesta && respuesta.ok === false) registroFallos.push(respuesta.error || 'El servidor no ha respondido bien');
    const bien = !!(respuesta && respuesta.ok === true);
    cerrarCambioLocal(cambio, bien);
    if (bien) despuesDeEscribir(action, cambio);
    return respuesta;
  } catch (err) {
    cerrarCambioLocal(cambio, false);
    if (registroFallos) registroFallos.push(err);
    throw err;
  } finally {
    peticionesEnCurso--;
    if (larga) peticionesLargasEnCurso--;
  }
}

/* ---- Control de ritmo: Google rechaza (con una página de error) si le llegan demasiadas peticiones a la vez ----
 * Como mucho 4 a la vez. Lo que pides TÚ tiene prioridad; el trabajo de fondo (precarga, refrescar clientes y
 * productos, comprobar la clave) nunca ocupa más de 1 hueco, así que siempre hay sitio para lo tuyo. Si ya hay
 * en marcha una lectura IGUAL, se comparte (no se pide dos veces; si estaba esperando como "de fondo" y la pides
 * tú, pasa a tener prioridad). Y ninguna petición espera para siempre: a los 60 s se da por perdida. */
const MAX_PETICIONES_A_LA_VEZ = 4;
const MAX_DE_FONDO = 1;
const TIEMPO_MAXIMO_PETICION_MS = 60000;
// Las operaciones LARGAS (PDF con muchas páginas, informes, cierres) pueden tardar varios minutos: Apps Script las
// corta a los 6, así que aquí se espera algo más para que llegue antes su propio aviso. Todo lo demás se da por
// perdido a los 60 s (para no dejar una pantalla colgada).
const TIEMPO_MAXIMO_LARGO_MS = 390000;
const ACCIONES_LARGAS = new Set(['resumenPeriodo', 'modelo347', 'estadisticas', 'balance', 'cerrarAnio', 'copiaSeguridad', 'gestorCarpeta', 'gestorPdfsEmitidas', 'gestorCsv', 'panelMes']);
function esAccionLarga(action) { return /Pdf$/.test(action) || ACCIONES_LARGAS.has(action); }
function tiempoMaximoDe(action) { return esAccionLarga(action) ? TIEMPO_MAXIMO_LARGO_MS : TIEMPO_MAXIMO_PETICION_MS; }
let peticionesLargasEnCurso = 0;   // las largas no cuentan para "esperar a que acaben las peticiones" (botón Actualizar)
const LECTURAS_COMPARTIBLES = new Set(['quienSoy', 'resumenInicio', 'reparto', 'pedidos', 'facturas', 'clientes', 'productos', 'resumenManana']);
let turnosEnUso = 0;
let turnosDeFondo = 0;
const colaDeTurnos = [];        // { fondo, resolver, enCola }
const lecturasEnVuelo = new Map();

function puedeEmpezarTurno(fondo) {
  return turnosEnUso < MAX_PETICIONES_A_LA_VEZ && (!fondo || turnosDeFondo < MAX_DE_FONDO);
}
function repartirTurnos() {
  for (let i = 0; i < colaDeTurnos.length && turnosEnUso < MAX_PETICIONES_A_LA_VEZ;) {
    const e = colaDeTurnos[i];
    if (puedeEmpezarTurno(e.fondo)) {
      colaDeTurnos.splice(i, 1);
      e.enCola = false;
      turnosEnUso++;
      if (e.fondo) turnosDeFondo++;
      e.resolver();
    } else {
      i++;
    }
  }
}
function ponerEnCola(entrada) {
  if (entrada.fondo) colaDeTurnos.push(entrada);
  else {
    let i = colaDeTurnos.findIndex((e) => e.fondo);   // delante de los de fondo, detrás de las otras prioritarias
    if (i === -1) i = colaDeTurnos.length;
    colaDeTurnos.splice(i, 0, entrada);
  }
  entrada.enCola = true;
}
function adquirirTurno(entrada) {
  return new Promise((resolver) => {
    entrada.resolver = resolver;
    ponerEnCola(entrada);
    repartirTurnos();
  });
}
function liberarTurno(entrada) {
  turnosEnUso--;
  if (entrada.fondo) turnosDeFondo--;
  repartirTurnos();
}
function subirPrioridad(entrada) {
  if (!entrada.enCola || !entrada.fondo) return;
  colaDeTurnos.splice(colaDeTurnos.indexOf(entrada), 1);
  entrada.fondo = false;
  ponerEnCola(entrada);
  repartirTurnos();
}

function pedirConTurno(action, extraParams, opciones) {
  const fondo = !!(opciones && opciones.fondo);
  let clave = null;
  if (LECTURAS_COMPARTIBLES.has(action)) {
    const p = extraParams || {};
    clave = action + '|' + Object.keys(p).sort().map((k) => `${k}=${p[k]}`).join('&');
    const existente = lecturasEnVuelo.get(clave);
    if (existente) {
      if (!fondo) subirPrioridad(existente.entrada);
      return existente.promesa;
    }
  }
  const entrada = { fondo: fondo, resolver: null, enCola: false };
  const promesa = (async () => {
    await adquirirTurno(entrada);
    try { return await apiGetInterno(action, extraParams); } finally { liberarTurno(entrada); }
  })();
  if (clave) {
    lecturasEnVuelo.set(clave, { promesa: promesa, entrada: entrada });
    const quitar = () => lecturasEnVuelo.delete(clave);
    promesa.then(quitar, quitar);
  }
  return promesa;
}

function fetchConTiempo(url, tiempoMaximo) {
  const limite = tiempoMaximo || TIEMPO_MAXIMO_PETICION_MS;
  return new Promise((resolver, rechazar) => {
    let terminado = false;
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    const temporizador = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      if (control) { try { control.abort(); } catch (e) { /* nada */ } }
      rechazar(new Error(limite > TIEMPO_MAXIMO_PETICION_MS
        ? 'Google no ha terminado en 6 minutos (el documento es muy grande o Google va muy lento). Prueba otra vez más tarde.'
        : 'Google tarda demasiado en responder.'));
    }, limite);
    fetch(url, control ? { signal: control.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then((res) => res.text())
      .then((texto) => { if (terminado) return; terminado = true; clearTimeout(temporizador); resolver(texto); })
      .catch((err) => { if (terminado) return; terminado = true; clearTimeout(temporizador); rechazar(err); });
  });
}

// Envío por POST: para subir la foto o el PDF de una factura (no cabe en la dirección de una petición GET). El cuerpo va como texto plano
// para que el navegador no tenga que pedir permiso previo a Google.
function fetchPostConTiempo(url, cuerpo, tiempoMaximo) {
  const limite = tiempoMaximo || 180000;
  return new Promise((resolver, rechazar) => {
    let terminado = false;
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    const temporizador = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      if (control) { try { control.abort(); } catch (e) { /* nada */ } }
      rechazar(new Error('La subida tarda demasiado. Comprueba la conexión e inténtalo de nuevo.'));
    }, limite);
    fetch(url, Object.assign({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: cuerpo, cache: 'no-store' }, control ? { signal: control.signal } : {}))
      .then((res) => res.text())
      .then((texto) => { if (terminado) return; terminado = true; clearTimeout(temporizador); resolver(texto); })
      .catch((err) => { if (terminado) return; terminado = true; clearTimeout(temporizador); rechazar(err); });
  });
}

async function apiPost(action, cuerpo) {
  const texto = await fetchPostConTiempo(WEB_APP_URL, JSON.stringify(Object.assign({ action, key: API_KEY }, cuerpo || {})), 180000);
  try {
    return JSON.parse(texto);
  } catch (e) {
    const fallo = new Error(MENSAJE_RESPUESTA_ILEGIBLE);
    fallo.toString = () => MENSAJE_RESPUESTA_ILEGIBLE;
    throw fallo;
  }
}

async function apiGetInterno(action, extraParams) {
  const params = new URLSearchParams({ action, key: API_KEY, ...(extraParams || {}) });
  const url = `${WEB_APP_URL}?${params.toString()}`;
  // Crear algo con "idSolicitud" se puede repetir sin riesgo: si ya se creó, el servidor devuelve lo mismo y no duplica
  const intentos = (ACCIONES_REINTENTABLES.has(action) || (extraParams && extraParams.idSolicitud)) ? 2 : 1;
  let fallo;
  for (let i = 0; i < intentos; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const texto = await fetchConTiempo(url, tiempoMaximoDe(action));
      try {
        const respuesta = JSON.parse(texto);
        if (respuesta && respuesta.tipoError === 'desactualizado') mostrarAvisoServidor();
        return respuesta;
      } catch (e) {
        fallo = new Error(MENSAJE_RESPUESTA_ILEGIBLE);
        fallo.toString = () => MENSAJE_RESPUESTA_ILEGIBLE;
      }
    } catch (e) {
      fallo = e; // sin conexión
    }
  }
  throw fallo;
}

/* ============ VISTAS RÁPIDAS: lo último que viste, al instante ============
 * Inicio, Reparto, Pedidos y Facturas se abren con lo último que se vio (guardado en este móvil) y se
 * ponen al día por detrás. Mientras tanto, una barrita y un texto pequeño avisan: "Actualizando…",
 * "Actualizado a las 10:32" o, si no se puede, "No se ha podido actualizar… Estás viendo datos de las
 * 09:10" con un botón para reintentar.
 * Reglas:
 *  - Los FORMULARIOS (nuevo pedido, editar…) nunca usan lo guardado: siempre cargan lo actual.
 *  - Lo que acabas de tocar (entregado, cobrado, incidencia) no se pisa cuando llegan los datos nuevos.
 *  - Cualquier cambio que afecte a las listas (crear, editar o anular un pedido…) borra lo guardado.
 *  - Lo guardado es de UN usuario (rol, ruta y clave): otro usuario del mismo móvil no lo ve. */
const VISTA_PREFIJO = 'vista_';
const VISTA_INDICE = 'vista_indice';
const VISTA_MAX_ENTRADAS = 14;
const VISTA_MAX_BYTES = 250000;               // una vista más grande no se guarda
const VISTA_MAX_EDAD_MS = 6 * 3600 * 1000;    // más vieja que esto no se enseña
const VISTA_VIEJA_MS = 5 * 60 * 1000;         // más vieja que esto se avisa en ámbar
let modoManual = false;                       // true mientras se pulsa Actualizar (no se enseña lo guardado)

function propietarioVista() {
  let h = 5381;
  const k = String(API_KEY || '');
  for (let i = 0; i < k.length; i++) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0;
  return `${ROL || '-'}:${RUTA || '-'}:${h.toString(36)}`;
}

function claveVista(accion, params) {
  const p = params || {};
  const ordenado = Object.keys(p).sort().map((k) => `${k}=${p[k]}`).join('&');
  return `${VISTA_PREFIJO}${propietarioVista()}|${accion}|${ordenado}`;
}

function leerIndiceVistas() {
  try { const x = JSON.parse(localStorage.getItem(VISTA_INDICE) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; }
}

function guardarVista(clave, datos, accion) {
  try {
    const texto = JSON.stringify({ ts: Date.now(), datos: datos });
    if (texto.length > VISTA_MAX_BYTES) return;
    localStorage.setItem(clave, texto);
    const indice = leerIndiceVistas().filter((e) => e.k !== clave);
    indice.push({ k: clave, a: accion || clave.split('|')[1] });
    while (indice.length > VISTA_MAX_ENTRADAS) localStorage.removeItem(indice.shift().k);
    localStorage.setItem(VISTA_INDICE, JSON.stringify(indice));
  } catch (e) { /* sin espacio o almacenamiento bloqueado: la app funciona igual, sin esto */ }
}

function leerVista(clave) {
  try {
    const v = JSON.parse(localStorage.getItem(clave) || 'null');
    if (!v || !v.ts || Date.now() - v.ts > VISTA_MAX_EDAD_MS) return null;
    return v;
  } catch (e) { return null; }
}

// Borra lo guardado (todo, o solo de ciertas acciones)
function invalidarVistas(acciones) {
  try {
    const indice = leerIndiceVistas();
    const quedan = [];
    indice.forEach((e) => {
      if (!acciones || acciones.includes(e.a)) localStorage.removeItem(e.k); else quedan.push(e);
    });
    localStorage.setItem(VISTA_INDICE, JSON.stringify(quedan));
  } catch (e) { /* nada */ }
}

// ---- Lo que acabas de tocar no debe "volver atrás" cuando llegan datos que salieron antes de tu cambio ----
let cambiosLocales = [];   // { id, cambios, fin (null = aún viajando), descartado }

function registrarCambioLocal(accion, params) {
  const p = params || {};
  if (!p.idPedido) return null;
  let cambios = null;
  if (accion === 'marcarEntregado') cambios = { entregado: true, horaEntrega: horaAhoraCorta() };
  else if (accion === 'marcarCobrado') cambios = { cobrado: true };
  else if (accion === 'guardarIncidencia') {
    const texto = String(p.texto == null ? '' : p.texto).replace(/\s+/g, ' ').trim().slice(0, 300);
    cambios = { incidencia: texto, horaIncidencia: texto ? horaAhoraCorta() : '' };
  }
  if (!cambios) return null;
  const entrada = { id: String(p.idPedido), accion: accion, cambios: cambios, fin: null, descartado: false };
  cambiosLocales.push(entrada);
  return entrada;
}

function cerrarCambioLocal(entrada, bien) {
  if (!entrada) return;
  entrada.fin = Date.now();
  if (!bien) entrada.descartado = true;   // el que llamó ya lo deshace en pantalla
}

function aplicarCambiosLocales(accion, datos, inicioPeticion) {
  const ahora = Date.now();
  cambiosLocales = cambiosLocales.filter((e) => !e.descartado && (e.fin === null || ahora - e.fin < 180000));
  if (!cambiosLocales.length) return datos;
  const lista = accion === 'reparto' ? (datos && datos.clientes) : (accion === 'pedidos' ? datos : null);
  if (!Array.isArray(lista)) return datos;
  lista.forEach((p) => {
    cambiosLocales.forEach((e) => {
      // vale si el cambio aún viaja, o terminó después de salir esta petición (los datos pueden ser anteriores a él)
      if (String(p.id) === e.id && (e.fin === null || e.fin >= inicioPeticion - 300)) Object.assign(p, e.cambios);
    });
  });
  return datos;
}

// Tras guardar algo en Google: lo guardado en el móvil se corrige o se borra
function despuesDeEscribir(accion, cambio) {
  if (cambio) {
    // cambio pequeño y conocido: se aplica también a las copias guardadas (sin cambiar su hora)
    try {
      leerIndiceVistas().filter((e) => e.a === 'reparto' || e.a === 'pedidos').forEach((e) => {
        const v = JSON.parse(localStorage.getItem(e.k) || 'null');
        if (!v) return;
        const lista = e.a === 'reparto' ? v.datos && v.datos.clientes : v.datos;
        if (!Array.isArray(lista)) return;
        let toco = false;
        lista.forEach((p) => { if (String(p.id) === cambio.id) { Object.assign(p, cambio.cambios); toco = true; } });
        if (toco) localStorage.setItem(e.k, JSON.stringify(v));
      });
    } catch (e) { /* nada */ }
    invalidarVistas(accion === 'marcarCobrado' ? ['resumenInicio', 'facturas'] : ['resumenInicio']);
    return;
  }
  if (ACCIONES_QUE_CAMBIAN_LISTAS.includes(accion)) invalidarVistas();
}
const ACCIONES_QUE_CAMBIAN_LISTAS = ['nuevoPedido', 'anularPedido', 'editarPedido', 'editarFactura', 'marcarFacturaCobrada', 'cerrarAnio', 'guardarCliente', 'guardarProducto'];

// ---- El aviso de estado (barrita + texto) ----
function pantallaDeTab(tab) {
  return ({ inicio: 'inicio', 'reparto-dia': 'reparto', 'pedidos-lista': 'pedidos', 'factura-lista': 'facturas' })[tab] || null;
}
const pad2 = (n) => String(n).padStart(2, '0');
function hhmm(ts) { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function mismoDia(ts) { const a = new Date(ts), b = new Date(); return a.toDateString() === b.toDateString(); }
// "a las 10:32" / "el 04/10 a las 21:15" y "de las 10:32" / "del 04/10 a las 21:15"
function cuandoFue(ts, forma) {
  if (mismoDia(ts)) return (forma === 'de' ? 'de las ' : 'a las ') + hhmm(ts);
  const d = new Date(ts);
  return (forma === 'de' ? 'del ' : 'el ') + `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} a las ${hhmm(ts)}`;
}

let reintentarVista = null;
function marcarEstado(pantalla, tipo, ts, motivo, reintentar) {
  if (pantallaDeTab(tabActualNombre) !== pantalla) return;
  const caja = document.getElementById('estadoDatos');
  const texto = document.getElementById('estadoDatosTexto');
  const boton = document.getElementById('btnReintentarDatos');
  let t = '', clase = 'estado-datos';
  reintentarVista = null;
  boton.classList.add('tab--hidden');
  if (tipo === 'cargando') {
    const vieja = ts && Date.now() - ts > VISTA_VIEJA_MS;
    t = ts ? (vieja ? `Datos ${cuandoFue(ts, 'de')} · actualizando…` : 'Actualizando…') : (modoManual ? 'Actualizando…' : 'Cargando…');
    clase += ' estado-datos--cargando' + (vieja ? ' estado-datos--viejo' : '');
  } else if (tipo === 'listo') {
    t = `Actualizado ${cuandoFue(ts, 'a')}`;
    clase += ' estado-datos--listo';
  } else if (tipo === 'error') {
    t = `No se ha podido actualizar${motivo ? ' (' + String(motivo).replace(/\.$/, '') + ')' : ''}. Estás viendo datos ${cuandoFue(ts, 'de')}.`;
    clase += ' estado-datos--error';
    reintentarVista = reintentar;
    boton.classList.remove('tab--hidden');
  }
  texto.textContent = t;
  caja.className = clase;
}
function ocultarEstado() {
  const caja = document.getElementById('estadoDatos');
  if (caja) caja.classList.add('tab--hidden');
  reintentarVista = null;
}

// ---- Cargar: primero lo guardado (si lo hay), luego lo nuevo ----
const turnosVista = {};   // por pantalla: solo vale la última petición (si cambias de día o de filtro, las anteriores se ignoran)

async function cargarVista(o) {
  const clave = claveVista(o.accion, o.params);
  turnosVista[o.pantalla] = (turnosVista[o.pantalla] || 0) + 1;
  const turno = turnosVista[o.pantalla];

  const guardada = modoManual ? null : leerVista(clave);
  if (guardada) {
    o.pintar(guardada.datos);
    marcarEstado(o.pantalla, 'cargando', guardada.ts);
  } else {
    if (o.antesDePedir && !modoManual) o.antesDePedir();   // al actualizar a mano se deja lo que hay a la vista
    marcarEstado(o.pantalla, 'cargando', null);
  }

  const inicio = Date.now();
  let r;
  try { r = await apiGet(o.accion, o.params); } catch (err) { r = { ok: false, error: textoDeFalloLectura(err) }; }
  if (turno !== turnosVista[o.pantalla]) return { obsoleto: true, pintado: !!guardada };

  if (!r || r.ok !== true) {
    if (guardada) {
      marcarEstado(o.pantalla, 'error', guardada.ts, textoDeFallo((r && r.error) || 'sin conexión'), () => cargarVista(o));
    } else {
      ocultarEstado();
      if (o.alFallar) o.alFallar(r);
      if (o.contenedor) {   // botón para volver a intentarlo ahí mismo
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-secondary';
        b.style.marginTop = '12px';
        b.textContent = 'Reintentar';
        b.addEventListener('click', () => cargarVista(o));
        o.contenedor.appendChild(b);
      }
    }
    return { ok: false, pintado: !!guardada };
  }

  const datos = aplicarCambiosLocales(o.accion, r.data, inicio);
  guardarVista(clave, datos, o.accion);
  const y = window.scrollY;
  o.pintar(datos);
  if (guardada) window.scrollTo(0, y);   // no salta la pantalla al llegar lo nuevo
  marcarEstado(o.pantalla, 'listo', Date.now());
  if (o.pantalla === 'inicio') programarPrecarga();
  return { ok: true, pintado: true };
}

// ---- Precarga: mientras miras Inicio, se van pidiendo lo que vas a abrir ----
let precargando = false;
let ultimaPrecarga = 0;
let temporizadorPrecarga = null;

function programarPrecarga(ms) {
  clearTimeout(temporizadorPrecarga);
  temporizadorPrecarga = setTimeout(precargarVistas, ms || 700);
}

// Pide EXACTAMENTE lo mismo que pedirá cada pantalla al abrirse, para que lo guardado le sirva
async function precargarVistas() {
  if (precargando || actualizandoAhora || document.hidden || !WEB_APP_URL || !API_KEY) return;
  if (Date.now() - ultimaPrecarga < 120000) return;   // como mucho cada 2 minutos
  if (peticionesEnCurso > 0) { programarPrecarga(2500); return; }   // lo que pides tú va primero: se espera a que haya calma
  precargando = true;
  try {
    const hoy = formatoFechaES(hoyISO());
    const lista = [
      ['reparto', { fecha: fechaOffsetDDMMYYYY(0) }],
      ['pedidos', { fechaIni: hoy, fechaFin: hoy }],
    ];
    if (ROL === 'admin') lista.push(['facturas', { fechaIni: formatoFechaES(primeroDeMesISO()), fechaFin: hoy }]);
    let completa = true;
    for (const [accion, params] of lista) {
      if (actualizandoAhora || document.hidden) { completa = false; break; }
      if (peticionesEnCurso > 0) { completa = false; programarPrecarga(2500); break; }   // ha empezado a pedir algo: se cede el paso
      const inicio = Date.now();
      const r = await apiGet(accion, params, { fondo: true }).catch(() => null);
      if (!r || r.ok !== true) { completa = false; break; }   // si falla una, se para (casi seguro sin conexión)
      guardarVista(claveVista(accion, params), aplicarCambiosLocales(accion, r.data, inicio), accion);
    }
    if (completa) ultimaPrecarga = Date.now();
  } finally {
    precargando = false;
  }
}

// ---- Al volver a la app tras un rato, se pone al día lo que se está viendo ----
let ocultaDesde = 0;
function refrescoSilencioso() {
  if (actualizandoAhora || !WEB_APP_URL || !API_KEY) return;
  if (PANTALLAS_DE_FORMULARIO.includes(tabActualNombre)) return;
  const recarga = ({ inicio: () => pintarInicio(), 'reparto-dia': () => cargarReparto(), 'pedidos-lista': () => cargarPedidos(), 'factura-lista': () => buscarResumenFacturas() })[tabActualNombre];
  if (recarga) recarga();
  programarPrecarga();
}

function cablearVistasRapidas() {
  document.getElementById('btnReintentarDatos').addEventListener('click', () => { if (reintentarVista) reintentarVista(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ocultaDesde = Date.now(); return; }
    if (!ocultaDesde || Date.now() - ocultaDesde < 60000) return;
    ocultaDesde = 0;
    refrescoSilencioso();
  });
}

/* ============ BOTÓN ACTUALIZAR ============
 * Pulsarlo: sale "Actualizando…" (y gira el icono), se comprueba que el servidor responde y que la
 * clave vale, se ponen al día los clientes y productos del móvil (admin) y se vuelve a pedir lo que se
 * está viendo, con los filtros que haya puesto y SIN vaciar lo que se esté escribiendo. Al terminar:
 * "✓ Actualizado", o el motivo si falla. */
let temporizadorAviso = null;
function mostrarAviso(texto, tipo, ms) {
  const el = document.getElementById('avisoEstado');
  el.textContent = texto;
  el.className = 'toast toast--' + (tipo || 'info');
  clearTimeout(temporizadorAviso);
  if (ms) temporizadorAviso = setTimeout(() => el.classList.add('tab--hidden'), ms);
}

// Para las LISTAS (que solo leen): el aviso de "puede que la operación SÍ se haya guardado" no tiene sentido
function textoDeFalloLectura(err) {
  const t = String((err && err.message) || err || '');
  if (t === MENSAJE_RESPUESTA_ILEGIBLE || /respuesta que no se pudo leer/.test(t)) return 'Google no ha respondido bien (puede estar saturado). Prueba otra vez en unos segundos.';
  return textoDeFallo(err);
}

// Texto claro de un fallo (de red, del servidor o ya escrito)
function textoDeFallo(err) {
  const t = String((err && err.message) || err || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(t)) return 'No hay conexión con Internet.';
  return t.replace(/^(Error|TypeError):\s*/, '') || 'Inténtalo de nuevo en un momento.';
}

// Pantallas que se vuelven a cargar al actualizar (con los filtros que tengan)
const RECARGA_AL_ACTUALIZAR = {
  inicio: () => pintarInicio(),
  'reparto-dia': () => cargarReparto(),
  'pedidos-lista': () => cargarPedidos(),
  'clientes-lista': () => { if (!document.getElementById('clientesListaVista').classList.contains('tab--hidden')) filtrarListaClientes(); },   // la ficha abierta no se cierra
  'factura-lista': () => buscarResumenFacturas(),
  'factura-periodo': () => buscarResumenPeriodo(),
  productos: () => cargarProductosGestion(),
  proveedores: () => cargarProveedores(),
  'gastos-ver': () => buscarGastos(),
  'pedido-proveedores': () => cargarPedidoProveedores(),
  estadisticas: () => buscarEstadisticas(),
  balance: () => buscarBalance(),
  'factura-347': () => buscarModelo347(),
  empresa: () => { comprobarServidor(); cargarEstadoCopias(); },   // sin tocar los campos que se estén editando
};
// Formularios: NO se recargan (se perdería lo que se está escribiendo)
const PANTALLAS_DE_FORMULARIO = ['nuevo', 'pedido-editar', 'factura-editar', 'gasto-nuevo', 'gasto-factura', 'proveedor-form', 'cerrar-anio'];

// Espera a que acaben las peticiones (que haya silencio 0,3 s seguidos), con un máximo de ~45 s
async function esperarFinDePeticiones() {
  let tranquilo = 0;
  for (let i = 0; i < 750; i++) {
    await new Promise((r) => setTimeout(r, 60));
    tranquilo = (peticionesEnCurso - peticionesLargasEnCurso) === 0 ? tranquilo + 60 : 0;   // un PDF grande en marcha no cuenta
    if (tranquilo >= 300) return true;
  }
  return false;
}

let actualizandoAhora = false;
async function actualizarTodo() {
  if (actualizandoAhora) return;
  if (!WEB_APP_URL || !API_KEY) { mostrarAviso('Falta configurar la app: entra en Ajustes.', 'error', 8000); return; }

  const boton = document.getElementById('btnRefrescar');
  actualizandoAhora = true;
  modoManual = true;
  boton.disabled = true;
  boton.classList.add('is-cargando');
  mostrarAviso('Actualizando…', 'info');
  registroFallos = [];
  const pantallaRapida = pantallaDeTab(tabActualNombre);
  if (pantallaRapida) marcarEstado(pantallaRapida, 'cargando', null);

  try {
    // 1) ¿responde el servidor y la clave sigue valiendo?
    const q = await apiGet('quienSoy');
    if (q && q.ok) {
      // 2) las listas guardadas en el móvil, al día (solo el administrador las usa)
      if (ROL === 'admin') {
        const [cl, pr] = await Promise.all([apiGet('clientes'), apiGet('productos')]);
        if (cl && cl.ok) { clientesCache = cl.data; guardarCache('clientes', cl.data); }
        if (pr && pr.ok) { productosCache = pr.data; guardarCache('productos', pr.data); }
      }
      // 3) lo que se está viendo
      if (!PANTALLAS_DE_FORMULARIO.includes(tabActualNombre)) {
        const recarga = RECARGA_AL_ACTUALIZAR[tabActualNombre] || (() => pintarInicio());   // los menús: se ponen al día las insignias
        recarga();
        const terminado = await esperarFinDePeticiones();
        if (!terminado) registroFallos.push('Google tarda demasiado en responder.');
      }
    }
    if (registroFallos.length) throw registroFallos[0];
    mostrarAviso('✓ Actualizado', 'ok', 2200);
  } catch (err) {
    mostrarAviso('No se pudo actualizar: ' + textoDeFallo(err), 'error', 9000);
  } finally {
    registroFallos = null;
    modoManual = false;
    actualizandoAhora = false;
    boton.disabled = false;
    boton.classList.remove('is-cargando');
  }
}

/* ============ MIGAS DE PAN ============ */
const BREADCRUMBS = {
  reparto: [{ label: 'Reparto', tab: 'reparto' }],
  'reparto-dia': [{ label: 'Reparto', tab: 'reparto' }, { label: 'Detalle', tab: 'reparto-dia' }],
  pedidos: [{ label: 'Pedidos', tab: 'pedidos' }],
  'pedidos-lista': [{ label: 'Pedidos', tab: 'pedidos' }, { label: 'Ver pedidos', tab: 'pedidos-lista' }],
  'pedido-editar': [{ label: 'Pedidos', tab: 'pedidos' }, { label: 'Ver pedidos', tab: 'pedidos-lista' }, { label: 'Editar pedido', tab: 'pedido-editar' }],
  'factura-347': [{ label: 'Facturas', tab: 'factura' }, { label: 'Modelo 347', tab: 'factura-347' }],
  'proveedores': [{ label: 'Compras', tab: 'compras' }, { label: 'Proveedores', tab: 'proveedores' }],
  'pedido-proveedores': [{ label: 'Compras', tab: 'compras' }, { label: 'Pedido a proveedores', tab: 'pedido-proveedores' }],
  'proveedor-form': [{ label: 'Compras', tab: 'compras' }, { label: 'Proveedores', tab: 'proveedores' }, { label: 'Editar', tab: 'proveedor-form' }],
  'gasto-nuevo': [{ label: 'Compras', tab: 'compras' }, { label: 'Nuevo gasto', tab: 'gasto-nuevo' }],
  'gastos-ver': [{ label: 'Compras', tab: 'compras' }, { label: 'Ver gastos', tab: 'gastos-ver' }],
  'gasto-factura': [{ label: 'Compras', tab: 'compras' }, { label: 'Ver gastos', tab: 'gastos-ver' }, { label: 'Incorporar factura', tab: 'gasto-factura' }],
  'panel': [{ label: 'Compras', tab: 'compras' }, { label: 'Panel de resultados', tab: 'panel' }],
  'facturas-dia': [{ label: 'Compras', tab: 'compras' }, { label: 'Facturas de hoy', tab: 'facturas-dia' }],
  'facturas-semana': [{ label: 'Compras', tab: 'compras' }, { label: 'Facturas de la semana', tab: 'facturas-semana' }],
  'cuadrar': [{ label: 'Compras', tab: 'compras' }, { label: 'Cuadrar con el resumen', tab: 'cuadrar' }],
  'gestor': [{ label: 'Compras', tab: 'compras' }, { label: 'Zona del gestor', tab: 'gestor' }],
  'cerrar-anio': [{ label: 'Compras', tab: 'compras' }, { label: 'Cerrar año', tab: 'cerrar-anio' }],
  'balance': [{ label: 'Compras', tab: 'compras' }, { label: 'Balance', tab: 'balance' }],
  'factura-periodo': [{ label: 'Facturas', tab: 'factura' }, { label: 'Resumen por periodo e IVA', tab: 'factura-periodo' }],
  nuevo: [{ label: 'Nuevo pedido', tab: 'nuevo' }],
  clientes: [{ label: 'Clientes', tab: 'clientes' }],
  'clientes-lista': [{ label: 'Clientes', tab: 'clientes' }, { label: 'Ver clientes', tab: 'clientes-lista' }],
  'cliente-form': [{ label: 'Clientes', tab: 'clientes' }, { label: 'Ver clientes', tab: 'clientes-lista' }, { label: 'Cliente', tab: 'cliente-form' }],
  factura: [{ label: 'Facturas', tab: 'factura' }],
  'factura-lista': [{ label: 'Facturas', tab: 'factura' }, { label: 'Lista', tab: 'factura-lista' }],
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

// Las subpáginas (ej. "pedidos-lista") resaltan el menú padre ("pedidos") en
// el menú lateral y en la barra inferior, no un ítem propio (no existe).
function claveMenuPadre(nombre) {
  if (nombre.startsWith('pedidos')) return 'pedidos';
  if (nombre.startsWith('clientes') || nombre === 'cliente-form') return 'clientes';
  if (nombre.startsWith('factura')) return 'factura';
  if (nombre.startsWith('reparto')) return 'reparto';
  if (nombre.startsWith('producto')) return 'productos';
  return nombre;
}

let tabActualNombre = 'inicio';

function cambiarTab(nombre) {
  tabActualNombre = nombre;
  ocultarEstado();
  document.querySelectorAll('.tab').forEach((t) => t.classList.add('tab--hidden'));
  document.getElementById(`tab-${nombre}`).classList.remove('tab--hidden');
  const clave = claveMenuPadre(nombre);
  document.querySelectorAll('.tabbar__item').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === clave));
  document.querySelectorAll('.sidebar__item[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === clave));
  pintarBreadcrumb(nombre);
  cargarTabActual(nombre);
}

function cargarTabActual(nombre) {
  const activo = nombre || tabActualNombre || 'inicio';
  if (!WEB_APP_URL || !API_KEY) return;
  if (activo === 'inicio') pintarInicio();
  if (activo === 'reparto-dia') cargarReparto();
  if (activo === 'pedidos-lista') prepararPedidosLista();
  if (activo === 'nuevo') cargarFormularioNuevo();
  if (activo === 'clientes-lista') cargarClientes();
  if (activo === 'factura-lista') prepararResumenFacturas();
  if (activo === 'factura-periodo') prepararResumenPeriodo();
  if (activo === 'pedido-editar') cargarPedidoParaEditar();
  if (activo === 'factura-editar') cargarFacturaParaEditar();
  if (activo === 'proveedores') cargarProveedores();
  if (activo === 'pedido-proveedores') iniciarPedidoProveedores();
  if (activo === 'gasto-nuevo') cargarFormularioGasto();
  if (activo === 'gasto-factura') cargarFormularioFactura();
  if (activo === 'panel') cargarPanel();
  if (activo === 'facturas-dia') iniciarFacturasDia();
  if (activo === 'facturas-semana') cargarFacturasSemana();
  if (activo === 'cuadrar') iniciarCuadrar();
  if (activo === 'gestor') iniciarGestor();
  if (activo === 'empresa') cargarEmpresa();
  if (activo === 'productos') cargarProductosGestion();
  if (activo === 'estadisticas') prepararEstadisticas();
}

function pintarInicio() {
  document.getElementById('homeSub').textContent =
    ROL === 'repartidor' ? `Repartidor · Ruta ${RUTA}` : 'Administración';
  // El admin ya recibe todo en una sola petición (resumen + insignias)
  if (ROL === 'admin') cargarResumenInicio(); else cargarBadgesInicio();
}

async function cargarResumenInicio() {
  await cargarVista({ pantalla: 'inicio', accion: 'resumenInicio', params: {}, pintar: (d) => pintarResumenInicio({ data: d }) });
}

function pintarResumenInicio(r) {
  document.getElementById('riRecaudado').textContent = formatoEuros(r.data.recaudado);
  document.getElementById('riPedidos').textContent = r.data.pedidosHoy;
  document.getElementById('riEntregados').textContent = `${r.data.entregados} / ${r.data.pedidosHoy}`;
  document.getElementById('riPendiente').textContent = formatoEuros(r.data.pendiente);
  const avisoInc = document.getElementById('avisoIncidencias');
  if (r.data.incidencias > 0) {
    avisoInc.textContent = `⚠ ${r.data.incidencias} pedido${r.data.incidencias === 1 ? '' : 's'} de hoy con incidencia — ver`;
    avisoInc.classList.remove('tab--hidden');
  } else {
    avisoInc.classList.add('tab--hidden');
  }

  // Insignias de "Reparto" y "Pedidos" con los mismos datos (sin pedir nada más)
  const total = r.data.pedidosHoy;
  const pendientes = total - r.data.entregados;
  document.getElementById('badgeReparto').textContent = total ? `${total} hoy` : '';
  document.getElementById('badgePedidos').textContent = pendientes ? `${pendientes} pendientes` : (total ? 'Al día' : '');
}

async function cargarBadgesInicio() {
  const badgeReparto = document.getElementById('badgeReparto');
  const badgePedidos = document.getElementById('badgePedidos');
  await cargarVista({
    pantalla: 'inicio', accion: 'pedidos', params: {},
    antesDePedir: () => { badgeReparto.textContent = ''; badgePedidos.textContent = ''; },
    pintar: (datos) => {
      const total = datos.length;
      const pendientes = datos.filter((p) => !p.entregado).length;
      badgeReparto.textContent = total ? `${total} hoy` : '';
      badgePedidos.textContent = pendientes ? `${pendientes} pendientes` : (total ? 'Al día' : '');
    },
  });
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
    invalidarVistas();   // lo guardado era de otra clave

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
  const offset = offsetRepartoSeleccionado;

  const res = await cargarVista({
    pantalla: 'reparto', accion: 'reparto', params: { fecha: fechaOffsetDDMMYYYY(offset) }, contenedor: contProductos,
    antesDePedir: () => {
      contProductos.innerHTML = '<div class="empty-state">Cargando…</div>';
      document.getElementById('repartoClientes').innerHTML = '';
    },
    pintar: (datos) => pintarReparto(datos),
    alFallar: (r) => { contProductos.innerHTML = `<div class="empty-state">No se pudo cargar (${(r && r.error) || 'sin conexión'})</div>`; },
  });
  if (res.obsoleto || !res.pintado) return;

  const bloqueFaltan = document.getElementById('bloqueFaltanManana');
  if (offset === 1) {
    bloqueFaltan.classList.remove('tab--hidden');
    cargarFaltanManana();
  } else {
    bloqueFaltan.classList.add('tab--hidden');
  }
}

let ultimoReparto = null;
function pintarReparto(data) {
  ultimoReparto = data;
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
    const incidencias = data.clientes.filter((c) => c.incidencia).length;
    const recaudado = data.clientes.filter((c) => c.cobrado).reduce((s, c) => s + Number(c.total || 0), 0);
    const totalEsperado = data.clientes.reduce((s, c) => s + Number(c.total || 0), 0);

    document.getElementById('repartoResumen').innerHTML = `
      <div class="stats-row">
        <div class="stats-row__item"><span class="stats-row__num">${entregados}/${total}</span><span class="stats-row__label">Entregados</span></div>
        <div class="stats-row__item"><span class="stats-row__num">${cobrados}/${total}</span><span class="stats-row__label">Cobrados</span></div>
        <div class="stats-row__item"><span class="stats-row__num">${formatoEuros(recaudado)}</span><span class="stats-row__label">Recaudado de ${formatoEuros(totalEsperado)}</span></div>
        ${incidencias ? `<div class="stats-row__item"><span class="stats-row__num" style="color:var(--warn-red)">${incidencias}</span><span class="stats-row__label">Incidencias</span></div>` : ''}
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
      ${htmlIncidencia(c)}
      ${mostrarSeguimiento ? `
        <div class="card__actions">
          ${!c.entregado ? `<button class="chip-btn" data-reparto-accion="entregado" data-id="${c.id}">Marcar entregado</button>` : ''}
          ${!c.cobrado ? `<button class="chip-btn" data-reparto-accion="cobrado" data-id="${c.id}">Marcar cobrado</button>` : ''}
          <button class="chip-btn" data-reparto-accion="incidencia" data-id="${c.id}">${c.incidencia ? 'Editar incidencia' : 'Incidencia'}</button>
        </div>` : ''}
    </div>
  `).join('');

  contClientes.querySelectorAll('[data-reparto-accion]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // Se ve al instante; si Google falla, se deshace y se avisa
      const accion = btn.dataset.repartoAccion;
      if (accion === 'incidencia') { abrirIncidencia(btn.dataset.id); return; }
      const c = ultimoReparto && ultimoReparto.clientes.find((x) => String(x.id) === String(btn.dataset.id));
      const antes = c ? { entregado: c.entregado, cobrado: c.cobrado, horaEntrega: c.horaEntrega } : null;
      if (c) {
        if (accion === 'entregado') { c.entregado = true; c.horaEntrega = horaAhoraCorta(); } else { c.cobrado = true; }
        pintarReparto(ultimoReparto);
      } else {
        btn.disabled = true;
      }
      const r = await apiGet('marcar' + (accion === 'entregado' ? 'Entregado' : 'Cobrado'), { idPedido: btn.dataset.id }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
      if (!r.ok) {
        alert('No se pudo actualizar: ' + (r.error || 'error'));
        if (c && antes) { Object.assign(c, antes); pintarReparto(ultimoReparto); } else { btn.disabled = false; }
      }
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
      const mensaje = `Hola ${c.nombre}! 👋 Todavía no hemos recibido tu pedido de pan para mañana. Si quieres que te lo llevemos, haz tu pedido en la app antes de las 22:00: ${new URL('pedido.html', location.href).href} ¡Gracias!`;
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

/* ============ PEDIDOS: un día, un rango de fechas y/o un cliente, en UNA pantalla ============ */
let pedidosFiltroPendiente = null;  // { ini, fin, clienteId }: lo que pide quien abre la pantalla (ej. la ficha de un cliente)
let rangoPedidosAnterior = null;    // para saber si se estaba mirando UN solo día

// Fechas en hora LOCAL (valueAsDate trabaja en UTC y cerca de medianoche daba el día anterior)
function aISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function desdeISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function sumarDiasISO(iso, n) { const d = desdeISO(iso); d.setDate(d.getDate() + n); return aISO(d); }
function hoyISO() { return aISO(new Date()); }
function primeroDeMesISO() { const d = new Date(); return aISO(new Date(d.getFullYear(), d.getMonth(), 1)); }

function fijarRangoPedidos(ini, fin) {
  document.getElementById('pedidosFechaIni').value = ini;
  document.getElementById('pedidosFechaFin').value = fin;
  rangoPedidosAnterior = { ini: ini, fin: fin };
}

// Opciones de cliente de un desplegable (se rehacen solo si la lista cambió, sin perder lo elegido)
function rellenarClientesFiltro(select, textoTodos) {
  if (select.options.length - 1 === clientesCache.length) return;
  const actual = select.value;
  select.innerHTML = `<option value="">${textoTodos}</option>` +
    clientesCache.map(opcionCliente).join('');
  select.value = actual;
}

async function prepararPedidosLista() {
  const esAdmin = ROL === 'admin';
  document.getElementById('bloquePedidosCliente').style.display = esAdmin ? '' : 'none';
  const selEstado = document.getElementById('filtroEstadoPedido');
  const opAnulado = selEstado.querySelector('option[value="anulado"]');
  if (opAnulado && !esAdmin) opAnulado.remove();

  // Los clientes y los pedidos se piden A LA VEZ: la lista no espera a los clientes
  const selCliente = document.getElementById('selectClientePedidos');
  const clientesListos = esAdmin
    ? cargarClientesCache().then(() => rellenarClientesFiltro(selCliente, 'Todos los clientes'))
    : Promise.resolve();

  if (pedidosFiltroPendiente) {
    await clientesListos; // (ya están en memoria: se viene de la ficha de un cliente)
    const f = pedidosFiltroPendiente;
    pedidosFiltroPendiente = null;
    fijarRangoPedidos(f.ini, f.fin);
    selCliente.value = f.clienteId || '';
    document.getElementById('buscarPedido').value = '';
    selEstado.value = f.estado || 'todos';
  } else if (!document.getElementById('pedidosFechaIni').value) {
    fijarRangoPedidos(hoyISO(), hoyISO());
  }
  await cargarPedidos();
}

async function cargarPedidos() {
  const cont = document.getElementById('listaPedidos');
  const ini = document.getElementById('pedidosFechaIni').value;
  const fin = document.getElementById('pedidosFechaFin').value;
  if (!ini || !fin) { cont.innerHTML = '<div class="empty-state">Elige las fechas.</div>'; return; }

  const params = { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) };
  const clienteId = ROL === 'admin' ? document.getElementById('selectClientePedidos').value : '';
  if (clienteId) params.clienteId = clienteId;

  await cargarVista({
    pantalla: 'pedidos', accion: 'pedidos', params: params, contenedor: cont,
    antesDePedir: () => { cont.innerHTML = '<div class="empty-state">Cargando…</div>'; },
    pintar: (datos) => pintarPedidos(datos),
    alFallar: (r) => { cont.innerHTML = `<div class="empty-state">No se pudo cargar (${(r && r.error) || 'sin conexión'})</div>`; },
  });
}

function cablearNavegacionPedidos() {
  const ini = document.getElementById('pedidosFechaIni');
  const fin = document.getElementById('pedidosFechaFin');
  const recordar = () => { rangoPedidosAnterior = { ini: ini.value, fin: fin.value }; };

  ini.addEventListener('change', () => {
    if (!ini.value) return;
    const eraUnDia = rangoPedidosAnterior && rangoPedidosAnterior.ini === rangoPedidosAnterior.fin;
    if (eraUnDia || !fin.value || fin.value < ini.value) fin.value = ini.value; // mirando un día: sigue siendo un día
    recordar();
    cargarPedidos();
  });
  fin.addEventListener('change', () => {
    if (!fin.value) return;
    if (!ini.value || ini.value > fin.value) ini.value = fin.value;
    recordar();
    cargarPedidos();
  });

  // Las flechas saltan un periodo entero (un día si se mira un día, N días si se mira un rango)
  const desplazar = (sentido) => {
    if (!ini.value || !fin.value) return;
    const dias = Math.round((desdeISO(fin.value) - desdeISO(ini.value)) / 86400000) + 1;
    fijarRangoPedidos(sumarDiasISO(ini.value, sentido * dias), sumarDiasISO(fin.value, sentido * dias));
    cargarPedidos();
  };
  document.getElementById('btnPedidosAnterior').addEventListener('click', () => desplazar(-1));
  document.getElementById('btnPedidosSiguiente').addEventListener('click', () => desplazar(1));

  document.querySelectorAll('[data-pedidos-rapido]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cual = btn.dataset.pedidosRapido;
      if (cual === 'mes') fijarRangoPedidos(primeroDeMesISO(), hoyISO());
      else {
        const dia = cual === 'ayer' ? sumarDiasISO(hoyISO(), -1) : cual === 'manana' ? sumarDiasISO(hoyISO(), 1) : hoyISO();
        fijarRangoPedidos(dia, dia);
      }
      cargarPedidos();
    });
  });

  document.getElementById('selectClientePedidos').addEventListener('change', cargarPedidos);
  document.getElementById('buscarPedido').addEventListener('input', () => pintarPedidos(ultimosPedidos));
  document.getElementById('filtroEstadoPedido').addEventListener('change', () => pintarPedidos(ultimosPedidos));
}

let ultimosPedidos = [];
function estadoDePedido(p) {
  return p.anulado ? 'Anulado' : p.cobrado ? 'Cobrado' : p.entregado ? 'Entregado' : 'Pendiente';
}

function pintarPedidos(pedidos) {
  ultimosPedidos = pedidos;
  const cont = document.getElementById('listaPedidos');
  const resumen = document.getElementById('pedidosResumen');
  const filtroTexto = BuscadorClientes.normalizar(document.getElementById('buscarPedido').value || '');
  const filtroEstado = document.getElementById('filtroEstadoPedido').value;
  const variosDias = document.getElementById('pedidosFechaIni').value !== document.getElementById('pedidosFechaFin').value;

  const filtrados = pedidos.filter((p) => {
    if (!coincideBusqueda(p.cliente, filtroTexto)) return false;
    if (filtroEstado === 'incidencia') return !p.anulado && !!p.incidencia;
    const estado = estadoDePedido(p).toLowerCase();
    return filtroEstado === 'todos' ? estado !== 'anulado' : estado === filtroEstado;
  });

  if (!filtrados.length) {
    cont.innerHTML = '<div class="empty-state">No hay pedidos que coincidan.</div>';
    resumen.textContent = '';
    return;
  }
  const suma = filtrados.reduce((s, p) => s + (Number(p.total) || 0), 0);
  resumen.textContent = filtroEstado === 'anulado'
    ? `${filtrados.length} pedido(s) anulado(s)`
    : filtroEstado === 'incidencia'
      ? `${filtrados.length} pedido(s) con incidencia`
      : `${filtrados.length} pedido(s) · Total ${formatoEuros(suma)}`;

  cont.innerHTML = filtrados.map((p) => {
    const estado = estadoDePedido(p);
    const acciones = p.anulado ? '' : `
      <div class="card__actions">
        ${!p.entregado ? `<button class="chip-btn" data-accion="entregado" data-id="${p.id}">Marcar entregado</button>` : ''}
        ${!p.cobrado ? `<button class="chip-btn" data-accion="cobrado" data-id="${p.id}">Marcar cobrado</button>` : ''}
        <button class="chip-btn" data-accion="incidencia" data-id="${p.id}">${p.incidencia ? 'Editar incidencia' : 'Incidencia'}</button>
        <button class="chip-btn" data-accion="albaran" data-id="${p.id}">Albarán PDF</button>
        ${ROL === 'admin' && p.documento !== 'Albarán' ? `<button class="chip-btn" data-accion="factura" data-id="${p.id}">Factura PDF</button>` : ''}
        ${ROL === 'admin' ? `<button class="chip-btn" data-accion="editar" data-id="${p.id}">Editar pedido</button>` : ''}
        ${ROL === 'admin' ? `<button class="chip-btn" data-accion="anular" data-id="${p.id}" style="border-color:var(--warn-red); color:var(--warn-red);">Anular</button>` : ''}
      </div>`;
    return `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.cliente)}</div>
          <div class="card__meta">${variosDias ? escapeHtml(p.fecha) + ' · ' : ''}${escapeHtml(p.hora || '')} · ${escapeHtml(p.canal || '')}${p.documento === 'Albarán' ? ' · <strong>ALBARÁN (sin factura)</strong>' : ''}</div>
        </div>
        <div style="text-align:right">
          <div class="card__total">${formatoEuros(p.total)}</div>
          ${stampHtml(estado)}
        </div>
      </div>
      <div class="card__products">${escapeHtml(p.pedido)}</div>
      ${p.entregado && p.horaEntrega && !p.anulado ? `<div class="card__meta" style="margin-top:6px;">Entregado a las ${escapeHtml(p.horaEntrega)}</div>` : ''}
      ${htmlIncidencia(p)}
      ${p.observaciones ? `<div class="card__meta" style="color:var(--stamp-red); margin-top:6px;">${escapeHtml(p.observaciones)}</div>` : ''}
      ${acciones}
    </div>
  `;
  }).join('');

  cont.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const accion = btn.dataset.accion;
      if (accion === 'entregado' || accion === 'cobrado') {
        cambiarEstadoPedido(btn.dataset.id, accion);
      } else if (accion === 'incidencia') {
        abrirIncidencia(btn.dataset.id);
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

function horaAhoraCorta() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Marca entregado/cobrado AL INSTANTE en pantalla y lo manda a Google detrás.
// Si Google falla, vuelve a como estaba y avisa.
async function cambiarEstadoPedido(idPedido, accion) {
  const p = ultimosPedidos.find((x) => String(x.id) === String(idPedido));
  const antes = p ? { entregado: p.entregado, cobrado: p.cobrado, horaEntrega: p.horaEntrega } : null;
  if (p) {
    if (accion === 'entregado') { p.entregado = true; p.horaEntrega = horaAhoraCorta(); } else { p.cobrado = true; }
    pintarPedidos(ultimosPedidos);
  }
  const action = accion === 'entregado' ? 'marcarEntregado' : 'marcarCobrado';
  const r = await apiGet(action, { idPedido }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) {
    alert('No se pudo actualizar: ' + (r.error || 'error desconocido'));
    if (p && antes) { Object.assign(p, antes); pintarPedidos(ultimosPedidos); } else { cargarPedidos(); }
  }
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
  // si tarda (un PDF con muchas páginas puede llevar uno o dos minutos), se le dice que es normal
  const aviso = setTimeout(() => { boton.textContent = textoCarga.replace(/…$/, '') + '… (puede tardar 1-3 min)'; }, 15000);
  try {
    await tarea();
  } finally {
    clearTimeout(aviso);
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

async function descargarPDF(base64, nombreArchivo, tipoMime) {
  const mime = tipoMime || 'application/pdf';
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mime });

  // En móvil, si el navegador lo soporta, ofrece compartir directamente
  // (WhatsApp, Mail, etc.) usando el panel nativo de compartir.
  try {
    const archivo = new File([blob], nombreArchivo, { type: mime });
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
  if (e.target.id === 'buscarCliente') {
    filtrarListaClientes();
  }
});

/* ============ NUEVO PEDIDO ============ */
let fechaPedidoSeleccion = 'manana';

/* ============ FACTURAS: una sola lista (todas, o las de un cliente) ============ */
let resumenFacturasCache = [];
let facturasFiltroPendiente = null; // { ini, fin, clienteId }: lo que pide quien abre la pantalla (ej. la ficha de un cliente)

async function prepararResumenFacturas() {
  const select = document.getElementById('selectClienteFacturas');
  const clientesListos = cargarClientesCache().then(() => rellenarClientesFiltro(select, 'Todos los clientes'));

  if (facturasFiltroPendiente) {
    await clientesListos;
    const f = facturasFiltroPendiente;
    facturasFiltroPendiente = null;
    document.getElementById('resFechaIni').value = f.ini;
    document.getElementById('resFechaFin').value = f.fin;
    select.value = f.clienteId || '';
    actualizarBotonExtracto();
    await buscarResumenFacturas(); // viene de la ficha de un cliente: se ven ya sus facturas
    return;
  }
  if (!document.getElementById('resFechaIni').value) document.getElementById('resFechaIni').value = primeroDeMesISO();
  if (!document.getElementById('resFechaFin').value) document.getElementById('resFechaFin').value = hoyISO();
  actualizarBotonExtracto();
}

// El extracto es de UN cliente: solo se puede pedir si hay uno elegido
function actualizarBotonExtracto() {
  document.getElementById('btnDescargarExtractoCliente').disabled = !document.getElementById('selectClienteFacturas').value;
}

function cablearListaFacturas() {
  document.getElementById('btnBuscarResumenFacturas').addEventListener('click', buscarResumenFacturas);
  document.getElementById('filtroEstadoFactura').addEventListener('change', pintarResumenFacturas);
  document.getElementById('btnResumenHoy').addEventListener('click', () => {
    document.getElementById('resFechaIni').value = hoyISO();
    document.getElementById('resFechaFin').value = hoyISO();
    buscarResumenFacturas();
  });
  document.getElementById('btnResumenMes').addEventListener('click', () => {
    document.getElementById('resFechaIni').value = primeroDeMesISO();
    document.getElementById('resFechaFin').value = hoyISO();
    buscarResumenFacturas();
  });
  document.getElementById('selectClienteFacturas').addEventListener('change', () => {
    actualizarBotonExtracto();
    buscarResumenFacturas();
  });
}

async function buscarResumenFacturas() {
  const cont = document.getElementById('listaResumenFacturas');
  const ini = document.getElementById('resFechaIni').value;
  const fin = document.getElementById('resFechaFin').value;
  if (!ini || !fin) { cont.innerHTML = '<div class="empty-state">Elige las dos fechas.</div>'; return; }

  const params = { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) };
  const clienteId = document.getElementById('selectClienteFacturas').value;
  if (clienteId) params.clienteId = clienteId;

  await cargarVista({
    pantalla: 'facturas', accion: 'facturas', params: params, contenedor: cont,
    antesDePedir: () => { cont.innerHTML = '<div class="empty-state">Buscando…</div>'; },
    pintar: (datos) => {
      resumenFacturasCache = datos.facturas;
      document.getElementById('resumenFacturasTotal').textContent =
        `Facturado: ${formatoEuros(datos.total)}  ·  Cobrado: ${formatoEuros(datos.totalCobrado)}  ·  Pendiente: ${formatoEuros(datos.totalPendiente)}` +
        (datos.numAnuladas ? `  ·  ${datos.numAnuladas} anulada(s)` : '');
      pintarResumenFacturas();
    },
    alFallar: (r) => { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r && r.error ? r.error : 'sin conexión')}</div>`; },
  });
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
  document.getElementById('empEmailGestor').value = r.data.emailGestor || '';
  document.getElementById('empLogoFileId').value = r.data.logoFileId || '';
  document.getElementById('empNumeroInicialFactura').value = r.data.numeroInicialFactura || '';
  document.getElementById('empSerie').value = r.data.serie || '';
  document.getElementById('empFechaFactura').value = r.data.fechaFactura === 'entrega' ? 'entrega' : 'pedido';
  cargarEstadoCopias();
  comprobarServidor();
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
    emailGestor: document.getElementById('empEmailGestor').value.trim(),
    logoFileId: document.getElementById('empLogoFileId').value.trim(),
    numeroInicialFactura: document.getElementById('empNumeroInicialFactura').value.trim(),
    serie: document.getElementById('empSerie').value.trim(),
    fechaFactura: document.getElementById('empFechaFactura').value,
  }).catch(() => ({ ok: false }));

  if (r.ok) {
    msg.textContent = 'Datos guardados.';
    msg.className = 'form-msg is-ok';
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

// Los tres documentos que se crean desde esta pantalla
let tipoDocumentoPendiente = null; // lo pide quien abre la pantalla (ej. "Nueva factura suelta" del menú Facturas)
const TEXTOS_TIPO_DOCUMENTO = {
  factura: { aviso: '', boton: 'Crear pedido' },
  albaran: { aviso: 'Se guarda como pedido (cuenta en el reparto y en el total a preparar) pero no crea factura. Los albaranes de un día se imprimen todos juntos desde Reparto → Mañana.', boton: 'Crear albarán' },
  facturaSuelta: { aviso: 'Factura de una venta puntual: no es un pedido de reparto (no cuenta en el reparto ni en el total a preparar). Al crearla se abre su PDF.', boton: 'Crear factura' },
};

function actualizarTipoDocumento() {
  const tipo = document.getElementById('selectTipoDocumento').value;
  const t = TEXTOS_TIPO_DOCUMENTO[tipo] || TEXTOS_TIPO_DOCUMENTO.factura;
  const aviso = document.getElementById('avisoTipoDocumento');
  aviso.textContent = t.aviso;
  aviso.style.display = t.aviso ? 'block' : 'none';
  document.getElementById('bloqueFechaPedido').style.display = tipo === 'facturaSuelta' ? 'none' : '';
  document.getElementById('btnCrearPedido').textContent = t.boton;
  recalcularTotal('nuevo');   // un albarán no lleva IVA: el total cambia al cambiar el tipo
}

function cablearNuevoPedido() {
  document.getElementById('btnCrearPedido').addEventListener('click', crearPedidoManual);
  document.getElementById('selectCliente').addEventListener('change', aplicarDocumentoDelCliente);
  document.getElementById('selectTipoDocumento').addEventListener('change', () => { tipoDocumentoElegidoAMano = true; });
  document.getElementById('selectFechaPedido').addEventListener('change', (e) => {
    fechaPedidoSeleccion = e.target.value;
  });
  document.getElementById('selectTipoDocumento').addEventListener('change', actualizarTipoDocumento);
  document.getElementById('btnNuevaFacturaSuelta').addEventListener('click', () => {
    tipoDocumentoPendiente = 'facturaSuelta';
    cambiarTab('nuevo');
  });
}

// El documento habitual del cliente (factura o albarán) se propone al elegirlo, salvo que ya hayas elegido tú uno a mano
let tipoDocumentoElegidoAMano = false;
function aplicarDocumentoDelCliente() {
  const selTipo = document.getElementById('selectTipoDocumento');
  if (tipoDocumentoElegidoAMano || selTipo.value === 'facturaSuelta') return;
  const c = clientesCache.find((x) => String(x.id) === String(document.getElementById('selectCliente').value));
  if (!c) return;
  selTipo.value = c.documento === 'albaran' ? 'albaran' : 'factura';
  actualizarTipoDocumento();
}

async function cargarFormularioNuevo(opciones) {
  if (!(opciones && opciones.conservarTipo)) tipoDocumentoElegidoAMano = false;
  const selectCliente = document.getElementById('selectCliente');
  const selectProducto = document.getElementById('nProductoSelect');
  const selectTipo = document.getElementById('selectTipoDocumento');
  const tipoActual = selectTipo.value;

  await Promise.all([cargarClientesCache(), cargarProductosCache()]);

  selectCliente.innerHTML = '<option value="">Selecciona un cliente…</option>' +
    clientesCache.map(opcionCliente).join('');
  selectProducto.innerHTML = '<option value="">Elige un producto…</option>' +
    productosCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)} — ${formatoEuros(p.precio)}</option>`).join('');

  itemsNuevo = [];
  pintarItems('nuevo');

  fechaPedidoSeleccion = 'manana';
  document.getElementById('selectFechaPedido').value = 'manana';
  // Tras crear uno se conserva el tipo (por si se hacen varios seguidos); al entrar de nuevo, vuelve a "pedido con factura"
  selectTipo.value = tipoDocumentoPendiente || (opciones && opciones.conservarTipo ? tipoActual : 'factura');
  tipoDocumentoPendiente = null;
  actualizarTipoDocumento();
  document.getElementById('nuevoMsg').textContent = '';
}


// Un código único por cada intento de crear algo: si el servidor ya lo procesó, devuelve lo que creó
// entonces en vez de crear otro. Así, tocar dos veces o repetir tras una respuesta perdida NO duplica.
function idUnico() {
  try { if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID(); } catch (e) { /* nada */ }
  return 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

// Pregunta cuando el servidor dice que YA existe algo igual
function preguntarDuplicado(r) {
  if (r.idFacturaExistente) {
    return confirm(`Ya hay una factura IGUAL de ${r.cliente} de hoy (nº ${r.idFacturaExistente}).\n\n¿Crear otra igual de todas formas?`);
  }
  const que = r.tipoDocumento === 'albaran' ? 'albarán' : 'pedido';
  return confirm(`Ya hay un ${que} IGUAL de ${r.cliente} para el ${r.fechaEntrega} (nº ${r.idPedidoExistente}, creado el ${r.creadoExistente}).\n\n¿Crear otro igual de todas formas?`);
}

let solicitudPedido = null;     // { id, huella }: el intento en curso; se reutiliza si se repite EXACTAMENTE lo mismo
let guardandoPedido = false;

async function crearPedidoManual() {
  if (guardandoPedido) return;   // segundo toque mientras guarda: se ignora
  const msg = document.getElementById('nuevoMsg');
  const boton = document.getElementById('btnCrearPedido');
  const clienteId = document.getElementById('selectCliente').value;
  const tipoDocumento = document.getElementById('selectTipoDocumento').value;
  const items = itemsNuevo.map((it) => it.tipo === 'catalogo'
    ? { productoId: it.productoId, cantidad: it.cantidad }
    : { nombre: it.nombre, precio: it.precio, iva: it.iva, cantidad: it.cantidad }
  );

  if (!clienteId) { msg.textContent = 'Selecciona un cliente.'; msg.className = 'form-msg is-error'; return; }
  if (!items.length) { msg.textContent = 'Añade al menos un producto.'; msg.className = 'form-msg is-error'; return; }

  // Mismo pedido que el intento anterior (p. ej. tras un fallo de conexión): MISMO código, y el servidor no lo duplica.
  const huella = JSON.stringify([clienteId, tipoDocumento, fechaPedidoSeleccion, items]);
  if (!solicitudPedido || solicitudPedido.huella !== huella) solicitudPedido = { id: idUnico(), huella: huella };

  guardandoPedido = true;
  const textoBoton = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  msg.textContent = 'Guardando… no hace falta pulsar otra vez.';
  msg.className = 'form-msg';
  const lento = setTimeout(() => { msg.textContent = 'Sigue guardando… Google va lento. Espera: aunque pulsaras otra vez, NO se duplicaría.'; }, 8000);

  try {
    const cuando = fechaPedidoSeleccion === 'manana' ? 'mañana' : 'HOY';
    let r;
    let confirmar = false;
    for (;;) {
      const params = { clienteId, items: JSON.stringify(items), fechaEntrega: fechaPedidoSeleccion, tipoDocumento, idSolicitud: solicitudPedido.id };
      if (confirmar) params.confirmarDuplicado = '1';
      r = await apiGet('nuevoPedido', params).catch((err) => ({ ok: false, error: textoDeFallo(err), sinRespuesta: true }));
      if (r && r.duplicadoProbable) {
        if (preguntarDuplicado(r)) { confirmar = true; continue; }
        msg.textContent = 'No se ha creado: ya había uno igual.';
        msg.className = 'form-msg';
        solicitudPedido = null;
        return;
      }
      break;
    }

    if (!r.ok) {
      msg.textContent = r.sinRespuesta
        ? `No hemos podido confirmar si se guardó (${String(r.error).replace(/\.$/, '')}). Pulsa «Crear pedido» otra vez: es seguro, no se duplicará.`
        : 'Error: ' + (r.error || 'inténtalo de nuevo');
      msg.className = 'form-msg is-error';
      return;   // el formulario se queda como estaba
    }

    solicitudPedido = null;
    document.getElementById('selectCliente').value = '';
    await cargarFormularioNuevo({ conservarTipo: true });

    const yaEstaba = r.repetido ? ' (ya estaba creado: no se ha duplicado)' : '';
    if (tipoDocumento === 'facturaSuelta') {
      msg.textContent = `Factura #${r.idFactura} creada (${formatoEuros(r.total)})${yaEstaba}. Generando PDF…`;
      msg.className = 'form-msg is-ok';
      const rPdf = await apiGet('facturaDirectaPdf', { idFactura: r.idFactura }).catch(() => ({ ok: false }));
      if (rPdf.ok) descargarPDF(rPdf.base64, rPdf.nombre);
      msg.textContent = `Factura #${r.idFactura} creada (${formatoEuros(r.total)})${yaEstaba}.`;
      return;
    }
    msg.textContent = `${tipoDocumento === 'albaran' ? 'Albarán' : 'Pedido'} #${r.idPedido} creado para ${cuando} (${formatoEuros(r.total)})${yaEstaba}.`;
    msg.className = 'form-msg is-ok';
  } finally {
    clearTimeout(lento);
    guardandoPedido = false;
    boton.disabled = false;
    boton.textContent = textoBoton;
  }
}

/* ============ CLIENTES ============ */
function cablearClientes() {
  document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
    document.getElementById('detalleCliente').classList.add('tab--hidden');
    document.getElementById('clientesListaVista').classList.remove('tab--hidden');
  });
  // La ficha ya no copia las listas de pedidos y facturas: abre las listas normales ya filtradas por este cliente
  document.getElementById('btnVerPedidosCliente').addEventListener('click', () => {
    if (!clienteSeleccionado) return;
    pedidosFiltroPendiente = { ini: sumarDiasISO(hoyISO(), -90), fin: hoyISO(), clienteId: clienteSeleccionado.id };
    cambiarTab('pedidos-lista');
  });
  document.getElementById('btnVerFacturasCliente').addEventListener('click', () => {
    if (!clienteSeleccionado) return;
    facturasFiltroPendiente = { ini: sumarDiasISO(hoyISO(), -365), fin: hoyISO(), clienteId: clienteSeleccionado.id };
    cambiarTab('factura-lista');
  });
}

let clienteSeleccionado = null;

async function cargarClientes() {
  document.getElementById('detalleCliente').classList.add('tab--hidden');
  document.getElementById('clientesListaVista').classList.remove('tab--hidden');
  await cargarClientesCache();
  filtrarListaClientes();
}

function filtrarListaClientes() {
  const cont = document.getElementById('listaClientes');
  const filtro = BuscadorClientes.normalizar(document.getElementById('buscarCliente').value || '');
  const filtrados = clientesCache.filter((c) => coincideBusqueda(c.nombre + ' ' + textoBusquedaCliente(c), filtro));

  cont.innerHTML = filtrados.map((c) => `
    <div class="client-row" data-id="${c.id}">
      <div>
        <div class="card__name">${escapeHtml(c.nombre)}</div>
        <div class="client-row__ruta">${escapeHtml(c.ruta || '')}${c.documento === 'albaran' ? ' <span class="card__meta">· Albarán</span>' : ''}</div>
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

  const info = [];
  const telefonos = [clienteSeleccionado.telefono, clienteSeleccionado.telefono2].filter(Boolean);
  if (telefonos.length) info.push('📞 ' + telefonos.join(' · '));
  const direccion = [clienteSeleccionado.direccion, [clienteSeleccionado.codigoPostal, clienteSeleccionado.poblacion].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if (direccion) info.push('📍 ' + direccion);
  if (clienteSeleccionado.nif) info.push('NIF/CIF: ' + clienteSeleccionado.nif);
  const nombreFactura = nombreFacturaCliente(clienteSeleccionado);
  if (nombreFactura && nombreFactura !== clienteSeleccionado.nombre) info.push('🧾 La factura sale a nombre de ' + nombreFactura);
  if (clienteSeleccionado.ruta) info.push('Ruta ' + clienteSeleccionado.ruta);
  if (clienteSeleccionado.descuento > 0) info.push(`Descuento: ${(clienteSeleccionado.descuento * 100).toFixed(0)}%`);
  if (clienteSeleccionado.documento === 'albaran') info.push('🧾 Va con albarán (sin factura)');
  document.getElementById('detalleClienteInfo').innerHTML = info.map((l) => `<div>${escapeHtml(l)}</div>`).join('');

  cargarPreciosEspeciales(id);
}

/* ============ UTILIDADES ============ */
function stampHtml(estado) {
  let clase = 'stamp--pendiente';
  if (estado === 'Cobrado' || estado === 'Entregado') clase = 'stamp--cobrado';
  else if (estado === 'Anulado' || estado === 'Anulada') clase = 'stamp--anulado';
  return `<span class="stamp ${clase}">${escapeHtml(estado || 'Pendiente')}</span>`;
}

// ¿El texto contiene todas las palabras buscadas (sin tildes ni mayúsculas, en cualquier orden)?
// A quién se dirige la factura: la persona (nombre y apellidos) si los tiene; si no, el establecimiento
function nombreFacturaCliente(c) {
  const persona = [c.nombrePila, c.apellidos].filter(Boolean).join(' ').trim();
  return persona || c.establecimiento || c.nombre || '';
}

// Texto extra por el que se puede buscar a un cliente sin enseñarlo: nombre, apellidos, teléfonos, NIF y población
function textoBusquedaCliente(c) {
  return [c.establecimiento, c.nombrePila, c.apellidos, c.telefono, c.telefono2, c.nif, c.poblacion].filter(Boolean).join(' ');
}
function opcionCliente(c) {
  return `<option value="${c.id}" data-buscar="${escapeHtml(textoBusquedaCliente(c))}">${escapeHtml(c.nombre)}</option>`;
}

function coincideBusqueda(texto, consultaNormalizada) {
  const t = BuscadorClientes.normalizar(texto);
  return consultaNormalizada.split(/\s+/).filter(Boolean).every((palabra) => t.includes(palabra));
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


/* ============ LISTAS DE CLIENTES Y PRODUCTOS (rápidas) ============
 * Se piden a Google una sola vez aunque varias pantallas las necesiten a la
 * vez, se guardan en el móvil para tenerlas AL INSTANTE la próxima vez que se
 * abre la app, y se refrescan en segundo plano para que no se queden viejas. */
let _enCursoClientes = null;
let _enCursoProductos = null;

function priorizarLectura(accion) {
  const e = lecturasEnVuelo.get(accion + '|');
  if (e) subirPrioridad(e.entrada);
}

function cargarClientesCache(forzar) {
  if (clientesCache.length && !forzar) return Promise.resolve();
  if (_enCursoClientes && !forzar) priorizarLectura('clientes');   // alguien la necesita ya: deja de ser "de fondo"
  if (!_enCursoClientes) {
    _enCursoClientes = apiGet('clientes', undefined, { fondo: !!forzar })
      .then((r) => { if (r && r.ok) { clientesCache = r.data; guardarCache('clientes', r.data); } })
      .catch(() => {})
      .then(() => { _enCursoClientes = null; });
  }
  return _enCursoClientes;
}

function cargarProductosCache(forzar) {
  if (productosCache.length && !forzar) return Promise.resolve();
  if (_enCursoProductos && !forzar) priorizarLectura('productos');
  if (!_enCursoProductos) {
    _enCursoProductos = apiGet('productos', undefined, { fondo: !!forzar })
      .then((r) => { if (r && r.ok) { productosCache = r.data; guardarCache('productos', r.data); } })
      .catch(() => {})
      .then(() => { _enCursoProductos = null; });
  }
  return _enCursoProductos;
}

// Al arrancar (solo admin): usa lo guardado la última vez y refresca ambas listas a la vez
function precargarListas() {
  if (ROL !== 'admin') return;
  const c = leerCache('clientes');
  const p = leerCache('productos');
  if (Array.isArray(c) && c.length && !clientesCache.length) clientesCache = c;
  if (Array.isArray(p) && p.length && !productosCache.length) productosCache = p;
  cargarClientesCache(true);
  cargarProductosCache(true);
}

// Cuando se cambia un cliente/producto, se tira también la copia guardada
function olvidarListaGuardada(nombre) {
  try { localStorage.removeItem('cache_' + nombre); } catch (e) {}
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
  document.getElementById('btnFacturasDia').addEventListener('click', (e) => abrirDocsDelDia('facturas', e.currentTarget));
  cablearTramosDocs();
  document.getElementById('btnAlbaranesDia').addEventListener('click', (e) => abrirDocsDelDia('albaranes', e.currentTarget));
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
  const [r, rp] = await Promise.all([
    apiGet('todosProductos').catch((err) => ({ ok: false, error: String(err) })),
    apiGet('proveedores').catch(() => null),
  ]);
  const nombresProveedor = {};
  if (rp && rp.ok) { proveedoresCache = rp.data; rp.data.forEach((p) => { nombresProveedor[String(p.id)] = p.nombre; }); }
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  productosGestionCache = r.data;
  productosCache = []; // fuerza a refrescar el caché de productos activos en otras pantallas
  olvidarListaGuardada('productos');

  if (!r.data.length) { cont.innerHTML = '<div class="empty-state">Sin productos todavía.</div>'; return; }

  cont.innerHTML = r.data.map((p) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.nombre)}</div>
          <div class="card__meta">${p.codigo ? escapeHtml(p.codigo) + ' · ' : ''}${formatoEuros(p.precio)} · IVA ${(p.iva * 100).toFixed(0)}% · ${escapeHtml(p.categoria || 'Panadería')}${p.subcategoria ? ' — ' + escapeHtml(p.subcategoria) : ''}${p.unidadesCaja ? ' · ' + escapeHtml(p.unidadesCaja) : ''}${p.coste !== null && p.coste !== undefined ? ' · Coste ' + formatoEuros(p.coste) + ' (margen ' + formatoEuros(p.precio - p.coste) + ')' : ''}${rp && rp.ok ? ' · <span' + ((p.proveedorId === '' || p.proveedorId === null || p.proveedorId === undefined) ? ' style="opacity:0.7">sin proveedor' : '>' + (nombresProveedor[String(p.proveedorId)] ? 'Proveedor: ' + escapeHtml(nombresProveedor[String(p.proveedorId)]) : 'proveedor que ya no existe')) + '</span>' : ''}</div>
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

// Rellena el desplegable de proveedores. Mientras no está listo (o si falla la carga), al guardar NO se manda el
// proveedor: el servidor deja el que ya tenía (así no se borra por error).
let proveedorSelectListo = false;
let turnoSelectProveedor = 0;
async function prepararSelectProveedor(valorActual) {
  const sel = document.getElementById('prFormProveedor');
  const turno = ++turnoSelectProveedor;
  proveedorSelectListo = false;
  sel.disabled = true;
  sel.innerHTML = '<option value="">Cargando proveedores…</option>';
  const r = await apiGet('proveedores').catch(() => null);
  if (turno !== turnoSelectProveedor) return;   // se abrió otro producto mientras tanto
  if (!r || !r.ok) { sel.innerHTML = '<option value="">(no se pudieron cargar los proveedores)</option>'; return; }
  proveedoresCache = r.data;
  const actual = valorActual === undefined || valorActual === null ? '' : String(valorActual);
  const opciones = r.data.filter((p) => p.activo || String(p.id) === actual).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  let html = '<option value="">Sin proveedor</option>' + opciones.map((p) => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(p.nombre)}${p.activo ? '' : ' (dado de baja)'}</option>`).join('');
  if (actual && !r.data.some((p) => String(p.id) === actual)) html += `<option value="${escapeHtml(actual)}">(proveedor que ya no existe)</option>`;
  sel.innerHTML = html;
  sel.value = actual;
  sel.disabled = false;
  proveedorSelectListo = true;
}

function abrirFormularioProducto(producto) {
  prepararSelectProveedor(producto ? producto.proveedorId : '');
  document.getElementById('productoFormTitulo').textContent = producto ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('prFormId').value = producto ? producto.id : '';
  document.getElementById('prFormNombre').value = producto ? producto.nombre : '';
  document.getElementById('prFormCodigo').value = producto ? producto.codigo : '';
  document.getElementById('prFormPrecio').value = producto ? producto.precio : '';
  document.getElementById('prFormIva').value = producto ? Math.round(producto.iva * 100) : '';
  document.getElementById('prFormCategoria').value = producto && producto.categoria ? producto.categoria : 'Panadería';
  document.getElementById('prFormSubcategoria').value = producto ? (producto.subcategoria || '') : '';
  document.getElementById('prFormUnidadesCaja').value = producto ? (producto.unidadesCaja || '') : '';
  document.getElementById('prFormCoste').value = producto && producto.coste !== null && producto.coste !== undefined ? producto.coste : '';
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

  const datosProducto = {
    id: document.getElementById('prFormId').value,
    nombre: nombre,
    codigo: document.getElementById('prFormCodigo').value.trim(),
    precio: document.getElementById('prFormPrecio').value || '0',
    iva: String((Number(document.getElementById('prFormIva').value) || 0) / 100),
    categoria: document.getElementById('prFormCategoria').value,
    subcategoria: document.getElementById('prFormSubcategoria').value.trim(),
    unidadesCaja: document.getElementById('prFormUnidadesCaja').value.trim(),
    coste: document.getElementById('prFormCoste').value,
    activo: document.getElementById('prFormActivo').value,
  };
  if (proveedorSelectListo) datosProducto.proveedorId = document.getElementById('prFormProveedor').value;
  const r = await apiGet('guardarProducto', datosProducto).catch((err) => ({ ok: false, error: String(err) }));

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
}

function abrirFormularioCliente(cliente) {
  solicitudCliente = null;   // formulario nuevo: intento nuevo
  document.getElementById('clienteFormTitulo').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('clFormId').value = cliente ? cliente.id : '';
  document.getElementById('clFormNombre').value = cliente ? (cliente.establecimiento !== undefined ? cliente.establecimiento : cliente.nombre) || '' : '';
  document.getElementById('clFormTelefono').value = cliente ? cliente.telefono || '' : '';
  document.getElementById('clFormDireccion').value = cliente ? cliente.direccion || '' : '';
  document.getElementById('clFormNif').value = cliente ? cliente.nif || '' : '';
  document.getElementById('clFormRuta').value = cliente ? cliente.ruta || '' : '';
  document.getElementById('clFormFormaPago').value = cliente ? cliente.formaPago || '' : '';
  document.getElementById('clFormDescuento').value = cliente && cliente.descuento ? Math.round(cliente.descuento * 100) : '';
  document.getElementById('clFormRecargo').value = cliente && cliente.recargoEquivalencia ? 'true' : 'false';
  document.getElementById('clFormDocumento').value = cliente && cliente.documento === 'albaran' ? 'albaran' : 'factura';
  document.getElementById('clFormTelefono2').value = (cliente && cliente.telefono2) || '';
  document.getElementById('clFormNombrePila').value = (cliente && cliente.nombrePila) || '';
  document.getElementById('clFormApellidos').value = (cliente && cliente.apellidos) || '';
  document.getElementById('clFormCodigoPostal').value = (cliente && cliente.codigoPostal) || '';
  document.getElementById('clFormPoblacion').value = (cliente && cliente.poblacion) || '';
  document.getElementById('clFormActivo').value = 'true';
  document.getElementById('clienteFormMsg').textContent = '';
  cambiarTab('cliente-form');
}

let solicitudCliente = null;
let guardandoCliente = false;

async function guardarCliente() {
  if (guardandoCliente) return;
  const msg = document.getElementById('clienteFormMsg');
  const boton = document.getElementById('btnGuardarCliente');
  const establecimiento = document.getElementById('clFormNombre').value.trim();
  const nombrePila = document.getElementById('clFormNombrePila').value.trim();
  const apellidos = document.getElementById('clFormApellidos').value.trim();
  if (!establecimiento && !nombrePila && !apellidos) { msg.textContent = 'Pon el nombre del establecimiento, o el nombre y apellidos.'; msg.className = 'form-msg is-error'; return; }

  const datos = {
    id: document.getElementById('clFormId').value,
    // "nombre" es el nombre con el que se ve al cliente: lo entiende también un servidor que aún no conozca los tres datos
    nombre: establecimiento || [nombrePila, apellidos].filter(Boolean).join(' '),
    establecimiento: establecimiento,
    nombrePila: nombrePila,
    apellidos: apellidos,
    telefono: document.getElementById('clFormTelefono').value.trim(),
    telefono2: document.getElementById('clFormTelefono2').value.trim(),
    direccion: document.getElementById('clFormDireccion').value.trim(),
    codigoPostal: document.getElementById('clFormCodigoPostal').value.trim(),
    poblacion: document.getElementById('clFormPoblacion').value.trim(),
    nif: document.getElementById('clFormNif').value.trim(),
    ruta: document.getElementById('clFormRuta').value.trim(),
    formaPago: document.getElementById('clFormFormaPago').value.trim(),
    descuento: String((Number(document.getElementById('clFormDescuento').value) || 0) / 100),
    recargoEquivalencia: document.getElementById('clFormRecargo').value,
    documento: document.getElementById('clFormDocumento').value,
    activo: document.getElementById('clFormActivo').value,
  };
  const creando = !datos.id;
  if (creando) {   // cliente NUEVO: lleva código (editar uno existente no lo necesita)
    const huella = JSON.stringify(datos);
    if (!solicitudCliente || solicitudCliente.huella !== huella) solicitudCliente = { id: idUnico(), huella: huella };
    datos.idSolicitud = solicitudCliente.id;
  }

  guardandoCliente = true;
  const textoBoton = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  msg.textContent = 'Guardando… no hace falta pulsar otra vez.';
  msg.className = 'form-msg';

  try {
    let r;
    for (;;) {
      r = await apiGet('guardarCliente', datos).catch((err) => ({ ok: false, error: textoDeFallo(err), sinRespuesta: true }));
      if (r && r.duplicadoProbable) {
        const c = r.clienteExistente || {};
        const seguir = confirm(`Ya existe un cliente igual (${r.motivo}): ${c.nombre} (nº ${c.id}${c.nif ? ', NIF ' + c.nif : ''}${c.telefono ? ', tel. ' + c.telefono : ''}).\n\n¿Crear otro de todas formas?`);
        if (!seguir) { msg.textContent = 'No se ha creado: ya existía.'; msg.className = 'form-msg'; solicitudCliente = null; return; }
        datos.confirmarDuplicado = '1';
        continue;
      }
      if (r && r.telefonoRepetido) {
        // el teléfono ya lo tiene otro cliente: en la app de clientes entraría siempre ese
        const seguir = confirm(`${r.error}\n\n¿Guardar igualmente?`);
        if (!seguir) { msg.textContent = 'No se ha guardado: ese teléfono ya es de otro cliente.'; msg.className = 'form-msg'; return; }
        datos.confirmarTelefonoRepetido = 'true';
        continue;
      }
      break;
    }

    if (r.ok) {
      solicitudCliente = null;
      msg.textContent = r.repetido ? 'Cliente guardado (ya estaba creado: no se ha duplicado).' : 'Cliente guardado.';
      msg.className = 'form-msg is-ok';
      clientesCache = []; // fuerza a refrescar el caché en otras pantallas
      olvidarListaGuardada('clientes');
      setTimeout(() => cambiarTab('clientes-lista'), 500);
    } else {
      msg.textContent = r.sinRespuesta
        ? `No hemos podido confirmar si se guardó (${String(r.error).replace(/\.$/, '')}). Pulsa «Guardar» otra vez: es seguro, no se duplicará.`
        : 'Error: ' + (r.error || 'inténtalo de nuevo');
      msg.className = 'form-msg is-error';
    }
  } finally {
    guardandoCliente = false;
    boton.disabled = false;
    boton.textContent = textoBoton;
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
  // Enter en el precio = Añadir (para meter varios deprisa)
  document.getElementById('peInputPrecio').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); anadirPrecioEspecial(); }
  });
}

// Precios especiales: se ven AL INSTANTE y se mandan a Google de uno en uno, en cola, por detrás.
// (Antes cada guardado esperaba a Google y luego recargaba la lista: lento, y varios seguidos
// se amontonaban y llegaban a romper la respuesta.)
let preciosEspecialesMostrados = []; // { idProducto, producto, precio } del cliente que se ve
let colaPrecios = Promise.resolve();
let preciosPendientes = 0;
let errorPrecios = '';
let opsPrecios = []; // cambios recientes: { tipo: 'poner'|'quitar', idCliente, idProducto, producto, precio, fin, fallida }

// Si se intenta cerrar la página con precios aún sin enviar, el navegador pregunta antes (se perderían)
window.addEventListener('beforeunload', (e) => {
  if (preciosPendientes > 0) { e.preventDefault(); e.returnValue = ''; }
});

function mostrarEstadoPrecios() {
  const el = document.getElementById('peEstado');
  if (errorPrecios) { el.textContent = errorPrecios; el.className = 'form-msg is-error'; return; }
  el.textContent = preciosPendientes ? `Guardando ${preciosPendientes}…` : (el.dataset.huboCambios ? '✓ Todo guardado' : '');
  el.className = preciosPendientes ? 'form-msg' : 'form-msg is-ok';
}

function encolarPrecio(tarea, op) {
  preciosPendientes++;
  opsPrecios.push(op);
  opsPrecios = opsPrecios.filter((o) => !o.fin || Date.now() - o.fin < 60000); // se olvidan los de hace más de un minuto
  document.getElementById('peEstado').dataset.huboCambios = '1';
  mostrarEstadoPrecios();
  colaPrecios = colaPrecios.then(tarea).catch(() => {}).then(() => { preciosPendientes--; op.fin = Date.now(); mostrarEstadoPrecios(); });
}

function pintarPreciosEspeciales(idCliente) {
  const cont = document.getElementById('listaPreciosEspeciales');
  if (!preciosEspecialesMostrados.length) {
    cont.innerHTML = '<div class="empty-state">Este cliente paga el precio normal en todos los productos.</div>';
    return;
  }
  cont.innerHTML = preciosEspecialesMostrados.map((pe) => `
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

async function cargarPreciosEspeciales(idCliente) {
  const cont = document.getElementById('listaPreciosEspeciales');
  const select = document.getElementById('peSelectProducto');
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';
  errorPrecios = '';
  mostrarEstadoPrecios();

  await cargarProductosCache();
  select.innerHTML = '<option value="">Producto…</option>' +
    productosCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');

  await colaPrecios; // si aún hay guardados en marcha, se espera a que terminen
  const momentoDePedirla = Date.now();
  const r = await apiGet('preciosEspecialesCliente', { clienteId: idCliente }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }
  // Lo añadido o quitado desde que se pidió la lista (esté o no ya confirmado) se mantiene a la vista:
  // la lista pudo calcularse en Google ANTES de que ese cambio llegara.
  let lista = r.data.map((x) => Object.assign({}, x));
  opsPrecios.filter((o) => !o.fallida && (!o.fin || o.fin >= momentoDePedirla) && String(o.idCliente) === String(idCliente)).forEach((o) => {
    if (o.tipo === 'poner') {
      const x = lista.find((y) => String(y.idProducto) === String(o.idProducto));
      if (x) x.precio = o.precio; else lista.push({ idProducto: o.idProducto, producto: o.producto, precio: o.precio });
    } else {
      lista = lista.filter((y) => String(y.idProducto) !== String(o.idProducto));
    }
  });
  preciosEspecialesMostrados = lista;
  pintarPreciosEspeciales(idCliente);
}

function anadirPrecioEspecial() {
  if (!clienteSeleccionado) return;
  const idCliente = clienteSeleccionado.id;
  const clienteNombre = clienteSeleccionado.nombre;
  const idProducto = document.getElementById('peSelectProducto').value;
  const precio = document.getElementById('peInputPrecio').value;
  if (!idProducto) { alert('Selecciona un producto.'); return; }
  if (precio === '' || Number(precio) < 0) { alert('Pon un precio válido.'); return; }

  const producto = productosCache.find((p) => String(p.id) === String(idProducto));
  const nombreProducto = producto ? producto.nombre : '';

  // 1) se ve ya
  const existente = preciosEspecialesMostrados.find((x) => String(x.idProducto) === String(idProducto));
  const precioAnterior = existente ? existente.precio : undefined;
  if (existente) existente.precio = Number(precio);
  else preciosEspecialesMostrados.push({ idProducto, producto: nombreProducto, precio: Number(precio) });
  errorPrecios = '';
  pintarPreciosEspeciales(idCliente);
  document.getElementById('peInputPrecio').value = '';
  document.getElementById('peSelectProducto').value = '';
  document.getElementById('peSelectProducto').focus();

  // 2) se manda a Google, de uno en uno
  const op = { tipo: 'poner', idCliente, idProducto, producto: nombreProducto, precio: Number(precio) };
  encolarPrecio(async () => {
    const r = await apiGet('guardarPrecioEspecial', { idCliente, clienteNombre, idProducto, productoNombre: nombreProducto, precio })
      .catch((err) => ({ ok: false, error: String(err) }));
    if (r.ok) return;
    // falló: se deshace SOLO este cambio y se avisa
    if (clienteSeleccionado && String(clienteSeleccionado.id) === String(idCliente)) {
      if (precioAnterior === undefined) preciosEspecialesMostrados = preciosEspecialesMostrados.filter((x) => String(x.idProducto) !== String(idProducto));
      else { const x = preciosEspecialesMostrados.find((y) => String(y.idProducto) === String(idProducto)); if (x) x.precio = precioAnterior; }
      pintarPreciosEspeciales(idCliente);
    }
    op.fallida = true;
    errorPrecios = `No se pudo guardar ${nombreProducto}: ${r.error || 'error'}`;
    mostrarEstadoPrecios();
  }, op);
}

function quitarPrecioEspecial(idCliente, idProducto) {
  const quitado = preciosEspecialesMostrados.find((x) => String(x.idProducto) === String(idProducto));
  preciosEspecialesMostrados = preciosEspecialesMostrados.filter((x) => String(x.idProducto) !== String(idProducto));
  errorPrecios = '';
  pintarPreciosEspeciales(idCliente);

  const op = { tipo: 'quitar', idCliente, idProducto };
  encolarPrecio(async () => {
    const r = await apiGet('eliminarPrecioEspecial', { idCliente, idProducto }).catch((err) => ({ ok: false, error: String(err) }));
    // "No encontrado" = ya estaba quitado (p. ej. la primera petición sí llegó): vale igual
    if (r.ok || r.error === 'No encontrado') return;
    if (quitado && clienteSeleccionado && String(clienteSeleccionado.id) === String(idCliente)) {
      preciosEspecialesMostrados.push(quitado);
      pintarPreciosEspeciales(idCliente);
    }
    op.fallida = true;
    errorPrecios = `No se pudo quitar ${quitado ? quitado.producto : 'el precio'}: ${r.error || 'error'}`;
    mostrarEstadoPrecios();
  }, op);
}


/* ============ INCIDENCIAS: por qué no se pudo entregar (o cualquier problema con un pedido) ============ */
const MOTIVOS_INCIDENCIA = ['Cliente ausente', 'Negocio cerrado', 'No puede pagar', 'Pide que volvamos más tarde', 'Falta producto', 'Pedido equivocado'];
let incidenciaIdEnEdicion = null;

// Cuadro rojo con la incidencia (si la hay) dentro de la tarjeta de un pedido
function htmlIncidencia(p) {
  if (!p.incidencia) return '';
  return `<div class="card__incidencia"><strong>⚠ Incidencia:</strong> ${escapeHtml(p.incidencia)}${p.horaIncidencia ? ` <span>(${escapeHtml(p.horaIncidencia)})</span>` : ''}</div>`;
}

// El pedido que se está viendo, esté en la lista de Pedidos o en el Reparto
function encontrarPedidoLocal(id) {
  const enLista = ultimosPedidos.find((p) => String(p.id) === String(id));
  if (enLista) return enLista;
  return ultimoReparto ? ultimoReparto.clientes.find((p) => String(p.id) === String(id)) : null;
}

// Cambia la incidencia en lo que hay en pantalla (lista y reparto) y lo repinta
function aplicarIncidenciaLocal(id, texto, hora) {
  [ultimosPedidos, ultimoReparto ? ultimoReparto.clientes : []].forEach((lista) => {
    lista.forEach((p) => { if (String(p.id) === String(id)) { p.incidencia = texto; p.horaIncidencia = hora; } });
  });
  if (ultimosPedidos.length) pintarPedidos(ultimosPedidos);
  if (ultimoReparto) pintarReparto(ultimoReparto);
}

function abrirIncidencia(id) {
  const p = encontrarPedidoLocal(id);
  if (!p) return;
  incidenciaIdEnEdicion = id;
  document.getElementById('incidenciaPara').textContent = `${p.cliente} · ${formatoEuros(p.total)}`;
  document.getElementById('incidenciaTexto').value = p.incidencia || '';
  document.getElementById('btnQuitarIncidencia').style.display = p.incidencia ? '' : 'none';
  document.getElementById('incidenciaMsg').textContent = '';
  document.getElementById('modalIncidencia').classList.remove('tab--hidden');
  document.getElementById('incidenciaTexto').focus();
}

function cerrarIncidencia() {
  document.getElementById('modalIncidencia').classList.add('tab--hidden');
  incidenciaIdEnEdicion = null;
}

// Se ve al instante; si Google falla, vuelve a como estaba y se avisa
async function guardarIncidencia(quitar) {
  const id = incidenciaIdEnEdicion;
  if (id === null) return;
  const texto = quitar ? '' : document.getElementById('incidenciaTexto').value.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!quitar && !texto) {
    const msg = document.getElementById('incidenciaMsg');
    msg.textContent = 'Escribe qué ha pasado, o pulsa "Quitar la incidencia".';
    msg.className = 'form-msg is-error';
    return;
  }
  const p = encontrarPedidoLocal(id);
  const antes = p ? { incidencia: p.incidencia || '', hora: p.horaIncidencia || '' } : { incidencia: '', hora: '' };
  cerrarIncidencia();
  aplicarIncidenciaLocal(id, texto, texto ? horaAhoraCorta() : '');

  const r = await apiGet('guardarIncidencia', { idPedido: id, texto }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) {
    alert('No se pudo guardar la incidencia: ' + (r.error || 'error'));
    aplicarIncidenciaLocal(id, antes.incidencia, antes.hora);
  }
}

function cablearIncidencias() {
  const contMotivos = document.getElementById('incidenciaMotivos');
  contMotivos.innerHTML = MOTIVOS_INCIDENCIA.map((m) => `<button type="button" class="chip-btn" data-motivo="${escapeHtml(m)}">${escapeHtml(m)}</button>`).join('');
  contMotivos.querySelectorAll('[data-motivo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ta = document.getElementById('incidenciaTexto');
      const actual = ta.value.trim();
      ta.value = actual ? (/[.!?]$/.test(actual) ? actual + ' ' : actual + '. ') + btn.dataset.motivo : btn.dataset.motivo;
      ta.focus();
    });
  });
  document.getElementById('btnGuardarIncidencia').addEventListener('click', () => guardarIncidencia(false));
  document.getElementById('btnQuitarIncidencia').addEventListener('click', () => guardarIncidencia(true));
  document.getElementById('btnCerrarIncidencia').addEventListener('click', cerrarIncidencia);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && incidenciaIdEnEdicion !== null) cerrarIncidencia(); });
  // El aviso de Inicio abre la lista de pedidos de hoy con incidencia
  document.getElementById('avisoIncidencias').addEventListener('click', () => {
    pedidosFiltroPendiente = { ini: hoyISO(), fin: hoyISO(), clienteId: '', estado: 'incidencia' };
    cambiarTab('pedidos-lista');
  });
}


/* ============ BUSCAR DUPLICADOS (los que ya hay) ============ */
function cablearDuplicados() {
  ['btnBuscarDuplicados', 'btnBuscarDuplicadosClientes'].forEach((id) => document.getElementById(id).addEventListener('click', buscarDuplicados));
  document.getElementById('btnCerrarDuplicados').addEventListener('click', () => document.getElementById('modalDuplicados').classList.add('tab--hidden'));
}

async function buscarDuplicados() {
  const cont = document.getElementById('duplicadosResultado');
  document.getElementById('modalDuplicados').classList.remove('tab--hidden');
  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('buscarDuplicados', { dias: 14 }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo buscar: ${escapeHtml(r.error || '')}</div>`; return; }
  const d = r.data;
  if (!d.pedidos.length && !d.clientes.length) {
    cont.innerHTML = '<div class="empty-state">✓ No hay pedidos duplicados (últimos 14 días y próximos 7) ni clientes duplicados.</div>';
    return;
  }
  let html = '';
  if (d.pedidos.length) {
    html += `<div class="section-label">Pedidos iguales (${d.pedidos.length})</div>`;
    html += d.pedidos.map((g) => `
      <div class="card">
        <div class="card__name">${escapeHtml(g.cliente)} · ${escapeHtml(g.fechaEntrega)}</div>
        <div class="card__meta">${escapeHtml(g.tipo)} · ${formatoEuros(g.total)} · ${escapeHtml(g.pedido)}</div>
        ${g.pedidos.map((p, i) => `
          <div class="product-row" style="margin-top:8px; align-items:center; gap:8px;">
            <div style="flex:1; font-size:13.5px;">
              <strong>#${escapeHtml(String(p.id))}</strong> · creado ${escapeHtml(p.creado)} · ${escapeHtml(p.canal || '')}
              ${p.entregado ? ' · <em>entregado</em>' : ''}${p.cobrado ? ' · <em>cobrado</em>' : ''}
              ${i === 0 ? ' · <span style="color:var(--ok, #2E7D4F); font-weight:700;">se conserva</span>' : ''}
            </div>
            ${i === 0 ? '' : `<button class="chip-btn" data-anular-duplicado="${escapeHtml(String(p.id))}" data-cliente="${escapeHtml(g.cliente)}">Anular #${escapeHtml(String(p.id))}</button>`}
          </div>`).join('')}
      </div>`).join('');
  }
  if (d.clientes.length) {
    html += `<div class="section-label" style="margin-top:14px;">Clientes iguales (${d.clientes.length})</div>`;
    html += d.clientes.map((g) => `
      <div class="card">
        <div class="card__meta" style="font-weight:700;">${escapeHtml(g.motivo)}</div>
        ${g.clientes.map((c) => `<div style="font-size:13.5px; margin-top:6px;"><strong>${escapeHtml(c.nombre)}</strong> (nº ${escapeHtml(String(c.id))})${c.nif ? ' · NIF ' + escapeHtml(c.nif) : ''}${c.telefono ? ' · ' + escapeHtml(String(c.telefono)) : ''}${c.activo ? '' : ' · <em>inactivo</em>'}</div>`).join('')}
        <div class="card__meta" style="margin-top:8px;">Revísalos en Clientes: si sobra uno, ponlo como inactivo (Activo = No) para no perder su historial.</div>
      </div>`).join('');
  }
  cont.innerHTML = html;
  cont.querySelectorAll('[data-anular-duplicado]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.anularDuplicado;
      if (!confirm(`¿Anular el pedido #${id} de ${btn.dataset.cliente}? Se conserva el otro, que es igual. Se borrará también su factura y no se puede deshacer.`)) return;
      btn.disabled = true;
      const rr = await apiGet('anularPedido', { idPedido: id }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
      if (!rr.ok) { alert('No se pudo anular: ' + (rr.error || 'error')); btn.disabled = false; return; }
      buscarDuplicados();
    });
  });
}

/* ============ FACTURAS Y ALBARANES DEL DÍA POR TRAMOS (de 10 en 10) ============
 * Un PDF con todos los documentos de un reparto grande tarda mucho en construirse en Google. Si hay más de 10, se
 * ofrecen tramos (1-10, 11-20…) que salen en pocos segundos y se imprimen por partes; también "todos a la vez".
 * Es la misma ventana para las dos cosas: solo cambian los textos y las acciones del servidor. */
const DOCS_DEL_DIA = {
  facturas: { lotes: 'facturasDiaLotes', pdf: 'facturasDiaPdf', Plural: 'Facturas', plural: 'facturas', todas: 'Todas', todasMin: 'todas', hechas: 'descargadas', sinDatos: 'No hay pedidos con factura para este día.' },
  albaranes: { lotes: 'albaranesDiaLotes', pdf: 'albaranesDiaPdf', Plural: 'Albaranes', plural: 'albaranes', todas: 'Todos', todasMin: 'todos', hechas: 'descargados', sinDatos: 'No hay albaranes para este día.' },
};
let generandoDocsDia = false;
const tramosDocsHechos = {};   // tipo|fecha|primera-ultima → ya descargado (se marca con ✓)

// Pide un PDF de los documentos del día (todos, o un tramo) y lo descarga. Devuelve la respuesta del servidor.
async function generarDocsDiaPdf(tipo, fecha, desde, hasta) {
  const params = { fecha: fecha };
  if (desde) { params.desde = String(desde); params.hasta = String(hasta); }
  const r = await apiGet(DOCS_DEL_DIA[tipo].pdf, params).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (!r.ok) return r;
  await descargarPDF(r.base64, r.nombre);
  if (r.omitidas) alert(`Aviso: ${r.omitidas} pedido(s) no tenían factura enlazada y no se incluyeron.`);
  return r;
}

async function abrirDocsDelDia(tipo, boton) {
  if (generandoDocsDia) return;
  const cfg = DOCS_DEL_DIA[tipo];
  const fecha = fechaOffsetDDMMYYYY(offsetRepartoSeleccionado);
  let datos = null;
  await conEstadoCarga(boton, 'Preparando…', async () => {
    const r = await apiGet(cfg.lotes, { fecha: fecha }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
    // servidor antiguo (aún sin los tramos): se genera todo de una vez, como siempre
    if ((!r.ok && /Acci[oó]n no reconocida/i.test(String(r.error || ''))) || (r.ok && (!r.data || typeof r.data.total !== 'number'))) { datos = { sinTramos: true }; return; }
    if (!r.ok) { alert('No se pudo preparar: ' + (r.error || 'error')); return; }
    if (r.data.total === 0) { alert(cfg.sinDatos + (r.data.sinFactura ? ` (${r.data.sinFactura} pedido(s) sin factura enlazada)` : '')); return; }
    datos = r.data;
  });
  if (!datos) return;
  if (datos.sinTramos || datos.lotes.length <= 1) {
    // pocos documentos (o servidor antiguo): de una vez, como siempre
    generandoDocsDia = true;
    try {
      await conEstadoCarga(boton, 'Generando…', async () => {
        const r = await generarDocsDiaPdf(tipo, fecha, '', '');
        if (!r.ok) alert('No se pudo generar: ' + (r.error || 'error'));
      });
    } finally { generandoDocsDia = false; }
    return;
  }
  pintarTramosDocs(tipo, datos, fecha);
}

function pintarTramosDocs(tipo, d, fecha) {
  const cfg = DOCS_DEL_DIA[tipo];
  const modal = document.getElementById('modalFacturasLotes');
  modal.dataset.tipo = tipo;
  document.getElementById('facturasLotesTitulo').textContent = cfg.Plural + ' del ' + fecha;
  document.getElementById('facturasLotesAyuda').textContent = `${d.total} ${cfg.plural}, ordenad${tipo === 'albaranes' ? 'os' : 'as'} por número. Saca cada tramo por separado (salen en pocos segundos) o ${cfg.todasMin} a la vez.` +
    (d.sinFactura ? ` ${d.sinFactura} pedido(s) no tienen factura enlazada y no aparecen.` : '');
  document.getElementById('facturasLotesMsg').textContent = '';
  const clave = (l) => tipo + '|' + fecha + '|' + l.primera + '-' + l.ultima;
  document.getElementById('facturasLotesLista').innerHTML = d.lotes.map((l) => `
    <button class="btn-secondary" data-tramo-desde="${l.desde}" data-tramo-hasta="${l.hasta}" data-tramo-clave="${escapeHtml(clave(l))}" style="width:100%; text-align:left;">
      ${tramosDocsHechos[clave(l)] ? '✓ ' : ''}${cfg.Plural} ${l.desde}–${l.hasta} <span class="card__meta">(nº ${escapeHtml(String(l.primera))} a ${escapeHtml(String(l.ultima))})</span>
    </button>`).join('');
  const todas = document.getElementById('btnFacturasTodasJuntas');
  todas.textContent = `${cfg.todas} a la vez (${d.total}) — puede tardar varios minutos`;
  todas.dataset.claves = JSON.stringify(d.lotes.map(clave));
  todas.dataset.fecha = fecha;
  document.querySelectorAll('#facturasLotesLista [data-tramo-desde]').forEach((b) => {
    b.dataset.fecha = fecha;
    b.addEventListener('click', () => sacarTramoDocs(b, b.dataset.tramoDesde, b.dataset.tramoHasta, [b.dataset.tramoClave]));
  });
  modal.classList.remove('tab--hidden');
}

async function sacarTramoDocs(boton, desde, hasta, claves) {
  if (generandoDocsDia) return;
  const modal = document.getElementById('modalFacturasLotes');
  const tipo = modal.dataset.tipo || 'facturas';
  const cfg = DOCS_DEL_DIA[tipo];
  const msg = document.getElementById('facturasLotesMsg');
  const botones = Array.from(modal.querySelectorAll('button')).filter((b) => b.id !== 'btnCerrarFacturasLotes');
  generandoDocsDia = true;
  botones.forEach((b) => { b.disabled = true; });
  msg.textContent = desde ? `Generando ${tipo === 'albaranes' ? 'los' : 'las'} ${cfg.plural} ${desde}–${hasta}…` : `Generando ${cfg.todasMin} ${tipo === 'albaranes' ? 'los' : 'las'} ${cfg.plural}… puede tardar 1-3 minutos. No cierres la app.`;
  msg.className = 'form-msg';
  try {
    const r = await generarDocsDiaPdf(tipo, boton.dataset.fecha, desde, hasta);
    if (!r.ok) { msg.textContent = 'No se pudo generar: ' + (r.error || 'error'); msg.className = 'form-msg is-error'; return; }
    claves.forEach((c) => { tramosDocsHechos[c] = true; });
    document.querySelectorAll('#facturasLotesLista [data-tramo-clave]').forEach((b) => {
      if (tramosDocsHechos[b.dataset.tramoClave] && !b.textContent.trim().startsWith('✓')) b.firstChild.textContent = '✓ ' + b.firstChild.textContent.trimStart();
    });
    msg.textContent = desde ? `Listo: ${cfg.plural} ${desde}–${hasta} ${cfg.hechas}.` : `Listo: ${cfg.todasMin} ${tipo === 'albaranes' ? 'los' : 'las'} ${cfg.plural} ${cfg.hechas}.`;
    msg.className = 'form-msg is-ok';
  } finally {
    generandoDocsDia = false;
    botones.forEach((b) => { b.disabled = false; });
  }
}

function cablearTramosDocs() {
  document.getElementById('btnCerrarFacturasLotes').addEventListener('click', () => document.getElementById('modalFacturasLotes').classList.add('tab--hidden'));
  document.getElementById('btnFacturasTodasJuntas').addEventListener('click', (e) => {
    const b = e.currentTarget;
    sacarTramoDocs(b, '', '', JSON.parse(b.dataset.claves || '[]'));
  });
}

/* ============ PEDIDO A PROVEEDORES ============
 * Lo que hay que comprar para los pedidos de clientes de un día de entrega, agrupado por el proveedor de cada
 * producto, con su PDF para mandárselo. Solo el administrador. */
let descargandoPedidoProveedor = false;

function iniciarPedidoProveedores() {
  const campo = document.getElementById('ppFecha');
  if (!campo.value) campo.value = sumarDiasISO(hoyISO(), 1);   // por defecto, mañana: lo que se compra esta noche
  cargarPedidoProveedores();
}

async function cargarPedidoProveedores(opciones) {
  const cont = document.getElementById('listaPedidoProveedores');
  const iso = document.getElementById('ppFecha').value;
  const botonTodos = document.getElementById('btnPedidoProveedoresTodos');
  const botonGastos = document.getElementById('btnPedidoProveedoresGastos');
  if (!(opciones && opciones.conservarMensaje)) document.getElementById('ppMsg').textContent = '';
  if (!iso) { cont.innerHTML = '<div class="empty-state">Elige un día.</div>'; return; }
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';
  botonTodos.disabled = true;
  botonGastos.disabled = true;

  const r = await apiGet('pedidoProveedores', { fecha: formatoFechaES(iso) }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (document.getElementById('ppFecha').value !== iso) return;   // cambió de día mientras cargaba
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  const d = r.data;
  if (!d.hayPedidos) {
    cont.innerHTML = `<div class="empty-state">No hay pedidos de clientes para el ${escapeHtml(d.fecha)}.</div>`;
    return;
  }
  const linea = (p) => `<div style="font-size:14px; margin-top:4px;"><strong>${escapeHtml(String(p.cantidad))}</strong> × ${escapeHtml(p.producto)}${p.formato ? ' <span class="card__meta">(' + escapeHtml(p.formato) + ')</span>' : ''}${p.deLineasLibres ? ' <span class="card__meta">(incluye ' + escapeHtml(String(p.deLineasLibres)) + ' con otro precio)</span>' : ''}${p.fueraDeCatalogo ? ' <em class="card__meta">(fuera de catálogo)</em>' : ''}</div>`;

  let html = d.proveedores.map((p) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.nombre)}${p.activo ? '' : ' <span class="card__meta">(dado de baja)</span>'}</div>
          <div class="card__meta">${p.telefono ? '<a href="tel:' + escapeHtml(String(p.telefono).replace(/[^\d+]/g, '')) + '">' + escapeHtml(String(p.telefono)) + '</a>' : 'sin teléfono'}${p.nif ? ' · ' + escapeHtml(String(p.nif)) : ''}</div>
        </div>
        <div class="card__name">${escapeHtml(String(p.total))}</div>
      </div>
      ${p.productos.map(linea).join('')}
      <div style="margin-top:8px;">${bloqueGastoProveedor(p)}</div>
      <div class="card__actions"><button class="chip-btn" data-pp-pdf="${escapeHtml(String(p.idProveedor))}">PDF para ${escapeHtml(p.nombre)}</button>${botonGastoProveedor(p)}</div>
    </div>`).join('');

  if (d.sinProveedor.productos.length) {
    html += `
    <div class="card" style="border-color:var(--warn-red);">
      <div class="card__name" style="color:var(--warn-red);">Sin proveedor asignado (${escapeHtml(String(d.sinProveedor.total))})</div>
      <div class="card__meta">Estos productos no entran en ningún PDF. Asígnales proveedor en Productos.</div>
      ${d.sinProveedor.productos.map(linea).join('')}
      <div class="card__actions"><button class="chip-btn" data-pp-productos="1">Ir a Productos</button></div>
    </div>`;
  }
  cont.innerHTML = html;
  botonTodos.disabled = !d.proveedores.length;
  botonGastos.disabled = !d.proveedores.some(puedeAnadirseAGastos);
  cont.querySelectorAll('[data-pp-gasto]').forEach((b) => b.addEventListener('click', () => anadirGastoEstimado(b.dataset.ppGasto, b)));
  cont.querySelectorAll('[data-pp-pdf]').forEach((b) => b.addEventListener('click', () => descargarPedidoProveedor(b.dataset.ppPdf, b)));
  cont.querySelectorAll('[data-pp-productos]').forEach((b) => b.addEventListener('click', () => cambiarTab('productos')));
}

// ¿Se puede añadir este proveedor a gastos? Hace falta que tenga costes puestos y que no esté ya cubierto por una factura
function puedeAnadirseAGastos(p) {
  return !!(p.estimado && p.estimado.conCoste > 0) && !(p.gasto && p.gasto.estado === 'Cubierto');
}

// Lo que se gastará en este proveedor (cantidad × coste de cada producto, más su IVA) y si ya está en gastos
function bloqueGastoProveedor(p) {
  const e = p.estimado || {};
  let html;
  if (!e.conCoste) html = '<div class="card__meta" style="color:var(--warn-red);">No se puede estimar el gasto: ningún producto de este proveedor tiene el coste puesto.</div>';
  else {
    html = `<div class="card__meta">Gasto estimado: <strong>${formatoEuros(e.total)}</strong> (base ${formatoEuros(e.base)} + IVA ${formatoEuros(e.iva)})</div>`;
    if (e.sinCoste && e.sinCoste.length) html += `<div class="card__meta" style="color:var(--warn-red);">Sin coste, no suman: ${escapeHtml(e.sinCoste.join(', '))}</div>`;
  }
  const g = p.gasto;
  if (g && g.estado === 'Estimado') html += `<div class="card__meta">✓ En gastos como estimado (${formatoEuros(g.total)})</div>`;
  else if (g && g.estado === 'Cubierto') html += `<div class="card__meta">✓ Cubierto por la factura${g.numFactura ? ' nº ' + escapeHtml(g.numFactura) : ''}</div>`;
  return html;
}

function botonGastoProveedor(p) {
  if (!puedeAnadirseAGastos(p)) return '';
  const hay = p.gasto && p.gasto.estado === 'Estimado';
  return `<button class="chip-btn" data-pp-gasto="${escapeHtml(String(p.idProveedor))}">${hay ? 'Actualizar gasto estimado' : 'Añadir a gastos (estimado)'}</button>`;
}

// Lo que se cuenta tras añadir a gastos: por cada proveedor, lo hecho o por qué no se pudo
function resumenGastoAnadido(r) {
  return (r.resultados || []).map((x) => x.ok
    ? `${x.nombre}: gasto estimado ${x.accion === 'creado' ? 'añadido' : 'actualizado'} (${formatoEuros(x.total)})${x.sinCoste && x.sinCoste.length ? ', sin contar ' + x.sinCoste.join(', ') + ' (sin coste)' : ''}.`
    : `${x.nombre}: ${x.error}`).join(' ');
}

let anadiendoGasto = false;
async function anadirGastoEstimado(idProveedor, boton) {
  if (anadiendoGasto) return;
  const msg = document.getElementById('ppMsg');
  anadiendoGasto = true;
  if (boton) boton.disabled = true;
  msg.textContent = 'Añadiendo a gastos…';
  msg.className = 'form-msg';
  try {
    const r = await apiGet('gastoPedidoProveedores', { fecha: formatoFechaES(document.getElementById('ppFecha').value), idProveedor: idProveedor || 'todos' })
      .catch((err) => ({ ok: false, error: textoDeFallo(err) }));
    if (!r.ok) { msg.textContent = r.error || 'No se pudo añadir a gastos.'; msg.className = 'form-msg is-error'; return; }
    msg.textContent = resumenGastoAnadido(r);
    msg.className = r.conProblema ? 'form-msg is-error' : 'form-msg is-ok';
    cargarPedidoProveedores({ conservarMensaje: true });   // para que se vea ya el estado de cada proveedor
  } finally {
    anadiendoGasto = false;
    if (boton) boton.disabled = false;
  }
}

async function descargarPedidoProveedor(idProveedor, boton) {
  if (descargandoPedidoProveedor) return;
  const msg = document.getElementById('ppMsg');
  descargandoPedidoProveedor = true;
  if (boton) boton.disabled = true;
  msg.textContent = 'Generando el PDF…';
  msg.className = 'form-msg';
  try {
    const r = await apiGet('pedidoProveedoresPdf', { fecha: formatoFechaES(document.getElementById('ppFecha').value), idProveedor: idProveedor || '' })
      .catch((err) => ({ ok: false, error: textoDeFallo(err) }));
    if (!r.ok) { msg.textContent = r.error || 'No se pudo generar el PDF.'; msg.className = 'form-msg is-error'; return; }
    await descargarPDF(r.base64, r.nombre);
    msg.textContent = 'PDF listo.';
    msg.className = 'form-msg is-ok';
    if (document.getElementById('ppAnadirGastoPdf').checked) {
      const g = await apiGet('gastoPedidoProveedores', { fecha: formatoFechaES(document.getElementById('ppFecha').value), idProveedor: idProveedor || 'todos' })
        .catch((err) => ({ ok: false, error: textoDeFallo(err) }));
      msg.textContent = 'PDF listo. ' + (g.ok ? resumenGastoAnadido(g) : (g.error || 'No se pudo añadir a gastos.'));
      msg.className = !g.ok || g.conProblema ? 'form-msg is-error' : 'form-msg is-ok';
      if (g.ok) cargarPedidoProveedores({ conservarMensaje: true });
    }
  } finally {
    descargandoPedidoProveedor = false;
    if (boton) boton.disabled = false;
  }
}

function cablearPedidoProveedores() {
  document.getElementById('ppFecha').addEventListener('change', cargarPedidoProveedores);
  document.querySelectorAll('[data-pp-rapido]').forEach((b) => b.addEventListener('click', () => {
    document.getElementById('ppFecha').value = sumarDiasISO(hoyISO(), b.dataset.ppRapido === 'manana' ? 1 : 0);
    cargarPedidoProveedores();
  }));
  document.getElementById('btnPedidoProveedoresTodos').addEventListener('click', (e) => descargarPedidoProveedor('', e.currentTarget));
  document.getElementById('btnPedidoProveedoresGastos').addEventListener('click', (e) => anadirGastoEstimado('', e.currentTarget));
  const casilla = document.getElementById('ppAnadirGastoPdf');
  try { casilla.checked = localStorage.getItem('ppAnadirGastoPdf') === '1'; } catch (e) { /* sin almacenamiento */ }
  casilla.addEventListener('change', () => { try { localStorage.setItem('ppAnadirGastoPdf', casilla.checked ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } });
}

/* ============ TELÉFONOS DE LOS CLIENTES Y ESTADO DEL SERVIDOR ============ */
// Aviso en pantalla: alguna petición ha dado "x is not defined" = falta pegar/actualizar un archivo de Apps Script
function mostrarAvisoServidor() {
  const aviso = document.getElementById('avisoServidor');
  aviso.textContent = '⚠ El servidor (Apps Script) parece estar a medio actualizar: falta pegar algún archivo. Mira Empresa → Estado del servidor.';
  aviso.classList.remove('tab--hidden');
}

async function comprobarServidor() {
  const caja = document.getElementById('estadoServidor');
  caja.textContent = 'Comprobando…';
  const r = await apiGet('ping').catch((err) => ({ ok: false, error: String(err) }));
  if (!r || !r.ok) {
    caja.innerHTML = `<strong style="color:var(--warn-red)">⚠ El servidor no responde bien a la comprobación.</strong><br>Puede ser que falte pegar <code>api_pwa.gs</code> o publicar una nueva versión (Implementar → Gestionar implementaciones → Nueva versión).<br><span style="color:var(--ink-muted)">${escapeHtml((r && r.error) || '')}</span>`;
    mostrarAvisoServidor();
    return;
  }
  if (r.coherente) {
    caja.innerHTML = `✓ <strong>Servidor al día</strong> · versión ${escapeHtml(r.version)}<br><span style="color:var(--ink-muted)">Todos los archivos de Apps Script son de la misma tanda.</span>`;
    document.getElementById('avisoServidor').classList.add('tab--hidden');
  } else {
    caja.innerHTML = `<strong style="color:var(--warn-red)">⚠ Servidor a medio actualizar</strong> · versión ${escapeHtml(r.version)}<br>Falta pegar o actualizar:<br>${(r.faltan || []).map((f) => '· ' + escapeHtml(String(f).split(':')[0])).filter((v, i, a) => a.indexOf(v) === i).join('<br>')}<br><span style="color:var(--ink-muted)">Pega esos archivos y vuelve a publicar la versión.</span>`;
    mostrarAvisoServidor();
  }
}

async function revisarTelefonos() {
  const cont = document.getElementById('telefonosResultado');
  cont.innerHTML = '<div class="empty-state">Revisando…</div>';
  document.getElementById('modalTelefonos').classList.remove('tab--hidden');
  const r = await apiGet('revisarTelefonos').catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo revisar: ${escapeHtml(r.error || '')}</div>`; return; }
  if (!r.data.conProblema) {
    cont.innerHTML = `<div class="empty-state">✓ Los ${r.data.totalClientes} clientes tienen un teléfono válido y sin repetir.</div>`;
    return;
  }
  cont.innerHTML = `<div class="card__meta" style="margin-bottom:6px;">${r.data.conProblema} de ${r.data.totalClientes} clientes con algo que revisar:</div>` +
    r.data.clientes.map((c) => `
      <div class="card">
        <div class="card__name">${escapeHtml(c.nombre)}${c.activo ? '' : ' <span class="card__meta">(inactivo)</span>'}</div>
        <div class="card__meta">En el Sheet: ${c.telefono ? escapeHtml(c.telefono) : '(vacío)'}</div>
        ${c.problemas.map((p) => `<div class="card__incidencia">${escapeHtml(p)}</div>`).join('')}
      </div>
    `).join('');
}

function cablearTelefonosYServidor() {
  document.getElementById('btnRevisarTelefonos').addEventListener('click', revisarTelefonos);
  document.getElementById('btnCerrarTelefonos').addEventListener('click', () => document.getElementById('modalTelefonos').classList.add('tab--hidden'));
  document.getElementById('btnComprobarServidor').addEventListener('click', comprobarServidor);
}

/* ============ PRODUCTOS EN NUEVO PEDIDO / EDITAR
   (catálogo + fuera de catálogo, todo en una sola lista por pantalla) ============ */
const CONFIG_ITEMS = {
  nuevo: { prefijo: 'n', obtener: () => itemsNuevo, poner: (l) => { itemsNuevo = l; }, listaId: 'listaProductosNuevo', totalId: 'nuevoTotal' },
  editarPedido: { prefijo: 'ep', obtener: () => itemsEditarPedido, poner: (l) => { itemsEditarPedido = l; }, listaId: 'listaEditarPedido', totalId: 'editarPedidoTotal' },
  editarFactura: { prefijo: 'ef', obtener: () => itemsEditarFactura, poner: (l) => { itemsEditarFactura = l; }, listaId: 'listaEditarFactura', totalId: 'editarFacturaTotal' },
};

function cablearProductosLibres() {
  Object.keys(CONFIG_ITEMS).forEach((tipo) => {
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

// Un albarán es un documento de entrega y NO lleva IVA: su total es la base. Nuevo pedido: según el tipo elegido; editar pedido: según el pedido.
function pedidoSinIva(tipo) {
  if (tipo === 'nuevo') return document.getElementById('selectTipoDocumento').value === 'albaran';
  if (tipo === 'editarPedido') return editarPedidoEsAlbaran;
  return false;
}

function recalcularTotal(tipo) {
  const cfg = CONFIG_ITEMS[tipo];
  let total = 0;
  const sinIva = pedidoSinIva(tipo);
  cfg.obtener().forEach((it) => { total += it.precio * it.cantidad * (sinIva ? 1 : 1 + it.iva); }); // iva ya es fracción en los dos tipos
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

  await cargarProductosCache();
  rellenarSelectProductos('editarPedido');

  const r = await apiGet('itemsPedido', { idPedido: idPedidoEnEdicion }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok || !r.data) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml((r && r.error) || 'pedido no encontrado')}</div>`; return; }

  document.getElementById('editarPedidoCliente').textContent =
    `${r.data.documento === 'Albarán' ? 'Albarán' : 'Pedido'} #${idPedidoEnEdicion} · ${r.data.cliente}`;
  const selFecha = document.getElementById('epFechaEntrega');
  selFecha.value = 'mantener';
  selFecha.options[0].textContent = `Mantener la fecha actual (${r.data.fechaEntrega})`;
  editarPedidoEsAlbaran = r.data.documento === 'Albarán';
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

  const nuevaFecha = document.getElementById('epFechaEntrega').value;
  const params = { idPedido: idPedidoEnEdicion, items: JSON.stringify(items) };
  if (nuevaFecha !== 'mantener') params.fechaEntrega = nuevaFecha;
  const r = await apiGet('editarPedido', params).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (r.ok) {
    msg.textContent = `Pedido actualizado (${formatoEuros(r.total)})` +
      (nuevaFecha === 'manana' ? ', pasado a mañana.' : nuevaFecha === 'hoy' ? ', pasado a hoy.' : '.');
    msg.className = 'form-msg is-ok';
    setTimeout(() => cambiarTab('pedidos-lista'), 700);
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

  await cargarProductosCache();
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

  const r = await apiGet('editarFactura', { idFactura: idFacturaEnEdicion, items: JSON.stringify(items) }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
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
      <div class="card__meta">Base: ${formatoEuros(c.base)} · IVA: ${formatoEuros(c.iva)}</div>
    </div>
  `).join('');
}

/* ============ RESUMEN POR PERIODO E IVA A LIQUIDAR (un solo informe) ============ */
function prepararResumenPeriodo() {
  const anio = document.getElementById('anioPeriodo');
  if (!anio.value) anio.value = new Date().getFullYear();
}

async function buscarResumenPeriodo() {
  const anio = document.getElementById('anioPeriodo').value.trim();
  const agrupacion = document.getElementById('agrupacionPeriodo').value;
  const cont = document.getElementById('listaPeriodo');
  const total = document.getElementById('periodoTotalAnual');
  if (!anio) { cont.innerHTML = '<div class="empty-state">Escribe un año.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('resumenPeriodo', { anio, agrupacion }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  const conDatos = r.data.periodos.filter((p) => p.numFacturas > 0 || p.numAnuladas > 0 || p.ivaSoportado !== 0 || p.baseCompras !== 0);
  if (!conDatos.length) {
    cont.innerHTML = '<div class="empty-state">Sin facturas ni compras en ese año.</div>';
    total.textContent = '';
    return;
  }

  cont.innerHTML = conDatos.map((p) => `
    <div class="card">
      <div class="card__top">
        <div class="card__name">${escapeHtml(p.periodo)}</div>
        <div class="card__total">${formatoEuros(p.total)}</div>
      </div>
      <div class="card__products">${p.numFacturas} factura(s)${p.numAnuladas ? ` · ${p.numAnuladas} anulada(s)` : ''} · Base: ${formatoEuros(p.base)} · IVA: ${formatoEuros(p.iva)}${p.recargo ? ' · Recargo: ' + formatoEuros(p.recargo) : ''}</div>
      <div class="card__products">Cobrado: ${formatoEuros(p.cobrado)} · Pendiente: ${formatoEuros(p.pendiente)}</div>
      <div class="card__products"><strong>IVA a liquidar: ${formatoEuros(p.ivaALiquidar)}</strong> (repercutido ${formatoEuros(p.iva)} − soportado ${formatoEuros(p.ivaSoportado)})</div>
    </div>
  `).join('');
  total.textContent = `Facturado ${r.data.anio}: ${formatoEuros(r.data.totalAnual)}  ·  IVA repercutido: ${formatoEuros(r.data.totalRepercutido)}  ·  IVA soportado: ${formatoEuros(r.data.totalSoportado)}  ·  A liquidar: ${formatoEuros(r.data.totalALiquidar)}`;
}

async function descargarResumenPeriodoPDF() {
  const anio = document.getElementById('anioPeriodo').value.trim();
  const agrupacion = document.getElementById('agrupacionPeriodo').value;
  if (!anio) { alert('Escribe un año primero.'); return; }
  const r = await apiGet('resumenPeriodoPdf', { anio, agrupacion }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok) { alert('Error: ' + (r.error || 'inténtalo de nuevo')); return; }
  await descargarPDF(r.base64, r.nombre);
}

function cablearInformesFacturacion() {
  document.getElementById('btnBuscar347').addEventListener('click', buscarModelo347);
  document.getElementById('btnBuscarPeriodo').addEventListener('click', buscarResumenPeriodo);
  document.getElementById('btnDescargar347').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', descargarModelo347PDF));
  document.getElementById('btnDescargarPeriodo').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', descargarResumenPeriodoPDF));
  document.getElementById('btnDescargarLibroFacturas').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', descargarLibroFacturas));
  document.getElementById('btnDescargarExtractoCliente').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', descargarExtractoCliente));
}

async function descargarLibroFacturas() {
  const ini = document.getElementById('resFechaIni').value;
  const fin = document.getElementById('resFechaFin').value;
  if (!ini || !fin) { alert('Elige las dos fechas primero.'); return; }
  const r = await apiGet('libroFacturasPdf', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok) { alert('Error: ' + (r.error || 'inténtalo de nuevo')); return; }
  await descargarPDF(r.base64, r.nombre);
}

async function descargarExtractoCliente() {
  const clienteId = document.getElementById('selectClienteFacturas').value;
  const ini = document.getElementById('resFechaIni').value;
  const fin = document.getElementById('resFechaFin').value;
  if (!clienteId) { alert('Elige un cliente primero.'); return; }
  if (!ini || !fin) { alert('Elige las dos fechas primero.'); return; }
  const r = await apiGet('extractoClientePdf', { clienteId, fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok) { alert('Error: ' + (r.error || 'inténtalo de nuevo')); return; }
  await descargarPDF(r.base64, r.nombre);
}

async function descargarModelo347PDF() {
  const anio = document.getElementById('anio347').value.trim();
  if (!anio) { alert('Escribe un año primero.'); return; }
  const r = await apiGet('modelo347Pdf', { anio }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok) { alert('Error: ' + (r.error || 'inténtalo de nuevo')); return; }
  await descargarPDF(r.base64, r.nombre);
}

/* ============ COMPRAS: PROVEEDORES ============ */
let proveedoresCache = [];
let proveedorSeleccionado = null;

async function cargarProveedores() {
  const cont = document.getElementById('listaProveedores');
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';
  const r = await apiGet('proveedores').catch(() => null);
  if (!r || !r.ok) { cont.innerHTML = '<div class="empty-state">No se pudo cargar.</div>'; return; }
  proveedoresCache = r.data;

  if (!proveedoresCache.length) { cont.innerHTML = '<div class="empty-state">Todavía no has añadido ningún proveedor.</div>'; return; }

  cont.innerHTML = proveedoresCache.map((p) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.nombre)}</div>
          <div class="card__meta">${p.nif ? 'NIF: ' + escapeHtml(p.nif) + ' · ' : ''}${escapeHtml(p.telefono || '')}</div>
        </div>
      </div>
      <div class="card__actions">
        <button class="chip-btn" data-editar-proveedor="${p.id}">Editar</button>
      </div>
    </div>
  `).join('');
  cont.querySelectorAll('[data-editar-proveedor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      proveedorSeleccionado = proveedoresCache.find((p) => String(p.id) === btn.dataset.editarProveedor);
      abrirFormularioProveedor(proveedorSeleccionado);
    });
  });
}

function abrirFormularioProveedor(proveedor) {
  document.getElementById('proveedorFormTitulo').textContent = proveedor ? 'Editar proveedor' : 'Nuevo proveedor';
  document.getElementById('prvFormId').value = proveedor ? proveedor.id : '';
  document.getElementById('prvFormNombre').value = proveedor ? proveedor.nombre : '';
  document.getElementById('prvFormNif').value = proveedor ? proveedor.nif : '';
  document.getElementById('prvFormTelefono').value = proveedor ? proveedor.telefono : '';
  document.getElementById('prvFormDireccion').value = proveedor ? proveedor.direccion : '';
  document.getElementById('prvFormActivo').value = proveedor ? String(proveedor.activo) : 'true';
  document.getElementById('proveedorFormMsg').textContent = '';
  cambiarTab('proveedor-form');
}

async function guardarProveedor() {
  const msg = document.getElementById('proveedorFormMsg');
  const nombre = document.getElementById('prvFormNombre').value.trim();
  if (!nombre) { msg.textContent = 'Pon un nombre.'; msg.className = 'form-msg is-error'; return; }

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet('guardarProveedor', {
    id: document.getElementById('prvFormId').value,
    nombre,
    nif: document.getElementById('prvFormNif').value.trim(),
    telefono: document.getElementById('prvFormTelefono').value.trim(),
    direccion: document.getElementById('prvFormDireccion').value.trim(),
    activo: document.getElementById('prvFormActivo').value,
  }).catch((err) => ({ ok: false, error: errorDeRed(err) }));

  if (r.ok) {
    msg.textContent = 'Proveedor guardado.';
    msg.className = 'form-msg is-ok';
    setTimeout(() => cambiarTab('proveedores'), 700);
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

/* ============ JUSTIFICANTES: FOTO O PDF DE LA FACTURA ============
 * El formulario de gasto y el de "incorporar factura" comparten esto. Se elige una foto (o un PDF), la app reduce la foto (un móvil hace
 * fotos de 5-10 MB; a 1800 px y JPEG se lee igual y sube en segundos), se sube a Google Drive y el gasto guarda su enlace. */
const MAX_LADO_FOTO = 1800;
const CALIDAD_FOTO = 0.8;
const MAX_BYTES_PDF = 10 * 1024 * 1024;
const justificantes = {};   // por formulario: { id, url, nombre, cambiado, subiendo, texto, error }

function estadoJustificante(pref) {
  if (!justificantes[pref]) justificantes[pref] = { id: '', url: '', nombre: '', cambiado: false, subiendo: false, texto: '', error: '' };
  return justificantes[pref];
}

function leerComoBase64(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).split(',')[1] || '');
    lector.onerror = () => rechazar(new Error('No se ha podido leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

async function cargarImagenParaReducir(archivo) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch (e) { /* sigue con la otra vía */ }
  }
  return await new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se ha podido abrir la foto.')); };
    img.src = url;
  });
}

async function prepararArchivoJustificante(archivo) {
  const esPdf = archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name || '');
  if (esPdf) {
    if (archivo.size > MAX_BYTES_PDF) throw new Error('El PDF es demasiado grande (máximo 10 MB).');
    return { mime: 'application/pdf', base64: await leerComoBase64(archivo) };
  }
  if (!/^image\//.test(archivo.type || '')) throw new Error('Elige una foto o un PDF.');
  const imagen = await cargarImagenParaReducir(archivo);
  const escala = Math.min(1, MAX_LADO_FOTO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round(imagen.width * escala));
  lienzo.height = Math.max(1, Math.round(imagen.height * escala));
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return { mime: 'image/jpeg', base64: lienzo.toDataURL('image/jpeg', CALIDAD_FOTO).split(',')[1] };
}

function pintarJustificante(pref) {
  const est = estadoJustificante(pref);
  const estado = document.getElementById(pref + 'ArchivoEstado');
  const quitar = document.getElementById(pref + 'ArchivoQuitar');
  const boton = document.getElementById(pref + 'ArchivoBoton');
  estado.textContent = '';
  estado.style.color = '';
  quitar.style.display = 'none';
  boton.textContent = est.url ? '📷 Cambiar la factura' : '📷 Fotografiar o subir la factura';
  if (est.subiendo) { estado.textContent = est.texto || 'Subiendo la factura…'; return; }
  if (est.error) { estado.textContent = est.error; estado.style.color = 'var(--warn-red)'; }
  if (est.url) {
    if (est.error) estado.appendChild(document.createElement('br'));
    estado.appendChild(document.createTextNode('✓ Factura adjunta: '));
    if (/^https:\/\//.test(est.url)) {
      const enlace = document.createElement('a');
      enlace.href = est.url; enlace.target = '_blank'; enlace.rel = 'noopener'; enlace.textContent = 'ver';
      estado.appendChild(enlace);
    }
    if (est.nombre) estado.appendChild(document.createTextNode(' (' + est.nombre + ')'));
    quitar.style.display = 'inline-block';
  } else if (!est.error) {
    estado.textContent = 'Sin factura adjunta.';
  }
}

function reiniciarJustificante(pref, urlExistente) {
  justificantes[pref] = { id: '', url: urlExistente || '', nombre: '', cambiado: false, subiendo: false, texto: '', error: '' };
  pintarJustificante(pref);
}

async function elegirArchivoJustificante(pref, archivo, contexto) {
  const est = estadoJustificante(pref);
  if (est.subiendo || !archivo) return;
  est.subiendo = true;
  est.error = '';
  est.texto = 'Preparando la factura…';
  pintarJustificante(pref);
  try {
    const f = await prepararArchivoJustificante(archivo);
    est.texto = 'Subiendo la factura…';
    pintarJustificante(pref);
    const r = await apiPost('subirJustificante', { mime: f.mime, base64: f.base64, fecha: contexto.fecha, proveedor: contexto.proveedor, numFactura: contexto.numFactura });
    if (!r.ok) throw new Error(r.error || 'No se pudo subir.');
    est.id = r.id; est.url = r.url; est.nombre = r.nombre; est.cambiado = true;
  } catch (err) {
    est.error = 'No se ha podido subir: ' + ((err && err.message) ? err.message : textoDeFallo(err));
  } finally {
    est.subiendo = false;
    pintarJustificante(pref);
  }
}

// contextoFn() → { fecha (dd/MM/yyyy), proveedor, numFactura }: para dar nombre al archivo en Drive
function iniciarJustificante(pref, contextoFn) {
  const entrada = document.getElementById(pref + 'Archivo');
  entrada.addEventListener('change', async () => {
    const archivo = entrada.files && entrada.files[0];
    entrada.value = '';   // para poder elegir otra vez el mismo archivo
    if (archivo) await elegirArchivoJustificante(pref, archivo, contextoFn());
  });
  document.getElementById(pref + 'ArchivoQuitar').addEventListener('click', () => {
    const est = estadoJustificante(pref);
    est.id = ''; est.url = ''; est.nombre = ''; est.error = ''; est.cambiado = true;
    pintarJustificante(pref);
  });
}

// Lo que hay que mandar al servidor del justificante: solo si se ha subido, cambiado o quitado en este formulario
function datosJustificante(pref) {
  const est = estadoJustificante(pref);
  return est.cambiado ? { justificanteId: est.id, justificanteUrl: est.url } : {};
}

// Categorías de gasto para elegir (las habituales y las ya usadas)
let categoriasGastoCache = [];
async function cargarCategoriasGasto() {
  if (!categoriasGastoCache.length) {
    const r = await apiGet('categoriasGasto').catch(() => null);
    if (r && r.ok && Array.isArray(r.data)) categoriasGastoCache = r.data;
  }
  document.getElementById('listaCategoriasGasto').innerHTML = categoriasGastoCache.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
}

// Descarga de un texto (los CSV para Excel): en el móvil ofrece compartir/guardar; si no, la descarga normal
async function descargarTexto(nombreArchivo, texto, tipo) {
  const blob = new Blob([texto], { type: tipo || 'text/plain;charset=utf-8' });
  try {
    const archivo = new File([blob], nombreArchivo, { type: tipo || 'text/plain' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: nombreArchivo });
      return;
    }
  } catch (e) { /* cancelado o no soportado: descarga normal */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ============ COMPRAS: GASTOS ============ */
async function cargarFormularioGasto() {
  const select = document.getElementById('gastoFormProveedor');
  if (!proveedoresCache.length) {
    const r = await apiGet('proveedores').catch(() => null);
    if (r && r.ok) proveedoresCache = r.data;
  }
  select.innerHTML = '<option value="">Sin proveedor / puntual</option>' +
    proveedoresCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');

  document.getElementById('gastoFormTitulo').textContent = 'Nuevo gasto';
  document.getElementById('gastoFormId').value = '';
  document.getElementById('gastoFormFecha').value = hoyISO();
  document.getElementById('gastoFormNumFactura').value = '';
  document.getElementById('gastoFormConcepto').value = '';
  document.getElementById('gastoFormCategoria').value = '';
  document.getElementById('gastoFormBase').value = '';
  document.getElementById('gastoFormIva').value = '';
  document.getElementById('gastoFormRetencion').value = '';
  document.getElementById('gastoFormPagado').checked = true;   // un gasto que se apunta a mano suele estar ya pagado
  document.getElementById('gastoFormFechaPago').value = hoyISO();
  alternarFechaPagoGasto();
  reiniciarJustificante('gastoForm');
  document.getElementById('gastoFormTotal').textContent = '0,00 €';
  document.getElementById('btnEliminarGasto').style.display = 'none';
  document.getElementById('gastoFormMsg').textContent = '';
  cargarCategoriasGasto();
}

async function abrirGastoParaEditar(g) {
  if (!proveedoresCache.length) {
    const r = await apiGet('proveedores').catch(() => null);
    if (r && r.ok) proveedoresCache = r.data;
  }
  cambiarTab('gasto-nuevo');
  document.getElementById('gastoFormTitulo').textContent = 'Editar gasto';
  document.getElementById('gastoFormId').value = g.id;
  document.getElementById('gastoFormFecha').value = g.fecha.split('/').reverse().join('-');
  document.getElementById('gastoFormProveedor').value = g.proveedorId || '';
  document.getElementById('gastoFormNumFactura').value = g.numFactura || '';
  document.getElementById('gastoFormConcepto').value = g.concepto || '';
  document.getElementById('gastoFormCategoria').value = g.categoria || '';
  document.getElementById('gastoFormBase').value = g.base;
  document.getElementById('gastoFormIva').value = g.iva;
  document.getElementById('gastoFormRetencion').value = g.retencion || '';
  document.getElementById('gastoFormPagado').checked = g.pagado !== false;
  document.getElementById('gastoFormFechaPago').value = g.fechaPago ? g.fechaPago.split('/').reverse().join('-') : hoyISO();
  alternarFechaPagoGasto();
  reiniciarJustificante('gastoForm', g.justificanteUrl);   // el que ya tiene se conserva si no se toca
  recalcularTotalGasto();
  document.getElementById('btnEliminarGasto').style.display = 'block';
  document.getElementById('gastoFormMsg').textContent = '';
}

function recalcularTotalGasto() {
  const base = Number(document.getElementById('gastoFormBase').value) || 0;
  const iva = Number(document.getElementById('gastoFormIva').value) || 0;
  const retencion = Number(document.getElementById('gastoFormRetencion').value) || 0;
  document.getElementById('gastoFormTotal').textContent = formatoEuros(base + iva - retencion);
}

function alternarFechaPagoGasto() {
  document.getElementById('gastoFormFechaPagoBloque').style.display = document.getElementById('gastoFormPagado').checked ? 'block' : 'none';
}

function contextoJustificanteGasto() {
  const proveedorId = document.getElementById('gastoFormProveedor').value;
  const fecha = document.getElementById('gastoFormFecha').value;
  return {
    fecha: fecha ? formatoFechaES(fecha) : '',
    proveedor: proveedorId ? (proveedoresCache.find((p) => String(p.id) === proveedorId) || {}).nombre || '' : '',
    numFactura: document.getElementById('gastoFormNumFactura').value.trim(),
  };
}

async function guardarGasto() {
  const msg = document.getElementById('gastoFormMsg');
  const id = document.getElementById('gastoFormId').value;
  const fecha = document.getElementById('gastoFormFecha').value;
  if (!fecha) { msg.textContent = 'Elige una fecha.'; msg.className = 'form-msg is-error'; return; }
  if (estadoJustificante('gastoForm').subiendo) { msg.textContent = 'Espera a que termine de subirse la factura.'; msg.className = 'form-msg is-error'; return; }
  const pagado = document.getElementById('gastoFormPagado').checked;
  const retencion = Number(document.getElementById('gastoFormRetencion').value) || 0;
  const total = (Number(document.getElementById('gastoFormBase').value) || 0) + (Number(document.getElementById('gastoFormIva').value) || 0);
  if (retencion > total) { msg.textContent = 'La retención no puede ser mayor que el total de la factura.'; msg.className = 'form-msg is-error'; return; }
  if (pagado && !document.getElementById('gastoFormFechaPago').value) { msg.textContent = 'Pon la fecha de pago (o desmarca "Ya está pagada").'; msg.className = 'form-msg is-error'; return; }

  const proveedorId = document.getElementById('gastoFormProveedor').value;
  const proveedorNombre = proveedorId ? proveedoresCache.find((p) => String(p.id) === proveedorId)?.nombre || '' : '';

  const datos = {
    fecha: formatoFechaES(fecha),
    proveedorId,
    proveedorNombre,
    numFactura: document.getElementById('gastoFormNumFactura').value.trim(),
    concepto: document.getElementById('gastoFormConcepto').value.trim(),
    categoria: document.getElementById('gastoFormCategoria').value.trim(),
    base: document.getElementById('gastoFormBase').value || 0,
    iva: document.getElementById('gastoFormIva').value || 0,
    retencion: String(retencion),
    pagado: pagado ? 'true' : 'false',
    fechaPago: pagado ? formatoFechaES(document.getElementById('gastoFormFechaPago').value) : '',
    ...datosJustificante('gastoForm'),
  };

  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const r = await apiGet(id ? 'editarGasto' : 'crearGasto', id ? { ...datos, id } : datos).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (r.ok) {
    msg.textContent = 'Gasto guardado.';
    msg.className = 'form-msg is-ok';
    setTimeout(() => cambiarTab('gastos-ver'), 700);
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

async function eliminarGasto() {
  const id = document.getElementById('gastoFormId').value;
  if (!id) return;
  if (!confirm('¿Seguro que quieres eliminar este gasto? No se puede deshacer.')) return;
  const r = await apiGet('eliminarGasto', { id }).catch(() => ({ ok: false }));
  if (r.ok) cambiarTab('gastos-ver');
  else alert('No se pudo eliminar: ' + (r.error || 'error'));
}

async function buscarGastos() {
  const ini = document.getElementById('gastosFechaIni').value;
  const fin = document.getElementById('gastosFechaFin').value;
  const cont = document.getElementById('listaGastos');
  if (!ini || !fin) { cont.innerHTML = '<div class="empty-state">Elige las dos fechas.</div>'; return; }

  cont.innerHTML = '<div class="empty-state">Buscando…</div>';
  const r = await apiGet('gastosPeriodo', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`; return; }

  ultimosGastos = r.data;
  pintarGastos();
}

// Se pinta desde lo último recibido (así, marcar "solo pendientes de pago" no vuelve a pedir nada)
let ultimosGastos = null;
function pintarGastos() {
  const cont = document.getElementById('listaGastos');
  const d = ultimosGastos;
  if (!d) return;
  const soloPendientes = document.getElementById('gastosSoloPendientes').checked;
  const lista = d.gastos.filter((g) => !soloPendientes || g.pagado === false);
  const pend = d.pendientePago || { n: 0, total: 0 };
  const est = d.estimado || { n: 0, total: 0 };

  if (!d.gastos.length) {
    cont.innerHTML = '<div class="empty-state">Sin gastos en ese periodo.</div>';
    document.getElementById('gastosTotal').textContent = '';
    return;
  }
  cont.innerHTML = lista.length ? lista.map((g) => {
    const confirmado = g.estado !== 'Estimado';
    const etiquetaPago = !confirmado ? '' : g.pagado === false
      ? '<span style="color:var(--warn-red); font-weight:600;">⏳ Pendiente de pago</span>'
      : (g.fechaPago ? `✓ Pagada el ${escapeHtml(g.fechaPago)}` : '');
    return `
    <div class="card"${!confirmado ? ' style="border-style:dashed;"' : ''}>
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(g.concepto || 'Gasto')}</div>
          <div class="card__meta">${escapeHtml(g.fecha)}${g.proveedor ? ' · ' + escapeHtml(g.proveedor) : ''}${g.categoria ? ' · ' + escapeHtml(g.categoria) : ''}${g.numFactura ? ' · Factura nº ' + escapeHtml(g.numFactura) : ''}</div>
          ${!confirmado ? '<div class="card__meta">Estimado: pendiente de la factura del proveedor (no cuenta para el gestor)</div>' : ''}
          ${g.retencion > 0 ? `<div class="card__meta">Retención IRPF: -${formatoEuros(g.retencion)}</div>` : ''}
          ${g.desglose && g.desglose.length ? `<div class="card__meta">IVA por tipos: ${g.desglose.map((l) => `${escapeHtml(String(l.tipo).replace('.', ','))} % → base ${escapeHtml(formatoEuros(l.base))}, cuota ${escapeHtml(formatoEuros(l.cuota))}`).join(' · ')}</div>` : ''}
          ${etiquetaPago ? `<div class="card__meta">${etiquetaPago}</div>` : ''}
          ${confirmado ? (g.justificanteUrl && /^https:\/\//.test(g.justificanteUrl) ? `<div class="card__meta">📎 <a href="${escapeHtml(g.justificanteUrl)}" target="_blank" rel="noopener">Ver la factura adjunta</a></div>` : '<div class="card__meta">Sin factura adjunta</div>') : ''}
        </div>
        <div class="card__total">${formatoEuros(g.total)}</div>
      </div>
      <div class="card__actions">
        ${!confirmado ? `<button class="chip-btn" data-incorporar-gasto="${g.id}">Incorporar factura</button>` : ''}
        ${confirmado ? `<button class="chip-btn" data-pagar-gasto="${g.id}" data-pagado="${g.pagado === false ? 'true' : 'false'}">${g.pagado === false ? 'Marcar como pagada' : 'Marcar como pendiente'}</button>` : ''}
        <button class="chip-btn" data-editar-gasto="${g.id}">Editar</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No hay gastos pendientes de pago en este periodo.</div>';

  document.getElementById('gastosTotal').innerHTML = escapeHtml(`Base: ${formatoEuros(d.totalBase)}  ·  IVA: ${formatoEuros(d.totalIva)}` + (d.totalRetencion > 0 ? `  ·  Retención: -${formatoEuros(d.totalRetencion)}` : '') + `  ·  Total: ${formatoEuros(d.totalGeneral)}`) +
    (pend.n ? `<div class="card__meta" style="margin-top:4px; color:var(--warn-red);">Pendiente de pago: ${pend.n} · ${escapeHtml(formatoEuros(pend.total))}</div>` : '') +
    (est.n ? `<div class="card__meta" style="margin-top:4px;">Además, ${est.n} gasto${est.n === 1 ? '' : 's'} estimado${est.n === 1 ? '' : 's'} pendiente${est.n === 1 ? '' : 's'} de factura: ${escapeHtml(formatoEuros(est.total))} (no cuenta${est.n === 1 ? '' : 'n'} para el gestor)</div>` : '');

  cont.querySelectorAll('[data-incorporar-gasto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = d.gastos.find((x) => String(x.id) === btn.dataset.incorporarGasto);
      if (!g) return;
      facturaPreseleccion = { proveedorId: g.proveedorId, cubre: [g.id] };
      cambiarTab('gasto-factura');
    });
  });
  cont.querySelectorAll('[data-editar-gasto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = d.gastos.find((x) => String(x.id) === btn.dataset.editarGasto);
      if (g) abrirGastoParaEditar(g);
    });
  });
  cont.querySelectorAll('[data-pagar-gasto]').forEach((btn) => {
    btn.addEventListener('click', () => marcarGastoPagado(btn.dataset.pagarGasto, btn.dataset.pagado === 'true', btn));
  });
}

// Marca una factura de proveedor como pagada (con la fecha de hoy) o de nuevo como pendiente
let marcandoPago = false;
async function marcarGastoPagado(id, pagado, boton, alTerminar) {
  if (marcandoPago) return;
  marcandoPago = true;
  if (boton) boton.disabled = true;
  try {
    const r = await apiGet('marcarGastoPagado', { id, pagado: pagado ? 'true' : 'false', fechaPago: pagado ? formatoFechaES(hoyISO()) : '' })
      .catch((err) => ({ ok: false, error: errorDeRed(err) }));
    if (!r.ok) { alert('No se pudo cambiar el pago: ' + (r.error || 'inténtalo de nuevo')); return; }
    if (alTerminar) alTerminar(); else buscarGastos();
  } finally {
    marcandoPago = false;
    if (boton) boton.disabled = false;
  }
}

/* ============ PANEL DE RESULTADOS ============ */
function mesActualISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function desplazarMesISO(valor, delta) {
  const [a, m] = valor.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

let panelPeticion = 0;
async function cargarPanel() {
  const entrada = document.getElementById('panelMes');
  if (!entrada.value) entrada.value = mesActualISO();
  const cont = document.getElementById('panelContenido');
  const [anio, mes] = entrada.value.split('-');
  const numero = ++panelPeticion;
  cont.innerHTML = '<div class="empty-state">Calculando…</div>';
  const r = await apiGet('panelMes', { anio, mes: String(Number(mes)) }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (numero !== panelPeticion) return;   // se pidió otro mes mientras tanto
  if (!r.ok) { cont.innerHTML = `<div class="empty-state">No se pudo calcular: ${escapeHtml(r.error || '')}</div>`; return; }
  pintarPanel(r);
}

function pintarPanel(d) {
  const cont = document.getElementById('panelContenido');
  const e = (n) => escapeHtml(formatoEuros(n));
  const res = d.resultado;
  const color = res.provisional < 0 ? 'var(--warn-red)' : 'var(--ok-green, #2E7D4F)';
  const maxCat = Math.max(1, ...d.gastos.porCategoria.map((c) => c.base));
  const margen = d.ventas.margenPct !== null && d.ventas.margenPct !== undefined ? ` (${(d.ventas.margenPct * 100).toFixed(1)}%)` : '';

  cont.innerHTML = `
    <div class="card">
      <div class="card__top"><div class="card__name">Resultado provisional</div><div class="card__total" style="color:${color};">${e(res.provisional)}</div></div>
      <div class="card__meta">Ventas ${e(res.ventas)} − gastos ${e(res.gastos)}${res.estimado > 0 ? ` − gastos estimados de pedidos a proveedores sin factura ${e(res.estimado)}` : ''}</div>
      <div class="card__meta">Sin IVA. Es provisional: faltan las facturas de proveedor que aún no han llegado.</div>
    </div>
    <div class="card">
      <div class="card__name">Ventas del mes</div>
      <div class="card__products">${e(d.ventas.base)} sin IVA · ${d.ventas.pedidos} pedidos</div>
      <div class="card__meta">Facturado: ${e(d.ventas.facturadoBase)} + IVA ${e(d.ventas.facturadoIva)} = ${e(d.ventas.facturadoTotal)} (${d.ventas.facturas} facturas)</div>
      <div class="card__meta">Margen bruto (ventas menos coste de fábrica de lo vendido): ${e(d.ventas.margenBruto)}${margen}</div>
    </div>
    <div class="card">
      <div class="card__top"><div class="card__name">Gastos por categoría</div><div class="card__total">${e(d.gastos.base)}</div></div>
      ${d.gastos.porCategoria.length ? d.gastos.porCategoria.map((c) => `
        <div style="margin-top:8px;">
          <div style="display:flex; justify-content:space-between; font-size:14px;"><span>${escapeHtml(c.categoria)} <span class="card__meta">(${c.n})</span></span><strong>${e(c.base)}</strong></div>
          <div style="background:#E9E2D6; border-radius:4px; height:6px; margin-top:3px;"><div style="width:${Math.round(c.base / maxCat * 100)}%; background:#C0762B; height:6px; border-radius:4px;"></div></div>
        </div>`).join('') : '<div class="card__meta">Sin gastos este mes.</div>'}
      <div class="card__meta" style="margin-top:8px;">Sin IVA${d.gastos.retencion > 0 ? ` · retenciones: ${e(d.gastos.retencion)}` : ''}${d.gastos.estimado.n ? ` · más ${e(d.gastos.estimado.base)} estimados (${d.gastos.estimado.n}) pendientes de factura` : ''}</div>
    </div>
    <div class="card">
      <div class="card__top"><div class="card__name">Pendiente de cobro</div><div class="card__total">${e(d.cobros.total)}</div></div>
      <div class="card__meta">${d.cobros.facturas.n} factura${d.cobros.facturas.n === 1 ? '' : 's'} (${e(d.cobros.facturas.total)}) · ${d.cobros.albaranes.n} albarán${d.cobros.albaranes.n === 1 ? '' : 'es'} (${e(d.cobros.albaranes.total)})</div>
      ${d.cobros.clientes.map((c) => `<div class="card__meta" style="margin-top:4px;">${escapeHtml(c.cliente)} · ${e(c.total)}${c.desde ? ' · desde ' + escapeHtml(c.desde) : ''}</div>`).join('')}
      ${d.cobros.anteriores && d.cobros.anteriores.n ? `<div class="card__meta" style="margin-top:6px;">Incluye ${d.cobros.anteriores.n} documento${d.cobros.anteriores.n === 1 ? '' : 's'} de años anteriores (ya archivados): ${e(d.cobros.anteriores.total)}. Para cobrarlos, búscalos en Facturas o en Pedidos con fechas de ese año.</div>` : ''}
    </div>
    <div class="card">
      <div class="card__top"><div class="card__name">Pagos pendientes a proveedores</div><div class="card__total">${e(d.pagos.total)}</div></div>
      ${d.pagos.anteriores && d.pagos.anteriores.n ? `<div class="card__meta">Incluye ${d.pagos.anteriores.n} factura${d.pagos.anteriores.n === 1 ? '' : 's'} de años anteriores (ya archivados): ${e(d.pagos.anteriores.total)}</div>` : ''}
      ${(d.pagos.porProveedor || []).map((p) => `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:8px;">
          <div class="card__meta"><strong>${escapeHtml(p.proveedor)}</strong> · ${p.n} factura${p.n === 1 ? '' : 's'} · ${e(p.total)}</div>
          <button class="chip-btn" data-pagar-proveedor="${escapeHtml(String(p.idProveedor))}" data-nombre="${escapeHtml(p.proveedor)}" data-n="${p.n}" data-total="${p.total}">Todas pagadas</button>
        </div>`).join('')}
      ${d.pagos.lista.length ? d.pagos.lista.map((p) => `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:8px;">
          <div class="card__meta">${escapeHtml(p.proveedor || 'Sin proveedor')}${p.numFactura ? ' · nº ' + escapeHtml(p.numFactura) : ''} · ${escapeHtml(p.fecha)}${p.anterior ? ' (año anterior)' : ''} · <strong>${e(p.total)}</strong></div>
          <button class="chip-btn" data-panel-pagar="${p.id}">Pagada</button>
        </div>`).join('') : '<div class="card__meta">No debes nada a ningún proveedor.</div>'}
    </div>
    <div class="card">
      <div class="card__name">IVA del mes</div>
      <div class="card__meta">Repercutido (ventas): ${e(d.iva.repercutido)} · Soportado (compras): ${e(d.iva.soportado)}</div>
      <div class="card__meta">${d.iva.aLiquidar >= 0 ? 'A ingresar' : 'A compensar'}: <strong>${e(Math.abs(d.iva.aLiquidar))}</strong></div>
    </div>`;
  cont.querySelectorAll('[data-panel-pagar]').forEach((btn) => {
    btn.addEventListener('click', () => marcarGastoPagado(btn.dataset.panelPagar, true, btn, cargarPanel));
  });
  cont.querySelectorAll('[data-pagar-proveedor]').forEach((btn) => {
    btn.addEventListener('click', () => marcarTodasPagadasProveedor(btn));
  });
}

// "Todas pagadas" de un proveedor: marca de golpe todas sus facturas pendientes (con la fecha de hoy)
let marcandoProveedor = false;
async function marcarTodasPagadasProveedor(btn) {
  if (marcandoProveedor) return;
  if (!confirm(`¿Marcar como pagadas las ${btn.dataset.n} facturas pendientes de ${btn.dataset.nombre} (${formatoEuros(Number(btn.dataset.total))})?`)) return;
  marcandoProveedor = true;
  btn.disabled = true;
  try {
    const r = await apiGet('marcarPagadosProveedor', { idProveedor: btn.dataset.pagarProveedor, fechaPago: formatoFechaES(hoyISO()) })
      .catch((err) => ({ ok: false, error: errorDeRed(err) }));
    if (!r.ok) { alert('No se pudieron marcar: ' + (r.error || 'inténtalo de nuevo')); return; }
    cargarPanel();
  } finally {
    marcandoProveedor = false;
    btn.disabled = false;
  }
}

/* ============ FACTURAS DE HOY ============
 * Cada proveedor del pedido de un día, con su importe estimado: ✓ si ya está su factura apuntada, o "falta" con un botón para apuntarla.
 * Debajo, las facturas por recibir de días anteriores. La factura que te dan por la mañana es la del pedido de la noche anterior. */
function ayerISO() { const d = new Date(); d.setDate(d.getDate() - 1); return aISO(d); }

let fdPeticion = 0;
function iniciarFacturasDia() {
  const f = document.getElementById('fdFecha');
  if (!f.value) f.value = hoyISO();
  cargarFacturasDia();
}

async function cargarFacturasDia() {
  const iso = document.getElementById('fdFecha').value;
  const lista = document.getElementById('fdLista');
  const anteriores = document.getElementById('fdAnteriores');
  const resumen = document.getElementById('fdResumen');
  document.getElementById('fdMsg').textContent = '';
  if (!iso) { lista.innerHTML = '<div class="empty-state">Elige el día.</div>'; return; }
  const n = ++fdPeticion;
  lista.innerHTML = '<div class="empty-state">Cargando…</div>';
  anteriores.innerHTML = '';
  resumen.textContent = '';
  const [rp, rg] = await Promise.all([
    apiGet('pedidoProveedores', { fecha: formatoFechaES(iso) }).catch((err) => ({ ok: false, error: textoDeFallo(err) })),
    apiGet('gastosEstimados', {}).catch(() => ({ ok: false })),
  ]);
  if (n !== fdPeticion) return;   // se cambió de día mientras cargaba
  if (!rp.ok) { lista.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(rp.error || '')}</div>`; return; }

  const provs = rp.data.hayPedidos ? rp.data.proveedores : [];
  const tiene = (p) => !!(p.gasto && p.gasto.estado === 'Cubierto');
  const apuntadas = provs.filter(tiene).length;
  resumen.textContent = provs.length
    ? `${provs.length} proveedor${provs.length === 1 ? '' : 'es'} · ${apuntadas} con factura apuntada` + (provs.length - apuntadas ? ` · te falta${provs.length - apuntadas === 1 ? '' : 'n'} ${provs.length - apuntadas}` : ' · ¡todas!')
    : '';
  lista.innerHTML = provs.length ? provs.map((p) => {
    const e = p.estimado || {};
    const estimable = e.conCoste > 0;
    return `
    <div class="card"${tiene(p) ? '' : ' style="border-style:dashed;"'}>
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.nombre)}</div>
          ${tiene(p)
            ? `<div class="card__meta">✓ Factura apuntada${p.gasto.numFactura ? ' · nº ' + escapeHtml(p.gasto.numFactura) : ''}</div>`
            : `<div class="card__meta" style="color:var(--warn-red);">Falta apuntar la factura</div>`}
        </div>
        <div class="card__total">${estimable ? escapeHtml(formatoEuros(e.total)) : '—'}</div>
      </div>
      ${tiene(p) ? '' : `<div class="card__meta">${estimable ? 'Estimado según tu pedido (con IVA)' : 'Sin coste puesto en sus productos: no hay estimado'}</div>
      <div class="card__actions"><button class="chip-btn" data-fd-apuntar="${escapeHtml(String(p.idProveedor))}">Apuntar factura</button></div>`}
    </div>`;
  }).join('') : '<div class="empty-state">No hay pedidos a proveedores para ese día.</div>';
  lista.querySelectorAll('[data-fd-apuntar]').forEach((btn) => {
    btn.addEventListener('click', () => apuntarFacturaDelDia(provs.find((p) => String(p.idProveedor) === btn.dataset.fdApuntar), iso, btn));
  });

  // facturas por recibir de días anteriores
  const previas = rg.ok ? rg.data.filter((g) => g.pedidoFecha && g.pedidoFecha.split('/').reverse().join('-') < iso) : [];
  anteriores.innerHTML = !rg.ok ? '' : previas.length ? previas.map((g) => `
    <div class="card" style="border-style:dashed;">
      <div class="card__top"><div><div class="card__name">${escapeHtml(g.proveedor)}</div><div class="card__meta">Pedido del ${escapeHtml(g.pedidoFecha)}</div></div><div class="card__total">${escapeHtml(formatoEuros(g.total))}</div></div>
      <div class="card__actions"><button class="chip-btn" data-fd-previa="${g.id}">Apuntar factura</button></div>
    </div>`).join('') : '<div class="empty-state">No te falta ninguna factura de días anteriores ✓</div>';
  anteriores.querySelectorAll('[data-fd-previa]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = previas.find((x) => String(x.id) === btn.dataset.fdPrevia);
      if (!g) return;
      facturaPreseleccion = { proveedorId: g.proveedorId, cubre: [g.id], fecha: g.pedidoFecha.split('/').reverse().join('-'), volver: 'facturas-dia' };
      cambiarTab('gasto-factura');
    });
  });
}

// Si el gasto estimado de ese proveedor aún no estaba creado, se crea antes (así la factura lo cubre y el día queda como hecho)
let apuntandoFacturaDia = false;
async function apuntarFacturaDelDia(p, iso, btn) {
  if (!p || apuntandoFacturaDia) return;
  apuntandoFacturaDia = true;
  btn.disabled = true;
  try {
    let cubre = p.gasto && p.gasto.estado === 'Estimado' ? [p.gasto.id] : [];
    if (!p.gasto && p.estimado && p.estimado.conCoste > 0) {
      const r = await apiGet('gastoPedidoProveedores', { fecha: formatoFechaES(iso), idProveedor: String(p.idProveedor) }).catch(() => ({ ok: false }));
      const x = r.ok && r.resultados && r.resultados[0];
      if (x && x.ok) cubre = [x.id];
    }
    facturaPreseleccion = { proveedorId: p.idProveedor, cubre: cubre, fecha: iso, volver: 'facturas-dia' };
    cambiarTab('gasto-factura');
  } finally {
    apuntandoFacturaDia = false;
    btn.disabled = false;
  }
}

/* ============ FACTURAS DE LA SEMANA ============
 * Todas las facturas por recibir (los gastos estimados sin factura) en una sola pantalla, una fila por factura: número, base, IVA, fecha y la
 * foto o el PDF. El archivo se sube y se guarda en el momento (no se pierde aunque no se teclee el resto) y "Guardar" apunta todas las
 * filas rellenadas, una tras otra. */
let semanaFilas = [];
const semanaBorrador = {};   // por gasto: lo escrito y el archivo; se conserva mientras la app esté abierta
let guardandoSemana = false;
let semanaPeticion = 0;
let semanaEntrada = { archivos: [], carpetaUrl: '' };   // las facturas digitales que esperan en la carpeta de entrada de Drive
let subiendoVarias = false;

function borradorSemana(g) {
  if (!semanaBorrador[g.id]) semanaBorrador[g.id] = { num: '', base: '', iva: '', fecha: (g.pedidoFecha || g.fecha || '').split('/').reverse().join('-'), url: g.justificanteUrl || '', nombre: '', subiendo: false, error: '', estado: '', repetida: false };
  const b = semanaBorrador[g.id];
  if (!b.url && g.justificanteUrl) b.url = g.justificanteUrl;   // el archivo ya subido en otra ocasión
  return b;
}

const filaSemanaRellena = (b) => String(b.num || '').trim() !== '' && (Number(b.base) || 0) > 0;

function infoFilaSemana(g, b) {
  const partes = [];
  const total = (Number(b.base) || 0) + (Number(b.iva) || 0);
  if ((Number(b.base) || 0) > 0) {
    const dif = total - g.total;
    const raro = g.total > 0 && Math.abs(dif) / g.total > 0.2;
    partes.push(`Factura ${formatoEuros(total)} · estimado ${formatoEuros(g.total)} · ${dif > 0 ? '+' : ''}${formatoEuros(dif)}${raro ? ' ⚠ muy distinta del estimado' : ''}${!b.ivaManual && (Number(b.iva) || 0) > 0 ? ' · IVA calculado según tu pedido: compruébalo con la factura' : ''}`);
  }
  return partes.join(' ');
}

function textoEstadoFilaSemana(b) {
  if (b.estado === 'guardando') return 'Guardando…';
  if (b.estado === 'ok') return '✓ Guardada';
  if (b.error) return b.error;
  return '';
}

function pintarFilaSemana(g) {
  const fila = document.querySelector(`[data-fs-fila="${g.id}"]`);
  if (!fila) return;
  const b = borradorSemana(g);
  fila.querySelector('[data-fs-info]').textContent = infoFilaSemana(g, b);
  const est = fila.querySelector('[data-fs-estado]');
  est.textContent = textoEstadoFilaSemana(b);
  est.style.color = b.error && b.estado !== 'ok' ? 'var(--warn-red)' : '';
  const arch = fila.querySelector('[data-fs-archivo-estado]');
  arch.textContent = '';
  arch.style.color = '';
  const boton = fila.querySelector('[data-fs-archivo-boton]');
  boton.textContent = b.url ? '📎 Cambiar' : '📎 Adjuntar la factura';
  if (b.subiendo) arch.textContent = 'Subiendo…';
  else if (b.errorArchivo) { arch.textContent = b.errorArchivo; arch.style.color = 'var(--warn-red)'; }
  else if (b.url) {
    arch.appendChild(document.createTextNode('✓ Adjunta: '));
    if (/^https:\/\//.test(b.url)) { const a = document.createElement('a'); a.href = b.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'ver'; arch.appendChild(a); }
  }
  fila.querySelector('[data-fs-igualmente]').style.display = b.repetida ? 'inline-block' : 'none';
}

function actualizarContadorSemana() {
  const rellenas = semanaFilas.filter((g) => filaSemanaRellena(borradorSemana(g)));
  const total = rellenas.reduce((s, g) => s + (Number(semanaBorrador[g.id].base) || 0) + (Number(semanaBorrador[g.id].iva) || 0), 0);
  document.getElementById('btnFsGuardar').textContent = rellenas.length ? `Guardar ${rellenas.length} factura${rellenas.length === 1 ? '' : 's'} rellenada${rellenas.length === 1 ? '' : 's'} (${formatoEuros(total)})` : 'Guardar las facturas rellenadas';
}

async function cargarFacturasSemana() {
  const lista = document.getElementById('fsLista');
  const resumen = document.getElementById('fsResumen');
  document.getElementById('fsMsg').textContent = '';
  if (!document.getElementById('fsFechaPago').value) document.getElementById('fsFechaPago').value = hoyISO();
  const n = ++semanaPeticion;
  const hayFilas = !!document.querySelector('[data-fs-fila]');
  if (!hayFilas) lista.innerHTML = '<div class="empty-state">Cargando…</div>';   // con filas a la vista se dejan hasta tener la lista nueva
  const [r, rl] = await Promise.all([
    apiGet('gastosEstimados', {}).catch((err) => ({ ok: false, error: textoDeFallo(err) })),
    apiGet('listarEntrada', {}).catch(() => ({ ok: false })),
  ]);
  if (n !== semanaPeticion) return;
  if (rl && rl.ok) semanaEntrada = { archivos: Array.isArray(rl.archivos) ? rl.archivos : [], carpetaUrl: rl.carpetaUrl || '' };
  pintarEntradaSemana();
  if (!r.ok) {
    if (hayFilas) return;   // no se pudo refrescar: se conservan las filas (y lo escrito) que ya había
    lista.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`;
    return;
  }
  semanaFilas = r.data.slice().sort((a, b) => ((a.pedidoFecha || '').split('/').reverse().join('') + a.proveedor).localeCompare((b.pedidoFecha || '').split('/').reverse().join('') + b.proveedor));
  if (!semanaFilas.length) {
    lista.innerHTML = '<div class="empty-state">No te falta ninguna factura por recibir ✓</div>';
    resumen.textContent = '';
    actualizarContadorSemana();
    return;
  }
  const totalEst = semanaFilas.reduce((s, g) => s + g.total, 0);
  resumen.textContent = `${semanaFilas.length} factura${semanaFilas.length === 1 ? '' : 's'} por recibir · ${formatoEuros(totalEst)} estimados`;
  let dia = '';
  lista.innerHTML = semanaFilas.map((g) => {
    const b = borradorSemana(g);
    const cab = g.pedidoFecha !== dia ? `<div class="field-label" style="margin-top:10px;">Pedido del ${escapeHtml(g.pedidoFecha || g.fecha)}</div>` : '';
    dia = g.pedidoFecha;
    return `${cab}
    <div class="card" data-fs-fila="${g.id}">
      <div class="card__top"><div><div class="card__name">${escapeHtml(g.proveedor)}</div><div class="card__meta">Estimado: ${escapeHtml(formatoEuros(g.total))}</div></div><div class="card__meta" data-fs-estado></div></div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
        <input type="text" class="text-input" data-fs-num placeholder="Nº factura" style="flex:2; min-width:110px;" value="${escapeHtml(b.num)}">
        <input type="number" class="text-input" data-fs-base placeholder="Base" step="0.01" min="0" style="flex:1; min-width:80px;" value="${escapeHtml(String(b.base))}">
        <input type="number" class="text-input" data-fs-iva placeholder="IVA" step="0.01" min="0" style="flex:1; min-width:70px;" value="${escapeHtml(String(b.iva))}">
      </div>
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;">
        <input type="date" class="text-input" data-fs-fecha style="max-width:150px;" aria-label="Fecha de la factura" value="${escapeHtml(b.fecha)}">
        <label class="btn-secondary" data-fs-archivo-boton for="fsArchivo-${g.id}" style="cursor:pointer; padding:8px 12px;">📎 Adjuntar la factura</label>
        <input type="file" id="fsArchivo-${g.id}" data-fs-archivo accept="image/*,application/pdf" style="display:none;">
        ${opcionesEntradaSemana()}
        <button type="button" class="chip-btn" data-fs-desglosar>Desglosar IVA</button>
        <button type="button" class="chip-btn" data-fs-igualmente style="display:none;">Guardar igualmente</button>
      </div>
      <div class="card__meta" data-fs-archivo-estado style="margin-top:4px;"></div>
      <div class="card__meta" data-fs-info style="margin-top:2px;"></div>
    </div>`;
  }).join('');
  semanaFilas.forEach((g) => {
    const fila = document.querySelector(`[data-fs-fila="${g.id}"]`);
    const b = borradorSemana(g);
    const lee = () => { b.num = fila.querySelector('[data-fs-num]').value; b.base = fila.querySelector('[data-fs-base]').value; b.iva = fila.querySelector('[data-fs-iva]').value; b.fecha = fila.querySelector('[data-fs-fecha]').value; b.repetida = false; b.error = b.estado === 'ok' ? b.error : ''; pintarFilaSemana(g); actualizarContadorSemana(); };
    ['[data-fs-num]', '[data-fs-fecha]'].forEach((s) => fila.querySelector(s).addEventListener('input', lee));
    // IVA automático: con la base escrita, el IVA sale de la proporción de IVA de lo que pediste (se ve como "calculado" y se puede cambiar)
    fila.querySelector('[data-fs-base]').addEventListener('input', () => {
      if (!b.ivaManual) {
        const base = Number(fila.querySelector('[data-fs-base]').value);
        fila.querySelector('[data-fs-iva]').value = base > 0 && g.base > 0 ? String(Math.round(base * g.iva / g.base * 100) / 100) : '';
      }
      lee();
    });
    fila.querySelector('[data-fs-iva]').addEventListener('input', () => { b.ivaManual = fila.querySelector('[data-fs-iva]').value !== ''; lee(); });
    // una factura con varios tipos de IVA se apunta en el formulario completo (con su desglose); al guardarla se vuelve aquí
    fila.querySelector('[data-fs-desglosar]').addEventListener('click', () => {
      facturaPreseleccion = { proveedorId: g.proveedorId, cubre: [g.id], fecha: b.fecha, numFactura: b.num, volver: 'facturas-semana', desglosar: true };
      cambiarTab('gasto-factura');
    });
    const selEntrada = fila.querySelector('[data-fs-entrada]');
    if (selEntrada) selEntrada.addEventListener('change', () => { const v = selEntrada.value; selEntrada.value = ''; if (v) adjuntarEntradaFilaSemana(g, v); });
    fila.querySelector('[data-fs-archivo]').addEventListener('change', (e) => {
      const archivo = e.target.files && e.target.files[0];
      e.target.value = '';
      if (archivo) subirArchivoFilaSemana(g, archivo);
    });
    fila.querySelector('[data-fs-igualmente]').addEventListener('click', async () => {
      if (guardandoSemana) return;
      guardandoSemana = true;
      try {
        const res = await guardarFilaSemana(g, true);
        if (res === 'ok') {
          delete semanaBorrador[g.id];
          await cargarFacturasSemana();
          const m = document.getElementById('fsMsg');
          m.textContent = '1 factura guardada.'; m.className = 'form-msg is-ok';
        }
      } finally { guardandoSemana = false; }
    });
    pintarFilaSemana(g);
  });
  actualizarContadorSemana();
}

function pintarEntradaSemana() {
  const info = document.getElementById('fsEntradaInfo');
  info.textContent = '';
  const n = semanaEntrada.archivos.length;
  if (n) info.appendChild(document.createTextNode(`${n} factura${n === 1 ? '' : 's'} subida${n === 1 ? '' : 's'} esperando asignarse a su fila. `));
  if (/^https:\/\//.test(semanaEntrada.carpetaUrl)) {
    const a = document.createElement('a');
    a.href = semanaEntrada.carpetaUrl; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Abrir la carpeta de entrada en Drive';
    info.appendChild(a);
  }
}

// Desplegable de cada fila con las facturas digitales de la carpeta de entrada (solo si hay alguna)
function opcionesEntradaSemana() {
  if (!semanaEntrada.archivos.length) return '';
  return `<select class="select-input" data-fs-entrada aria-label="Elegir una factura de la carpeta de entrada" style="max-width:100%;"><option value="">📂 Elegir de la carpeta de entrada…</option>${semanaEntrada.archivos.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.nombre)}</option>`).join('')}</select>`;
}

// Pega a la fila una factura digital que ya está en la carpeta de entrada. Al guardar la factura, ese archivo se mueve solo a su carpeta y se renombra.
async function adjuntarEntradaFilaSemana(g, idArchivo) {
  const a = semanaEntrada.archivos.find((x) => x.id === idArchivo);
  const b = borradorSemana(g);
  if (!a || b.subiendo) return;
  b.subiendo = true; b.errorArchivo = '';
  pintarFilaSemana(g);
  try {
    const r = await apiGet('adjuntarJustificante', { id: g.id, justificanteId: a.id, justificanteUrl: a.url }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
    if (!r.ok) throw new Error(r.error || 'No se pudo adjuntar.');
    b.url = a.url;
  } catch (err) {
    b.errorArchivo = 'No se ha podido adjuntar: ' + ((err && err.message) ? err.message : textoDeFallo(err));
  } finally {
    b.subiendo = false;
    pintarFilaSemana(g);
  }
}

// Sube varias facturas digitales de una vez a la carpeta de entrada (con su nombre), para elegir después la de cada fila
async function subirVariasASemana(archivos) {
  if (subiendoVarias || !archivos.length) return;
  subiendoVarias = true;
  const msg = document.getElementById('fsMsg');
  const fallos = [];
  try {
    for (let i = 0; i < archivos.length; i++) {
      msg.textContent = `Subiendo ${i + 1} de ${archivos.length}…`;
      msg.className = 'form-msg';
      try {
        const f = await prepararArchivoJustificante(archivos[i]);
        const r = await apiPost('subirJustificante', { destino: 'entrada', nombre: archivos[i].name, mime: f.mime, base64: f.base64 });
        if (!r.ok) throw new Error(r.error || 'No se pudo subir.');
      } catch (err) {
        fallos.push(`${archivos[i].name}: ${(err && err.message) ? err.message : textoDeFallo(err)}`);
      }
    }
  } finally {
    subiendoVarias = false;
  }
  const subidas = archivos.length - fallos.length;
  const texto = (subidas ? `${subidas} factura${subidas === 1 ? '' : 's'} subida${subidas === 1 ? '' : 's'}. Elige en cada fila la que le corresponde.` : '') + (fallos.length ? ` No se han podido subir: ${fallos.join('; ')}` : '');
  const clase = 'form-msg ' + (fallos.length ? 'is-error' : 'is-ok');
  await cargarFacturasSemana();   // trae la carpeta de entrada con lo nuevo; lo escrito en las filas se conserva
  msg.textContent = texto; msg.className = clase;
}

// Sube la factura de una fila a Drive y la pega al gasto estimado de ese día (queda guardada aunque no se escriba nada más)
async function subirArchivoFilaSemana(g, archivo) {
  const b = borradorSemana(g);
  if (b.subiendo) return;
  b.subiendo = true; b.errorArchivo = '';
  pintarFilaSemana(g);
  try {
    const f = await prepararArchivoJustificante(archivo);
    const r = await apiPost('subirJustificante', { mime: f.mime, base64: f.base64, fecha: (g.pedidoFecha || g.fecha), proveedor: g.proveedor, numFactura: String(b.num || '').trim() });
    if (!r.ok) throw new Error(r.error || 'No se pudo subir.');
    const a = await apiGet('adjuntarJustificante', { id: g.id, justificanteId: r.id, justificanteUrl: r.url }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
    if (!a.ok) throw new Error('Se ha subido, pero no se ha podido guardar en el gasto: ' + (a.error || ''));
    b.url = r.url;
  } catch (err) {
    b.errorArchivo = 'No se ha podido adjuntar: ' + ((err && err.message) ? err.message : textoDeFallo(err));
  } finally {
    b.subiendo = false;
    pintarFilaSemana(g);
  }
}

// Apunta la factura de UNA fila. Devuelve 'ok', 'repetida', 'error' o 'red' (se cortó la conexión)
async function guardarFilaSemana(g, igualmente) {
  const b = borradorSemana(g);
  const pagadas = document.getElementById('fsPagadas').checked;
  const proveedor = proveedoresCache.find((p) => String(p.id) === String(g.proveedorId));
  const datos = {
    fecha: formatoFechaES(b.fecha), proveedorId: g.proveedorId, proveedorNombre: proveedor ? proveedor.nombre : g.proveedor, numFactura: String(b.num).trim(),
    base: String(Number(b.base) || 0), iva: String(Number(b.iva) || 0), cubre: String(g.id), categoria: 'Mercancía',
    pagado: pagadas ? 'true' : 'false', fechaPago: pagadas ? formatoFechaES(document.getElementById('fsFechaPago').value) : '',
  };
  const huella = JSON.stringify(datos);
  if (!b.solicitud || b.solicitud.huella !== huella) b.solicitud = { id: idUnico(), huella };
  datos.idSolicitud = b.solicitud.id;
  if (igualmente) datos.confirmarDuplicado = '1';
  b.estado = 'guardando'; b.error = ''; b.repetida = false;
  pintarFilaSemana(g);
  const r = await apiGet('incorporarFactura', datos).catch((err) => ({ ok: false, red: true, error: errorDeRed(err) }));
  if (r.ok) { b.estado = 'ok'; pintarFilaSemana(g); return 'ok'; }
  b.estado = '';
  if (r.facturaRepetida) { b.error = r.error; b.repetida = true; pintarFilaSemana(g); return 'repetida'; }
  b.error = r.error || 'No se pudo guardar.';
  pintarFilaSemana(g);
  return r.red ? 'red' : 'error';
}

async function guardarFacturasSemana() {
  if (guardandoSemana) return;
  const msg = document.getElementById('fsMsg');
  const rellenas = semanaFilas.filter((g) => filaSemanaRellena(borradorSemana(g)) && borradorSemana(g).estado !== 'ok');
  if (!rellenas.length) { msg.textContent = 'Rellena al menos una factura (el número y la base).'; msg.className = 'form-msg is-error'; return; }
  if (semanaFilas.some((g) => borradorSemana(g).subiendo)) { msg.textContent = 'Espera a que terminen de subirse las facturas adjuntas.'; msg.className = 'form-msg is-error'; return; }
  if (document.getElementById('fsPagadas').checked && !document.getElementById('fsFechaPago').value) { msg.textContent = 'Pon la fecha de pago (o desmarca "ya están pagadas").'; msg.className = 'form-msg is-error'; return; }
  const sinFecha = rellenas.find((g) => !borradorSemana(g).fecha);
  if (sinFecha) { msg.textContent = `Falta la fecha de la factura de ${sinFecha.proveedor}.`; msg.className = 'form-msg is-error'; return; }
  guardandoSemana = true;
  const boton = document.getElementById('btnFsGuardar');
  boton.disabled = true;
  if (!proveedoresCache.length) { const p = await apiGet('proveedores').catch(() => null); if (p && p.ok) proveedoresCache = p.data; }
  let hechas = 0, fallidas = 0, cortado = false;
  try {
    for (let i = 0; i < rellenas.length; i++) {
      msg.textContent = `Guardando… ${i + 1} de ${rellenas.length}`;
      msg.className = 'form-msg';
      const res = await guardarFilaSemana(rellenas[i], false);
      if (res === 'ok') hechas++; else fallidas++;
      if (res === 'red') { cortado = true; break; }
    }
  } finally {
    guardandoSemana = false;
    boton.disabled = false;
  }
  msg.textContent = `${hechas} factura${hechas === 1 ? '' : 's'} guardada${hechas === 1 ? '' : 's'}.` + (cortado ? ' Se ha cortado la conexión: las que faltan siguen aquí, pulsa Guardar otra vez.' : fallidas ? ` ${fallidas} con problema: revísalas abajo.` : '');
  msg.className = 'form-msg ' + (fallidas ? 'is-error' : 'is-ok');
  // las guardadas desaparecen de la lista; las que han dado problema se quedan con lo escrito
  rellenas.filter((g) => semanaBorrador[g.id].estado === 'ok').forEach((g) => { delete semanaBorrador[g.id]; });
  const guardado = msg.textContent, clase = msg.className;
  await cargarFacturasSemana();
  msg.textContent = guardado; msg.className = clase;
}

/* ============ CUADRAR CON EL RESUMEN DEL PROVEEDOR ============ */
let cuadrando = false;
let importandoResumen = false;
let ultimoCuadre = null;   // lo último que se comprobó: { proveedorId, proveedorNombre, texto, importables }
async function iniciarCuadrar() {
  if (!proveedoresCache.length) {
    const r = await apiGet('proveedores').catch(() => null);
    if (r && r.ok) proveedoresCache = r.data;
  }
  const sel = document.getElementById('cdProveedor');
  const elegido = sel.value;
  sel.innerHTML = '<option value="">Elige el proveedor…</option>' + proveedoresCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  sel.value = elegido;   // al volver de apuntar una factura se conserva lo que había
}

function iso(f) { return f.split('/').reverse().join('-'); }

function pintarCuadre(r, proveedorId, texto) {
  const cont = document.getElementById('cdResultado');
  const importables = r.faltanEnApp.filter((x) => x.importable);
  const selProv = document.getElementById('cdProveedor');
  ultimoCuadre = { proveedorId, proveedorNombre: selProv.selectedOptions && selProv.selectedOptions[0] ? selProv.selectedOptions[0].textContent : '', texto: texto || '', importables };
  const sumaImp = (k) => redondeo2(importables.reduce((s, x) => s + (Number(x[k]) || 0), 0));
  const e = (n) => escapeHtml(formatoEuros(n));
  const dif = (n) => (n > 0 ? '+' : '') + formatoEuros(n);
  const bloque = (titulo, color, filas, vacio) => filas.length ? `<div class="card"><div class="card__name"${color ? ` style="color:${color};"` : ''}>${titulo} (${filas.length})</div>${filas.join('')}</div>` : (vacio || '');
  cont.innerHTML = `
    <div class="card">
      <div class="card__name" style="color:${r.cuadra ? 'var(--ok-green, #2E7D4F)' : 'var(--warn-red)'};">${r.cuadra ? '✓ Todo cuadra' : 'No cuadra'}</div>
      <div class="card__meta">Del ${escapeHtml(r.desde)} al ${escapeHtml(r.hasta)} · ${r.lineas} factura${r.lineas === 1 ? '' : 's'} en el resumen</div>
      <div class="card__meta">Resumen del proveedor: ${e(r.totalResumen)} · Lo que tienes apuntado: ${e(r.totalApp)} · Diferencia: ${escapeHtml(dif(r.diferencia))}</div>
      ${r.repetidasEnResumen.length ? `<div class="card__meta" style="color:var(--warn-red); margin-top:4px;">⚠ El listado repite ${r.repetidasEnResumen.length} número${r.repetidasEnResumen.length === 1 ? '' : 's'} de factura: el total del proveedor cuenta esas líneas y aquí no. Revísalo con él.</div>` : ''}
    </div>
    ${importables.length ? `<div class="card">
      <div class="card__name">Apuntar de golpe las que faltan</div>
      <div class="card__meta" style="margin-top:4px;">${importables.length} factura${importables.length === 1 ? '' : 's'}: base ${e(sumaImp('base'))} + IVA ${e(sumaImp('iva'))} = ${e(sumaImp('total'))}. Se apuntan con los datos del listado, cubren el gasto estimado de su día (si lo hay) y el listado se guarda en Drive como justificante.${r.faltanEnApp.length > importables.length ? ` ${r.faltanEnApp.length - importables.length} no se pueden apuntar solas (están abajo con el motivo).` : ''}</div>
      <label style="display:flex; gap:8px; align-items:center; margin:10px 0 6px; font-size:15px;"><input type="checkbox" id="cdPagadas"><span>Ya están pagadas</span></label>
      <button class="btn-primary" id="btnCdImportar" style="width:100%;">Apuntar las ${importables.length} que se pueden</button>
    </div>` : ''}
    ${bloque('⚠ Importe distinto', 'var(--warn-red)', r.importeDistinto.map((x) => `<div class="card__meta" style="margin-top:6px;"><strong>${escapeHtml(x.numFactura)}</strong> · ${escapeHtml(x.fecha)} · el proveedor dice ${e(x.resumen)} y tienes ${e(x.app)} (${escapeHtml(dif(x.diferencia))})</div>`))}
    ${bloque('✗ Están en el resumen y NO las tienes apuntadas', 'var(--warn-red)', r.faltanEnApp.map((x, i) => `<div style="margin-top:8px;"><div style="display:flex; justify-content:space-between; align-items:center; gap:8px;"><div class="card__meta"><strong>${escapeHtml(x.numFactura)}</strong> · ${escapeHtml(x.fecha)} · ${e(x.total)}${x.base !== null && x.base !== undefined ? ` (base ${e(x.base)} + IVA ${e(x.iva)})` : ''}</div><button class="chip-btn" data-cd-apuntar="${i}">Apuntarla</button></div>${x.importable ? '' : `<div class="card__meta" style="color:var(--warn-red);">${escapeHtml(x.motivo || '')}</div>`}</div>`))}
    ${bloque('? Las tienes apuntadas pero NO salen en el resumen', 'var(--warn-red)', r.sobranEnApp.map((x) => `<div class="card__meta" style="margin-top:6px;"><strong>${escapeHtml(x.numFactura || 'sin número')}</strong> · ${escapeHtml(x.fecha)} · ${e(x.total)}</div>`))}
    ${bloque('Repetidas en el resumen (no se apuntan: revísalas con el proveedor)', '', r.repetidasEnResumen.map((x) => `<div class="card__meta" style="margin-top:6px;">${escapeHtml(x.numFactura)} · ${escapeHtml(x.fecha)} · ${e(x.total)}</div>`))}
    ${r.ignoradas.length ? `<div class="card"><div class="card__name">Líneas que no he entendido (${r.ignoradas.length})</div>${r.ignoradas.map((x) => `<div class="card__meta" style="margin-top:4px;">${escapeHtml(x)}</div>`).join('')}</div>` : ''}
    ${r.coinciden.length ? `<div class="card"><div class="card__name">✓ Coinciden (${r.coinciden.length})</div><div class="card__meta" style="margin-top:6px;">${r.coinciden.map((x) => escapeHtml(x.numFactura)).join(' · ')}</div></div>` : ''}`;
  const botonImportar = document.getElementById('btnCdImportar');
  if (botonImportar) botonImportar.addEventListener('click', importarDelListado);
  cont.querySelectorAll('[data-cd-apuntar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const x = r.faltanEnApp[Number(btn.dataset.cdApuntar)];
      facturaPreseleccion = { proveedorId, cubre: [], fecha: iso(x.fecha), numFactura: x.numFactura, volver: 'cuadrar' };
      cambiarTab('gasto-factura');
    });
  });
}

// Apunta de golpe las facturas que faltan con los datos del listado. El servidor lo hace por tandas (cada factura tarda unos segundos), así que se repite
// la petición hasta que no queden. Al terminar se vuelve a comprobar para ver cómo ha quedado.
async function importarDelListado() {
  if (importandoResumen || !ultimoCuadre || !ultimoCuadre.importables.length) return;
  const c = ultimoCuadre;
  const msg = document.getElementById('cdMsg');
  const total = redondeo2(c.importables.reduce((s, x) => s + x.total, 0));
  const base = redondeo2(c.importables.reduce((s, x) => s + x.base, 0));
  const iva = redondeo2(c.importables.reduce((s, x) => s + x.iva, 0));
  if (!confirm(`¿Apuntar ${c.importables.length} factura${c.importables.length === 1 ? '' : 's'} de ${c.proveedorNombre}?\n\nBase ${formatoEuros(base)} + IVA ${formatoEuros(iva)} = ${formatoEuros(total)}\n\nSe apuntan con los datos del listado y cubren el gasto estimado de su día. El listado se guarda en Drive como justificante.`)) return;
  const pagadas = !!(document.getElementById('cdPagadas') && document.getElementById('cdPagadas').checked);
  const boton = document.getElementById('btnCdImportar');
  importandoResumen = true;
  if (boton) boton.disabled = true;
  const acum = { importadas: 0, yaEstaban: 0, errores: [], listadoUrl: '', fallo: '' };
  try {
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      msg.textContent = `Apuntando las facturas… ${acum.importadas} de ${c.importables.length}`;
      msg.className = 'form-msg';
      const r = await apiPost('importarResumen', { idProveedor: c.proveedorId, texto: c.texto, pagado: pagadas ? 'true' : 'false', fechaPago: pagadas ? formatoFechaES(hoyISO()) : '' })
        .catch((err) => ({ ok: false, error: textoDeFallo(err) }));
      if (!r.ok) { acum.fallo = r.error || 'No se pudo apuntar.'; break; }
      acum.importadas += r.importadas || 0;
      acum.yaEstaban += r.yaEstaban || 0;
      (r.resultados || []).filter((x) => !x.ok).forEach((x) => acum.errores.push(x));
      if (r.listadoUrl) acum.listadoUrl = r.listadoUrl;
      if (!(r.quedan > 0) || ((r.importadas || 0) + (r.yaEstaban || 0)) === 0) break;   // no quedan, o no se avanza (para no dar vueltas)
    }
  } finally {
    importandoResumen = false;
  }
  await comprobarResumen();   // vuelve a cuadrar con lo ya apuntado
  const partes = [];
  if (acum.importadas) partes.push(`${acum.importadas} factura${acum.importadas === 1 ? '' : 's'} apuntada${acum.importadas === 1 ? '' : 's'}`);
  if (acum.yaEstaban) partes.push(`${acum.yaEstaban} ya estaba${acum.yaEstaban === 1 ? '' : 'n'}`);
  if (acum.errores.length) partes.push(`${acum.errores.length} con problema (${acum.errores.slice(0, 3).map((x) => `${x.numFactura}: ${x.error}`).join('; ')}${acum.errores.length > 3 ? '…' : ''})`);
  if (acum.fallo) partes.push(`se paró: ${acum.fallo}${acum.importadas ? ' (lo ya apuntado se conserva)' : ''}`);
  msg.textContent = partes.join(' · ') || 'No se ha apuntado nada.';
  msg.className = 'form-msg ' + (acum.errores.length || acum.fallo ? 'is-error' : 'is-ok');
  if (/^https:\/\//.test(acum.listadoUrl)) {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'card';
    const meta = document.createElement('div');
    meta.className = 'card__meta';
    meta.appendChild(document.createTextNode('El listado queda guardado en Drive como justificante de esas facturas: '));
    const enlace = document.createElement('a');
    enlace.href = acum.listadoUrl; enlace.target = '_blank'; enlace.rel = 'noopener'; enlace.textContent = 'abrirlo';
    meta.appendChild(enlace);
    tarjeta.appendChild(meta);
    document.getElementById('cdResultado').insertBefore(tarjeta, document.getElementById('cdResultado').firstChild);
  }
}

async function comprobarResumen() {
  if (cuadrando) return;
  const msg = document.getElementById('cdMsg');
  const proveedorId = document.getElementById('cdProveedor').value;
  const texto = document.getElementById('cdTexto').value;
  if (!proveedorId) { msg.textContent = 'Elige el proveedor.'; msg.className = 'form-msg is-error'; return; }
  if (!texto.trim()) { msg.textContent = 'Pega el listado del proveedor.'; msg.className = 'form-msg is-error'; return; }
  cuadrando = true;
  const boton = document.getElementById('btnCuadrar');
  boton.disabled = true;
  msg.textContent = 'Comprobando…';
  msg.className = 'form-msg';
  document.getElementById('cdResultado').innerHTML = '';
  try {
    const r = await apiPost('cuadrarResumen', { idProveedor: proveedorId, texto }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
    if (!r.ok) {
      msg.textContent = r.error || 'No se pudo comprobar.';
      msg.className = 'form-msg is-error';
      if (r.ignoradas && r.ignoradas.length) document.getElementById('cdResultado').innerHTML = `<div class="card"><div class="card__name">Líneas que no he entendido</div>${r.ignoradas.map((x) => `<div class="card__meta" style="margin-top:4px;">${escapeHtml(x)}</div>`).join('')}</div>`;
      return;
    }
    msg.textContent = '';
    pintarCuadre(r, proveedorId, texto);
  } finally {
    cuadrando = false;
    boton.disabled = false;
  }
}

function cablearCuadrar() {
  document.getElementById('btnFsGuardar').addEventListener('click', guardarFacturasSemana);
  const varias = document.getElementById('fsArchivos');
  varias.addEventListener('change', () => { const lista = varias.files ? Array.from(varias.files) : []; varias.value = ''; subirVariasASemana(lista); });
  document.getElementById('btnFsVariosDias').addEventListener('click', () => { facturaPreseleccion = { volver: 'facturas-semana' }; cambiarTab('gasto-factura'); });
  document.getElementById('fsPagadas').addEventListener('change', () => { document.getElementById('fsFechaPagoBloque').style.display = document.getElementById('fsPagadas').checked ? 'block' : 'none'; });
  document.getElementById('btnCuadrar').addEventListener('click', comprobarResumen);
  document.getElementById('cdArchivo').addEventListener('change', (e) => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => { document.getElementById('cdTexto').value = String(lector.result || ''); };
    lector.onerror = () => { const m = document.getElementById('cdMsg'); m.textContent = 'No se ha podido leer el archivo.'; m.className = 'form-msg is-error'; };
    lector.readAsText(archivo);
  });
  document.getElementById('fdFecha').addEventListener('change', cargarFacturasDia);
  document.querySelectorAll('[data-fd-rapido]').forEach((b) => b.addEventListener('click', () => {
    document.getElementById('fdFecha').value = b.dataset.fdRapido === 'ayer' ? ayerISO() : hoyISO();
    cargarFacturasDia();
  }));
}

/* ============ ZONA DEL GESTOR ============ */
function mesDelGestor() {
  const v = document.getElementById('gestorMes').value;
  if (!v) return null;
  const [anio, mes] = v.split('-');
  return { anio, mes: String(Number(mes)), etiqueta: v };
}

function limitesDelMes(anio, mes) {
  const ultimo = new Date(Number(anio), Number(mes), 0).getDate();
  const p = (n) => String(n).padStart(2, '0');
  return { ini: `01/${p(mes)}/${anio}`, fin: `${p(ultimo)}/${p(mes)}/${anio}` };
}

function mensajeGestor(texto, tipo) {
  const msg = document.getElementById('gestorMsg');
  msg.textContent = texto;
  msg.className = 'form-msg' + (tipo ? ' is-' + tipo : '');
}

function iniciarGestor() {
  const entrada = document.getElementById('gestorMes');
  if (!entrada.value) entrada.value = mesActualISO();
  mensajeGestor('', '');
  document.getElementById('gestorResultado').innerHTML = '';
}

async function descargarCsvGestor(tipo) {
  const m = mesDelGestor();
  if (!m) { mensajeGestor('Elige el mes.', 'error'); return; }
  mensajeGestor('Preparando…', '');
  const r = await apiGet('gestorCsv', { anio: m.anio, mes: m.mes, tipo }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (!r.ok) { mensajeGestor('No se pudo preparar: ' + (r.error || 'inténtalo de nuevo'), 'error'); return; }
  await descargarTexto(r.nombre, r.csv, 'text/csv;charset=utf-8');
  mensajeGestor(`${r.nombre}: ${r.filas} fila${r.filas === 1 ? '' : 's'}. Se abre con Excel.`, 'ok');
}

async function descargarXlsxGestor() {
  const m = mesDelGestor();
  if (!m) { mensajeGestor('Elige el mes.', 'error'); return; }
  mensajeGestor('Preparando el Excel…', '');
  const r = await apiGet('gestorXlsx', { anio: m.anio, mes: m.mes }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (!r.ok) { mensajeGestor('No se pudo preparar: ' + (r.error || 'inténtalo de nuevo'), 'error'); return; }
  await descargarPDF(r.base64, r.nombre, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  mensajeGestor(`${r.nombre}: ${r.filas} fila${r.filas === 1 ? '' : 's'} en 3 hojas (emitidas, recibidas e IVA).`, 'ok');
}

async function descargarLibroGestor(accion) {
  const m = mesDelGestor();
  if (!m) { mensajeGestor('Elige el mes.', 'error'); return; }
  const l = limitesDelMes(m.anio, m.mes);
  mensajeGestor('Generando el PDF…', '');
  const r = await apiGet(accion, { fechaIni: l.ini, fechaFin: l.fin }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok) { mensajeGestor('No se pudo generar: ' + (r.error || 'inténtalo de nuevo'), 'error'); return; }
  await descargarPDF(r.base64, r.nombre);
  mensajeGestor('PDF listo.', 'ok');
}

function pintarResultadoCarpeta(r) {
  const cont = document.getElementById('gestorResultado');
  const j = r.justificantes;
  const ficha = (x) => escapeHtml((x.proveedor || 'sin proveedor') + (x.numFactura ? ' nº ' + x.numFactura : '') + ' (' + x.fecha + ')');
  cont.innerHTML = `
    <div class="card">
      <div class="card__name">Carpeta de ${escapeHtml(r.mes)} preparada</div>
      ${/^https:\/\//.test(r.url) ? `<div class="card__meta"><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">Abrir la carpeta en Google Drive</a></div>` : ''}
      <div class="card__meta" style="margin-top:6px;">${r.ficheros.map((f) => escapeHtml(f.nombre) + ' · ' + f.filas + ' fila' + (f.filas === 1 ? '' : 's')).join('<br>')}</div>
      <div class="card__meta" style="margin-top:6px;">Justificantes de compras: ${j.copiados} archivo${j.copiados === 1 ? '' : 's'} copiado${j.copiados === 1 ? '' : 's'}${j.yaEstaban ? ', ' + j.yaEstaban + ' ya estaba' + (j.yaEstaban === 1 ? '' : 'n') : ''} · PDF de facturas emitidas: ${r.pdfsEmitidas}</div>
      ${j.sinJustificante.length ? `<div class="card__meta" style="margin-top:6px; color:var(--warn-red);">Sin factura adjunta (${j.sinJustificante.length}): ${j.sinJustificante.map(ficha).join('; ')}</div>` : ''}
      ${j.perdidos.length ? `<div class="card__meta" style="margin-top:6px; color:var(--warn-red);">La factura adjunta ya no está en Drive (${j.perdidos.length}): ${j.perdidos.map(ficha).join('; ')}</div>` : ''}
    </div>`;
}

async function prepararCarpetaGestor() {
  const m = mesDelGestor();
  if (!m) { mensajeGestor('Elige el mes.', 'error'); return; }
  mensajeGestor('Preparando la carpeta en Drive… (puede tardar un poco)', '');
  const r = await apiGet('gestorCarpeta', { anio: m.anio, mes: m.mes }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (!r.ok) { mensajeGestor('No se pudo preparar: ' + (r.error || 'inténtalo de nuevo'), 'error'); return; }
  pintarResultadoCarpeta(r);
  const avisos = r.justificantes.sinJustificante.length + r.justificantes.perdidos.length;
  mensajeGestor(avisos ? `Carpeta lista, pero hay ${avisos} factura${avisos === 1 ? '' : 's'} de proveedor sin la factura adjunta.` : 'Carpeta lista.', avisos ? 'error' : 'ok');
}

let generandoPdfsGestor = false;
async function generarPdfsEmitidasGestor(boton) {
  if (generandoPdfsGestor) return;
  const m = mesDelGestor();
  if (!m) { mensajeGestor('Elige el mes.', 'error'); return; }
  generandoPdfsGestor = true;
  boton.disabled = true;
  try {
    for (let vuelta = 0; vuelta < 300; vuelta++) {
      const r = await apiGet('gestorPdfsEmitidas', { anio: m.anio, mes: m.mes, lote: '8' }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
      if (!r.ok) { mensajeGestor('No se pudo seguir: ' + (r.error || 'inténtalo de nuevo (lo ya hecho se conserva)'), 'error'); return; }
      if (r.errores && r.errores.length) { mensajeGestor(`No se pudo generar la factura nº ${r.errores[0].id}: ${r.errores[0].error}`, 'error'); return; }
      if (r.total === 0) { mensajeGestor('No hay facturas emitidas en ese mes.', ''); return; }
      mensajeGestor(`Generando los PDF de las facturas emitidas… ${r.total - r.restantes} de ${r.total}`, '');
      if (r.restantes === 0) { mensajeGestor(`Listos los PDF de las ${r.total} facturas emitidas. Están en la carpeta del mes.`, 'ok'); return; }
      if (r.hechas === 0) { mensajeGestor('No se ha podido avanzar. Inténtalo de nuevo.', 'error'); return; }
    }
  } finally {
    generandoPdfsGestor = false;
    boton.disabled = false;
  }
}

async function compartirCarpetaGestor() {
  const m = mesDelGestor();
  if (!m) { mensajeGestor('Elige el mes.', 'error'); return; }
  if (!confirm(`¿Compartir la carpeta de ${m.etiqueta} con tu gestor (solo lectura) y avisarle por correo?`)) return;
  mensajeGestor('Compartiendo…', '');
  const r = await apiGet('gestorCompartir', { anio: m.anio, mes: m.mes }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (!r.ok) { mensajeGestor(r.error || 'No se pudo compartir.', 'error'); return; }
  mensajeGestor(`Carpeta compartida con ${r.email}. Le ha llegado un correo con el enlace.`, 'ok');
}

function cablearPanelYGestor() {
  const panelMes = document.getElementById('panelMes');
  panelMes.addEventListener('change', cargarPanel);
  document.getElementById('btnPanelAnterior').addEventListener('click', () => { panelMes.value = desplazarMesISO(panelMes.value || mesActualISO(), -1); cargarPanel(); });
  document.getElementById('btnPanelSiguiente').addEventListener('click', () => { panelMes.value = desplazarMesISO(panelMes.value || mesActualISO(), 1); cargarPanel(); });
  document.getElementById('btnGestorXlsx').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Preparando…', descargarXlsxGestor));
  document.getElementById('btnGestorEmitidas').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Preparando…', () => descargarCsvGestor('emitidas')));
  document.getElementById('btnGestorRecibidas').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Preparando…', () => descargarCsvGestor('recibidas')));
  document.getElementById('btnGestorIva').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Preparando…', () => descargarCsvGestor('iva')));
  document.getElementById('btnGestorLibroEmitidas').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Generando…', () => descargarLibroGestor('libroFacturasPdf')));
  document.getElementById('btnGestorLibroGastos').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Generando…', () => descargarLibroGestor('libroGastosPdf')));
  document.getElementById('btnGestorCarpeta').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Preparando…', prepararCarpetaGestor));
  document.getElementById('btnGestorPdfs').addEventListener('click', (e) => generarPdfsEmitidasGestor(e.currentTarget));
  document.getElementById('btnGestorCompartir').addEventListener('click', (e) => conEstadoCarga(e.currentTarget, 'Compartiendo…', compartirCarpetaGestor));
}

/* ============ INCORPORAR LA FACTURA DE UN PROVEEDOR ============ */
let facturaPreseleccion = null;   // al abrir desde un gasto estimado, de las facturas del día o del cuadre: { proveedorId, cubre: [ids], fecha (aaaa-mm-dd), numFactura, volver }
let facturaDestino = 'gastos-ver'; // adónde se vuelve al guardar
let facturaEstimados = [];        // los gastos estimados pendientes del proveedor elegido
let solicitudFactura = null;      // código del intento: si se repite el envío, el servidor no duplica la factura
let guardandoFactura = false;

async function cargarFormularioFactura() {
  const pre = facturaPreseleccion;
  facturaPreseleccion = null;
  if (!proveedoresCache.length) {
    const r = await apiGet('proveedores').catch(() => null);
    if (r && r.ok) proveedoresCache = r.data;
  }
  const sel = document.getElementById('facProveedor');
  sel.innerHTML = '<option value="">Elige el proveedor…</option>' +
    proveedoresCache.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  document.getElementById('facNumero').value = (pre && pre.numFactura) || '';
  if (pre && pre.fecha) document.getElementById('facFecha').value = pre.fecha; else document.getElementById('facFecha').value = hoyISO();
  facturaDestino = (pre && pre.volver) || 'gastos-ver';
  const atras = document.querySelector('#tab-gasto-factura [data-volver]');
  atras.dataset.volver = facturaDestino;
  atras.textContent = facturaDestino === 'facturas-dia' ? '← Facturas de hoy' : facturaDestino === 'facturas-semana' ? '← Facturas de la semana' : facturaDestino === 'cuadrar' ? '← Cuadrar con el resumen' : '← Gastos';
  document.getElementById('facBase').value = '';
  document.getElementById('facIva').value = '';
  reiniciarDesgloseFactura(pre && pre.desglosar);   // si se viene de "Desglosar IVA" de una fila, el desglose ya está abierto
  document.getElementById('facRetencion').value = '';
  document.getElementById('facCategoria').value = 'Mercancía';
  document.getElementById('facPagada').checked = false;   // una factura de proveedor suele quedar pendiente hasta que se paga
  document.getElementById('facFechaPago').value = hoyISO();
  alternarFechaPagoFactura();
  reiniciarJustificante('fac');
  cargarCategoriasGasto();
  document.getElementById('facMsg').textContent = '';
  document.getElementById('btnGuardarFactura').disabled = false;
  solicitudFactura = null;
  guardandoFactura = false;
  if (pre && pre.proveedorId !== '' && pre.proveedorId !== undefined && pre.proveedorId !== null) sel.value = String(pre.proveedorId);
  await cargarEstimadosDeProveedor(pre ? pre.cubre : null);
}

async function cargarEstimadosDeProveedor(seleccion) {
  const cont = document.getElementById('facEstimados');
  const idProv = document.getElementById('facProveedor').value;
  if (!idProv) {
    facturaEstimados = [];
    cont.innerHTML = '<div class="empty-state">Elige el proveedor para ver sus gastos estimados pendientes.</div>';
    recalcularFactura();
    return;
  }
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';
  const r = await apiGet('gastosEstimados', { idProveedor: idProv }).catch((err) => ({ ok: false, error: textoDeFallo(err) }));
  if (document.getElementById('facProveedor').value !== idProv) return;   // cambió de proveedor mientras cargaba
  if (!r.ok) {
    facturaEstimados = [];
    cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml(r.error || '')}</div>`;
    recalcularFactura();
    return;
  }
  facturaEstimados = r.data;
  if (!facturaEstimados.length) {
    cont.innerHTML = '<div class="empty-state">Este proveedor no tiene gastos estimados pendientes: la factura se incorporará como un gasto normal.</div>';
    recalcularFactura();
    return;
  }
  const marcado = (g) => seleccion ? seleccion.map(String).includes(String(g.id)) : true;
  cont.innerHTML = facturaEstimados.map((g) => `
    <label class="card" style="display:flex; gap:10px; align-items:center; cursor:pointer;">
      <input type="checkbox" data-fac-cubre="${g.id}"${marcado(g) ? ' checked' : ''}>
      <span style="flex:1;">${escapeHtml(g.pedidoFecha || g.fecha)}<span class="card__meta"> · pedido a ${escapeHtml(g.proveedor)}</span></span>
      <strong>${formatoEuros(g.total)}</strong>
    </label>`).join('');
  cont.querySelectorAll('[data-fac-cubre]').forEach((c) => c.addEventListener('change', recalcularFactura));
  recalcularFactura();
}

function idsCubiertosPorLaFactura() {
  return Array.from(document.querySelectorAll('#facEstimados [data-fac-cubre]')).filter((c) => c.checked).map((c) => c.dataset.facCubre);
}

// Total de la factura y comparación con lo estimado de los días que cubre
function alternarFechaPagoFactura() {
  document.getElementById('facFechaPagoBloque').style.display = document.getElementById('facPagada').checked ? 'block' : 'none';
}

function contextoJustificanteFactura() {
  const proveedorId = document.getElementById('facProveedor').value;
  const fecha = document.getElementById('facFecha').value;
  return {
    fecha: fecha ? formatoFechaES(fecha) : '',
    proveedor: proveedorId ? (proveedoresCache.find((p) => String(p.id) === proveedorId) || {}).nombre || '' : '',
    numFactura: document.getElementById('facNumero').value.trim(),
  };
}

function recalcularFactura() {
  const total = (Number(document.getElementById('facBase').value) || 0) + (Number(document.getElementById('facIva').value) || 0);
  document.getElementById('facTotal').textContent = formatoEuros(total);
  const retencion = Number(document.getElementById('facRetencion').value) || 0;
  document.getElementById('facAPagar').textContent = retencion > 0 ? `Total a pagar, descontada la retención de ${formatoEuros(retencion)}: ${formatoEuros(total - retencion)}` : '';
  const marcados = idsCubiertosPorLaFactura();
  const el = document.getElementById('facComparacion');
  if (!marcados.length) { el.textContent = ''; return; }
  const estimado = facturaEstimados.filter((g) => marcados.includes(String(g.id))).reduce((s, g) => s + g.total, 0);
  const dif = total - estimado;
  el.textContent = `Estimado de lo que cubre: ${formatoEuros(estimado)}  ·  Factura: ${formatoEuros(total)}` + (total > 0 ? `  ·  Diferencia: ${dif > 0 ? '+' : ''}${formatoEuros(dif)}` : '');
}

/* ---- desglose del IVA por tipos (4 %, 10 %, 21 % y otro) ---- */
const redondeo2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const FILAS_DESGLOSE = [{ id: 'facD4', tipo: 4 }, { id: 'facD10', tipo: 10 }, { id: 'facD21', tipo: 21 }];

function lineasDesgloseFactura() {
  const el = (i) => document.getElementById(i);
  const lineas = [];
  FILAS_DESGLOSE.forEach((f) => {
    const base = Number(el(f.id + 'Base').value) || 0;
    if (base > 0) lineas.push({ tipo: f.tipo, base: base, cuota: el(f.id + 'Cuota').value === '' ? redondeo2(base * f.tipo / 100) : Number(el(f.id + 'Cuota').value) });
  });
  const baseOtro = Number(el('facDOtroBase').value) || 0;
  if (baseOtro > 0 && el('facDOtroTipo').value !== '') {
    const tipo = Number(el('facDOtroTipo').value);
    lineas.push({ tipo: tipo, base: baseOtro, cuota: el('facDOtroCuota').value === '' ? redondeo2(baseOtro * tipo / 100) : Number(el('facDOtroCuota').value) });
  }
  return lineas;
}

// Con el desglose activado, la base y el IVA de la factura son la SUMA de los tipos (y no se escriben a mano)
function recalcularDesgloseFactura() {
  const el = (i) => document.getElementById(i);
  FILAS_DESGLOSE.forEach((f) => {
    const cuota = el(f.id + 'Cuota');
    const base = Number(el(f.id + 'Base').value) || 0;
    if (!cuota.dataset.manual) cuota.value = base > 0 ? String(redondeo2(base * f.tipo / 100)) : '';
  });
  const cuotaOtro = el('facDOtroCuota');
  const baseOtro = Number(el('facDOtroBase').value) || 0;
  if (!cuotaOtro.dataset.manual) cuotaOtro.value = baseOtro > 0 && el('facDOtroTipo').value !== '' ? String(redondeo2(baseOtro * Number(el('facDOtroTipo').value) / 100)) : '';
  const lineas = lineasDesgloseFactura();
  const base = redondeo2(lineas.reduce((s, l) => s + l.base, 0));
  const iva = redondeo2(lineas.reduce((s, l) => s + l.cuota, 0));
  el('facBase').value = base > 0 ? String(base) : '';
  el('facIva').value = base > 0 ? String(iva) : '';
  el('facDesgloseTotal').textContent = base > 0 ? `Suma de los tipos: base ${formatoEuros(base)} + IVA ${formatoEuros(iva)} = ${formatoEuros(base + iva)}` : '';
  recalcularFactura();
}

function alternarDesgloseFactura() {
  const activo = document.getElementById('facDesglosar').checked;
  document.getElementById('facDesgloseBloque').style.display = activo ? 'block' : 'none';
  document.getElementById('facBase').readOnly = activo;
  document.getElementById('facIva').readOnly = activo;
  if (activo) recalcularDesgloseFactura();
}

function reiniciarDesgloseFactura(activar) {
  ['facD4Base', 'facD4Cuota', 'facD10Base', 'facD10Cuota', 'facD21Base', 'facD21Cuota', 'facDOtroTipo', 'facDOtroBase', 'facDOtroCuota'].forEach((i) => { const e = document.getElementById(i); e.value = ''; delete e.dataset.manual; });
  document.getElementById('facDesglosar').checked = !!activar;
  alternarDesgloseFactura();
}

function cablearDesgloseFactura() {
  document.getElementById('facDesglosar').addEventListener('change', alternarDesgloseFactura);
  ['facD4Base', 'facD10Base', 'facD21Base', 'facDOtroBase', 'facDOtroTipo'].forEach((i) => document.getElementById(i).addEventListener('input', recalcularDesgloseFactura));
  ['facD4Cuota', 'facD10Cuota', 'facD21Cuota', 'facDOtroCuota'].forEach((i) => document.getElementById(i).addEventListener('input', (e) => {
    if (e.target.value === '') delete e.target.dataset.manual; else e.target.dataset.manual = '1';   // si la escribes tú, deja de calcularse sola
    recalcularDesgloseFactura();
  }));
}

async function guardarFacturaProveedor() {
  if (guardandoFactura) return;
  const msg = document.getElementById('facMsg');
  const fallo = (texto) => { msg.textContent = texto; msg.className = 'form-msg is-error'; };
  const proveedorId = document.getElementById('facProveedor').value;
  const numFactura = document.getElementById('facNumero').value.trim();
  const fecha = document.getElementById('facFecha').value;
  const base = Number(document.getElementById('facBase').value) || 0;
  if (!proveedorId) { fallo('Elige el proveedor.'); return; }
  if (!numFactura) { fallo('Pon el número de la factura.'); return; }
  if (!fecha) { fallo('Elige la fecha de la factura.'); return; }
  const desglosar = document.getElementById('facDesglosar').checked;
  const lineasDesglose = desglosar ? lineasDesgloseFactura() : [];
  if (desglosar && !lineasDesglose.length) { fallo('Pon la base de al menos un tipo de IVA (o desmarca el desglose).'); return; }
  if (!(base > 0)) { fallo('Pon la base imponible de la factura.'); return; }

  if (estadoJustificante('fac').subiendo) { fallo('Espera a que termine de subirse la factura.'); return; }
  const pagada = document.getElementById('facPagada').checked;
  const retencion = Number(document.getElementById('facRetencion').value) || 0;
  const iva = Number(document.getElementById('facIva').value) || 0;
  if (retencion > base + iva) { fallo('La retención no puede ser mayor que el total de la factura.'); return; }
  if (pagada && !document.getElementById('facFechaPago').value) { fallo('Pon la fecha de pago (o desmarca "Ya está pagada").'); return; }

  const proveedor = proveedoresCache.find((p) => String(p.id) === proveedorId);
  const datos = {
    fecha: formatoFechaES(fecha), proveedorId, proveedorNombre: proveedor ? proveedor.nombre : '', numFactura,
    base: String(base), iva: String(iva), cubre: idsCubiertosPorLaFactura().join(','),
    categoria: document.getElementById('facCategoria').value.trim(), retencion: String(retencion),
    pagado: pagada ? 'true' : 'false', fechaPago: pagada ? formatoFechaES(document.getElementById('facFechaPago').value) : '',
    ...datosJustificante('fac'),
  };
  if (desglosar) datos.desglose = JSON.stringify(lineasDesglose);
  const huella = JSON.stringify(datos);
  if (!solicitudFactura || solicitudFactura.huella !== huella) solicitudFactura = { id: idUnico(), huella: huella };
  datos.idSolicitud = solicitudFactura.id;

  const boton = document.getElementById('btnGuardarFactura');
  guardandoFactura = true;
  boton.disabled = true;
  msg.textContent = 'Incorporando la factura…';
  msg.className = 'form-msg';
  try {
    let r = await apiGet('incorporarFactura', datos).catch((err) => ({ ok: false, error: errorDeRed(err) }));
    if (!r.ok && r.facturaRepetida) {
      if (!confirm(`${r.error}\n\n¿Incorporarla igualmente?`)) { msg.textContent = 'No se ha incorporado.'; msg.className = 'form-msg'; return; }
      r = await apiGet('incorporarFactura', { ...datos, confirmarDuplicado: '1' }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
    }
    if (!r.ok) { fallo(r.error || 'No se pudo incorporar la factura.'); return; }
    msg.textContent = r.cubiertos
      ? `Factura incorporada. Cubre ${r.cubiertos} gasto${r.cubiertos === 1 ? '' : 's'} estimado${r.cubiertos === 1 ? '' : 's'} (${formatoEuros(r.estimado)}); la factura es de ${formatoEuros(r.total)} (${r.diferencia > 0 ? '+' : ''}${formatoEuros(r.diferencia)}).`
      : 'Factura incorporada como gasto.';
    msg.className = 'form-msg is-ok';
    setTimeout(() => cambiarTab(facturaDestino), 1500);
  } finally {
    guardandoFactura = false;
    boton.disabled = false;
  }
}

async function descargarLibroGastos() {
  const ini = document.getElementById('gastosFechaIni').value;
  const fin = document.getElementById('gastosFechaFin').value;
  if (!ini || !fin) { alert('Elige las dos fechas primero.'); return; }
  const r = await apiGet('libroGastosPdf', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok) { alert('Error: ' + (r.error || 'inténtalo de nuevo')); return; }
  await descargarPDF(r.base64, r.nombre);
}

function cablearCompras() {
  cablearPanelYGestor();
  cablearDesgloseFactura();
  cablearCuadrar();
  document.getElementById('btnNuevoProveedor').addEventListener('click', () => abrirFormularioProveedor(null));
  document.getElementById('btnGuardarProveedor').addEventListener('click', guardarProveedor);
  document.getElementById('btnGuardarGasto').addEventListener('click', guardarGasto);
  document.getElementById('btnEliminarGasto').addEventListener('click', eliminarGasto);
  document.getElementById('gastoFormBase').addEventListener('input', recalcularTotalGasto);
  document.getElementById('gastoFormIva').addEventListener('input', recalcularTotalGasto);
  document.getElementById('gastoFormRetencion').addEventListener('input', recalcularTotalGasto);
  document.getElementById('gastoFormPagado').addEventListener('change', alternarFechaPagoGasto);
  iniciarJustificante('gastoForm', contextoJustificanteGasto);
  document.getElementById('btnBuscarGastos').addEventListener('click', buscarGastos);
  document.getElementById('gastosSoloPendientes').addEventListener('change', pintarGastos);
  document.getElementById('btnGastosEsteMes').addEventListener('click', () => {
    const hoy = new Date();
    document.getElementById('gastosFechaIni').valueAsDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('gastosFechaFin').valueAsDate = hoy;
    buscarGastos();
  });
  document.getElementById('btnDescargarLibroGastos').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', descargarLibroGastos));
  document.getElementById('btnIncorporarFactura').addEventListener('click', () => { facturaPreseleccion = null; cambiarTab('gasto-factura'); });
  document.getElementById('facProveedor').addEventListener('change', () => cargarEstimadosDeProveedor(null));
  document.getElementById('facBase').addEventListener('input', recalcularFactura);
  document.getElementById('facIva').addEventListener('input', recalcularFactura);
  document.getElementById('facRetencion').addEventListener('input', recalcularFactura);
  document.getElementById('facPagada').addEventListener('change', alternarFechaPagoFactura);
  iniciarJustificante('fac', contextoJustificanteFactura);
  document.getElementById('btnGuardarFactura').addEventListener('click', guardarFacturaProveedor);
}

/* ============ CERRAR AÑO (ARCHIVAR) ============ */
async function cerrarAnio() {
  const msg = document.getElementById('cerrarAnioMsg');
  const anio = document.getElementById('anioCerrar').value.trim();
  if (!anio) { msg.textContent = 'Escribe un año.'; msg.className = 'form-msg is-error'; return; }

  const anioActual = new Date().getFullYear();
  if (Number(anio) >= anioActual) {
    msg.textContent = 'Solo se pueden archivar años ya terminados, no el actual ni futuros.';
    msg.className = 'form-msg is-error';
    return;
  }

  if (!confirm(`¿Archivar todo el año ${anio}? Se moverá a pestañas propias del Sheet (no se borra nada). Puede tardar unos segundos.`)) return;

  msg.textContent = 'Archivando… puede tardar un poco, no cierres esta pantalla.';
  msg.className = 'form-msg';

  let r = await apiGet('cerrarAnio', { anio }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok && r.requiereConfirmacion && r.pendientes) {
    // quedan cosas sin resolver de ese año: al archivarlo dejan de verse en el Panel y en Facturas de la semana
    const p = r.pendientes;
    const linea = (x, singular, plural) => (x.n ? `\n· ${x.n} ${x.n === 1 ? singular : plural} (${formatoEuros(x.total)})` : '');
    const detalle = linea(p.facturasSinCobrar, 'factura sin cobrar', 'facturas sin cobrar') + linea(p.albaranesSinCobrar, 'albarán sin cobrar', 'albaranes sin cobrar') +
      linea(p.gastosSinPagar, 'factura de proveedor sin pagar', 'facturas de proveedor sin pagar') + linea(p.estimadosSinFactura, 'gasto estimado sin factura', 'gastos estimados sin factura');
    const aviso = (p.estimadosSinFactura.n ? 'Los gastos estimados sin factura dejarán de verse en Facturas de la semana: apunta antes sus facturas. ' : '') + 'Lo que falte por cobrar o pagar seguirá apareciendo en el Panel como "de años anteriores".';
    if (!confirm(`Del año ${anio} todavía queda sin resolver:${detalle}\n\n${aviso} ¿Archivar igualmente?`)) {
      msg.textContent = `No se ha archivado nada. Cobra, paga o apunta primero lo que queda de ${anio}.`;
      msg.className = 'form-msg';
      return;
    }
    msg.textContent = 'Archivando… puede tardar un poco, no cierres esta pantalla.';
    r = await apiGet('cerrarAnio', { anio, confirmarPendientes: 'true' }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  }
  if (r.ok) {
    msg.textContent = `Listo — pedidos: ${r.pedidosArchivados}, facturas: ${r.facturasArchivadas}, gastos: ${r.gastosArchivados} movidos al archivo de ${r.anio}.`;
    msg.className = 'form-msg is-ok';
  } else {
    msg.textContent = 'Error: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

function cablearCerrarAnio() {
  document.getElementById('btnCerrarAnio').addEventListener('click', (e) => conEstadoCarga(e.target, 'Archivando…', cerrarAnio));
}


/* ============ BALANCE: VENTAS vs COSTE DE FÁBRICA ============ */
async function buscarBalance() {
  const ini = document.getElementById('balFechaIni').value;
  const fin = document.getElementById('balFechaFin').value;
  const resumen = document.getElementById('balResumen');
  const lista = document.getElementById('balLista');
  if (!ini || !fin) { resumen.innerHTML = '<div class="empty-state">Elige las dos fechas.</div>'; lista.innerHTML = ''; return; }

  resumen.innerHTML = '<div class="empty-state">Calculando…</div>';
  lista.innerHTML = '';
  const r = await apiGet('balance', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok) { resumen.innerHTML = `<div class="empty-state">No se pudo calcular: ${escapeHtml(r.error || '')}</div>`; return; }
  const d = r.data;

  const pct = d.margenPct !== null ? ` (${(d.margenPct * 100).toFixed(1)}%)` : '';
  resumen.innerHTML = `
    <div class="card">
      <div class="card__top"><div class="card__name">Margen bruto</div><div class="card__total">${formatoEuros(d.margenBruto)}${pct}</div></div>
      <div class="card__products">Ventas ${formatoEuros(d.ventasTotal)} · Coste de fábrica ${formatoEuros(d.costeTotal)} · ${d.pedidos} pedidos</div>
      ${d.ventasSinCoste > 0 ? `<div class="card__meta" style="color:var(--warn-red); margin-top:6px;">Hay ${formatoEuros(d.ventasSinCoste)} de ventas de productos sin coste puesto: no entran en el margen. Ponles el coste en Productos.</div>` : ''}
      <div class="card__meta" style="margin-top:6px;">Gastos registrados en Compras (referencia): ${formatoEuros(d.gastosBase)}</div>
      ${d.gastosEstimadosBase > 0 ? `<div class="card__meta">Gastos estimados de pedidos a proveedores, pendientes de factura: ${formatoEuros(d.gastosEstimadosBase)}</div>` : ''}
    </div>`;

  lista.innerHTML = d.productos.length ? d.productos.map((p) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(p.nombre)}</div>
          <div class="card__meta">${p.unidades} cajas · Ventas ${formatoEuros(p.ventas)}${p.tieneCoste ? ' · Coste ' + formatoEuros(p.coste) : ' · sin coste'}</div>
        </div>
        <div class="card__total">${p.tieneCoste ? formatoEuros(p.margen) : '—'}</div>
      </div>
    </div>`).join('') : '<div class="empty-state">Sin pedidos en ese periodo.</div>';
  document.getElementById('balNota').textContent =
    'Si las facturas de la fábrica también las registras como gastos en Compras, no las restes otra vez: ya cuentan en el coste.';
}

async function descargarBalance() {
  const ini = document.getElementById('balFechaIni').value;
  const fin = document.getElementById('balFechaFin').value;
  if (!ini || !fin) { alert('Elige las dos fechas primero.'); return; }
  const r = await apiGet('balancePdf', { fechaIni: formatoFechaES(ini), fechaFin: formatoFechaES(fin) }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (!r.ok) { alert('Error: ' + (r.error || 'inténtalo de nuevo')); return; }
  await descargarPDF(r.base64, r.nombre);
}

function cablearBalance() {
  document.getElementById('btnBuscarBalance').addEventListener('click', buscarBalance);
  document.getElementById('btnBalanceEsteMes').addEventListener('click', () => {
    const hoy = new Date();
    document.getElementById('balFechaIni').valueAsDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('balFechaFin').valueAsDate = hoy;
    buscarBalance();
  });
  document.getElementById('btnDescargarBalance').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', descargarBalance));
}


/* ============ COPIAS DE SEGURIDAD (en Empresa) ============ */
async function cargarEstadoCopias() {
  const cont = document.getElementById('estadoCopias');
  const r = await apiGet('estadoCopias').catch(() => ({ ok: false }));
  if (!r.ok) { cont.textContent = 'No se pudo comprobar el estado de las copias.'; return; }
  const d = r.data;
  const auto = d.programada === true ? 'Copia automática: <strong>activada</strong>'
    : d.programada === false ? '<strong style="color:var(--warn-red)">La copia automática NO está activada</strong> (ejecuta configurarMantenimiento en Apps Script)'
    : 'Copia automática: no se pudo comprobar';
  cont.innerHTML = `${auto}<br>Última copia: ${d.ultima ? escapeHtml(d.ultima) : 'todavía ninguna'} · Guardadas: ${d.total} (se conservan las últimas ${d.conservar})`;
}

async function hacerCopiaAhora() {
  const msg = document.getElementById('copiaMsg');
  msg.textContent = 'Haciendo la copia… puede tardar unos segundos.';
  msg.className = 'form-msg';
  const r = await apiGet('copiaSeguridad').catch((err) => ({ ok: false, error: errorDeRed(err) }));
  if (r.ok) {
    msg.textContent = `Copia guardada en tu Drive, carpeta "${r.carpeta}".`;
    msg.className = 'form-msg is-ok';
    cargarEstadoCopias();
  } else {
    msg.textContent = 'No se pudo hacer la copia: ' + (r.error || 'inténtalo de nuevo');
    msg.className = 'form-msg is-error';
  }
}

function cablearCopias() {
  document.getElementById('btnCopiaAhora').addEventListener('click', (e) => conEstadoCarga(e.target, 'Copiando…', hacerCopiaAhora));
}
