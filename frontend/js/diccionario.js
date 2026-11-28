
/* ========================================================
   SEÑALIVE - DICCIONARIO VISUAL FUNCIONAL
   Archivo: frontend/js/diccionario.js

   24 letras ASL estáticas
   Fotografías de referencia
   Cámara real con MediaPipe
   Reconocimiento TensorFlow.js
   Confianza mínima: 75 %
   ======================================================== */

(() => {
    "use strict";

    // ==========================================
    // CONFIGURACIÓN
    // ==========================================

    const LETRAS =
        "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

    const CONFIANZA_MINIMA = 0.75;
    const CONFIRMACIONES_NECESARIAS = 4;
    const INTERVALO_PREDICCION = 200;

    const RUTA_IMAGENES = "./referencias/";
    const RUTA_PESOS =
        "./models/letras_tfjs_weights.json";
    const RUTA_ETIQUETAS =
        "./models/labels.json";

    const RUTA_MEDIAPIPE =
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";

    const RUTA_DETECTOR =
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

    const $ = id => document.getElementById(id);

    // ==========================================
    // ELEMENTOS EXISTENTES
    // ==========================================

    const seccion = $("d");
    const cuadricula = $("keys");
    const etiqueta = $("kl");

    if (!seccion || !cuadricula || !etiqueta) {
        console.error(
            "Diccionario: faltan elementos HTML."
        );
        return;
    }

    const lateral = seccion.querySelector(".side");

    const tarjetas = lateral?.querySelectorAll(
        ":scope > .card"
    );

    const cuadroReferencia =
        tarjetas?.[0]?.querySelector(".ref.ref-large");

    const cuadroCamara =
        tarjetas?.[1]?.querySelector(".cam.cam-wide");

    if (!cuadroReferencia || !cuadroCamara) {
        console.error(
            "Diccionario: faltan los paneles."
        );
        return;
    }

    // ==========================================
    // ESTILOS DEL DICCIONARIO
    // ==========================================

    const estilos = document.createElement("style");

    estilos.id = "senalive-estilos-diccionario";

    estilos.textContent = `
        #d.on {
            align-items: start;
        }

        #d > .card {
            min-width: 0;
        }

        #d .side,
        #d .side > .card {
            min-width: 0;
        }

        #d #keys {
            grid-template-columns:
                repeat(auto-fill, minmax(52px, 1fr));
        }

        #d #keys .key {
            min-width: 0;
        }

        #d #keys .key.on {
            background: var(--accent);
            color: #06150f;
        }

        #d .dictionary-help {
            margin: 0 0 14px;
            font-size: 13px;
            color: var(--mute);
        }

        #d .dictionary-reference {
            display: grid;
            place-items: center;
            position: relative;
            width: 100%;
            height: 185px;
            max-width: 100%;
            overflow: hidden;
            border-radius: 12px;
            background: var(--bg);
            border: 1px dashed var(--line);
        }

        #d .dictionary-reference img {
            display: block;
            position: static !important;
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            object-position: center;
            transform: none !important;
        }

        #d .dictionary-reference img[hidden],
        #d .dictionary-reference p[hidden] {
            display: none !important;
        }

        #d .dictionary-reference p {
            margin: 0;
            padding: 12px;
            text-align: center;
            font-size: 13px;
            color: var(--mute);
        }

        #d .dictionary-camera {
            width: 100%;
            aspect-ratio: 4 / 3;
            min-height: 180px;
            position: relative;
            overflow: hidden;
            background: var(--cam);
            border-radius: 12px;
        }

        #d .dictionary-camera video,
        #d .dictionary-camera canvas {
            display: block;
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            transform: none !important;
        }

        #d .dictionary-camera canvas {
            pointer-events: none;
            z-index: 1;
        }

        #d .dictionary-camera .tag {
            z-index: 2;
        }

        #d .dictionary-camera.ok {
            outline: 3px solid var(--ok);
            outline-offset: -3px;
        }

        #d .dictionary-feedback {
            font-size: 13px;
            line-height: 1.5;
            min-height: 40px;
            margin: 12px 0 9px;
            text-align: center;
            overflow-wrap: anywhere;
        }

        #d .dictionary-meter {
            height: 10px;
            border-radius: 999px;
            background: var(--line);
            overflow: hidden;
        }

        #d .dictionary-meter i {
            display: block;
            height: 100%;
            width: 0;
            background: var(--accent);
            transition: width .2s ease;
        }

        #d .dictionary-hint {
            text-align: center;
            font-size: 12px;
            color: var(--mute);
            margin: 10px 0 0;
        }

        #d .dictionary-controls {
            margin: 12px 0 0;
            display: flex;
            justify-content: center;
        }

        @media (max-width: 820px) {
            #d.on {
                grid-template-columns: 1fr;
            }

            #d .dictionary-camera {
                max-height: 360px;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            #d .dictionary-meter i {
                transition: none;
            }
        }
    `;

    document.head.appendChild(estilos);

    // ==========================================
    // CREAR INTERFAZ
    // ==========================================

    const ayuda = document.createElement("p");

    ayuda.className = "dictionary-help";

    ayuda.textContent =
        "Selecciona una letra para ver su seña y practicarla con tu mano.";

    cuadricula.parentElement.insertBefore(
        ayuda,
        cuadricula
    );

    // Fotografía

    const imagen = document.createElement("img");

    imagen.id = "dictionaryReferenceImage";
    imagen.alt = "Fotografía ASL de la letra A";
    imagen.hidden = true;

    const avisoImagen = document.createElement("p");

    avisoImagen.id = "dictionaryReferenceFallback";
    avisoImagen.textContent =
        "Cargando imagen de referencia...";

    cuadroReferencia.className =
        "dictionary-reference";

    cuadroReferencia.replaceChildren(
        imagen,
        avisoImagen
    );

    // Cámara

    const video = document.createElement("video");

    video.id = "dictionaryVideo";
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement("canvas");

    canvas.id = "dictionaryOverlay";

    const estadoCamara = document.createElement("span");

    estadoCamara.className = "tag";
    estadoCamara.textContent = "Cámara pendiente";

    const confianzaActual =
        document.createElement("span");

    confianzaActual.className = "tag fps";
    confianzaActual.id = "dictionaryConfidence";
    confianzaActual.textContent = "—";

    cuadroCamara.className =
        "cam dictionary-camera";

    cuadroCamara.replaceChildren(
        video,
        canvas,
        estadoCamara,
        confianzaActual
    );

    // Mensaje de reconocimiento

    const feedback = document.createElement("p");

    feedback.className = "dictionary-feedback";
    feedback.id = "dictionaryFeedback";

    feedback.setAttribute("role", "status");

    feedback.setAttribute(
        "aria-live",
        "polite"
    );

    // Barra de progreso

    const medidor = document.createElement("div");

    medidor.className = "dictionary-meter";

    medidor.setAttribute(
        "aria-label",
        "Confirmaciones de la seña"
    );

    const progreso = document.createElement("i");

    progreso.id = "dictionaryProgressFill";

    medidor.appendChild(progreso);

    // Instrucciones

    const pista = document.createElement("p");

    pista.className = "dictionary-hint";

    pista.textContent =
        "Necesitas 75 % de confianza y 4 lecturas consecutivas.";

    // Botón de reintento

    const controles = document.createElement("div");

    controles.className = "dictionary-controls";

    const reintentar = document.createElement("button");

    reintentar.type = "button";
    reintentar.className = "btn";
    reintentar.id = "dictionaryRetry";

    reintentar.textContent =
        "Reintentar cámara / modelo";

    controles.appendChild(reintentar);

    tarjetas[1].append(
        feedback,
        medidor,
        pista,
        controles
    );

    // ==========================================
    // VARIABLES DE RECONOCIMIENTO
    // ==========================================

    let seleccionada = "A";

    let ultimaLetra = "";
    let contador = 0;
    let validado = false;

    let detector = null;
    let modelo = null;
    let etiquetas = [];

    let detectorPromise = null;
    let modeloPromise = null;

    let streamPropio = null;
    let animacion = null;

    let ultimoFrame = -1;
    let ultimoTimestamp = -1;
    let ultimaPrediccion = 0;

    let inicioPromise = null;
    let generacion = 0;

    let conexiones = [];

    const activo = () =>
        seccion.classList.contains("on") &&
        document.visibilityState !== "hidden";

    // ==========================================
    // ACTUALIZAR MENSAJE
    // ==========================================

    function actualizarTexto(texto) {
        feedback.textContent = texto;
    }

    // ==========================================
    // REINICIAR COMPARACIÓN
    // ==========================================

    function reiniciarComparacion() {
        ultimaLetra = "";
        contador = 0;
        validado = false;

        progreso.style.width = "0%";

        confianzaActual.textContent = "—";

        cuadroCamara.classList.remove("ok");

        actualizarTexto(
            `Haz la letra ${seleccionada} frente a la cámara.`
        );
    }

    // ==========================================
    // SELECCIONAR LETRA
    // ==========================================

    function seleccionarLetra(letra) {
        letra = String(letra).trim().toUpperCase();

        if (!LETRAS.includes(letra)) {
            return;
        }

        seleccionada = letra;

        etiqueta.textContent = letra;

        reiniciarComparacion();

        // Marcar botón seleccionado

        cuadricula.querySelectorAll("button.key")
            .forEach(boton => {
                const elegida =
                    boton.dataset.letra === letra;

                boton.classList.toggle(
                    "on",
                    elegida
                );

                boton.setAttribute(
                    "aria-pressed",
                    String(elegida)
                );
            });

        // Cargar fotografía

        imagen.hidden = true;
        avisoImagen.hidden = false;

        avisoImagen.textContent =
            `Cargando referencia ${letra}...`;

        imagen.alt =
            `Fotografía de la seña ASL para ${letra}`;

        imagen.onload = () => {
            imagen.hidden = false;
            avisoImagen.hidden = true;
        };

        imagen.onerror = () => {
            imagen.hidden = true;
            avisoImagen.hidden = false;

            avisoImagen.textContent =
                `No se encontró ${letra}.png en frontend/referencias/`;
        };

        imagen.src =
            `${RUTA_IMAGENES}${letra}.png`;
    }

    // ==========================================
    // GENERAR BOTONES DEL ALFABETO
    // ==========================================

    cuadricula.replaceChildren();

    for (const letra of LETRAS) {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = "key";

        boton.dataset.letra = letra;
        boton.textContent = letra;

        boton.setAttribute(
            "aria-label",
            `Ver y practicar la letra ${letra}`
        );

        boton.addEventListener(
            "click",
            () => seleccionarLetra(letra)
        );

        cuadricula.appendChild(boton);
    }

    seleccionarLetra("A");

    // ==========================================
    // CARGAR MODELO TENSORFLOW.JS
    // ==========================================

    async function cargarModelo() {
        if (modelo) return;

        if (modeloPromise) {
            return modeloPromise;
        }

        modeloPromise = (async () => {
            const tf = window.tf;

            if (!tf) {
                throw new Error(
                    "TensorFlow.js no está cargado"
                );
            }

            await tf.ready();

            const [
                respuestaPesos,
                respuestaEtiquetas
            ] = await Promise.all([
                fetch(RUTA_PESOS),
                fetch(RUTA_ETIQUETAS)
            ]);

            if (
                !respuestaPesos.ok ||
                !respuestaEtiquetas.ok
            ) {
                throw new Error(
                    "No se encuentran los archivos del modelo de letras"
                );
            }

            const pesosJSON =
                await respuestaPesos.json();

            const nuevasEtiquetas =
                await respuestaEtiquetas.json();

            const formas = [
                [63, 128],
                [128],
                [128, 64],
                [64],
                [64, 24],
                [24]
            ];

            if (
                !Array.isArray(nuevasEtiquetas) ||
                nuevasEtiquetas.length !== 24 ||
                !Array.isArray(pesosJSON.weights) ||
                pesosJSON.weights.length !== 6
            ) {
                throw new Error(
                    "Modelo de letras incompatible"
                );
            }

            // Crear red neuronal

            const red = tf.sequential();

            const tensores = [];

            try {
                red.add(tf.layers.dense({
                    inputShape: [63],
                    units: 128,
                    activation: "relu"
                }));

                red.add(tf.layers.dropout({
                    rate: 0.20
                }));

                red.add(tf.layers.dense({
                    units: 64,
                    activation: "relu"
                }));

                red.add(tf.layers.dense({
                    units: 24,
                    activation: "softmax"
                }));

                // Cargar pesos

                pesosJSON.weights.forEach(
                    (peso, indice) => {
                        const forma = formas[indice];

                        const cantidad = forma.reduce(
                            (a, b) => a * b,
                            1
                        );

                        if (
                            JSON.stringify(peso.shape) !==
                                JSON.stringify(forma) ||
                            !Array.isArray(peso.values) ||
                            peso.values.length !== cantidad
                        ) {
                            throw new Error(
                                `Pesos incompatibles: tensor ${indice + 1}`
                            );
                        }

                        tensores.push(
                            tf.tensor(
                                peso.values,
                                forma,
                                "float32"
                            )
                        );
                    }
                );

                red.setWeights(tensores);

                modelo = red;

                etiquetas = nuevasEtiquetas.map(
                    x => String(x).toUpperCase()
                );

            } catch (error) {
                red.dispose();
                throw error;

            } finally {
                tensores.forEach(
                    t => t.dispose()
                );
            }

        })();

        try {
            await modeloPromise;

        } catch (error) {
            modeloPromise = null;
            throw error;
        }
    }

    // ==========================================
    // CARGAR DETECTOR MEDIAPIPE
    // ==========================================

    async function cargarDetector() {
        if (detector) return;

        if (detectorPromise) {
            return detectorPromise;
        }

        detectorPromise = (async () => {
            const {
                FilesetResolver,
                HandLandmarker
            } = await import(
                `${RUTA_MEDIAPIPE}/vision_bundle.mjs`
            );

            const vision =
                await FilesetResolver.forVisionTasks(
                    `${RUTA_MEDIAPIPE}/wasm`
                );

            detector =
                await HandLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: RUTA_DETECTOR,
                            delegate: "CPU"
                        },

                        runningMode: "VIDEO",
                        numHands: 1,

                        minHandDetectionConfidence: 0.4,
                        minHandPresenceConfidence: 0.4,
                        minTrackingConfidence: 0.4
                    }
                );

            conexiones =
                HandLandmarker.HAND_CONNECTIONS || [];

        })();

        try {
            await detectorPromise;

        } catch (error) {
            detectorPromise = null;
            throw error;
        }
    }

    // ==========================================
    // COMPARTIR CÁMARA EXISTENTE
    // ==========================================

    async function obtenerStreamCompartido() {
        const videoPrincipal = $("video");

        for (let intento = 0; intento < 20; intento++) {
            if (!activo()) {
                return null;
            }

            const existente =
                videoPrincipal?.srcObject;

            if (
                existente?.getVideoTracks?.().some(
                    track => track.readyState === "live"
                )
            ) {
                return existente;
            }

            await new Promise(
                resolve => setTimeout(resolve, 100)
            );
        }

        return null;
    }

    // ==========================================
    // INICIAR CÁMARA DEL DICCIONARIO
    // ==========================================

    async function iniciarDiccionario() {
        if (inicioPromise) {
            return inicioPromise;
        }

        const token = ++generacion;

        inicioPromise = (async () => {
            try {
                estadoCamara.textContent =
                    "Activando cámara...";

                let stream =
                    await obtenerStreamCompartido();

                if (
                    !activo() ||
                    token !== generacion
                ) {
                    return;
                }

                if (!stream) {
                    streamPropio =
                        await navigator.mediaDevices.getUserMedia({
                            video: {
                                facingMode: "user"
                            },
                            audio: false
                        });

                    stream = streamPropio;
                }

                if (
                    !activo() ||
                    token !== generacion
                ) {
                    return;
                }

                video.srcObject = stream;

                await video.play();

                estadoCamara.textContent =
                    "Preparando detector...";

                await Promise.all([
                    cargarDetector(),
                    cargarModelo()
                ]);

                if (
                    !activo() ||
                    token !== generacion
                ) {
                    return;
                }

                estadoCamara.textContent =
                    "Buscando manos...";

                ultimoFrame = -1;
                ultimoTimestamp = -1;

                if (animacion === null) {
                    animacion =
                        requestAnimationFrame(procesar);
                }

            } catch (error) {
                if (
                    !activo() ||
                    token !== generacion
                ) {
                    return;
                }

                console.error(
                    "Error en Diccionario:",
                    error
                );

                estadoCamara.textContent =
                    "No disponible";

                actualizarTexto(
                    `Error: ${error.message}. Pulsa «Reintentar cámara / modelo».`
                );

            } finally {
                inicioPromise = null;

                if (
                    activo() &&
                    token !== generacion &&
                    animacion === null
                ) {
                    queueMicrotask(
                        () => iniciarDiccionario()
                    );
                }
            }
        })();

        return inicioPromise;
    }

    // ==========================================
    // DETENER VISTA DEL DICCIONARIO
    // ==========================================

    function detenerDiccionario() {
        generacion++;

        if (animacion !== null) {
            cancelAnimationFrame(animacion);
            animacion = null;
        }

        video.pause();
        video.srcObject = null;

        // Solo cerrar cámara si fue abierta aquí

        if (streamPropio) {
            streamPropio.getTracks().forEach(
                track => track.stop()
            );

            streamPropio = null;
        }

        ultimoFrame = -1;

        ultimaLetra = "";
        contador = 0;

        estadoCamara.textContent =
            "Cámara en pausa";
    }

    // ==========================================
    // NORMALIZACIÓN DE MANO
    // ==========================================

    function normalizarMano(puntos) {
        if (!puntos || puntos.length !== 21) {
            return null;
        }

        const base = puntos[0];

        const escala = Math.max(
            ...puntos.map(p =>
                Math.hypot(
                    p.x - base.x,
                    p.y - base.y
                )
            )
        );

        if (
            !Number.isFinite(escala) ||
            escala < 0.001
        ) {
            return null;
        }

        const vector = puntos.flatMap(p => [
            (p.x - base.x) / escala,
            (p.y - base.y) / escala,
            (p.z - base.z) / escala
        ]);

        return (
            vector.length === 63 &&
            vector.every(Number.isFinite)
        ) ? vector : null;
    }

    // ==========================================
    // CLASIFICAR UNA LETRA
    // ==========================================

    function clasificar(puntos) {
        const vector = normalizarMano(puntos);

        if (!vector || !modelo) {
            return null;
        }

        const tf = window.tf;

        const probabilidades = tf.tidy(() => {
            const entrada = tf.tensor2d(
                [vector],
                [1, 63]
            );

            return Array.from(
                modelo.predict(entrada).dataSync()
            );
        });

        if (
            probabilidades.length !== etiquetas.length
        ) {
            return null;
        }

        const mayor = probabilidades.indexOf(
            Math.max(...probabilidades)
        );

        return {
            letra: etiquetas[mayor],
            confianza: probabilidades[mayor]
        };
    }

    // ==========================================
    // EVALUAR SEÑA REALIZADA
    // ==========================================

    function evaluarPrediccion({
        letra = null,
        confianza = 0,
        hayMano = true
    } = {}) {
        if (!activo()) return;

        if (!hayMano || !letra) {
            contador = 0;
            ultimaLetra = "";

            if (!validado) {
                progreso.style.width = "0%";
            }

            confianzaActual.textContent =
                "Sin mano";

            if (!validado) {
                actualizarTexto(
                    "Coloca tu mano frente a la cámara."
                );
            }

            return;
        }

        const detectada =
            String(letra).toUpperCase();

        const valor = Number(confianza);

        const porcentaje = Math.round(
            valor * 100
        );

        confianzaActual.textContent =
            `${detectada} · ${porcentaje}%`;

        if (validado) return;

        // Letra incorrecta o confianza baja

        if (
            detectada !== seleccionada ||
            !Number.isFinite(valor) ||
            valor < CONFIANZA_MINIMA
        ) {
            contador = 0;
            ultimaLetra = "";

            progreso.style.width = "0%";

            actualizarTexto(
                detectada === seleccionada
                    ? `La letra ${seleccionada} necesita al menos 75 % de confianza.`
                    : `Detecté ${detectada}. Intenta hacer la letra ${seleccionada}.`
            );

            return;
        }

        // Confirmaciones consecutivas

        contador =
            ultimaLetra === detectada
                ? contador + 1
                : 1;

        ultimaLetra = detectada;

        progreso.style.width =
            `${contador / CONFIRMACIONES_NECESARIAS * 100}%`;

        actualizarTexto(
            `Mantén ${seleccionada} estable (${contador}/${CONFIRMACIONES_NECESARIAS}).`
        );

        // Seña correcta

        if (contador >= CONFIRMACIONES_NECESARIAS) {
            validado = true;

            cuadroCamara.classList.add("ok");

            actualizarTexto(
                `¡Correcto! Reconocí la letra ${seleccionada}. Selecciona otra para continuar.`
            );
        }
    }

    // ==========================================
    // DIBUJAR PUNTOS DE MEDIAPIPE
    // ==========================================

    function dibujarPuntos(manos) {
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        for (const mano of manos) {
            ctx.strokeStyle = "#3ddba8";
            ctx.lineWidth = 3;

            for (const union of conexiones) {
                const a = mano[union.start];
                const b = mano[union.end];

                if (!a || !b) continue;

                ctx.beginPath();

                ctx.moveTo(
                    a.x * canvas.width,
                    a.y * canvas.height
                );

                ctx.lineTo(
                    b.x * canvas.width,
                    b.y * canvas.height
                );

                ctx.stroke();
            }

            ctx.fillStyle = "white";

            for (const punto of mano) {
                ctx.beginPath();

                ctx.arc(
                    punto.x * canvas.width,
                    punto.y * canvas.height,
                    4,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }
        }
    }

    // ==========================================
    // PROCESAR LA CÁMARA EN TIEMPO REAL
    // ==========================================

    function procesar() {
        animacion = null;

        if (!activo()) return;

        animacion = requestAnimationFrame(procesar);

        if (
            !detector ||
            !modelo ||
            video.paused ||
            video.readyState < 2
        ) {
            return;
        }

        if (video.currentTime === ultimoFrame) {
            return;
        }

        ultimoFrame = video.currentTime;

        const timestamp = Math.max(
            performance.now(),
            ultimoTimestamp + 1
        );

        ultimoTimestamp = timestamp;

        try {
            const resultado =
                detector.detectForVideo(
                    video,
                    timestamp
                );

            const manos =
                resultado.landmarks || [];

            if (
                canvas.width !== video.videoWidth ||
                canvas.height !== video.videoHeight
            ) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            dibujarPuntos(manos);

            estadoCamara.textContent =
                manos.length
                    ? "Mano detectada"
                    : "Buscando manos...";

            if (
                timestamp - ultimaPrediccion >=
                INTERVALO_PREDICCION
            ) {
                ultimaPrediccion = timestamp;

                const resultadoLetra =
                    manos.length
                        ? clasificar(manos[0])
                        : null;

                evaluarPrediccion(
                    resultadoLetra
                        ? {
                            ...resultadoLetra,
                            hayMano: true
                        }
                        : {
                            hayMano: false
                        }
                );
            }

        } catch (error) {
            console.error(
                "Diccionario: error en la detección:",
                error
            );

            estadoCamara.textContent =
                "Error de detección";

            actualizarTexto(
                `No se pudo detectar: ${error.message}`
            );

            detenerDiccionario();
        }
    }

    // ==========================================
    // EVENTO COMPARTIDO DE PREDICCIONES
    // ==========================================

    window.addEventListener(
        "senalive:letra-diccionario",
        evento => {
            evaluarPrediccion(
                evento.detail || {}
            );
        }
    );

    // ==========================================
    // BOTÓN DE REINTENTO
    // ==========================================

    reintentar.addEventListener(
        "click",
        () => {
            detenerDiccionario();

            if (activo()) {
                iniciarDiccionario();
            }
        }
    );

    // ==========================================
    // NAVEGACIÓN ENTRE MÓDULOS
    // ==========================================

    const observador = new MutationObserver(
        () => {
            if (activo()) {
                iniciarDiccionario();
            } else {
                detenerDiccionario();
            }
        }
    );

    observador.observe(
        seccion,
        {
            attributes: true,
            attributeFilter: ["class"]
        }
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (activo()) {
                iniciarDiccionario();
            } else {
                detenerDiccionario();
            }
        }
    );

    // ==========================================
    // LIBERAR RECURSOS AL SALIR
    // ==========================================

    window.addEventListener(
        "pagehide",
        () => {
            detenerDiccionario();

            observador.disconnect();

            if (detector) {
                detector.close();
                detector = null;
            }

            if (modelo) {
                modelo.dispose();
                modelo = null;
            }
        }
    );

    // ==========================================
    // INICIAR SI EL DICCIONARIO ESTÁ ACTIVO
    // ==========================================

    if (activo()) {
        iniciarDiccionario();
    }

})();
