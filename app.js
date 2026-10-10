/* ============ CONFIG (se guarda en el propio móvil, no en el código) ============ */
let WEB_APP_URL = localStorage.getItem('webAppUrl') || '';
let API_KEY = localStorage.getItem('apiKey') || '';
let ROL = localStorage.getItem('rol') || 'admin'; // 'admin' | 'repartidor'
let RUTA = localStorage.getItem('ruta') || '';

let productosCache = [];
let clientesCache = [];
let itemsNuevo = []; // { tipo:'catalogo'|'libre', productoId?, nombre, precio, iva (fracción), cantidad, uid }
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
const ACCIONES_LARGAS = new Set(['resumenPeriodo', 'modelo347', 'estadisticas', 'balance', 'cerrarAnio', 'copiaSeguridad']);
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
const PANTALLAS_DE_FORMULARIO = ['nuevo', 'pedido-editar', 'factura-editar', 'gasto-nuevo', 'proveedor-form', 'cerrar-anio'];

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

async function cargarPedidoProveedores() {
  const cont = document.getElementById('listaPedidoProveedores');
  const iso = document.getElementById('ppFecha').value;
  const botonTodos = document.getElementById('btnPedidoProveedoresTodos');
  document.getElementById('ppMsg').textContent = '';
  if (!iso) { cont.innerHTML = '<div class="empty-state">Elige un día.</div>'; return; }
  cont.innerHTML = '<div class="empty-state">Cargando…</div>';
  botonTodos.disabled = true;

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
      <div class="card__actions"><button class="chip-btn" data-pp-pdf="${escapeHtml(String(p.idProveedor))}">PDF para ${escapeHtml(p.nombre)}</button></div>
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
  cont.querySelectorAll('[data-pp-pdf]').forEach((b) => b.addEventListener('click', () => descargarPedidoProveedor(b.dataset.ppPdf, b)));
  cont.querySelectorAll('[data-pp-productos]').forEach((b) => b.addEventListener('click', () => cambiarTab('productos')));
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

  await cargarProductosCache();
  rellenarSelectProductos('editarPedido');

  const r = await apiGet('itemsPedido', { idPedido: idPedidoEnEdicion }).catch((err) => ({ ok: false, error: String(err) }));
  if (!r.ok || !r.data) { cont.innerHTML = `<div class="empty-state">No se pudo cargar: ${escapeHtml((r && r.error) || 'pedido no encontrado')}</div>`; return; }

  document.getElementById('editarPedidoCliente').textContent =
    `${r.data.documento === 'Albarán' ? 'Albarán' : 'Pedido'} #${idPedidoEnEdicion} · ${r.data.cliente}`;
  const selFecha = document.getElementById('epFechaEntrega');
  selFecha.value = 'mantener';
  selFecha.options[0].textContent = `Mantener la fecha actual (${r.data.fechaEntrega})`;
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
  document.getElementById('gastoFormFecha').valueAsDate = new Date();
  document.getElementById('gastoFormConcepto').value = '';
  document.getElementById('gastoFormCategoria').value = '';
  document.getElementById('gastoFormBase').value = '';
  document.getElementById('gastoFormIva').value = '';
  document.getElementById('gastoFormTotal').textContent = '0,00 €';
  document.getElementById('btnEliminarGasto').style.display = 'none';
  document.getElementById('gastoFormMsg').textContent = '';
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
  document.getElementById('gastoFormConcepto').value = g.concepto || '';
  document.getElementById('gastoFormCategoria').value = g.categoria || '';
  document.getElementById('gastoFormBase').value = g.base;
  document.getElementById('gastoFormIva').value = g.iva;
  recalcularTotalGasto();
  document.getElementById('btnEliminarGasto').style.display = 'block';
  document.getElementById('gastoFormMsg').textContent = '';
}

function recalcularTotalGasto() {
  const base = Number(document.getElementById('gastoFormBase').value) || 0;
  const iva = Number(document.getElementById('gastoFormIva').value) || 0;
  document.getElementById('gastoFormTotal').textContent = formatoEuros(base + iva);
}

async function guardarGasto() {
  const msg = document.getElementById('gastoFormMsg');
  const id = document.getElementById('gastoFormId').value;
  const fecha = document.getElementById('gastoFormFecha').value;
  if (!fecha) { msg.textContent = 'Elige una fecha.'; msg.className = 'form-msg is-error'; return; }

  const proveedorId = document.getElementById('gastoFormProveedor').value;
  const proveedorNombre = proveedorId ? proveedoresCache.find((p) => String(p.id) === proveedorId)?.nombre || '' : '';

  const datos = {
    fecha: formatoFechaES(fecha),
    proveedorId,
    proveedorNombre,
    concepto: document.getElementById('gastoFormConcepto').value.trim(),
    categoria: document.getElementById('gastoFormCategoria').value.trim(),
    base: document.getElementById('gastoFormBase').value || 0,
    iva: document.getElementById('gastoFormIva').value || 0,
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

  if (!r.data.gastos.length) {
    cont.innerHTML = '<div class="empty-state">Sin gastos en ese periodo.</div>';
    document.getElementById('gastosTotal').textContent = '';
    return;
  }

  cont.innerHTML = r.data.gastos.map((g) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__name">${escapeHtml(g.concepto || 'Gasto')}</div>
          <div class="card__meta">${escapeHtml(g.fecha)}${g.proveedor ? ' · ' + escapeHtml(g.proveedor) : ''}${g.categoria ? ' · ' + escapeHtml(g.categoria) : ''}</div>
        </div>
        <div class="card__total">${formatoEuros(g.total)}</div>
      </div>
      <div class="card__actions">
        <button class="chip-btn" data-editar-gasto="${g.id}">Editar</button>
      </div>
    </div>
  `).join('');
  document.getElementById('gastosTotal').textContent = `Base: ${formatoEuros(r.data.totalBase)}  ·  IVA: ${formatoEuros(r.data.totalIva)}  ·  Total: ${formatoEuros(r.data.totalGeneral)}`;

  cont.querySelectorAll('[data-editar-gasto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = r.data.gastos.find((x) => String(x.id) === btn.dataset.editarGasto);
      if (g) abrirGastoParaEditar(g);
    });
  });
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
  document.getElementById('btnNuevoProveedor').addEventListener('click', () => abrirFormularioProveedor(null));
  document.getElementById('btnGuardarProveedor').addEventListener('click', guardarProveedor);
  document.getElementById('btnGuardarGasto').addEventListener('click', guardarGasto);
  document.getElementById('btnEliminarGasto').addEventListener('click', eliminarGasto);
  document.getElementById('gastoFormBase').addEventListener('input', recalcularTotalGasto);
  document.getElementById('gastoFormIva').addEventListener('input', recalcularTotalGasto);
  document.getElementById('btnBuscarGastos').addEventListener('click', buscarGastos);
  document.getElementById('btnGastosEsteMes').addEventListener('click', () => {
    const hoy = new Date();
    document.getElementById('gastosFechaIni').valueAsDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('gastosFechaFin').valueAsDate = hoy;
    buscarGastos();
  });
  document.getElementById('btnDescargarLibroGastos').addEventListener('click', (e) => conEstadoCarga(e.target, 'Generando…', descargarLibroGastos));
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

  const r = await apiGet('cerrarAnio', { anio }).catch((err) => ({ ok: false, error: errorDeRed(err) }));
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
