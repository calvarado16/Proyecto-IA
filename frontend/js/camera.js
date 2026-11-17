
// ========================================
// SEÑALIVE - CAMERA.JS
// Cámara compartida con MediaPipe
// ========================================

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

let stream = null;
let detector = null;
let conexiones = [];

let ultimoVideo = null;
let ultimoTiempo = -1;


// ========================================
// MOSTRAR ESTADOS
// ========================================

function mostrarEstado(mensaje) {

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
// VERIFICAR ELEMENTOS DEL HTML
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

    if (document.getElementById("e")
        .classList.contains("on")) {
        return "e";
    }

    if (document.getElementById("t")
        .classList.contains("on")) {
        return "t";
    }

    return null;
}


// ========================================
// ACTIVAR VIDEO DEL MÓDULO
// ========================================

async function activarVista() {

    if (!stream) return;

    const modo = obtenerModoActivo();

    // Pausar los videos que no están activos
    for (const [nombre, vista] of Object.entries(vistas)) {

        if (nombre !== modo) {
            vista.video.pause();
        }
    }

    if (!modo) return;

    const vista = vistas[modo];

    // Reproducir la cámara
    await vista.video.play();

    // Ajustar canvas al tamaño real del video
    vista.canvas.width = vista.video.videoWidth;
    vista.canvas.height = vista.video.videoHeight;

    // Reiniciar referencia del fotograma
    ultimoVideo = null;
    ultimoTiempo = -1;
}


// ========================================
// INICIAR CÁMARA
// ========================================

async function iniciar() {

    try {

        verificarElementos();

        mostrarEstado("Solicitando cámara...");

        // Solicitar acceso a la webcam
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        // Compartir la cámara entre módulos
        for (const vista of Object.values(vistas)) {
            vista.video.srcObject = stream;
        }

        // Activar el módulo actual
        await activarVista();

        mostrarEstado("Cámara activa. Cargando MediaPipe...");

        console.log("Cámara iniciada correctamente");

    } catch (error) {

        console.error("ERROR DE CÁMARA O HTML:", error);

        mostrarEstado(
            "Error de inicio: " + error.message
        );

        return;
    }


    // ====================================
    // CARGAR MEDIAPIPE
    // ====================================

    try {

        const {
            FilesetResolver,
            HandLandmarker
        } = await import(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs"
        );

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );

        // Crear detector de manos
        detector = await HandLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
                },

                runningMode: "VIDEO",
                numHands: 1
            }
        );

        conexiones = HandLandmarker.HAND_CONNECTIONS;

        mostrarEstado("Buscando mano...");

        console.log("MediaPipe listo");

        requestAnimationFrame(procesarVideo);

    } catch (error) {

        console.error("ERROR DE MEDIAPIPE:", error);

        mostrarEstado(
            "Cámara activa, pero falló MediaPipe"
        );
    }
}


// ========================================
// DETECTAR MANOS
// ========================================

function procesarVideo() {

    requestAnimationFrame(procesarVideo);

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

    // Detectar cambio de vista
    if (ultimoVideo !== video) {
        ultimoVideo = video;
        ultimoTiempo = -1;
    }

    // Evitar analizar dos veces el mismo fotograma
    if (video.currentTime === ultimoTiempo) {
        return;
    }

    ultimoTiempo = video.currentTime;

    let resultado;

    try {

        resultado = detector.detectForVideo(
            video,
            performance.now()
        );

    } catch (error) {

        console.error("Error de detección:", error);

        mostrarEstado("Error detectando la mano");

        detector = null;

        return;
    }

    const manos = resultado.landmarks ?? [];

    // Dibujar sobre el video
    dibujarPuntos(vista.canvas, manos);

    mostrarEstado(
        manos.length
            ? "Mano detectada"
            : "Buscando mano..."
    );

    // Enviar las coordenadas a dataset.js
    window.dispatchEvent(
        new CustomEvent("senalive:landmarks", {
            detail: {
                landmarks: manos[0] ?? null
            }
        })
    );
}


// ========================================
// DIBUJAR LOS 21 PUNTOS
// ========================================

function dibujarPuntos(canvas, manos) {

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    for (const puntos of manos) {

        // Dibujar conexiones
        ctx.strokeStyle = "#3ddba8";
        ctx.lineWidth = 3;

        for (const conexion of conexiones) {

            const a = puntos[conexion.start];
            const b = puntos[conexion.end];

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

        // Dibujar puntos
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
    }
}


// ========================================
// CAMBIAR ENTRE TRADUCTOR Y ENTRENAR
// ========================================

document
    .querySelectorAll("nav button[data-m]")
    .forEach(boton => {

        boton.addEventListener("click", async () => {

            try {

                await activarVista();

            } catch (error) {

                console.error(
                    "Error cambiando de módulo:",
                    error
                );

                mostrarEstado(
                    "Error al activar el video"
                );
            }
        });
    });


// ========================================
// INICIAR APLICACIÓN
// ========================================

iniciar();
