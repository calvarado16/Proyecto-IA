
 // ========================================
 // SEÑALIVE - TRADUCTOR CON TENSORFLOW.JS
 // Reconocimiento de 24 letras ASL
 // Excluye J y Z (requieren movimiento)
 // ========================================

 const tf = window.tf;

 const prediccion = document.getElementById("prediction");
 const confianza = document.getElementById("confidence");
 const barra = document.querySelector(".confidence-fill");

 const estadoModelo =
     document.getElementById("modelStatus") ||
     document.querySelector("#t .lbl-center");

 let modeloJS = null;
 let etiquetas = [];
 let ultimoEnvio = 0;

 const UMBRAL_CONFIANZA = 0.50;
 const INTERVALO_PREDICCION = 200;


 // ========================================
 // MOSTRAR ESTADO DEL MODELO
 // ========================================

 function mostrarEstado(mensaje) {

     console.log("[SeñaLive]", mensaje);

     if (estadoModelo) {
         estadoModelo.textContent = mensaje;
     }
 }


 // ========================================
 // CARGAR MODELO ENTRENADO
 // ========================================

 async function cargarModelo() {

     try {

         mostrarEstado("Cargando TensorFlow.js...");

         if (!tf) {
             throw new Error(
                 "TensorFlow.js no está cargado"
             );
         }

         await tf.ready();

         console.log(
             "TensorFlow.js versión:",
             tf.version.tfjs
         );

         mostrarEstado(
             "Cargando modelo de 24 letras..."
         );

         // Cargar pesos y etiquetas
         const [respuestaPesos, respuestaEtiquetas] =
             await Promise.all([

                 fetch(
                     "./models/letras_tfjs_weights.json",
                     { cache: "no-store" }
                 ),

                 fetch(
                     "./models/labels.json",
                     { cache: "no-store" }
                 )

             ]);

         if (!respuestaPesos.ok) {
             throw new Error(
                 "No se encontraron los pesos. HTTP " +
                 respuestaPesos.status
             );
         }

         if (!respuestaEtiquetas.ok) {
             throw new Error(
                 "No se encontraron las etiquetas. HTTP " +
                 respuestaEtiquetas.status
             );
         }

         const datos = await respuestaPesos.json();

         etiquetas = await respuestaEtiquetas.json();

         // Verificar compatibilidad
         if (
             !Array.isArray(datos.weights) ||
             datos.weights.length !== 6
         ) {
             throw new Error(
                 "El modelo debe tener 6 conjuntos de pesos"
             );
         }

         if (
             !Array.isArray(etiquetas) ||
             etiquetas.length !== 24
         ) {
             throw new Error(
                 "El modelo necesita 24 etiquetas"
             );
         }

         console.log(
             "Letras disponibles:",
             etiquetas.join(", ")
         );

         // ====================================
         // RECONSTRUIR RED NEURONAL
         // ====================================

         const red = tf.sequential();

         // Entrada: 21 puntos × 3 coordenadas
         red.add(tf.layers.dense({
             inputShape: [63],
             units: 128,
             activation: "relu"
         }));

         // Capa Dropout
         red.add(tf.layers.dropout({
             rate: 0.2
         }));

         // Segunda capa oculta
         red.add(tf.layers.dense({
             units: 64,
             activation: "relu"
         }));

         // Salida: 24 letras
         red.add(tf.layers.dense({
             units: etiquetas.length,
             activation: "softmax"
         }));

         // ====================================
         // CARGAR PESOS ENTRENADOS
         // ====================================

         const formasEsperadas = [
             [63, 128],
             [128],
             [128, 64],
             [64],
             [64, 24],
             [24]
         ];

         const pesos = [];

         try {

             for (let i = 0; i < datos.weights.length; i++) {

                 const peso = datos.weights[i];
                 const formaEsperada = formasEsperadas[i];

                 if (
                     !Array.isArray(peso.shape) ||
                     !Array.isArray(peso.values) ||
                     JSON.stringify(peso.shape) !==
                         JSON.stringify(formaEsperada)
                 ) {
                     throw new Error(
                         `Dimensiones incompatibles en peso ${i}`
                     );
                 }

                 pesos.push(
                     tf.tensor(
                         peso.values,
                         peso.shape,
                         "float32"
                     )
                 );
             }

             red.setWeights(pesos);

         } finally {

             // Liberar tensores temporales
             pesos.forEach(p => p.dispose());
         }

         modeloJS = red;

         mostrarEstado(
             "TensorFlow.js activo - 24 letras"
         );

         // Actualizar título descriptivo
         const titulo = document.querySelector(
             "header .pill"
         );

         if (titulo) {
             titulo.textContent =
                 "ASL · 24 letras estáticas";
         }

         console.log(
             "Modelo SeñaLive cargado correctamente"
         );

     } catch (error) {

         console.error(
             "Error cargando modelo:",
             error
         );

         mostrarEstado(
             "Error del modelo: " + error.message
         );
     }
 }


 // ========================================
 // NORMALIZAR LOS PUNTOS DE LA MANO
 // Misma normalización utilizada en Colab
 // ========================================

 function normalizarMano(puntos) {

     if (!puntos || puntos.length !== 21) {
         return null;
     }

     // Punto 0 = muñeca
     const muneca = puntos[0];

     // Calcular tamaño de referencia
     const escala = Math.max(
         ...puntos.map(p =>
             Math.hypot(
                 p.x - muneca.x,
                 p.y - muneca.y
             )
         )
     );

     if (escala < 0.001) {
         return null;
     }

     const valores = puntos.flatMap(p => [

         (p.x - muneca.x) / escala,

         (p.y - muneca.y) / escala,

         (p.z - muneca.z) / escala

     ]);

     if (!valores.every(Number.isFinite)) {
         return null;
     }

     return valores;
 }


 // ========================================
 // REALIZAR PREDICCIÓN
 // ========================================

 function predecir(features) {

     const probabilidades = tf.tidy(() => {

         const entrada = tf.tensor2d(
             [features],
             [1, 63]
         );

         const salida = modeloJS.predict(entrada);

         return Array.from(salida.dataSync());
     });

     // Buscar la letra con mayor probabilidad
     let indice = 0;

     for (let i = 1; i < probabilidades.length; i++) {

         if (
             probabilidades[i] >
             probabilidades[indice]
         ) {
             indice = i;
         }
     }

     return {
         letra: etiquetas[indice],
         confianza: probabilidades[indice]
     };
 }


 // ========================================
 // LIMPIAR PREDICCIÓN
 // ========================================

 function limpiarPrediccion() {

     if (prediccion) {
         prediccion.textContent = "—";
     }

     if (confianza) {
         confianza.textContent = "—";
     }

     if (barra) {
         barra.style.width = "0%";
     }
 }


 // ========================================
 // RECIBIR DATOS DESDE CAMERA.JS
 // ========================================

 window.addEventListener(
     "senalive:landmarks",
     evento => {

         // Esperar a que el modelo esté listo
         if (!modeloJS) return;

         // Solo procesar el modo Traductor
         if (evento.detail?.modo !== "t") {
             return;
         }

         const ahora = performance.now();

         // Evitar analizar demasiados fotogramas
         if (
             ahora - ultimoEnvio <
             INTERVALO_PREDICCION
         ) {
             return;
         }

         ultimoEnvio = ahora;

         // Obtener primera mano detectada
         const puntos =
             evento.detail.landmarks ??
             evento.detail.manos?.[0] ??
             null;

         const features = normalizarMano(puntos);

         if (!features) {
             limpiarPrediccion();
             return;
         }

         try {

             // Realizar predicción
             const resultado = predecir(features);

             const porcentaje = Math.round(
                 resultado.confianza * 100
             );

             // Mostrar letra si supera el umbral
             if (
                 resultado.confianza >=
                 UMBRAL_CONFIANZA
             ) {

                 prediccion.textContent =
                     resultado.letra;

             } else {

                 prediccion.textContent = "—";
             }

             // Mostrar porcentaje
             confianza.textContent =
                 porcentaje + "%";

             // Actualizar barra
             barra.style.width =
                 porcentaje + "%";

         } catch (error) {

             console.error(
                 "Error realizando predicción:",
                 error
             );
         }
     }
 );


 // ========================================
 // INICIAR TRADUCTOR
 // ========================================

 cargarModelo();
