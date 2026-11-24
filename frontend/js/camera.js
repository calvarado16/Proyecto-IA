
// ========================================
// SEÑALIVE - CAMERA.JS
// DETECCIÓN DE HASTA DOS MANOS
// ========================================

// Elementos de las dos cámaras
const vistas = {
    t: {
        video: document.getElementById("video"),
        canvas: document.getElementById("overlay"),
        estado: document.getElementById("cameraStatus")
    },
    e: {
        video: document.getElementById("trainVideo"),
        canvas: document.getElementById("trainOverlay"),
        estado: document.getElementById("trainCameraStatus")
    }
};

const estadoGeneral =
    document.getElementById("connectionStatus");

// Utilizar la misma versión para JS y WASM
const BASE_MEDIAPIPE =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";

const MODELO =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Variables globales del módulo
let stream = null;
let detector = null;
let conexiones = [];

let ultimoVideo = null;
let ultimoTiempo = -1;
let ultimoTimestamp = -1;

let animacion = null;
let iniciando = false;
let estadoAnterior = "";

// ========================================
// MOSTRAR ESTADO
// ========================================

function mostrarEstado(mensaje) {

    if (mensaje === estadoAnterior) return;

    estadoAnterior = mensaje;

    for (const vista of Object.values(vistas)) {

        if (vista.estado) {
            vista.estado.textContent = mensaje;
        }
    }

    if (estadoGeneral) {
        estadoGeneral.textContent = mensaje;
    }
}

// ========================================
// VERIFICAR ELEMENTOS HTML
// ========================================

function verificarElementos() {

    for (const [modo, vista] of Object.entries(vistas)) {

        for (const [nombre, elemento] of Object.entries(vista)) {

            if (!elemento) {
                throw new Error(
                    `Falta ${nombre} en el módulo ${modo}`
                );
            }
        }
    }
}

// ========================================
// IDENTIFICAR MÓDULO ACTIVO
// ========================================

function obtenerModoActivo() {

    if (
        document.getElementById("e")
            ?.classList.contains("on")
    ) {
        return "e";
    }

    if (
        document.getElementById("t")
            ?.classList.contains("on")
    ) {
        return "t";
    }

    return null;
}

// ========================================
// ACTIVAR LA VISTA ACTUAL
// ========================================

async function activarVista() {

    if (!stream) return;

    const modo = obtenerModoActivo();

    // Pausar las vistas que no estén activas
    for (const [nombre, vista] of Object.entries(vistas)) {

        if (nombre !== modo) {

            vista.video.pause();

            const ctx = vista.canvas.getContext("2d");

            ctx?.clearRect(
                0,
                0,
                vista.canvas.width,
                vista.canvas.height
            );
        }
    }

    if (!modo) return;

    const vista = vistas[modo];

    if (vista.video.srcObject !== stream) {
        vista.video.srcObject = stream;
    }

    // Reproducir video
    await vista.video.play();

    // Ajustar tamaño del canvas
    if (vista.video.videoWidth > 0) {

        vista.canvas.width =
            vista.video.videoWidth;

        vista.canvas.height =
            vista.video.videoHeight;
    }

    // Reiniciar control de fotogramas
    ultimoVideo = null;
    ultimoTiempo = -1;
}

// ========================================
// INICIAR CÁMARA Y MEDIAPIPE
// ========================================

async function iniciar() {

    if (iniciando) return;

    if (stream && detector) {
        await activarVista();
        return;
    }

    iniciando = true;

    try {

        verificarElementos();

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Abre la página desde localhost o HTTPS."
            );
        }

        // Solicitar cámara una sola vez
        if (!stream) {

            mostrarEstado("Solicitando cámara...");

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                },
                audio: false
            });

            // Compartir cámara entre módulos
            for (const vista of Object.values(vistas)) {
                vista.video.srcObject = stream;
            }
        }

        await activarVista();

        mostrarEstado("Cargando MediaPipe...");

        // Importar MediaPipe
        const {
            FilesetResolver,
            HandLandmarker
        } = await import(
            `${BASE_MEDIAPIPE}/vision_bundle.mjs`
        );

        // Cargar archivos WASM
        const vision =
            await FilesetResolver.forVisionTasks(
                `${BASE_MEDIAPIPE}/wasm`
            );

        // Crear detector
        if (!detector) {

            detector = await HandLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {
                        modelAssetPath: MODELO,
                        delegate: "CPU"
                    },

                    runningMode: "VIDEO",

                    // Hasta dos manos
                    numHands: 2,

                    // Umbrales de detección
                    minHandDetectionConfidence: 0.4,
                    minHandPresenceConfidence: 0.4,
                    minTrackingConfidence: 0.4
                }
            );
        }

        // Obtener conexiones de los dedos
        conexiones = HandLandmarker.HAND_CONNECTIONS;

        mostrarEstado("Buscando manos...");

        console.log("MediaPipe cargado correctamente");

        // Iniciar procesamiento una sola vez
        if (animacion === null) {
            animacion = requestAnimationFrame(procesarVideo);
        }

    } catch (error) {

        console.error("ERROR AL INICIAR:", error);

        mostrarEstado(
            "Error: " + error.message
        );

    } finally {
        iniciando = false;
    }
}

// ========================================
// DETECTAR AMBAS MANOS
// ========================================

function procesarVideo() {

    animacion = requestAnimationFrame(procesarVideo);

    if (!detector) return;

    const modo = obtenerModoActivo();

    if (!modo) return;

    const vista = vistas[modo];
    const video = vista.video;

    if (
        video.paused ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
        return;
    }

    // Detectar cambio entre Traductor y Entrenar
    if (ultimoVideo !== video) {

        ultimoVideo = video;
        ultimoTiempo = -1;
    }

    // No procesar el mismo fotograma dos veces
    if (video.currentTime === ultimoTiempo) {
        return;
    }

    ultimoTiempo = video.currentTime;

    // Mantener timestamps crecientes
    const timestamp = Math.max(
        performance.now(),
        ultimoTimestamp + 1
    );

    ultimoTimestamp = timestamp;

    try {

        // Ejecutar detección
        const resultado = detector.detectForVideo(
            video,
            timestamp
        );

        // Obtener todas las manos
        const manos = resultado.landmarks ?? [];

        // Obtener identificación de las manos
        const handedness =
            resultado.handedness ??
            resultado.handednesses ??
            [];

        // Ajustar canvas al video
        if (
            vista.canvas.width !== video.videoWidth ||
            vista.canvas.height !== video.videoHeight
        ) {

            vista.canvas.width = video.videoWidth;
            vista.canvas.height = video.videoHeight;
        }

        // Dibujar ambas manos
        dibujarPuntos(vista.canvas, manos);

        // Mostrar cantidad detectada
        if (manos.length === 2) {

            mostrarEstado("2 manos detectadas");

        } else if (manos.length === 1) {

            mostrarEstado("1 mano detectada");

        } else {

            mostrarEstado("Buscando manos...");
        }

        // Enviar las manos al dataset
        window.dispatchEvent(
            new CustomEvent("senalive:landmarks", {
                detail: {
                    landmarks: manos[0] ?? null,
                    manos: manos,
                    handedness: handedness,
                    timestamp: timestamp,
                    modo: modo
                }
            })
        );

    } catch (error) {

        console.error(
            "ERROR DETECTANDO MANOS:",
            error
        );

        mostrarEstado("Error en la detección");

        detector = null;
    }
}

// ========================================
// DIBUJAR LOS PUNTOS DE AMBAS MANOS
// ========================================

function dibujarPuntos(canvas, manos) {

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Limpiar dibujo anterior
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Colores para distinguir las manos
    const colores = [
        "#3ddba8", // Verde
        "#00bfff"  // Azul
    ];

    manos.forEach((puntos, indice) => {

        const color = colores[indice % colores.length];

        // Dibujar conexiones de los dedos
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        for (const conexion of conexiones) {

            const a = puntos[conexion.start];
            const b = puntos[conexion.end];

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

        // Dibujar los 21 puntos
        ctx.fillStyle = "white";

        for (const punto of puntos) {

            ctx.beginPath();

            ctx.arc(
                punto.x * canvas.width,
                punto.y * canvas.height,
                5,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }
    });
}

// ========================================
// CAMBIAR ENTRE MÓDULOS
// ========================================

document.querySelectorAll("nav button[data-m]")
    .forEach(boton => {

        boton.addEventListener("click", () => {

            // app.js debe actualizar primero la vista
            setTimeout(() => {

                activarVista().catch(error => {

                    console.error(
                        "Error cambiando de módulo:",
                        error
                    );

                    mostrarEstado(
                        "Error al activar la cámara"
                    );
                });

            }, 0);
        });
    });

// ========================================
// LIBERAR RECURSOS
// ========================================

window.addEventListener("pagehide", () => {

    if (animacion !== null) {
        cancelAnimationFrame(animacion);
        animacion = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    if (detector) {
        detector.close();
        detector = null;
    }
});

// ========================================
// INICIAR SEÑALIVE
// ========================================

iniciar();
