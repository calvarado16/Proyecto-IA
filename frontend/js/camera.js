
/* ==========================================
   SEÑALIVE - CAMERA.JS
   CÁMARA Y MEDIAPIPE
   TRADUCTOR, APRENDER, JUEGO, ENTRENAR
========================================== */

const ESPEJO_HORIZONTAL = false;

// ==========================================
// ELEMENTOS DE LAS CÁMARAS
// ==========================================

const vistas = {
    t: {
        video: document.getElementById("video"),
        canvas: document.getElementById("overlay"),
        estado: document.getElementById("cameraStatus")
    },

    a: {
        video: document.getElementById("learnVideo"),
        canvas: document.getElementById("learnOverlay"),
        estado: document.getElementById("learnCameraStatus")
    },

    j: {
        video: document.getElementById("gameVideo"),
        canvas: document.getElementById("gameOverlay"),
        estado: document.getElementById("gameCameraStatus")
    },

    e: {
        video: document.getElementById("trainVideo"),
        canvas: document.getElementById("trainOverlay"),
        estado: document.getElementById("trainCameraStatus")
    }
};

const estadoGeneral =
    document.getElementById("connectionStatus");

const BASE_MEDIAPIPE =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";

const MODELO_MANOS =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// ==========================================
// VARIABLES
// ==========================================

let stream = null;
let detector = null;
let conexiones = [];

let ultimoVideo = null;
let ultimoTiempo = -1;
let ultimoTimestamp = -1;

let animacion = null;
let iniciando = false;
let estadoAnterior = "";

// ==========================================
// MOSTRAR ESTADO
// ==========================================

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

// ==========================================
// VERIFICAR ELEMENTOS
// ==========================================

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

// ==========================================
// IDENTIFICAR MODO ACTIVO
// ==========================================

function obtenerModoActivo() {
    if (document.getElementById("e")
        ?.classList.contains("on")) {
        return "e";
    }

    if (document.getElementById("t")
        ?.classList.contains("on")) {
        return "t";
    }

    if (document.getElementById("a")
        ?.classList.contains("on")) {
        return "a";
    }

    if (document.getElementById("j")
        ?.classList.contains("on")) {
        return "j";
    }

    return null;
}

// ==========================================
// ORIENTACIÓN VISUAL
// ==========================================

function aplicarOrientacionVisual(vista) {
    vista.video.style.transform = "none";
    vista.canvas.style.transform = "none";

    vista.video.style.transformOrigin = "center";
    vista.canvas.style.transformOrigin = "center";
}

function obtenerFrameDeteccion(video) {
    return video;
}

// ==========================================
// ACTIVAR CÁMARA SEGÚN MÓDULO
// ==========================================

async function activarVista() {
    if (!stream) return;

    const modo = obtenerModoActivo();

    for (const [nombre, vista] of Object.entries(vistas)) {
        if (nombre !== modo) {
            vista.video.pause();

            const ctx = vista.canvas.getContext("2d");

            if (ctx) {
                ctx.clearRect(
                    0, 0,
                    vista.canvas.width,
                    vista.canvas.height
                );
            }
        }
    }

    if (!modo) return;

    const vista = vistas[modo];

    aplicarOrientacionVisual(vista);

    if (vista.video.srcObject !== stream) {
        vista.video.srcObject = stream;
    }

    await vista.video.play();

    if (
        vista.video.videoWidth > 0 &&
        vista.video.videoHeight > 0
    ) {
        vista.canvas.width = vista.video.videoWidth;
        vista.canvas.height = vista.video.videoHeight;
    }

    ultimoVideo = null;
    ultimoTiempo = -1;
}

// ==========================================
// INICIAR MEDIAPIPE
// ==========================================

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
                "Abre SeñaLive desde localhost o HTTPS"
            );
        }

        if (!stream) {
            mostrarEstado("Solicitando cámara...");

            stream =
                await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: "user"
                    },
                    audio: false
                });

            for (const vista of Object.values(vistas)) {
                vista.video.srcObject = stream;
                aplicarOrientacionVisual(vista);
            }
        }

        await activarVista();

        mostrarEstado("Cargando MediaPipe...");

        const {
            FilesetResolver,
            HandLandmarker
        } = await import(
            `${BASE_MEDIAPIPE}/vision_bundle.mjs`
        );

        const vision =
            await FilesetResolver.forVisionTasks(
                `${BASE_MEDIAPIPE}/wasm`
            );

        if (!detector) {
            detector =
                await HandLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: MODELO_MANOS,
                            delegate: "CPU"
                        },

                        runningMode: "VIDEO",
                        numHands: 2,

                        minHandDetectionConfidence: 0.4,
                        minHandPresenceConfidence: 0.4,
                        minTrackingConfidence: 0.4
                    }
                );
        }

        conexiones = HandLandmarker.HAND_CONNECTIONS;

        mostrarEstado("Buscando manos...");

        console.log("MediaPipe cargado correctamente");
        console.log("Cámara sin inversión horizontal");

        if (animacion === null) {
            animacion = requestAnimationFrame(procesarVideo);
        }

    } catch (error) {
        console.error("ERROR AL INICIAR:", error);

        mostrarEstado("Error: " + error.message);

    } finally {
        iniciando = false;
    }
}

// ==========================================
// PROCESAMIENTO DE VIDEO
// ==========================================

function procesarVideo() {
    animacion = requestAnimationFrame(procesarVideo);

    if (!detector) return;

    const modo = obtenerModoActivo();

    if (!modo) return;

    const vista = vistas[modo];
    const video = vista.video;

    if (
        video.paused ||
        video.readyState <
            HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
        return;
    }

    if (ultimoVideo !== video) {
        ultimoVideo = video;
        ultimoTiempo = -1;
    }

    if (video.currentTime === ultimoTiempo) {
        return;
    }

    ultimoTiempo = video.currentTime;

    const timestamp = Math.max(
        performance.now(),
        ultimoTimestamp + 1
    );

    ultimoTimestamp = timestamp;

    try {
        const fuenteDeteccion =
            obtenerFrameDeteccion(video);

        const resultado = detector.detectForVideo(
            fuenteDeteccion,
            timestamp
        );

        const manos = resultado.landmarks ?? [];

        const handedness =
            resultado.handedness ??
            resultado.handednesses ??
            [];

        // Ajustar tamaño de canvas
        if (
            vista.canvas.width !== video.videoWidth ||
            vista.canvas.height !== video.videoHeight
        ) {
            vista.canvas.width = video.videoWidth;
            vista.canvas.height = video.videoHeight;
        }

        dibujarPuntos(vista.canvas, manos);

        if (manos.length === 2) {
            mostrarEstado("2 manos detectadas");

        } else if (manos.length === 1) {
            mostrarEstado("1 mano detectada");

        } else {
            mostrarEstado("Buscando manos...");
        }

        // Enviar landmarks a los módulos
        window.dispatchEvent(
            new CustomEvent(
                "senalive:landmarks",
                {
                    detail: {
                        modo: modo,
                        landmarks: manos[0] ?? null,
                        manos: manos,
                        handedness: handedness,
                        espejo: ESPEJO_HORIZONTAL,
                        timestamp: timestamp
                    }
                }
            )
        );

    } catch (error) {
        console.error(
            "ERROR DETECTANDO MANOS:",
            error
        );

        mostrarEstado("Error en la detección");

        if (detector) {
            detector.close();
            detector = null;
        }
    }
}

// ==========================================
// DIBUJAR LOS 21 PUNTOS DE LA MANO
// ==========================================

function dibujarPuntos(canvas, manos) {
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(
        0, 0,
        canvas.width,
        canvas.height
    );

    const colores = [
        "#3ddba8",
        "#00bfff"
    ];

    manos.forEach((puntos, indice) => {
        const color = colores[indice % colores.length];

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        // Conexiones de los dedos
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

        // Puntos de las manos
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

// ==========================================
// NAVEGACIÓN ENTRE MÓDULOS
// ==========================================

document.querySelectorAll("nav button[data-m]")
    .forEach(boton => {
        boton.addEventListener("click", () => {
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

// ==========================================
// LIBERAR RECURSOS
// ==========================================

window.addEventListener("pagehide", () => {
    if (animacion !== null) {
        cancelAnimationFrame(animacion);
        animacion = null;
    }

    if (stream) {
        stream.getTracks().forEach(
            track => track.stop()
        );
        stream = null;
    }

    if (detector) {
        detector.close();
        detector = null;
    }
});

// ==========================================
// INICIAR
// ==========================================

iniciar();
