
/*
========================================
SEÑALIVE - DIAGNÓSTICO DEL PULGAR
Para letras M, N y T
========================================
*/

const camara = document.getElementById("cam1");
const video = document.getElementById("video");

// Crear una capa independiente para no
// interferir con el dibujo de MediaPipe.
const capaPulgar = document.createElement("canvas");

capaPulgar.id = "thumbDebugOverlay";

capaPulgar.style.position = "absolute";
capaPulgar.style.pointerEvents = "none";
capaPulgar.style.zIndex = "5";

camara.style.position = "relative";
camara.appendChild(capaPulgar);

const ctx = capaPulgar.getContext("2d");

// Crear indicador de diagnóstico
const indicador = document.createElement("div");

indicador.style.position = "absolute";
indicador.style.bottom = "12px";
indicador.style.left = "12px";
indicador.style.zIndex = "6";
indicador.style.padding = "8px 12px";
indicador.style.background = "rgba(0,0,0,.8)";
indicador.style.color = "#fff";
indicador.style.borderRadius = "8px";
indicador.style.fontSize = "12px";
indicador.style.pointerEvents = "none";

indicador.textContent =
    "Diagnóstico: esperando puntos de la mano";

camara.appendChild(indicador);

// Ajustar el canvas a la cámara
function ajustarCanvas() {

    const rectVideo = video.getBoundingClientRect();
    const rectCamara = camara.getBoundingClientRect();

    const ancho = rectVideo.width;
    const alto = rectVideo.height;

    capaPulgar.style.left =
        (rectVideo.left - rectCamara.left) + "px";

    capaPulgar.style.top =
        (rectVideo.top - rectCamara.top) + "px";

    capaPulgar.style.width = ancho + "px";
    capaPulgar.style.height = alto + "px";

    const escala = window.devicePixelRatio || 1;

    const anchoReal = Math.round(ancho * escala);
    const altoReal = Math.round(alto * escala);

    if (
        capaPulgar.width !== anchoReal ||
        capaPulgar.height !== altoReal
    ) {
        capaPulgar.width = anchoReal;
        capaPulgar.height = altoReal;
    }

    ctx.setTransform(escala, 0, 0, escala, 0, 0);

    return { ancho, alto };
}

// Convertir coordenadas normalizadas a
// posiciones de la imagen de la cámara.
function posicionEnPantalla(punto, ancho, alto) {

    const estilo = getComputedStyle(video);

    const transformacion = estilo.transform;

    // Detectar si la vista está reflejada
    const espejoCSS =
        transformacion.startsWith("matrix(") &&
        Number(transformacion.slice(7).split(",")[0]) < 0;

    let x = 1 - punto.x;

    const anchoVideo = video.videoWidth || ancho;
    const altoVideo = video.videoHeight || alto;

    const ajuste = estilo.objectFit;

    if (ajuste === "cover" || ajuste === "contain") {

        const escala = ajuste === "cover"
            ? Math.max(
                ancho / anchoVideo,
                alto / altoVideo
            )
            : Math.min(
                ancho / anchoVideo,
                alto / altoVideo
            );

        const anchoImagen = anchoVideo * escala;
        const altoImagen = altoVideo * escala;

        return {
            x: x * anchoImagen +
               (ancho - anchoImagen) / 2,
            y: punto.y * altoImagen +
               (alto - altoImagen) / 2
        };
    }

    return {
        x: x * ancho,
        y: punto.y * alto
    };
}

// Dibujar los puntos 1, 2, 3 y 4
function dibujarPulgar(puntos) {

    const { ancho, alto } = ajustarCanvas();

    ctx.clearRect(0, 0, ancho, alto);

    if (!puntos || puntos.length !== 21) {

        indicador.textContent =
            "Diagnóstico: sin mano detectada";

        return;
    }

    const coordenadas = puntos.map(p =>
        posicionEnPantalla(p, ancho, alto)
    );

    // Dibujar la conexión del pulgar
    ctx.beginPath();

    [0, 1, 2, 3, 4].forEach((indice, i) => {

        const p = coordenadas[indice];

        if (i === 0) {
            ctx.moveTo(p.x, p.y);
        } else {
            ctx.lineTo(p.x, p.y);
        }
    });

    ctx.strokeStyle = "#ffad33";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Dibujar puntos del pulgar
    [1, 2, 3, 4].forEach(indice => {

        const p = coordenadas[indice];

        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);

        ctx.fillStyle = "#ffad33";
        ctx.fill();

        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Número del punto
        ctx.font = "bold 15px Arial";
        ctx.fillStyle = "#ffffff";

        ctx.fillText(
            String(indice),
            p.x + 10,
            p.y - 10
        );
    });

    // Mostrar punto de referencia: muñeca
    const muneca = coordenadas[0];

    ctx.beginPath();
    ctx.arc(
        muneca.x,
        muneca.y,
        5,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#38d9ff";
    ctx.fill();

    // Información de la punta del pulgar
    const punta = puntos[4];

    indicador.textContent =
        "Pulgar (punto 4) | " +
        "X: " + punta.x.toFixed(2) +
        " Y: " + punta.y.toFixed(2) +
        " Z: " + punta.z.toFixed(2);
}

// Recibir datos directamente desde camera.js
window.addEventListener(
    "senalive:landmarks",
    evento => {

        if (evento.detail?.modo !== "t") {
            return;
        }

        const puntos =
            evento.detail.landmarks ??
            evento.detail.manos?.[0] ??
            null;

        dibujarPulgar(puntos);
    }
);

console.log(
    "Diagnóstico del pulgar activado"
);
