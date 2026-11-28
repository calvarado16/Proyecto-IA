
 // ===================================================
 // SEÑALIVE - CAPTURA DE MOVIMIENTOS J, Z Y OTRO
 // 30 fotogramas x 63 características por secuencia
 // NO reemplaza dataset.js
 // ===================================================

 (() => {
     "use strict";

     // ==========================================
     // CONFIGURACIÓN
     // ==========================================

     const FOTOGRAMAS = 30;
     const INTERVALO_MS = 50;
     const PREPARACION_MS = 1400;
     const PERDIDA_MAX_MS = 550;

     const CLAVE = "senalive_secuencias_jz_v1";

     // ==========================================
     // CREAR INTERFAZ EN ENTRENAR
     // ==========================================

     const contenedor =
         document.querySelector("#e .card.side");

     if (!contenedor) {
         console.error(
             "[SeñaLive J/Z] No existe #e .card.side"
         );
         return;
     }

     const panel = document.createElement("div");

     panel.style.cssText =
         "margin-top:20px;padding-top:16px;" +
         "border-top:1px solid #385047";

     panel.innerHTML = `
         <h2 class="section-title">
             Entrenar movimientos J y Z
         </h2>

         <p class="hint">
             Cada grabación guarda una secuencia
             de ${FOTOGRAMAS} fotogramas.
             Utiliza una sola mano.
         </p>

         <label for="jzEtiqueta">
             Movimiento que vas a realizar
         </label>

         <select id="jzEtiqueta"
             style="display:block;width:100%;
             padding:12px;margin:7px 0 14px;
             background:#0b1712;color:white;
             border:1px solid #385047;
             border-radius:7px">

             <option value="J">
                 J (meñique)
             </option>

             <option value="Z">
                 Z (índice)
             </option>

             <option value="OTRO">
                 OTRO (movimientos que no son J ni Z)
             </option>

         </select>

         <label for="jzCantidad">
             Intentos consecutivos
         </label>

         <input
             id="jzCantidad"
             type="number"
             min="1"
             max="30"
             value="5"
             style="display:block;width:100%;
             padding:12px;margin:7px 0 14px;
             background:#0b1712;color:white;
             border:1px solid #385047;
             border-radius:7px">

         <div class="btns">

             <button class="btn p"
                 type="button"
                 id="jzGrabar">
                 Grabar movimientos
             </button>

             <button class="btn"
                 type="button"
                 id="jzCancelar"
                 disabled>
                 Cancelar
             </button>

         </div>

         <p class="hint"
             id="jzEstado"
             role="status">
             Listo para grabar.
         </p>

         <div class="lbl">
             <span>Fotogramas registrados</span>
             <b id="jzProgreso">
                 0 / ${FOTOGRAMAS}
             </b>
         </div>

         <div class="bar">
             <i id="jzBarra"
                 style="display:block;width:0%;
                 height:100%;background:#3ddba8">
             </i>
         </div>

         <p class="hint" id="jzConteos">
             J: 0 · Z: 0 · OTRO: 0
         </p>

         <div class="btns">

             <button class="btn p"
                 type="button"
                 id="jzExportar">
                 Exportar JSON de movimientos
             </button>

             <button class="btn"
                 type="button"
                 id="jzBorrar">
                 Borrar solo movimientos
             </button>

         </div>
     `;

     contenedor.appendChild(panel);

     // ==========================================
     // ELEMENTOS
     // ==========================================

     const ui = {
         etiqueta: panel.querySelector("#jzEtiqueta"),
         cantidad: panel.querySelector("#jzCantidad"),
         grabar: panel.querySelector("#jzGrabar"),
         cancelar: panel.querySelector("#jzCancelar"),
         estado: panel.querySelector("#jzEstado"),
         progreso: panel.querySelector("#jzProgreso"),
         barra: panel.querySelector("#jzBarra"),
         conteos: panel.querySelector("#jzConteos"),
         exportar: panel.querySelector("#jzExportar"),
         borrar: panel.querySelector("#jzBorrar")
     };

     let muestras = [];
     let grabacion = null;

     // ==========================================
     // RECUPERAR MOVIMIENTOS GUARDADOS
     // ==========================================

     try {

         const previo = JSON.parse(
             localStorage.getItem(CLAVE) || "[]"
         );

         if (Array.isArray(previo)) {

             muestras = previo.filter(m =>
                 ["J", "Z", "OTRO"].includes(m.etiqueta) &&
                 Array.isArray(m.frames) &&
                 m.frames.length === FOTOGRAMAS &&
                 m.frames.every(f =>
                     Array.isArray(f) &&
                     f.length === 63
                 )
             );
         }

     } catch (error) {

         console.warn(
             "[SeñaLive J/Z] Error recuperando datos:",
             error
         );
     }

     // ==========================================
     // MOSTRAR ESTADO
     // ==========================================

     function estado(texto) {
         ui.estado.textContent = texto;
     }

     // ==========================================
     // ACTUALIZAR INTERFAZ
     // ==========================================

     function refrescar() {

         const conteos = {
             J: 0,
             Z: 0,
             OTRO: 0
         };

         muestras.forEach(m => {
             conteos[m.etiqueta]++;
         });

         ui.conteos.textContent =
             `J: ${conteos.J} · ` +
             `Z: ${conteos.Z} · ` +
             `OTRO: ${conteos.OTRO} · ` +
             `Total: ${muestras.length}`;

         ui.exportar.disabled =
             muestras.length === 0;

         ui.borrar.disabled =
             Boolean(grabacion) ||
             muestras.length === 0;

         ui.grabar.disabled =
             Boolean(grabacion);

         ui.cancelar.disabled =
             !grabacion;

         ui.etiqueta.disabled =
             Boolean(grabacion);

         ui.cantidad.disabled =
             Boolean(grabacion);
     }

     // ==========================================
     // ACTUALIZAR PROGRESO
     // ==========================================

     function progreso(n) {

         ui.progreso.textContent =
             `${n} / ${FOTOGRAMAS}`;

         ui.barra.style.width =
             `${Math.round(
                 (n / FOTOGRAMAS) * 100
             )}%`;
     }

     // ==========================================
     // CANCELAR GRABACIÓN
     // ==========================================

     function cancelar(
         mensaje = "Grabación cancelada."
     ) {

         grabacion = null;

         estado(mensaje);
         refrescar();
     }

     // ==========================================
     // INICIAR GRABACIÓN
     // ==========================================

     ui.grabar.addEventListener("click", () => {

         if (grabacion) return;

         const participante =
             document.getElementById("personId")
                 ?.value.trim() || "P01";

         const cantidad =
             Number(ui.cantidad.value);

         if (
             !Number.isInteger(cantidad) ||
             cantidad < 1 ||
             cantidad > 30
         ) {

             estado(
                 "Elige entre 1 y 30 intentos."
             );

             return;
         }

         grabacion = {
             etiqueta: ui.etiqueta.value,
             participante,
             cantidad,
             numero: 1,
             fase: "preparar",
             inicioPreparacion: null,
             ultimoFrame: -Infinity,
             ultimaMano: performance.now(),
             origen: null,
             escala: null,
             frames: [],
             mano: "Desconocida"
         };

         progreso(0);

         estado(
             `Intento 1/${cantidad}. ` +
             "Muestra una mano y espera GRABANDO."
         );

         refrescar();
     });

     ui.cancelar.addEventListener(
         "click",
         () => cancelar()
     );

     // ==========================================
     // COMPLETAR UN MOVIMIENTO
     // ==========================================

     function completar() {

         if (!grabacion) return;

         const muestra = {
             etiqueta: grabacion.etiqueta,
             participante: grabacion.participante,
             mano: grabacion.mano,
             fecha: new Date().toISOString(),
             frames: grabacion.frames
         };

         muestras.push(muestra);

         const terminoLote =
             grabacion.numero >= grabacion.cantidad;

         const siguienteNumero =
             grabacion.numero + 1;

         // Guardar temporalmente en navegador
         try {

             localStorage.setItem(
                 CLAVE,
                 JSON.stringify(muestras)
             );

         } catch (error) {

             console.warn(
                 "No se pudo guardar en el navegador:",
                 error
             );

             estado(
                 "Almacenamiento lleno. " +
                 "Exporta el JSON antes de salir."
             );
         }

         if (terminoLote) {

             grabacion = null;

             estado(
                 `¡Tanda completa! ` +
                 `${muestra.etiqueta}: ` +
                 `${siguienteNumero - 1} intentos. ` +
                 "Exporta el JSON."
             );

         } else {

             grabacion.numero = siguienteNumero;
             grabacion.fase = "preparar";

             grabacion.inicioPreparacion = null;
             grabacion.ultimoFrame = -Infinity;

             grabacion.origen = null;
             grabacion.escala = null;
             grabacion.frames = [];

             progreso(0);

             estado(
                 `Intento ${siguienteNumero}/` +
                 `${grabacion.cantidad}. ` +
                 "Prepara nuevamente la seña."
             );
         }

         refrescar();
     }

     // ==========================================
     // CONVERTIR 21 PUNTOS EN 63 VALORES
     //
     // IMPORTANTE:
     // Se usa el origen y escala del primer
     // fotograma para CONSERVAR el movimiento.
     // ==========================================

     function extraerFotograma(puntos, grab) {

         if (!grab.origen) {

             const muneca = puntos[0];

             grab.origen = {
                 x: muneca.x,
                 y: muneca.y,
                 z: muneca.z
             };

             grab.escala = Math.max(
                 ...puntos.map(p =>
                     Math.hypot(
                         p.x - muneca.x,
                         p.y - muneca.y
                     )
                 )
             );
         }

         if (
             !Number.isFinite(grab.escala) ||
             grab.escala < 0.001
         ) {
             return null;
         }

         const valores = puntos.flatMap(p => [

             (p.x - grab.origen.x) / grab.escala,

             (p.y - grab.origen.y) / grab.escala,

             (p.z - grab.origen.z) / grab.escala

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
     // RECIBIR PUNTOS DESDE CAMERA.JS
     // ==========================================

     window.addEventListener(
         "senalive:landmarks",
         evento => {

             if (
                 !grabacion ||
                 evento.detail?.modo !== "e"
             ) {
                 return;
             }

             const ahora = performance.now();

             const manos =
                 evento.detail.manos || [];

             // Exigir exactamente una mano
             if (
                 manos.length !== 1 ||
                 manos[0]?.length !== 21
             ) {

                 if (
                     grabacion.fase === "grabando" &&
                     ahora - grabacion.ultimaMano >
                     PERDIDA_MAX_MS
                 ) {

                     cancelar(
                         "Se perdió la mano. " +
                         "Vuelve a intentarlo."
                     );

                 } else if (
                     grabacion.fase === "preparar"
                 ) {

                     grabacion.inicioPreparacion = null;

                     estado(
                         "Coloca una sola mano " +
                         "frente a la cámara."
                     );
                 }

                 return;
             }

             grabacion.ultimaMano = ahora;

             // ====================================
             // PREPARAR LA GRABACIÓN
             // ====================================

             if (
                 grabacion.fase === "preparar"
             ) {

                 if (
                     grabacion.inicioPreparacion === null
                 ) {

                     grabacion.inicioPreparacion = ahora;
                 }

                 const restante =
                     PREPARACION_MS -
                     (ahora - grabacion.inicioPreparacion);

                 if (restante > 0) {

                     estado(
                         `Intento ${grabacion.numero}/` +
                         `${grabacion.cantidad}: comienza en ` +
                         `${(restante / 1000).toFixed(1)} s...`
                     );

                     return;
                 }

                 grabacion.fase = "grabando";

                 estado(
                     `¡GRABANDO intento ` +
                     `${grabacion.numero}/` +
                     `${grabacion.cantidad}! ` +
                     "Realiza el movimiento."
                 );
             }

             // ====================================
             // REGISTRAR FOTOGRAMAS
             // ====================================

             if (
                 ahora - grabacion.ultimoFrame <
                 INTERVALO_MS
             ) {
                 return;
             }

             grabacion.ultimoFrame = ahora;

             const vector = extraerFotograma(
                 manos[0],
                 grabacion
             );

             if (!vector) {

                 cancelar(
                     "Error normalizando los puntos."
                 );

                 return;
             }

             // Identificar mano
             const primera =
                 evento.detail.handedness?.[0]?.[0] ||
                 evento.detail.handedness?.[0];

             grabacion.mano =
                 primera?.categoryName ||
                 primera?.displayName ||
                 primera?.label ||
                 grabacion.mano;

             grabacion.frames.push(vector);

             progreso(
                 grabacion.frames.length
             );

             if (
                 grabacion.frames.length >=
                 FOTOGRAMAS
             ) {
                 completar();
             }
         }
     );

     // ==========================================
     // EXPORTAR JSON
     // ==========================================

     ui.exportar.addEventListener(
         "click",
         () => {

             if (!muestras.length) return;

             const contenido = {
                 version: 1,
                 fotogramas_por_muestra: FOTOGRAMAS,
                 caracteristicas_por_fotograma: 63,
                 muestras
             };

             const blob = new Blob(
                 [JSON.stringify(contenido)],
                 {
                     type: "application/json"
                 }
             );

             const url =
                 URL.createObjectURL(blob);

             const enlace =
                 document.createElement("a");

             enlace.href = url;

             enlace.download =
                 "senalive_movimientos_J_Z_OTRO.json";

             document.body.appendChild(enlace);

             enlace.click();
             enlace.remove();

             setTimeout(
                 () => URL.revokeObjectURL(url),
                 1000
             );

             estado(
                 `Se exportaron ${muestras.length} secuencias.`
             );
         }
     );

     // ==========================================
     // BORRAR SOLO MOVIMIENTOS
     // ==========================================

     ui.borrar.addEventListener(
         "click",
         () => {

             if (
                 grabacion ||
                 !confirm(
                     "¿Borrar las secuencias J, Z y OTRO?"
                 )
             ) {
                 return;
             }

             muestras = [];

             try {

                 localStorage.removeItem(CLAVE);

             } catch (error) {

                 console.warn(error);
             }

             progreso(0);

             estado(
                 "Movimientos eliminados. " +
                 "Las muestras estáticas no se tocaron."
             );

             refrescar();
         }
     );

     // ==========================================
     // CANCELAR AL SALIR DE ENTRENAR
     // ==========================================

     document.querySelectorAll(
         "nav button[data-m]"
     ).forEach(boton => {

         boton.addEventListener(
             "click",
             () => {

                 if (
                     grabacion &&
                     boton.dataset.m !== "e"
                 ) {

                     cancelar(
                         "Grabación cancelada al salir de Entrenar."
                     );
                 }
             }
         );
     });

     // ==========================================
     // INICIAR MÓDULO
     // ==========================================

     progreso(0);
     refrescar();

     console.log(
         "[SeñaLive] Captura de movimientos J/Z/OTRO lista."
     );

 })();
