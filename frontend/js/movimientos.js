
 // =====================================================
 // SEÑALIVE - J Y Z CON TENSORFLOW.JS
 // 30 fotogramas, sin botones, solo punto amarillo
 // Compatible con dataset-movimientos.js
 // =====================================================

 (() => {
   "use strict";

   const tf = window.tf;
   const camara = document.getElementById("cam1");
   const video = document.getElementById("video");

   if (!tf || !camara || !video) {
     console.error(
       "[SeñaLive J/Z] Falta TensorFlow.js, #cam1 o #video"
     );
     return;
   }

   const CONFIG = {
     fotogramas: 30,
     intervaloMs: 50,
     preparacionMinMs: 130,
     inicioPorEscala: 0.13,
     historialPrevio: 10,
     toleranciaPosturaMs: 280,
     perdidaManoMs: 380,
     maxCapturaMs: 3700,
     pausaTrasIntentoMs: 1700,
     confianzaMinima: 0.75,
     minHorizontalZ: 0.32,
     minVerticalZ: 0.12,
     minHorizontalJ: 0.10,
     minVerticalJ: 0.28
   };

   // ==========================================
   // CANVAS - SOLO PUNTO AMARILLO
   // ==========================================

   document.getElementById(
     "puntoMovimientoJZ"
   )?.remove();

   const canvas = document.createElement("canvas");

   canvas.id = "puntoMovimientoJZ";

   canvas.style.cssText =
     "position:absolute;" +
     "inset:0;" +
     "width:100%;" +
     "height:100%;" +
     "object-fit:contain;" +
     "pointer-events:none;" +
     "z-index:4;" +
     "transform:none";

   camara.appendChild(canvas);

   const ctx = canvas.getContext("2d");

   // ==========================================
   // VARIABLES
   // ==========================================

   let modelo = null;
   let etiquetas = [];

   let preparando = null;
   let captura = null;

   let activo = false;

   let ultimaMuestra = -Infinity;
   let ultimaMano = -Infinity;
   let nuevoIntentoDesde = 0;

   // ==========================================
   // AVISAR AL TRADUCTOR
   // ==========================================

   function notificarActivo(valor) {

     if (activo === valor) return;

     activo = valor;

     window.dispatchEvent(
       new CustomEvent(
         "senalive:movimiento-activo",
         {
           detail: {
             activo: valor
           }
         }
       )
     );
   }

   // ==========================================
   // TAMAÑO DEL VIDEO
   // ==========================================

   function tamanoVideo() {

     const w = video.videoWidth || 640;
     const h = video.videoHeight || 480;

     if (
       canvas.width !== w ||
       canvas.height !== h
     ) {
       canvas.width = w;
       canvas.height = h;
     }

     return { w, h };
   }

   // ==========================================
   // DIBUJAR PUNTO AMARILLO
   // ==========================================

   function mostrarPunto(punto) {

     if (!ctx) return;

     const { w, h } = tamanoVideo();

     ctx.clearRect(0, 0, w, h);

     if (!punto) return;

     ctx.beginPath();

     ctx.arc(
       punto.x * w,
       punto.y * h,
       8,
       0,
       2 * Math.PI
     );

     ctx.fillStyle = "#ffeb3b";
     ctx.fill();

     ctx.lineWidth = 2;
     ctx.strokeStyle = "#222";
     ctx.stroke();
   }

   // ==========================================
   // DISTANCIA ENTRE PUNTOS
   // ==========================================

   function distancia(a, b) {

     return Math.hypot(
       a.x - b.x,
       a.y - b.y
     );
   }

   // ==========================================
   // IDENTIFICAR DEDOS EXTENDIDOS
   // ==========================================

   function dedoExtendido(
     p,
     base,
     articulacion,
     punta
   ) {

     const tramo = distancia(
       p[base],
       p[articulacion]
     );

     return (
       tramo > 0.0001 &&
       distancia(
         p[base],
         p[punta]
       ) / tramo > 1.62
     );
   }

   // ==========================================
   // DETECTAR POSTURA INICIAL
   // ==========================================

   function posturaInicial(p) {

     const i = dedoExtendido(
       p, 5, 6, 8
     );

     const m = dedoExtendido(
       p, 9, 10, 12
     );

     const a = dedoExtendido(
       p, 13, 14, 16
     );

     const n = dedoExtendido(
       p, 17, 18, 20
     );

     // Z: índice extendido
     if (i && !m && !a && !n) {
       return "Z";
     }

     // J: meñique extendido
     if (n && !i && !m && !a) {
       return "J";
     }

     return null;
   }

   // ==========================================
   // COPIAR LANDMARKS
   // ==========================================

   function copia(puntos) {

     return puntos.map(p => ({
       x: p.x,
       y: p.y,
       z: p.z
     }));
   }

   // ==========================================
   // CALCULAR ESCALA DE LA MANO
   // ==========================================

   function escalaMano(puntos) {

     const { w, h } = tamanoVideo();

     return Math.max(
       ...puntos.map(p =>
         Math.hypot(
           (p.x - puntos[0].x) * w,
           (p.y - puntos[0].y) * h
         )
       )
     );
   }

   // ==========================================
   // OBTENER PUNTA DEL DEDO
   // ==========================================

   function puntaPixel(puntos, letra) {

     const { w, h } = tamanoVideo();

     const indice = letra === "J" ? 20 : 8;

     return {
       x: puntos[indice].x * w,
       y: puntos[indice].y * h
     };
   }

   // ==========================================
   // NORMALIZAR DATOS PARA TENSORFLOW
   // 30 FOTOGRAMAS X 63 = 1890
   // ==========================================

   function vectorParaModelo(frames) {

     if (frames.length !== 30) {
       return null;
     }

     const primera = frames[0];
     const muneca = primera[0];

     const escala = Math.max(
       ...primera.map(p =>
         Math.hypot(
           p.x - muneca.x,
           p.y - muneca.y
         )
       )
     );

     if (
       !Number.isFinite(escala) ||
       escala < 0.001
     ) {
       return null;
     }

     const datos = [];

     for (const mano of frames) {

       for (const p of mano) {

         datos.push(
           (p.x - muneca.x) / escala,
           (p.y - muneca.y) / escala,
           (p.z - muneca.z) / escala
         );
       }
     }

     return (
       datos.length === 1890 &&
       datos.every(Number.isFinite)
     )
       ? datos
       : null;
   }

   // ==========================================
   // COMPROBAR MOVIMIENTO SUFICIENTE
   // ==========================================

   function movimientoSuficiente(
     frames,
     letra
   ) {

     const { w, h } = tamanoVideo();

     const escala = escalaMano(
       frames[0]
     );

     if (
       !Number.isFinite(escala) ||
       escala < 15
     ) {
       return false;
     }

     const indice = letra === "J" ? 20 : 8;

     const xs = frames.map(
       p => p[indice].x * w
     );

     const ys = frames.map(
       p => p[indice].y * h
     );

     const dx = (
       Math.max(...xs) -
       Math.min(...xs)
     ) / escala;

     const dy = (
       Math.max(...ys) -
       Math.min(...ys)
     ) / escala;

     console.log(
       "[SeñaLive J/Z] Recorrido:",
       letra,
       "horizontal",
       dx.toFixed(2),
       "vertical",
       dy.toFixed(2)
     );

     if (letra === "Z") {

       return (
         dx >= CONFIG.minHorizontalZ &&
         dy >= CONFIG.minVerticalZ
       );
     }

     return (
       dx >= CONFIG.minHorizontalJ &&
       dy >= CONFIG.minVerticalJ
     );
   }

   // ==========================================
   // CARGAR MODELO DE TENSORFLOW.JS
   // ==========================================

   async function cargarModeloJZ() {

     let red = null;

     try {

       await tf.ready();

       const [
         rPesos,
         rEtiquetas
       ] = await Promise.all([

         fetch(
           "./models/movimientos_jz_weights.json",
           { cache: "no-store" }
         ),

         fetch(
           "./models/movimientos_jz_labels.json",
           { cache: "no-store" }
         )

       ]);

       if (
         !rPesos.ok ||
         !rEtiquetas.ok
       ) {

         throw new Error(
           `HTTP pesos=${rPesos.status}, ` +
           `etiquetas=${rEtiquetas.status}`
         );
       }

       const pesosJson = await rPesos.json();
       const labels = await rEtiquetas.json();

       if (
         !Array.isArray(labels) ||
         labels.length !== 2 ||
         !labels.includes("J") ||
         !labels.includes("Z") ||
         !Array.isArray(pesosJson.weights) ||
         pesosJson.weights.length !== 6
       ) {

         throw new Error(
           "Pesos o etiquetas J/Z incompatibles"
         );
       }

       // ======================================
       // CREAR RED NEURONAL
       // ======================================

       red = tf.sequential();

       red.add(
         tf.layers.dense({
           inputShape: [1890],
           units: 128,
           activation: "relu"
         })
       );

       red.add(
         tf.layers.dropout({
           rate: 0.30
         })
       );

       red.add(
         tf.layers.dense({
           units: 64,
           activation: "relu"
         })
       );

       red.add(
         tf.layers.dense({
           units: 2,
           activation: "softmax"
         })
       );

       // ======================================
       // CARGAR PESOS ENTRENADOS
       // ======================================

       const formas = [
         [1890, 128],
         [128],
         [128, 64],
         [64],
         [64, 2],
         [2]
       ];

       const tensores = [];

       try {

         pesosJson.weights.forEach(
           (p, i) => {

             const forma = formas[i];

             const n = forma.reduce(
               (a, b) => a * b,
               1
             );

             if (
               JSON.stringify(p.shape) !==
                 JSON.stringify(forma) ||
               !Array.isArray(p.values) ||
               p.values.length !== n
             ) {

               throw new Error(
                 "Forma de pesos incorrecta " +
                 "en índice " + i
               );
             }

             tensores.push(
               tf.tensor(
                 p.values,
                 p.shape,
                 "float32"
               )
             );
           }
         );

         red.setWeights(tensores);

       } finally {

         tensores.forEach(
           t => t.dispose()
         );
       }

       modelo = red;
       etiquetas = labels;

       console.log(
         "[SeñaLive J/Z] Modelo TensorFlow cargado:",
         etiquetas
       );

     } catch (error) {

       if (red) {
         red.dispose();
       }

       console.error(
         "[SeñaLive J/Z] ERROR cargando modelo:",
         error
       );
     }
   }

   // ==========================================
   // DETENER O CANCELAR CAPTURA
   // ==========================================

   function detener({
     cooldown = true
   } = {}) {

     // Si se intentaba J/Z, bloquear palabras brevemente después
     // de un intento cancelado para que no lo clasifiquen como palabra.
     if (captura) {
       window.senalivePrioridadJZHasta = Math.max(
         window.senalivePrioridadJZHasta || 0,
         performance.now() + 2100
       );
     }

     preparando = null;
     captura = null;

     notificarActivo(false);
     mostrarPunto(null);

     if (cooldown) {

       nuevoIntentoDesde =
         performance.now() +
         CONFIG.pausaTrasIntentoMs;
     }
   }

   // ==========================================
   // EVALUAR CAPTURA CON TENSORFLOW
   // ==========================================

   function evaluarCaptura() {

     if (!captura || !modelo) {
       return;
     }

     const actual = captura;

     // El mismo movimiento ya fue reservado para J/Z,
     // incluso si el modelo termina rechazándolo.
     window.senalivePrioridadJZHasta = Math.max(
       window.senalivePrioridadJZHasta || 0,
       performance.now() + 2400
     );

     captura = null;
     preparando = null;

     nuevoIntentoDesde =
       performance.now() +
       CONFIG.pausaTrasIntentoMs;

     try {

       // ======================================
       // VERIFICAR MOVIMIENTO
       // ======================================

       if (
         !movimientoSuficiente(
           actual.frames,
           actual.letra
         )
       ) {

         console.log(
           "[SeñaLive J/Z] Rechazado: " +
           "movimiento insuficiente"
         );

         return;
       }

       // ======================================
       // NORMALIZAR
       // ======================================

       const entrada = vectorParaModelo(
         actual.frames
       );

       if (!entrada) {

         console.warn(
           "[SeñaLive J/Z] Rechazado: " +
           "datos incompletos"
         );

         return;
       }

       // ======================================
       // PREDICCIÓN TENSORFLOW.JS
       // ======================================

       const probabilidades = tf.tidy(() => {

         const tensor = tf.tensor2d(
           [entrada],
           [1, 1890]
         );

         return Array.from(
           modelo.predict(tensor).dataSync()
         );
       });

       const indice =
         probabilidades[0] >= probabilidades[1]
           ? 0
           : 1;

       const letra = etiquetas[indice];
       const confianza = probabilidades[indice];

       console.log(
         "[SeñaLive J/Z] Postura:",
         actual.letra,
         "| Modelo:",
         letra,
         "| Confianza:",
         (100 * confianza).toFixed(1) + "%"
       );

       // ======================================
       // ACEPTAR O RECHAZAR
       // ======================================

       if (
         letra === actual.letra &&
         confianza >= CONFIG.confianzaMinima
       ) {

         window.dispatchEvent(
           new CustomEvent(
             "senalive:letra-dinamica",
             {
               detail: {
                 letra,
                 confianza
               }
             }
           )
         );

         console.log(
           "[SeñaLive J/Z] LETRA RECONOCIDA:",
           letra
         );

       } else {

         console.log(
           "[SeñaLive J/Z] Rechazado: " +
           "postura/modelo/confianza"
         );
       }

     } catch (error) {

       console.error(
         "[SeñaLive J/Z] Error al predecir:",
         error
       );

     } finally {

       notificarActivo(false);
       mostrarPunto(null);
     }
   }

   // ==========================================
   // ESCUCHAR LANDMARKS DE MEDIAPIPE
   // ==========================================

   window.addEventListener(
     "senalive:landmarks",
     evento => {

       const detalle = evento.detail || {};

       // Solo trabajar en Traductor
       if (detalle.modo !== "t") {

         detener({
           cooldown: false
         });

         return;
       }

       if (!modelo) return;

       const ahora = performance.now();

       // Limitar fotogramas
       if (
         ahora - ultimaMuestra <
         CONFIG.intervaloMs
       ) {
         return;
       }

       ultimaMuestra = ahora;

       const manos =
         detalle.manos ||
         (
           detalle.landmarks
             ? [detalle.landmarks]
             : []
         );

       // ======================================
       // VERIFICAR UNA MANO
       // ======================================

       if (
         manos.length !== 1 ||
         manos[0]?.length !== 21
       ) {

         if (
           captura &&
           ahora - ultimaMano >
           CONFIG.perdidaManoMs
         ) {

           console.warn(
             "[SeñaLive J/Z] Cancelado: " +
             "se perdió la mano"
           );

           detener();

         } else if (!captura) {

           preparando = null;
           mostrarPunto(null);
         }

         return;
       }

       ultimaMano = ahora;

       const puntos = manos[0];

       const postura = posturaInicial(puntos);

       // Priorizar J/Z desde la postura inicial para que el
       // modelo de palabras no capture el mismo movimiento.
       if (postura || preparando || captura) {
         window.senalivePrioridadJZHasta = Math.max(
           window.senalivePrioridadJZHasta || 0,
           ahora + 1500
         );
       }

       // ======================================
       // MOSTRAR PUNTO AMARILLO
       // ======================================

       const dedoActual =
         captura?.letra ||
         preparando?.letra ||
         postura;

       mostrarPunto(
         dedoActual
           ? puntos[dedoActual === "J" ? 20 : 8]
           : null
       );

       // ======================================
       // 1. CONTINUAR CAPTURA
       // ======================================

       if (captura) {

         if (
           ahora - captura.inicio >
           CONFIG.maxCapturaMs
         ) {

           console.warn(
             "[SeñaLive J/Z] Cancelado: " +
             "captura muy lenta"
           );

           detener();
           return;
         }

         captura.frames.push(
           copia(puntos)
         );

         if (
           captura.frames.length >=
           CONFIG.fotogramas
         ) {

           // Asegurar 30 fotogramas
           captura.frames =
             captura.frames.slice(
               0,
               CONFIG.fotogramas
             );

           evaluarCaptura();
         }

         return;
       }

       // Esperar antes de nuevo intento
       if (ahora < nuevoIntentoDesde) {
         return;
       }

       // ======================================
       // 2. DETECTAR POSTURA INICIAL
       // ======================================

       if (!preparando) {

         if (!postura) return;

         const escala = escalaMano(puntos);

         if (escala < 18) return;

         preparando = {

           letra: postura,

           desde: ahora,

           ultimaPostura: ahora,

           origen: puntaPixel(
             puntos,
             postura
           ),

           escala,

           previos: [
             copia(puntos)
           ]
         };

         return;
       }

       // ======================================
       // PERMITIR PEQUEÑAS PÉRDIDAS
       // DE LA POSTURA
       // ======================================

       if (
         postura === preparando.letra
       ) {

         preparando.ultimaPostura = ahora;

       } else if (
         postura &&
         postura !== preparando.letra
       ) {

         preparando = null;
         return;

       } else if (
         ahora - preparando.ultimaPostura >
         CONFIG.toleranciaPosturaMs
       ) {

         preparando = null;
         return;
       }

       // ======================================
       // GUARDAR FOTOGRAMAS PREVIOS
       // ======================================

       preparando.previos.push(
         copia(puntos)
       );

       if (
         preparando.previos.length >
         CONFIG.historialPrevio
       ) {

         preparando.previos.shift();
       }

       const transcurrido =
         ahora - preparando.desde;

       const recorrido = distancia(

         puntaPixel(
           puntos,
           preparando.letra
         ),

         preparando.origen
       );

       if (transcurrido > 3000) {

         preparando = null;
         return;
       }

       // ======================================
       // 3. INICIAR GRABACIÓN AUTOMÁTICA
       // ======================================

       if (
         transcurrido >=
           CONFIG.preparacionMinMs &&
         recorrido >=
           CONFIG.inicioPorEscala *
           preparando.escala
       ) {

         // Incluir fotogramas anteriores
         // al comienzo del movimiento

         captura = {

           letra: preparando.letra,

           inicio: ahora,

           frames:
             preparando.previos.slice()
         };

         console.log(
           "[SeñaLive J/Z] Capturando:",
           captura.letra,
           "| fotogramas previos:",
           captura.frames.length
         );

         preparando = null;

         notificarActivo(true);
       }
     }
   );

   // ==========================================
   // INICIAR MODELO DE J Y Z
   // ==========================================

   cargarModeloJZ();

 })();
