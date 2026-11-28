
 // ==========================================
 // SEÑALIVE - DATASET.JS
 // RECOLECCIÓN DE MUESTRAS PARA TENSORFLOW
 // 24 LETRAS ASL - 63 CARACTERÍSTICAS
 // ==========================================

 // ==========================================
 // 1. ELEMENTOS HTML
 // ==========================================

 const captureLabel =
     document.getElementById("captureLabel");

 const personId =
     document.getElementById("personId");

 const captureTarget =
     document.getElementById("captureTarget");

 const captureCounter =
     document.getElementById("captureCounter");

 const captureProgress =
     document.getElementById("captureProgress");

 const captureStatus =
     document.getElementById("captureStatus");

 const datasetTotal =
     document.getElementById("datasetTotal");

 const datasetCounts =
     document.getElementById("datasetCounts");

 const startCapture =
     document.getElementById("startCapture");

 const stopCapture =
     document.getElementById("stopCapture");

 const downloadDataset =
     document.getElementById("downloadDataset");

 const clearDataset =
     document.getElementById("clearDataset");


 // ==========================================
 // 2. CONFIGURACIÓN
 // ==========================================

 const LETRAS = [
     "A", "B", "C", "D", "E", "F",
     "G", "H", "I", "K", "L", "M",
     "N", "O", "P", "Q", "R", "S",
     "T", "U", "V", "W", "X", "Y"
 ];

 const INTERVALO_CAPTURA = 250;

 const CLAVE_ALMACENAMIENTO =
     "senalive_dataset_63_v1";

 let muestras = [];

 let capturando = false;
 let letraActual = "";
 let participanteActual = "";
 let objetivo = 50;
 let capturadas = 0;

 let ultimoRegistro = 0;
 let inicioCaptura = 0;


 // ==========================================
 // 3. MOSTRAR MENSAJES
 // ==========================================

 function mostrarMensaje(mensaje) {

     if (captureStatus) {
         captureStatus.textContent = mensaje;
     }

     console.log("[Dataset SeñaLive]", mensaje);
 }


 // ==========================================
 // 4. NORMALIZAR LOS 21 PUNTOS
 // MISMO PROCESO QUE GOOGLE COLAB
 // ==========================================

 function normalizarMano(puntos) {

     if (!puntos || puntos.length !== 21) {
         return null;
     }

     // Punto 0: muñeca
     const muneca = puntos[0];

     const escala = Math.max(
         ...puntos.map(p =>
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

     // 21 puntos x 3 coordenadas = 63
     const valores = puntos.flatMap(p => [

         (p.x - muneca.x) / escala,

         (p.y - muneca.y) / escala,

         (p.z - muneca.z) / escala

     ]);

     if (
         valores.length !== 63 ||
         !valores.every(Number.isFinite)
     ) {
         return null;
     }

     return valores;
 }


 // ==========================================
 // 5. GUARDAR DATOS EN EL NAVEGADOR
 // ==========================================

 function guardarDatos() {

     try {

         localStorage.setItem(
             CLAVE_ALMACENAMIENTO,
             JSON.stringify(muestras)
         );

         return true;

     } catch (error) {

         console.warn(
             "No se pudo guardar en localStorage:",
             error
         );

         return false;
     }
 }


 // ==========================================
 // 6. RECUPERAR DATOS GUARDADOS
 // ==========================================

 function recuperarDatos() {

     try {

         const guardado =
             localStorage.getItem(
                 CLAVE_ALMACENAMIENTO
             );

         if (!guardado) return;

         const datos = JSON.parse(guardado);

         if (!Array.isArray(datos)) return;

         muestras = datos.filter(m =>
             LETRAS.includes(m.etiqueta) &&
             Array.isArray(m.features) &&
             m.features.length === 63 &&
             m.features.every(Number.isFinite)
         );

     } catch (error) {

         console.warn(
             "No se pudo recuperar el dataset:",
             error
         );

         muestras = [];
     }
 }


 // ==========================================
 // 7. ACTUALIZAR CONTADOR Y PROGRESO
 // ==========================================

 function actualizarProgreso() {

     if (captureCounter) {

         captureCounter.textContent =
             `${capturadas} / ${objetivo}`;
     }

     if (captureProgress) {

         const porcentaje = Math.min(
             100,
             (capturadas / objetivo) * 100
         );

         captureProgress.style.width =
             porcentaje + "%";
     }
 }


 // ==========================================
 // 8. MOSTRAR RESUMEN DEL DATASET
 // ==========================================

 function actualizarResumen() {

     if (datasetTotal) {

         datasetTotal.textContent =
             muestras.length;
     }

     if (datasetCounts) {

         datasetCounts.innerHTML = "";

         const conteos = {};

         for (const muestra of muestras) {

             const letra = muestra.etiqueta;

             conteos[letra] =
                 (conteos[letra] || 0) + 1;
         }

         for (const letra of LETRAS) {

             if (!conteos[letra]) continue;

             const elemento =
                 document.createElement("li");

             elemento.textContent =
                 `${letra}: ${conteos[letra]} muestras`;

             datasetCounts.appendChild(elemento);
         }
     }

     const tieneDatos = muestras.length > 0;

     if (downloadDataset) {
         downloadDataset.disabled = !tieneDatos;
     }

     if (clearDataset) {
         clearDataset.disabled =
             !tieneDatos || capturando;
     }
 }


 // ==========================================
 // 9. ACTIVAR Y DETENER BOTONES
 // ==========================================

 function actualizarBotones() {

     startCapture.disabled = capturando;
     stopCapture.disabled = !capturando;

     captureLabel.disabled = capturando;
     personId.disabled = capturando;
     captureTarget.disabled = capturando;

     actualizarResumen();
 }


 // ==========================================
 // 10. INICIAR CAPTURA
 // ==========================================

 function iniciarCaptura() {

     if (capturando) return;

     const letra =
         captureLabel.value.trim().toUpperCase();

     const participante =
         personId.value.trim();

     const cantidad =
         Number(captureTarget.value);

     // Validar letra del alfabeto entrenado
     if (!LETRAS.includes(letra)) {

         mostrarMensaje(
             "Selecciona una de las 24 letras ASL. " +
             "J y Z requieren movimiento."
         );

         return;
     }

     // Validar participante
     if (
         !/^[A-Za-z0-9_-]{1,20}$/.test(participante)
     ) {

         mostrarMensaje(
             "Escribe un código de participante " +
             "con letras, números, guiones o guion bajo."
         );

         return;
     }

     // Validar cantidad
     if (
         !Number.isInteger(cantidad) ||
         cantidad < 10 ||
         cantidad > 500
     ) {

         mostrarMensaje(
             "La cantidad debe estar entre 10 y 500."
         );

         return;
     }

     letraActual = letra;
     participanteActual = participante;
     objetivo = cantidad;

     capturadas = 0;
     ultimoRegistro = 0;

     // Tiempo para preparar la seña
     inicioCaptura = performance.now() + 2000;

     capturando = true;

     actualizarProgreso();
     actualizarBotones();

     mostrarMensaje(
         `Preparando captura de ${letraActual}. ` +
         "Coloca una sola mano en posición correcta."
     );
 }


 // ==========================================
 // 11. DETENER CAPTURA
 // ==========================================

 function detenerCaptura(mensaje) {

     if (!capturando) return;

     capturando = false;

     actualizarBotones();

     mostrarMensaje(
         mensaje ||
         `Captura detenida. ` +
         `${capturadas} muestras registradas.`
     );
 }


 // ==========================================
 // 12. IDENTIFICAR MANO
 // ==========================================

 function obtenerNombreMano(handedness) {

     const primera =
         handedness?.[0]?.[0] ??
         handedness?.[0];

     return (
         primera?.categoryName ||
         primera?.displayName ||
         primera?.label ||
         "Desconocida"
     );
 }


 // ==========================================
 // 13. RECIBIR PUNTOS DE CAMERA.JS
 // ==========================================

 window.addEventListener(
     "senalive:landmarks",
     evento => {

         if (!capturando) return;

         // Capturar únicamente en Entrenar
         if (evento.detail?.modo !== "e") {
             return;
         }

         const ahora = performance.now();

         // Esperar dos segundos para preparar
         if (ahora < inicioCaptura) {
             return;
         }

         // Una muestra cada 250 milisegundos
         if (
             ahora - ultimoRegistro <
             INTERVALO_CAPTURA
         ) {
             return;
         }

         const manos =
             evento.detail.manos ?? [];

         // Para este modelo, una sola mano
         if (manos.length !== 1) {

             mostrarMensaje(
                 "Muestra solamente una mano " +
                 "frente a la cámara."
             );

             return;
         }

         const puntos = manos[0];

         // Aplicar misma normalización
         // utilizada en el entrenamiento
         const features = normalizarMano(puntos);

         if (!features) {
             return;
         }

         ultimoRegistro = ahora;

         // Crear muestra
         const muestra = {

             etiqueta: letraActual,

             participante: participanteActual,

             mano: obtenerNombreMano(
                 evento.detail.handedness
             ),

             fecha: new Date().toISOString(),

             features: features
         };

         // Guardar en dataset
         muestras.push(muestra);

         capturadas++;

         const guardado = guardarDatos();

         actualizarProgreso();
         actualizarResumen();

         if (!guardado) {

             detenerCaptura(
                 "Almacenamiento lleno o no disponible. " +
                 "Exporta el CSV antes de cerrar."
             );

             return;
         }

         mostrarMensaje(
             `Capturando ${letraActual}: ` +
             `${capturadas}/${objetivo}`
         );

         // Finalizar automáticamente
         if (capturadas >= objetivo) {

             detenerCaptura(
                 `Captura de ${letraActual} completada: ` +
                 `${capturadas} muestras. ` +
                 "Ya puedes exportar el CSV."
             );
         }
     }
 );


 // ==========================================
 // 14. EXPORTAR DATASET A CSV
 // ==========================================

 function exportarCSV() {

     if (muestras.length === 0) {

         mostrarMensaje(
             "Todavía no tienes muestras."
         );

         return;
     }

     // Crear nombres de las 63 características
     const columnas = [];

     for (let i = 0; i < 21; i++) {

         columnas.push(`x${i}`);
         columnas.push(`y${i}`);
         columnas.push(`z${i}`);
     }

     // Encabezados
     const encabezados = [
         "etiqueta",
         "participante",
         "mano",
         "fecha",
         ...columnas
     ];

     // Escapar campos del CSV
     function escaparCSV(valor) {

         const texto = String(valor);

         return '"' +
             texto.replace(/"/g, '""') +
             '"';
     }

     const filas = [
         encabezados.join(",")
     ];

     // Escribir cada muestra
     for (const muestra of muestras) {

         const fila = [

             muestra.etiqueta,
             muestra.participante,
             muestra.mano,
             muestra.fecha,
             ...muestra.features

         ];

         filas.push(
             fila.map(escaparCSV).join(",")
         );
     }

     const contenido = filas.join("\r\n");

     const archivo = new Blob(
         ["\uFEFF", contenido],
         {
             type: "text/csv;charset=utf-8"
         }
     );

     const url = URL.createObjectURL(archivo);

     const enlace = document.createElement("a");

     enlace.href = url;
     enlace.download = "senalive_muestras_63.csv";

     document.body.appendChild(enlace);

     enlace.click();
     enlace.remove();

     setTimeout(() => {
         URL.revokeObjectURL(url);
     }, 1000);

     mostrarMensaje(
         `CSV exportado: ${muestras.length} muestras.`
     );
 }


 // ==========================================
 // 15. BORRAR DATASET
 // ==========================================

 function borrarDataset() {

     if (capturando) return;

     const confirmar = window.confirm(
         "¿Seguro que deseas borrar todas " +
         "las muestras guardadas?"
     );

     if (!confirmar) return;

     muestras = [];

     try {
         localStorage.removeItem(
             CLAVE_ALMACENAMIENTO
         );
     } catch (error) {
         console.warn(error);
     }

     capturadas = 0;

     actualizarProgreso();
     actualizarResumen();

     mostrarMensaje(
         "Dataset eliminado correctamente."
     );
 }


 // ==========================================
 // 16. EVENTOS DE LOS BOTONES
 // ==========================================

 startCapture.addEventListener(
     "click",
     iniciarCaptura
 );

 stopCapture.addEventListener(
     "click",
     () => detenerCaptura()
 );

 downloadDataset.addEventListener(
     "click",
     exportarCSV
 );

 clearDataset.addEventListener(
     "click",
     borrarDataset
 );

 // Detener si salimos de Entrenar
 document.querySelectorAll("nav button[data-m]")
     .forEach(boton => {

         boton.addEventListener("click", () => {

             if (
                 capturando &&
                 boton.dataset.m !== "e"
             ) {
                 detenerCaptura(
                     "Captura pausada al salir de Entrenar."
                 );
             }
         });
     });


 // ==========================================
 // 17. INICIAR MÓDULO
 // ==========================================

 recuperarDatos();

 actualizarProgreso();
 actualizarBotones();

 mostrarMensaje(
     "Dataset listo. Selecciona una letra " +
     "y presiona Iniciar captura."
 );

 console.log(
     "SeñaLive Dataset: 63 características"
 );
