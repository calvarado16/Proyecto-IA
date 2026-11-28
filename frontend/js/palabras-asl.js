
(() => {
  "use strict";

  // ===================================================
  // SEÑALIVE - 10 PALABRAS ASL AUTOMÁTICAS
  // TensorFlow.js - 30 fotogramas x 126 características
  // ===================================================

  const tf = window.tf;

  const panel = document.getElementById("t");
  const prediccion = document.getElementById("prediction");
  const confianzaUI = document.getElementById("confidence");
  const barra = document.querySelector("#t .confidence-fill");
  const estadoModelo = document.getElementById("modelStatus");

  if (!tf || !panel || !prediccion) {
    console.error(
      "[SeñaLive] Faltan TensorFlow.js o elementos del traductor"
    );
    return;
  }

  // ===================================================
  // ELIMINAR SELECTORES ANTIGUOS
  // ===================================================

  [
    "selectorPalabrasASL",
    "palabrasASLEstado",
    "estadoPalabrasAutomaticas"
  ].forEach(id => document.getElementById(id)?.remove());

  document.documentElement.dataset.senaliveRecognitionMode =
    "letras";

  // ===================================================
  // CONFIGURACIÓN GENERAL
  // ===================================================

  const CONFIG = {
    intervaloMs: 50,

    minimoFrames: 12,
    maximoFrames: 45,

    esperaQuietudMs: 450,
    esperaPerdidaMs: 300,

    movimientoInicio: 0.007,
    movimientoContinuo: 0.006,
    amplitudMinima: 0.035,

    muestrasConMovimientoParaIniciar: 2,

    // Respaldo para palabras sin umbral específico
    confianzaMinima: 0.65,

    // Separación entre las dos mejores predicciones
    diferenciaMinima: 0.10,

    // Evitar detecciones continuas
    liberacionManosMs: 450,
    pausaEntreIntentosMs: 500,
    resultadoVisibleMs: 2300,
    evitarPalabraRepetidaMs: 4000,

    // Cambiar solo si se confirma inversión
    // respecto al entrenamiento
    intercambiarManos: false
  };

  // ===================================================
  // CONFIANZA INDIVIDUAL DE LAS 10 PALABRAS
  // ===================================================

  const UMBRALES = {
    hello: 0.60,
    thankyou: 0.60,
    please: 0.65,
    yes: 0.65,
    no: 0.70,
    water: 0.60,
    food: 0.60,
    mom: 0.65,
    dad: 0.65,
    bye: 0.60
  };

  // ===================================================
  // ARCHIVOS DEL MODELO DE KAGGLE
  // ===================================================

  const RUTAS = [
    "./models/palabras_asl_weights.json",
    "./models/palabras_asl_labels.json",
    "./models/palabras_asl_es.json"
  ];

  // ===================================================
  // ESTADO VISUAL
  // ===================================================

  const nota = document.createElement("div");

  nota.id = "estadoPalabrasAutomaticas";
  nota.setAttribute("role", "status");

  nota.style.cssText =
    "margin-top:9px;font-size:12px;line-height:1.5;" +
    "color:#9bb9ad;text-align:center;";

  estadoModelo?.parentNode?.appendChild(nota);

  // ===================================================
  // VARIABLES
  // ===================================================

  let modelo = null;
  let etiquetas = [];
  let traducciones = {};

  let capturando = false;

  let fotogramas = [];
  let precaptura = [];

  let ultimoFrame = null;
  let ultimaMuestra = -Infinity;

  let ultimoMovimiento = 0;
  let ultimaMano = -Infinity;

  let movimientosIniciales = 0;

  let bloqueoJZ = false;
  let pausaHasta = 0;

  let esperandoLiberacion = false;
  let liberacionDesde = null;

  let ultimaPalabra = "";
  let ultimaPalabraEn = -Infinity;

  // Variables compartidas con el traductor

  window.senaliveCapturandoPalabra = false;
  window.senalivePalabraVisibleHasta = 0;
  window.senaliveModeloPalabrasCargado = false;

  // ===================================================
  // ACTUALIZAR ESTADO
  // ===================================================

  function informar(texto) {
    if (nota.textContent !== texto) {
      nota.textContent = texto;
    }
  }

  // ===================================================
  // REINICIAR CAPTURA
  // ===================================================

  function reiniciarCaptura() {
    capturando = false;

    fotogramas = [];
    precaptura = [];

    ultimoFrame = null;
    ultimaMuestra = -Infinity;

    ultimoMovimiento = 0;
    movimientosIniciales = 0;

    window.senaliveCapturandoPalabra = false;
  }

  // ===================================================
  // ESPERAR A QUE SE RETIRE LA MANO
  // ===================================================

  function esperarLiberacion() {
    reiniciarCaptura();

    esperandoLiberacion = true;
    liberacionDesde = null;
  }

  // ===================================================
  // CARGAR MODELO TENSORFLOW.JS
  // ===================================================

  async function cargarModelo() {
    let red = null;

    try {
      await tf.ready();

      informar("Cargando modelo de 10 palabras ASL...");

      const respuestas = await Promise.all(
        RUTAS.map(r =>
          fetch(r, {
            cache: "no-store"
          })
        )
      );

      respuestas.forEach((r, i) => {
        if (!r.ok) {
          throw new Error(
            `${RUTAS[i]}: HTTP ${r.status}`
          );
        }
      });

      const [
        datos,
        labels,
        espanol
      ] = await Promise.all(
        respuestas.map(r => r.json())
      );

      // Validar los archivos

      if (
        !Array.isArray(datos?.weights) ||
        datos.weights.length !== 8 ||
        !Array.isArray(labels) ||
        labels.length !== 10 ||
        labels.some(
          nombre =>
            typeof nombre !== "string" ||
            !(nombre in UMBRALES)
        ) ||
        new Set(labels).size !== 10
      ) {
        throw new Error(
          "Pesos o etiquetas incompatibles con el modelo ASL"
        );
      }

      // ===============================================
      // CONSTRUIR LA RED NEURONAL
      // ===============================================

      red = tf.sequential();

      red.add(
        tf.layers.conv1d({
          inputShape: [30, 126],
          filters: 64,
          kernelSize: 5,
          padding: "same",
          activation: "relu"
        })
      );

      red.add(
        tf.layers.maxPooling1d({
          poolSize: 2
        })
      );

      red.add(
        tf.layers.conv1d({
          filters: 96,
          kernelSize: 3,
          padding: "same",
          activation: "relu"
        })
      );

      red.add(
        tf.layers.maxPooling1d({
          poolSize: 2
        })
      );

      red.add(
        tf.layers.flatten()
      );

      red.add(
        tf.layers.dense({
          units: 128,
          activation: "relu"
        })
      );

      red.add(
        tf.layers.dropout({
          rate: 0.35
        })
      );

      red.add(
        tf.layers.dense({
          units: 10,
          activation: "softmax"
        })
      );

      // ===============================================
      // CARGAR PESOS DEL MODELO
      // ===============================================

      const formas = [
        [5, 126, 64],
        [64],
        [3, 64, 96],
        [96],
        [672, 128],
        [128],
        [128, 10],
        [10]
      ];

      const tensores = [];

      try {
        datos.weights.forEach((p, i) => {
          const forma = formas[i];

          const cantidad = forma.reduce(
            (a, b) => a * b,
            1
          );

          if (
            JSON.stringify(p.shape) !==
              JSON.stringify(forma) ||
            !Array.isArray(p.values) ||
            p.values.length !== cantidad
          ) {
            throw new Error(
              "Peso incompatible en posición " + i
            );
          }

          tensores.push(
            tf.tensor(
              p.values,
              forma,
              "float32"
            )
          );
        });

        red.setWeights(tensores);

      } finally {
        tensores.forEach(t => t.dispose());
      }

      // ===============================================
      // MODELO LISTO
      // ===============================================

      modelo = red;
      etiquetas = labels;
      traducciones = espanol || {};

      window.senaliveModeloPalabrasCargado = true;

      if (estadoModelo) {
        estadoModelo.textContent =
          "TensorFlow.js activo: 26 letras + 10 palabras ASL";
      }

      informar(
        "Modelo listo. Realiza una seña y después retira las manos."
      );

      console.log(
        "[SeñaLive] Modelo de palabras cargado:",
        etiquetas
      );

    } catch (error) {
      if (red && !modelo) {
        red.dispose();
      }

      console.error(
        "[SeñaLive] Error cargando palabras:",
        error
      );

      informar(
        "Error cargando palabras. Revisa F12 > Console."
      );
    }
  }

  // ===================================================
  // IDENTIFICAR MANO IZQUIERDA Y DERECHA
  // ===================================================

  function ladoDe(meta) {
    const c = Array.isArray(meta)
      ? meta[0]
      : meta;

    const nombre = String(
      c?.categoryName ??
      c?.displayName ??
      c?.label ??
      ""
    ).toLowerCase();

    if (nombre.includes("left")) {
      return "left";
    }

    if (nombre.includes("right")) {
      return "right";
    }

    return null;
  }

  // ===================================================
  // CREAR FRAME DE 126 CARACTERÍSTICAS
  // ===================================================

  function crearFrame(detalle) {
    const manos = Array.isArray(detalle.manos)
      ? detalle.manos
      : [];

    const handedness = detalle.handedness ?? [];

    const asignadas = {
      left: null,
      right: null
    };

    manos.forEach((mano, i) => {
      if (
        !Array.isArray(mano) ||
        mano.length !== 21
      ) {
        return;
      }

      let lado = ladoDe(handedness[i]);

      if (!lado) {
        lado = manos.length === 1
          ? "right"
          : (
            mano[0].x < 0.5
              ? "left"
              : "right"
          );
      }

      if (asignadas[lado]) {
        lado = lado === "left"
          ? "right"
          : "left";
      }

      asignadas[lado] = mano;
    });

    const valores = new Float32Array(126).fill(NaN);

    for (const [lado, base] of [
      ["left", 0],
      ["right", 63]
    ]) {
      const mano = asignadas[lado];

      if (!mano) {
        continue;
      }

      for (let i = 0; i < 21; i++) {
        valores[base + i * 3] = Number(mano[i].x);

        valores[base + i * 3 + 1] =
          Number(mano[i].y);

        valores[base + i * 3 + 2] =
          Number(mano[i].z);
      }
    }

    if (CONFIG.intercambiarManos) {
      const copia = valores.slice();

      valores.set(
        copia.slice(63),
        0
      );

      valores.set(
        copia.slice(0, 63),
        63
      );
    }

    return valores;
  }

  // ===================================================
  // DETECTAR MOVIMIENTO ENTRE FOTOGRAMAS
  // ===================================================

  function diferenciaFrame(anterior, actual) {
    if (!anterior) {
      return 0;
    }

    let maximo = 0;

    for (const base of [0, 63]) {
      for (const punto of [0, 4, 8, 12, 20]) {
        const i = base + punto * 3;

        if (
          [
            anterior[i],
            anterior[i + 1],
            actual[i],
            actual[i + 1]
          ].every(Number.isFinite)
        ) {
          maximo = Math.max(
            maximo,
            Math.hypot(
              actual[i] - anterior[i],
              actual[i + 1] - anterior[i + 1]
            )
          );
        }
      }
    }

    return maximo;
  }

  // ===================================================
  // CALCULAR AMPLITUD DEL MOVIMIENTO
  // ===================================================

  function amplitudTotal(frames) {
    let amplitud = 0;

    for (const base of [0, 63]) {
      for (const punto of [0, 4, 8, 12, 20]) {
        const i = base + punto * 3;

        const xs = [];
        const ys = [];

        for (const frame of frames) {
          if (
            Number.isFinite(frame[i]) &&
            Number.isFinite(frame[i + 1])
          ) {
            xs.push(frame[i]);
            ys.push(frame[i + 1]);
          }
        }

        if (xs.length >= 3) {
          amplitud = Math.max(
            amplitud,
            Math.hypot(
              Math.max(...xs) - Math.min(...xs),
              Math.max(...ys) - Math.min(...ys)
            )
          );
        }
      }
    }

    return amplitud;
  }

  // ===================================================
  // INTERPOLAR SECUENCIA A 30 FOTOGRAMAS
  // ===================================================

  function prepararSecuencia(frames) {
    const salida = Array.from(
      { length: 30 },
      () => Array(126).fill(0)
    );

    for (
      let atributo = 0;
      atributo < 126;
      atributo++
    ) {
      const indices = [];

      for (let i = 0; i < frames.length; i++) {
        if (
          Number.isFinite(
            frames[i][atributo]
          )
        ) {
          indices.push(i);
        }
      }

      if (!indices.length) {
        continue;
      }

      for (let n = 0; n < 30; n++) {
        const t =
          n * (frames.length - 1) / 29;

        if (t <= indices[0]) {
          salida[n][atributo] =
            frames[indices[0]][atributo];

          continue;
        }

        const ultimo =
          indices[indices.length - 1];

        if (t >= ultimo) {
          salida[n][atributo] =
            frames[ultimo][atributo];

          continue;
        }

        let j = 1;

        while (indices[j] < t) {
          j++;
        }

        const a = indices[j - 1];
        const b = indices[j];

        const factor = (t - a) / (b - a);

        salida[n][atributo] =
          frames[a][atributo] * (1 - factor) +
          frames[b][atributo] * factor;
      }
    }

    return salida;
  }

  // ===================================================
  // AGREGAR PALABRAS AL TEXTO
  // ===================================================

  function agregarTexto(texto) {
    const salida = document.getElementById("out");

    if (!salida) {
      return;
    }

    let contenedor = salida.querySelector(
      "[data-senalive-palabras]"
    );

    if (!contenedor) {
      contenedor = document.createElement("span");

      contenedor.dataset.senalivePalabras = "1";

      const cursor = salida.querySelector(".cur");

      if (cursor) {
        salida.insertBefore(
          contenedor,
          cursor
        );
      } else {
        salida.appendChild(contenedor);
      }
    }

    contenedor.textContent +=
      (
        contenedor.textContent.trim()
          ? " "
          : ""
      ) + texto;
  }

  // ===================================================
  // MOSTRAR PALABRA RECONOCIDA
  // ===================================================

  function mostrarPalabra(texto, probabilidad) {
    const ahora = performance.now();

    // Evitar repetir la misma palabra inmediatamente

    if (
      texto === ultimaPalabra &&
      ahora - ultimaPalabraEn <
        CONFIG.evitarPalabraRepetidaMs
    ) {
      console.log(
        "[SeñaLive] Repetición omitida:",
        texto
      );

      return false;
    }

    ultimaPalabra = texto;
    ultimaPalabraEn = ahora;

    window.senalivePalabraVisibleHasta =
      ahora + CONFIG.resultadoVisibleMs;

    const porcentaje = Math.round(
      probabilidad * 100
    );

    prediccion.textContent = texto;
    prediccion.style.overflowWrap = "anywhere";

    if (confianzaUI) {
      confianzaUI.textContent =
        porcentaje + "%";
    }

    if (barra) {
      barra.style.width =
        porcentaje + "%";
    }

    agregarTexto(texto);

    window.dispatchEvent(
      new CustomEvent(
        "senalive:palabra-asl",
        {
          detail: {
            texto,
            confianza: probabilidad
          }
        }
      )
    );

    return true;
  }

  // ===================================================
  // EVALUAR SEÑA COMPLETA
  // ===================================================

  function evaluar(frames) {
    if (
      !modelo ||
      frames.length < CONFIG.minimoFrames
    ) {
      return false;
    }

    // ===============================================
    // VALIDAR MOVIMIENTO
    // ===============================================

    if (
      amplitudTotal(frames) <
      CONFIG.amplitudMinima
    ) {
      informar(
        "Movimiento insuficiente. Repite la seña completa."
      );

      return false;
    }

    // ===============================================
    // DAR PRIORIDAD A J Y Z
    // ===============================================

    if (
      performance.now() <
      (window.senalivePrioridadJZHasta || 0)
    ) {
      return false;
    }

    try {
      // =============================================
      // CREAR DOS VENTANAS DE PREDICCIÓN
      // =============================================

      const completo = prepararSecuencia(frames);

      const recorte = prepararSecuencia(
        frames.slice(
          Math.max(
            1,
            Math.floor(frames.length * 0.12)
          )
        )
      );

      // =============================================
      // PREDICCIÓN TENSORFLOW
      // =============================================

      const predicciones = tf.tidy(() => {
        const entrada = tf.tensor3d(
          [
            completo,
            recorte
          ],
          [2, 30, 126]
        );

        return modelo.predict(
          entrada
        ).arraySync();
      });

      const primera = predicciones[0];
      const segunda = predicciones[1];

      // =============================================
      // VERIFICAR RESULTADOS
      // =============================================

      if (
        !Array.isArray(primera) ||
        !Array.isArray(segunda) ||
        primera.length !== 10 ||
        segunda.length !== 10 ||
        [...primera, ...segunda].some(
          p =>
            !Number.isFinite(p) ||
            p < 0 ||
            p > 1
        )
      ) {
        throw new Error(
          "Predicción inválida"
        );
      }

      const iPrimera = primera.indexOf(
        Math.max(...primera)
      );

      const iSegunda = segunda.indexOf(
        Math.max(...segunda)
      );

      // Las dos ventanas deben coincidir

      if (iPrimera !== iSegunda) {
        informar(
          "Predicción inestable. Repite la seña."
        );

        return false;
      }

      // =============================================
      // ORDENAR PREDICCIONES
      // =============================================

      const orden = primera.map(
        (p, i) => ({
          palabra: etiquetas[i],
          probabilidad: Math.min(
            p,
            segunda[i]
          )
        })
      ).sort(
        (a, b) =>
          b.probabilidad - a.probabilidad
      );

      const mejor = orden[0];
      const segundo = orden[1];

      // =============================================
      // UMBRAL INDIVIDUAL POR PALABRA
      // =============================================

      // Corrección:
      // no forzar el 75 % como mínimo global.

      const umbral =
        UMBRALES[mejor.palabra] ??
        CONFIG.confianzaMinima;

      const margen =
        mejor.probabilidad -
        segundo.probabilidad;

      console.log(
        `[SeñaLive] ${mejor.palabra}: ` +
        `${(mejor.probabilidad * 100).toFixed(1)} % ` +
        `(mínimo ${umbral * 100} %)`
      );

      // =============================================
      // VALIDAR CONFIANZA Y MARGEN
      // =============================================

      if (
        mejor.probabilidad < umbral ||
        margen < CONFIG.diferenciaMinima
      ) {
        informar(
          `Seña no confirmada: ${mejor.palabra} ` +
          `(${Math.round(
            mejor.probabilidad * 100
          )}%).`
        );

        return false;
      }

      // =============================================
      // TRADUCIR PALABRA AL ESPAÑOL
      // =============================================

      const texto =
        traducciones[mejor.palabra] ||
        mejor.palabra.toUpperCase();

      if (
        !mostrarPalabra(
          texto,
          mejor.probabilidad
        )
      ) {
        informar(
          "Palabra repetida. Retira la mano y espera unos segundos."
        );

        return false;
      }

      informar(
        `Reconocida: ${texto} ` +
        `(${Math.round(
          mejor.probabilidad * 100
        )}%).`
      );

      return true;

    } catch (error) {
      console.error(
        "[SeñaLive] Error prediciendo:",
        error
      );

      informar(
        "Error interpretando la seña. Revisa F12 > Console."
      );

      return false;
    }
  }

  // ===================================================
  // FINALIZAR CAPTURA
  // ===================================================

  function finalizarCaptura() {
    if (!capturando) {
      return;
    }

    const datos = fotogramas.slice();

    esperarLiberacion();

    const aceptada = evaluar(datos);

    pausaHasta =
      performance.now() +
      CONFIG.pausaEntreIntentosMs;

    if (aceptada) {
      pausaHasta = Math.max(
        pausaHasta,
        window.senalivePalabraVisibleHasta
      );
    }
  }

  // ===================================================
  // COORDINACIÓN CON LAS LETRAS J Y Z
  // ===================================================

  window.addEventListener(
    "senalive:movimiento-activo",
    evento => {
      bloqueoJZ =
        evento.detail?.activo === true;

      if (bloqueoJZ) {
        esperarLiberacion();
      }
    }
  );

  window.addEventListener(
    "senalive:letra-dinamica",
    () => {
      esperarLiberacion();

      pausaHasta =
        performance.now() + 1800;
    }
  );

  // ===================================================
  // RECIBIR LANDMARKS DE LA CÁMARA
  // ===================================================

  window.addEventListener(
    "senalive:landmarks",
    evento => {
      // =============================================
      // SOLO EN MODO TRADUCTOR
      // =============================================

      if (
        evento.detail?.modo !== "t" ||
        !panel.classList.contains("on")
      ) {
        reiniciarCaptura();

        esperandoLiberacion = false;
        liberacionDesde = null;

        return;
      }

      const ahora = performance.now();

      const detalle = evento.detail;

      const manos = Array.isArray(detalle.manos)
        ? detalle.manos
        : [];

      // =============================================
      // PRIORIDAD DE J Y Z
      // =============================================

      if (
        bloqueoJZ ||
        ahora <
          (window.senalivePrioridadJZHasta || 0)
      ) {
        if (capturando) {
          esperarLiberacion();
        }

        return;
      }

      // =============================================
      // ESPERAR RETIRO DE MANOS
      // =============================================

      if (esperandoLiberacion) {
        if (manos.length === 0) {
          if (liberacionDesde === null) {
            liberacionDesde = ahora;
          }

          if (
            ahora - liberacionDesde >=
            CONFIG.liberacionManosMs
          ) {
            esperandoLiberacion = false;
            liberacionDesde = null;

            reiniciarCaptura();

            informar(
              "Listo para otra seña."
            );
          }

        } else {
          liberacionDesde = null;
        }

        return;
      }

      // =============================================
      // COMPROBAR MODELO Y PAUSA
      // =============================================

      if (
        !modelo ||
        ahora < pausaHasta
      ) {
        return;
      }

      // =============================================
      // SIN MANOS DETECTADAS
      // =============================================

      if (manos.length === 0) {
        movimientosIniciales = 0;

        if (
          capturando &&
          ahora - ultimaMano >=
          CONFIG.esperaPerdidaMs
        ) {
          finalizarCaptura();

        } else if (!capturando) {
          precaptura = [];
          ultimoFrame = null;
        }

        return;
      }

      ultimaMano = ahora;

      // =============================================
      // CONTROL DE FRECUENCIA
      // =============================================

      if (
        ahora - ultimaMuestra <
        CONFIG.intervaloMs
      ) {
        return;
      }

      ultimaMuestra = ahora;

      const actual = crearFrame(detalle);

      const delta = diferenciaFrame(
        ultimoFrame,
        actual
      );

      ultimoFrame = actual;

      // =============================================
      // DETECTAR INICIO DE LA SEÑA
      // =============================================

      if (!capturando) {
        precaptura.push(actual);

        if (precaptura.length > 8) {
          precaptura.shift();
        }

        if (
          delta >=
          CONFIG.movimientoInicio
        ) {
          movimientosIniciales++;

        } else {
          movimientosIniciales = Math.max(
            0,
            movimientosIniciales - 1
          );
        }

        if (
          movimientosIniciales >=
            CONFIG.muestrasConMovimientoParaIniciar &&
          precaptura.length >= 3
        ) {
          capturando = true;

          window.senaliveCapturandoPalabra = true;

          fotogramas = precaptura.slice();

          ultimoMovimiento = ahora;
          movimientosIniciales = 0;

          informar(
            "Capturando seña completa..."
          );
        }

        return;
      }

      // =============================================
      // CONTINUAR CAPTURANDO
      // =============================================

      fotogramas.push(actual);

      if (
        delta >=
        CONFIG.movimientoContinuo
      ) {
        ultimoMovimiento = ahora;
      }

      // =============================================
      // FINALIZAR LA SEÑA
      // =============================================

      if (
        fotogramas.length >=
          CONFIG.maximoFrames ||
        (
          fotogramas.length >=
            CONFIG.minimoFrames &&
          ahora - ultimoMovimiento >=
            CONFIG.esperaQuietudMs
        )
      ) {
        finalizarCaptura();
      }
    }
  );

  // ===================================================
  // INICIAR CARGA DEL MODELO
  // ===================================================

  cargarModelo();

})();
