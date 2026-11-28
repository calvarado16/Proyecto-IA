
/* ============================================================
   SEÑALIVE - INTERFAZ PROFESIONAL DEL TRADUCTOR
   26 letras ASL + 10 palabras

   Archivo: frontend/js/interfaz-traductor.js

   Este archivo NO modifica:
   - El modelo TensorFlow.js
   - La cámara
   - El reconocimiento de letras
   - El reconocimiento de palabras
   - Las letras dinámicas J y Z
   ============================================================ */

(() => {
  "use strict";

  // ============================================================
  // 1. ELEMENTOS PRINCIPALES
  // ============================================================

  const $ = id => document.getElementById(id);

  const panel = $("t");
  const salida = $("out");

  const tarjeta = salida?.closest(
    ".card.full-span"
  );

  if (!panel || !salida || !tarjeta) {
    console.error(
      "[SeñaLive UI] No se encontró el panel del traductor."
    );
    return;
  }

  // Evitar cargar la interfaz dos veces
  if ($("sl-transcriptor")) {
    return;
  }

  // ============================================================
  // 2. ESTILOS VISUALES
  // ============================================================

  const estilos = document.createElement("style");

  estilos.id = "sl-estilos-profesionales";

  estilos.textContent = `

    /* ========================================
       PANEL PRINCIPAL DE TRADUCCIÓN
    ======================================== */

    #t #sl-transcriptor {
      padding: 24px;
      overflow: hidden;
    }

    #t .sl-cabecera {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }

    #t .sl-kicker {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent, #35d5a5);
    }

    #t .sl-titulo {
      margin: 0;
      font-size: 22px;
      font-weight: 750;
      color: var(--ink, #ffffff);
    }

    #t .sl-subtitulo {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--mute, #9bb9ad);
      line-height: 1.5;
    }

    #t .sl-en-vivo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 13px;
      border: 1px solid var(--line, #30443b);
      border-radius: 99px;
      background: var(--bg, #0c1511);
      color: var(--mute, #a8bcb4);
      font-size: 12px;
      white-space: nowrap;
    }

    #t .sl-punto {
      width: 8px;
      height: 8px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--accent, #35d5a5);
      box-shadow: 0 0 0 4px
        rgba(53, 213, 165, 0.12);
    }

    /* ========================================
       ÁREA DEL TEXTO TRADUCIDO
    ======================================== */

    #t .sl-papel {
      position: relative;
      padding: 22px;
      min-height: 132px;
      background: var(--bg, #0c1511);
      border: 1px solid var(--line, #30443b);
      border-radius: 14px;
    }

    #t .sl-papel #out {
      min-height: 64px;
      font-family: inherit;
      font-size: clamp(22px, 2.4vw, 32px);
      font-weight: 500;
      letter-spacing: 0.01em;
      line-height: 1.5;
      color: var(--ink, #ffffff);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    #t .sl-papel #out .cur {
      margin-left: 2px;
      vertical-align: -0.1em;
    }

    #t .sl-papel #out.sl-sin-texto .cur {
      visibility: hidden;
    }

    #t .sl-vacio {
      position: absolute;
      top: 26px;
      left: 22px;
      right: 22px;
      font-size: 15px;
      line-height: 1.5;
      color: var(--mute, #9bb9ad);
      pointer-events: none;
    }

    #t .sl-vacio[hidden] {
      display: none !important;
    }

    #t .sl-papel-pie {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    #t .sl-contador,
    #t .sl-nota-papel {
      font-size: 12px;
      color: var(--mute, #9bb9ad);
    }

    /* ========================================
       SEPARADOR
    ======================================== */

    #t .sl-divisor {
      height: 1px;
      margin: 22px 0 18px;
      background: var(--line, #30443b);
    }

    /* ========================================
       BOTONES DEL TRADUCTOR
    ======================================== */

    #t .sl-acciones {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    #t .sl-accion {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      min-height: 44px;
      padding: 11px 16px;

      border: 1px solid var(--line, #30443b);
      border-radius: 10px;

      background: var(--bg, #0c1511);
      color: var(--ink, #ffffff);

      font-family: inherit;
      font-size: 13px;
      font-weight: 600;

      white-space: nowrap;
      cursor: pointer;

      transition:
        background 0.15s,
        border-color 0.15s,
        transform 0.15s;
    }

    #t .sl-accion:hover {
      border-color: var(--accent, #35d5a5);
      transform: translateY(-1px);
    }

    #t .sl-accion:active {
      transform: translateY(0);
    }

    #t .sl-accion:focus-visible {
      outline: 2px solid var(--accent, #35d5a5);
      outline-offset: 3px;
    }

    #t .sl-accion svg {
      width: 17px;
      height: 17px;

      flex-shrink: 0;

      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Botón principal */

    #t .sl-accion.principal {
      background: var(--accent, #35d5a5);
      border-color: var(--accent, #35d5a5);
      color: #06241b;
      font-weight: 750;
    }

    #t .sl-accion.principal:hover {
      filter: brightness(1.07);
    }

    /* Botón limpiar */

    #t .sl-accion.peligro {
      color: var(--bad, #f17979);
    }

    /* ========================================
       MENSAJES DE OPERACIÓN
    ======================================== */

    #t .sl-aviso {
      min-height: 20px;
      margin: 14px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--mute, #9bb9ad);
    }

    #t .sl-aviso.exito {
      color: var(--accent, #35d5a5);
    }

    #t .sl-aviso.error {
      color: var(--bad, #f17979);
    }

    /* ========================================
       PANEL DE RECONOCIMIENTO
    ======================================== */

    #t .side .card {
      min-width: 0;
    }

    #t .sl-prediccion-titulo {
      text-align: center;
      margin-bottom: 14px;
    }

    #t #prediction {
      font-size: clamp(36px, 5vw, 70px);
      line-height: 1.15;
      min-height: 72px;
      overflow-wrap: anywhere;
      letter-spacing: -0.025em;
    }

    #t #modelStatus {
      color: var(--accent, #35d5a5);
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      line-height: 1.5;
      margin-top: 14px;
    }

    #t #estadoPalabrasAutomaticas {
      color: var(--mute, #a8bcb4) !important;
      font-size: 12px !important;
      text-align: center;
      line-height: 1.5;
      margin-top: 9px !important;
    }

    #t .ring {
      width: 67px;
      height: 67px;
      opacity: 0.9;
    }

    /* ========================================
       ETIQUETA SUPERIOR
    ======================================== */

    main header .pill {
      border-color: rgba(53, 213, 165, 0.3);
      color: var(--accent, #35d5a5);
      font-size: 12px;
      letter-spacing: 0.02em;
    }

    /* ========================================
       ESTADO LATERAL
    ======================================== */

    nav .stat {
      line-height: 1.6;
    }

    nav .stat #tensorflowStatus {
      display: block;
      font-size: 12px;
      color: var(--mute, #a8bcb4);
      line-height: 1.5;
      margin-top: 6px;
    }

    /* ========================================
       HISTORIAL
    ======================================== */

    #h .sl-hist-title {
      margin: 0 0 6px;
      font-size: 20px;
      color: var(--ink, #ffffff);
    }

    #h .sl-hist-desc {
      margin: 0 0 18px;
      font-size: 13px;
      color: var(--mute, #9bb9ad);
    }

    #h .sl-hist-lista {
      display: grid;
      gap: 11px;
    }

    #h .sl-hist-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 15px;

      padding: 15px;
      border: 1px solid var(--line, #30443b);
      border-radius: 10px;
      background: var(--bg, #0c1511);
    }

    #h .sl-hist-cuerpo {
      flex: 1;
      min-width: 0;
    }

    #h .sl-hist-texto {
      margin: 0 0 5px;
      font-size: 15px;
      color: var(--ink, #ffffff);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    #h .sl-hist-fecha {
      font-size: 12px;
      color: var(--mute, #9bb9ad);
    }

    #h .sl-hist-eliminar {
      padding: 8px 12px;
      background: transparent;
      color: var(--bad, #f17979);
      border: 1px solid var(--line, #30443b);
      border-radius: 8px;
      cursor: pointer;
    }

    #h .sl-hist-vacio {
      padding: 24px;
      text-align: center;
      font-size: 14px;
      color: var(--mute, #9bb9ad);
      border: 1px dashed var(--line, #30443b);
      border-radius: 10px;
    }

    /* ========================================
       DISEÑO RESPONSIVE
    ======================================== */

    @media (max-width: 640px) {

      #t #sl-transcriptor {
        padding: 17px;
      }

      #t .sl-papel {
        padding: 17px;
      }

      #t .sl-vacio {
        top: 21px;
        left: 17px;
        right: 17px;
      }

      #t .sl-acciones {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

      #t .sl-accion {
        width: 100%;
        padding: 10px;
        min-width: 0;
      }

      #t .sl-accion.principal {
        grid-column: span 2;
      }

      #t #sl-voz,
      #t #sl-copiar {
        grid-column: span 2;
      }
    }

    @media (prefers-reduced-motion: reduce) {

      #t .sl-accion {
        transition: none;
      }
    }

  `;

  document.head.appendChild(estilos);

  // ============================================================
  // 3. AGREGAR TÍTULO AL PANEL DE PREDICCIÓN
  // ============================================================

  const prediccion = $("prediction");

  const panelPrediccion =
    prediccion?.closest(".card");

  if (
    panelPrediccion &&
    !panelPrediccion.querySelector(
      ".sl-prediccion-titulo"
    )
  ) {
    const titulo = document.createElement("p");

    titulo.className =
      "sl-kicker sl-prediccion-titulo";

    titulo.textContent =
      "SEÑA DETECTADA";

    panelPrediccion.insertBefore(
      titulo,
      prediccion
    );
  }

  // ============================================================
  // 4. PREPARAR EL TEXTO DEL TRADUCTOR
  // ============================================================

  // Conservar el mismo elemento #out que utilizan
  // los demás archivos JavaScript de SeñaLive.

  const textoInicial =
    salida.textContent || "";

  let contenedor = salida.querySelector(
    "[data-senalive-palabras]"
  );

  if (!contenedor) {
    contenedor = document.createElement("span");
  }

  contenedor.dataset.senalivePalabras = "1";
  contenedor.textContent = textoInicial.trim();

  const cursor =
    salida.querySelector(".cur") ||
    document.createElement("span");

  cursor.classList.add("cur");

  cursor.setAttribute(
    "aria-hidden",
    "true"
  );

  salida.replaceChildren(
    contenedor,
    cursor
  );

  // ============================================================
  // 5. ICONOS
  // ============================================================

  const iconos = {

    espacio:
      '<path d="M4 8v9h16V8"/>',

    borrar:
      '<path d="M10 6h11v12H10L3 12l7-6Z"/>' +
      '<path d="m13 10 5 5m0-5-5 5"/>',

    limpiar:
      '<path d="M4 7h16M10 7V4h4v3m4 0-1 14H7L6 7"/>' +
      '<path d="M10 11v6m4-6v6"/>',

    copiar:
      '<rect x="8" y="8" width="12" height="12" rx="2"/>' +
      '<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',

    voz:
      '<path d="M11 5 6 9H3v6h3l5 4V5Z"/>' +
      '<path d="M15 9a5 5 0 0 1 0 6"/>' +
      '<path d="M18 6a9 9 0 0 1 0 12"/>',

    guardar:
      '<path d="M5 3h12l4 4v14H3V3h2Z"/>' +
      '<path d="M7 3v6h10V3"/>' +
      '<path d="M7 21v-8h10v8"/>'

  };

  function svg(tipo) {
    return (
      '<svg aria-hidden="true" viewBox="0 0 24 24">' +
      iconos[tipo] +
      "</svg>"
    );
  }

  // ============================================================
  // 6. CREAR PANEL PROFESIONAL
  // ============================================================

  tarjeta.id = "sl-transcriptor";

  tarjeta.innerHTML = `

    <div class="sl-cabecera">

      <div>

        <p class="sl-kicker">
          SEÑALIVE / TRADUCTOR
        </p>

        <h2 class="sl-titulo">
          Tu traducción
        </h2>

        <p class="sl-subtitulo">
          Las señas reconocidas aparecerán aquí
          automáticamente.
        </p>

      </div>

      <div class="sl-en-vivo">
        <span class="sl-punto"></span>
        Traducción en tiempo real
      </div>

    </div>

    <div class="sl-papel">

      <div id="sl-salida-contenedor"></div>

      <span
        class="sl-vacio"
        id="sl-vacio">
        Realiza una seña frente a la cámara
        para comenzar...
      </span>

      <div class="sl-papel-pie">

        <span
          class="sl-contador"
          id="sl-contador">
          0 caracteres · 0 palabras
        </span>

        <span class="sl-nota-papel">
          Lengua de Señas Americana (ASL)
        </span>

      </div>

    </div>

    <div class="sl-divisor"></div>

    <div
      class="sl-acciones"
      role="group"
      aria-label="Acciones del traductor">

      <button
        type="button"
        class="sl-accion"
        id="sl-espacio">
        ${svg("espacio")}
        Espacio
      </button>

      <button
        type="button"
        class="sl-accion"
        id="sl-borrar">
        ${svg("borrar")}
        Borrar
      </button>

      <button
        type="button"
        class="sl-accion peligro"
        id="sl-limpiar">
        ${svg("limpiar")}
        Limpiar
      </button>

      <button
        type="button"
        class="sl-accion"
        id="sl-copiar">
        ${svg("copiar")}
        Copiar
      </button>

      <button
        type="button"
        class="sl-accion"
        id="sl-voz">
        ${svg("voz")}
        <span id="sl-voz-texto">
          Leer en voz alta
        </span>
      </button>

      <button
        type="button"
        class="sl-accion principal"
        id="sl-guardar">
        ${svg("guardar")}
        Guardar en historial
      </button>

    </div>

    <p
      class="sl-aviso"
      id="sl-aviso"
      role="status"
      aria-live="polite">
      Sistema preparado para recibir señas.
    </p>

  `;

  // Devolver #out al documento
  // conservando su identidad original.

  $("sl-salida-contenedor").appendChild(
    salida
  );

  salida.setAttribute(
    "aria-label",
    "Texto traducido"
  );

  salida.setAttribute(
    "aria-live",
    "polite"
  );

  // ============================================================
  // 7. VARIABLES DE LA INTERFAZ
  // ============================================================

  const vacio = $("sl-vacio");
  const contador = $("sl-contador");
  const aviso = $("sl-aviso");

  let cambioInterno = false;

  // ============================================================
  // 8. OBTENER EL TEXTO ACTUAL
  // ============================================================

  function obtenerTexto() {
    return contenedor.textContent || "";
  }

  // ============================================================
  // 9. ACTUALIZAR CONTADOR
  // ============================================================

  function actualizarTexto() {
    const texto = obtenerTexto();
    const limpio = texto.trim();

    vacio.hidden = limpio.length > 0;

    salida.classList.toggle(
      "sl-sin-texto",
      limpio.length === 0
    );

    const caracteres =
      Array.from(texto).length;

    const palabras = limpio
      ? limpio.split(/\s+/u).length
      : 0;

    contador.textContent =
      `${caracteres} caracteres · ` +
      `${palabras} palabras`;
  }

  // ============================================================
  // 10. MOSTRAR MENSAJES
  // ============================================================

  function informar(
    mensaje,
    tipo = ""
  ) {
    aviso.textContent = mensaje;

    aviso.className =
      "sl-aviso " + tipo;
  }

  // ============================================================
  // 11. MODIFICAR EL TEXTO
  // ============================================================

  function fijarTexto(texto) {
    cambioInterno = true;

    contenedor.textContent = String(texto);

    salida.replaceChildren(
      contenedor,
      cursor
    );

    cambioInterno = false;

    actualizarTexto();
  }

  // ============================================================
  // 12. MANTENER COMPATIBILIDAD CON LOS MODELOS
  // ============================================================

  function sincronizarTexto() {
    if (cambioInterno) {
      return;
    }

    const texto = Array.from(
      salida.childNodes
    )
      .filter(nodo => nodo !== cursor)
      .map(nodo => nodo.textContent || "")
      .join("")
      .replace(/ {2,}/g, " ");

    const estructuraCorrecta =
      salida.childNodes.length === 2 &&
      salida.firstChild === contenedor &&
      salida.lastChild === cursor;

    if (
      !estructuraCorrecta ||
      contenedor.textContent !== texto
    ) {
      cambioInterno = true;

      contenedor.textContent = texto;

      salida.replaceChildren(
        contenedor,
        cursor
      );

      cambioInterno = false;
    }

    actualizarTexto();
  }

  const observadorTexto =
    new MutationObserver(sincronizarTexto);

  observadorTexto.observe(
    salida,
    {
      childList: true,
      characterData: true,
      subtree: true
    }
  );

  // ============================================================
  // 13. BOTÓN ESPACIO
  // ============================================================

  $("sl-espacio").addEventListener(
    "click",
    () => {
      const texto = obtenerTexto();

      if (!texto.trim()) {
        informar(
          "Primero realiza una seña."
        );
        return;
      }

      if (!texto.endsWith(" ")) {
        fijarTexto(texto + " ");
      }

      informar(
        "Espacio agregado.",
        "exito"
      );
    }
  );

  // ============================================================
  // 14. BOTÓN BORRAR
  // ============================================================

  $("sl-borrar").addEventListener(
    "click",
    () => {
      const caracteres =
        Array.from(obtenerTexto());

      if (!caracteres.length) {
        informar(
          "No hay caracteres que borrar."
        );
        return;
      }

      caracteres.pop();

      fijarTexto(
        caracteres.join("")
      );

      informar(
        "Último carácter eliminado.",
        "exito"
      );
    }
  );

  // ============================================================
  // 15. BOTÓN LIMPIAR
  // ============================================================

  $("sl-limpiar").addEventListener(
    "click",
    () => {
      if (!obtenerTexto()) {
        informar(
          "La traducción ya está vacía."
        );
        return;
      }

      fijarTexto("");

      if (
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }

      const textoVoz =
        $("sl-voz-texto");

      if (textoVoz) {
        textoVoz.textContent =
          "Leer en voz alta";
      }

      informar(
        "Traducción eliminada.",
        "exito"
      );
    }
  );

  // ============================================================
  // 16. BOTÓN COPIAR
  // ============================================================

  $("sl-copiar").addEventListener(
    "click",
    async () => {
      const texto =
        obtenerTexto().trim();

      if (!texto) {
        informar(
          "No hay texto para copiar."
        );
        return;
      }

      try {
        await navigator.clipboard.writeText(
          texto
        );

        informar(
          "Texto copiado al portapapeles.",
          "exito"
        );

      } catch (error) {
        console.error(
          "[SeñaLive] Error al copiar:",
          error
        );

        informar(
          "No se pudo copiar el texto.",
          "error"
        );
      }
    }
  );

  // ============================================================
  // 17. BOTÓN LEER EN VOZ ALTA
  // ============================================================

  let lecturaActual = null;

  $("sl-voz").addEventListener(
    "click",
    () => {
      if (
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ) {
        informar(
          "El navegador no permite lectura en voz alta.",
          "error"
        );
        return;
      }

      // Detener lectura anterior

      if (
        lecturaActual ||
        window.speechSynthesis.speaking
      ) {
        lecturaActual = null;

        window.speechSynthesis.cancel();

        $("sl-voz-texto").textContent =
          "Leer en voz alta";

        informar(
          "Lectura detenida."
        );

        return;
      }

      const texto =
        obtenerTexto().trim();

      if (!texto) {
        informar(
          "No hay traducción para leer."
        );
        return;
      }

      const lectura =
        new SpeechSynthesisUtterance(texto);

      lecturaActual = lectura;

      lectura.lang = "es-HN";
      lectura.rate = 0.92;
      lectura.pitch = 1;

      lectura.onstart = () => {
        if (lecturaActual !== lectura) {
          return;
        }

        $("sl-voz-texto").textContent =
          "Detener lectura";

        informar(
          "Reproduciendo traducción...",
          "exito"
        );
      };

      lectura.onend = () => {
        if (lecturaActual !== lectura) {
          return;
        }

        lecturaActual = null;

        $("sl-voz-texto").textContent =
          "Leer en voz alta";

        informar(
          "Lectura finalizada."
        );
      };

      lectura.onerror = evento => {
        if (lecturaActual !== lectura) {
          return;
        }

        lecturaActual = null;

        $("sl-voz-texto").textContent =
          "Leer en voz alta";

        informar(
          "No se pudo reproducir el audio.",
          "error"
        );

        console.error(
          "[SeñaLive] Error de voz:",
          evento.error
        );
      };

      window.speechSynthesis.speak(
        lectura
      );
    }
  );

  // ============================================================
  // 18. ALMACENAMIENTO DEL HISTORIAL
  // ============================================================

  const CLAVE_HISTORIAL =
    "senalive_historial_v1";

  function leerHistorial() {
    try {
      const datos = JSON.parse(
        localStorage.getItem(
          CLAVE_HISTORIAL
        ) || "[]"
      );

      if (!Array.isArray(datos)) {
        return [];
      }

      return datos.filter(
        item =>
          item &&
          typeof item.texto === "string"
      );

    } catch (error) {
      console.error(
        "[SeñaLive] Error leyendo historial:",
        error
      );

      return [];
    }
  }

  function guardarHistorial(datos) {
    try {
      localStorage.setItem(
        CLAVE_HISTORIAL,
        JSON.stringify(datos)
      );

      return true;

    } catch (error) {
      console.error(
        "[SeñaLive] Error guardando historial:",
        error
      );

      return false;
    }
  }

  // ============================================================
  // 19. CREAR PANTALLA DE HISTORIAL
  // ============================================================

  const seccionHistorial = $("h");

  if (seccionHistorial) {
    seccionHistorial.innerHTML = `

      <div class="card">

        <h2 class="sl-hist-title">
          Historial de traducciones
        </h2>

        <p class="sl-hist-desc">
          Consulta las traducciones que has guardado
          en este navegador.
        </p>

        <div
          class="sl-hist-lista"
          id="sl-hist-lista">
        </div>

      </div>

    `;
  }

  // ============================================================
  // 20. MOSTRAR TRADUCCIONES GUARDADAS
  // ============================================================

  function mostrarHistorial() {
    const lista = $("sl-hist-lista");

    if (!lista) {
      return;
    }

    lista.replaceChildren();

    const registros = leerHistorial();

    if (!registros.length) {
      const mensaje =
        document.createElement("p");

      mensaje.className =
        "sl-hist-vacio";

      mensaje.textContent =
        "Aún no hay traducciones guardadas.";

      lista.appendChild(mensaje);

      return;
    }

    registros.forEach(registro => {
      const fila =
        document.createElement("div");

      fila.className =
        "sl-hist-item";

      const informacion =
        document.createElement("div");

      informacion.className =
        "sl-hist-cuerpo";

      const frase =
        document.createElement("p");

      frase.className =
        "sl-hist-texto";

      frase.textContent =
        registro.texto;

      const fecha =
        document.createElement("time");

      fecha.className =
        "sl-hist-fecha";

      const fechaGuardada =
        new Date(registro.fecha);

      fecha.textContent =
        Number.isNaN(
          fechaGuardada.getTime()
        )
          ? "Fecha no disponible"
          : fechaGuardada.toLocaleString(
              "es-HN"
            );

      informacion.append(
        frase,
        fecha
      );

      const eliminar =
        document.createElement("button");

      eliminar.type = "button";

      eliminar.className =
        "sl-hist-eliminar";

      eliminar.textContent =
        "Eliminar";

      eliminar.addEventListener(
        "click",
        () => {
          const actualizados =
            leerHistorial().filter(
              item =>
                item.id !== registro.id
            );

          if (
            guardarHistorial(
              actualizados
            )
          ) {
            mostrarHistorial();
          }
        }
      );

      fila.append(
        informacion,
        eliminar
      );

      lista.appendChild(fila);
    });
  }

  // ============================================================
  // 21. BOTÓN GUARDAR EN HISTORIAL
  // ============================================================

  $("sl-guardar").addEventListener(
    "click",
    () => {
      const texto =
        obtenerTexto().trim();

      if (!texto) {
        informar(
          "No hay traducción para guardar."
        );
        return;
      }

      const registros = leerHistorial();

      const identificador =
        window.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random()}`;

      registros.unshift({
        id: identificador,
        tipo: "Traducción",
        texto: texto,
        fecha: new Date().toISOString()
      });

      const guardado = guardarHistorial(
        registros.slice(0, 200)
      );

      if (!guardado) {
        informar(
          "No se pudo guardar el historial.",
          "error"
        );
        return;
      }

      mostrarHistorial();

      informar(
        "Traducción guardada correctamente.",
        "exito"
      );
    }
  );

  // ============================================================
  // 22. INDICADOR CIRCULAR DE CONFIANZA
  // ============================================================

  const elementoConfianza =
    $("confidence");

  const aro = panel.querySelector(
    ".ring circle[stroke-dashoffset]"
  );

  if (elementoConfianza && aro) {
    const actualizarAro = () => {
      const contenido =
        elementoConfianza.textContent || "";

      const numero = parseFloat(
        contenido
      );

      const porcentaje =
        Number.isFinite(numero)
          ? Math.max(
              0,
              Math.min(100, numero)
            )
          : 0;

      const desplazamiento =
        94 * (1 - porcentaje / 100);

      aro.setAttribute(
        "stroke-dashoffset",
        String(desplazamiento)
      );
    };

    const observadorConfianza =
      new MutationObserver(
        actualizarAro
      );

    observadorConfianza.observe(
      elementoConfianza,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    actualizarAro();
  }

  // ============================================================
  // 23. MEJORAR ETIQUETA Y MENSAJES DEL MODELO
  // ============================================================

  const etiquetaSuperior =
    document.querySelector(
      "main header .pill"
    );

  const estadoModelo =
    $("modelStatus");

  const estadoTensorFlow =
    $("tensorflowStatus");

  function mejorarEstados() {

    // Solo mostrar el estado activo cuando el
    // módulo de palabras confirme que cargó.

    const palabrasCargadas =
      window.senaliveModeloPalabrasCargado === true;

    if (
      palabrasCargadas &&
      etiquetaSuperior
    ) {
      const nuevoTitulo =
        "ASL · Traducción en tiempo real";

      if (
        etiquetaSuperior.textContent !==
        nuevoTitulo
      ) {
        etiquetaSuperior.textContent =
          nuevoTitulo;
      }
    }

    if (
      palabrasCargadas &&
      estadoTensorFlow
    ) {
      const texto =
        "Reconocimiento de señas habilitado";

      if (
        estadoTensorFlow.textContent !== texto
      ) {
        estadoTensorFlow.textContent =
          texto;
      }
    }

    if (estadoModelo) {
      const textoActual =
        estadoModelo.textContent || "";

      if (
        palabrasCargadas &&
        textoActual.includes(
          "TensorFlow.js activo"
        )
      ) {
        estadoModelo.textContent =
          "Reconocimiento de señas activo";
      }
    }

    const estadoPalabras =
      $("estadoPalabrasAutomaticas");

    if (estadoPalabras) {
      const textoActual =
        estadoPalabras.textContent || "";

      if (
        textoActual.includes(
          "Listo para otra seña"
        )
      ) {
        estadoPalabras.textContent =
          "Preparado para una nueva seña";
      }

      if (
        textoActual.includes(
          "Modelo listo. Realiza una seña"
        )
      ) {
        estadoPalabras.textContent =
          "Preparado para reconocer señas";
      }

      if (
        textoActual.includes(
          "Capturando seña completa"
        )
      ) {
        estadoPalabras.textContent =
          "Analizando movimiento de manos...";
      }
    }
  }

  // Observar cambios del modelo y del panel.

  if (panelPrediccion) {
    const observadorEstados =
      new MutationObserver(
        mejorarEstados
      );

    observadorEstados.observe(
      panelPrediccion,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );
  }

  // Comprobar también cuando cambia el modo.

  window.addEventListener(
    "senalive:palabra-asl",
    mejorarEstados
  );

  // ============================================================
  // 24. INICIAR INTERFAZ
  // ============================================================

  mostrarHistorial();
  actualizarTexto();
  mejorarEstados();

  console.log(
    "[SeñaLive] Interfaz profesional cargada correctamente."
  );

})();
