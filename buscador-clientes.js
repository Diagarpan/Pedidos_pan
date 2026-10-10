/* Buscador de clientes con sugerencias mientras escribes.
 *
 * Convierte un <select> de clientes en una caja de texto con coincidencias
 * en vivo (sin tildes ni mayúsculas, y con varias palabras en cualquier
 * orden: "garcia pepe" encuentra "Pepe García"). El <select> original se
 * queda oculto y sigue siendo quien guarda el valor, así que el resto de la
 * app lo lee igual que siempre (select.value, evento "change", etc.).
 *
 * Si otro código cambia el select (le pone opciones nuevas o select.value = ''),
 * la caja de texto se actualiza sola.
 */
(function () {
  const MAX_SUGERENCIAS = 40;
  const descripcionValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function activar(select) {
    if (!select || select.dataset.buscadorActivo) return;
    select.dataset.buscadorActivo = '1';

    const envoltorio = document.createElement('div');
    envoltorio.className = 'buscador-cliente';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input buscador-cliente__input';
    input.placeholder = select.dataset.placeholder || 'Escribe para buscar un cliente…';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Buscar cliente');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');

    const botonLimpiar = document.createElement('button');
    botonLimpiar.type = 'button';
    botonLimpiar.className = 'buscador-cliente__limpiar';
    botonLimpiar.setAttribute('aria-label', 'Quitar cliente');
    botonLimpiar.textContent = '×';
    botonLimpiar.hidden = true;

    const lista = document.createElement('div');
    lista.className = 'buscador-cliente__lista';
    lista.setAttribute('role', 'listbox');
    lista.hidden = true;

    select.parentNode.insertBefore(envoltorio, select);
    envoltorio.appendChild(input);
    envoltorio.appendChild(botonLimpiar);
    envoltorio.appendChild(lista);
    select.style.display = 'none';

    // Al pulsar la etiqueta "Cliente" que apuntaba al select, se enfoca la caja
    if (select.id) {
      document.querySelectorAll('label[for="' + select.id + '"]').forEach((et) => {
        et.addEventListener('click', () => input.focus());
      });
    }

    let escribiendo = false;
    let indiceActivo = -1;
    let opcionesVisibles = [];

    function valorSelect() { return descripcionValue.get.call(select); }
    function ponerValorSelect(v) { descripcionValue.set.call(select, v); }

    // Refleja en la caja de texto lo que haya elegido el select
    function sincronizar() {
      const v = valorSelect();
      const opcion = v ? select.options[select.selectedIndex] : null;
      if (opcion) {
        input.value = opcion.textContent;
      } else if (!escribiendo) {
        input.value = '';
      }
      botonLimpiar.hidden = !input.value;
    }

    // Si el código de la app hace select.value = '...' , la caja se pone al día
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() { return valorSelect(); },
      set(v) { ponerValorSelect(v); escribiendo = false; sincronizar(); },
    });
    new MutationObserver(sincronizar).observe(select, { childList: true });

    function cerrar() {
      lista.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      indiceActivo = -1;
    }

    function pintarActivo() {
      Array.from(lista.children).forEach((el, i) => el.classList.toggle('is-activo', i === indiceActivo));
      const activo = lista.children[indiceActivo];
      if (activo && activo.scrollIntoView) activo.scrollIntoView({ block: 'nearest' });
    }

    function mostrarSugerencias() {
      const palabras = normalizar(input.value).split(/\s+/).filter(Boolean);
      const todas = Array.from(select.options).filter((o) => o.value);
      let coincidencias = palabras.length
        ? todas.filter((o) => { const n = normalizar(o.textContent + ' ' + (o.dataset.buscar || '')); return palabras.every((p) => n.includes(p)); })
        : todas;

      // Primero los que EMPIEZAN por lo escrito, luego el resto
      if (palabras.length) {
        const q = normalizar(input.value);
        coincidencias = coincidencias.slice().sort((a, b) => {
          const sa = normalizar(a.textContent).startsWith(q) ? 0 : 1;
          const sb = normalizar(b.textContent).startsWith(q) ? 0 : 1;
          return sa - sb;
        });
      }

      opcionesVisibles = coincidencias.slice(0, MAX_SUGERENCIAS);
      lista.innerHTML = '';
      if (!coincidencias.length) {
        const vacio = document.createElement('div');
        vacio.className = 'buscador-cliente__vacio';
        vacio.textContent = 'Ningún cliente coincide';
        lista.appendChild(vacio);
      } else {
        opcionesVisibles.forEach((o) => {
          const fila = document.createElement('div');
          fila.className = 'buscador-cliente__opcion';
          fila.setAttribute('role', 'option');
          fila.textContent = o.textContent;
          // pointerdown (y no click) para que funcione antes de que la caja pierda el foco
          fila.addEventListener('pointerdown', (ev) => { ev.preventDefault(); elegir(o); });
          lista.appendChild(fila);
        });
        if (coincidencias.length > MAX_SUGERENCIAS) {
          const mas = document.createElement('div');
          mas.className = 'buscador-cliente__vacio';
          mas.textContent = 'Hay más: sigue escribiendo para afinar';
          lista.appendChild(mas);
        }
      }
      indiceActivo = -1;
      lista.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function elegir(opcion) {
      ponerValorSelect(opcion.value);
      escribiendo = false;
      sincronizar();
      cerrar();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function quitarSeleccion() {
      const habiaValor = !!valorSelect();
      ponerValorSelect('');
      if (habiaValor) select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    input.addEventListener('focus', () => { input.select(); mostrarSugerencias(); });
    input.addEventListener('input', () => {
      escribiendo = true;
      // Si se vuelve a escribir, ya no vale el cliente elegido antes
      if (valorSelect()) quitarSeleccion();
      botonLimpiar.hidden = !input.value;
      mostrarSugerencias();
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (lista.hidden) mostrarSugerencias();
        indiceActivo = Math.min(indiceActivo + 1, opcionesVisibles.length - 1);
        pintarActivo();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        indiceActivo = Math.max(indiceActivo - 1, 0);
        pintarActivo();
      } else if (ev.key === 'Enter') {
        if (!lista.hidden && opcionesVisibles.length) {
          ev.preventDefault();
          // Enter elige el resaltado, o el primero si solo queda uno
          const o = indiceActivo >= 0 ? opcionesVisibles[indiceActivo] : (opcionesVisibles.length === 1 ? opcionesVisibles[0] : null);
          if (o) elegir(o);
        }
      } else if (ev.key === 'Escape') {
        cerrar();
      }
    });
    botonLimpiar.addEventListener('click', () => {
      escribiendo = false;
      quitarSeleccion();
      input.value = '';
      botonLimpiar.hidden = true;
      input.focus();
    });
    document.addEventListener('pointerdown', (ev) => {
      if (!envoltorio.contains(ev.target)) {
        cerrar();
        // Si dejó texto a medias sin elegir a nadie, se vacía para no engañar
        if (!valorSelect() && input.value) { escribiendo = false; input.value = ''; botonLimpiar.hidden = true; }
      }
    });

    sincronizar();
  }

  window.BuscadorClientes = { activar, normalizar };
})();
