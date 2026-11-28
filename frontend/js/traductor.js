
/* ==========================================
   SEÑALIVE - TRADUCTOR CON TENSORFLOW.JS
   24 LETRAS ESTÁTICAS + J Y Z
   COMPATIBLE CON APRENDER Y JUEGO
========================================== */

const tf = window.tf;

// ==========================================
// ELEMENTOS DE LA INTERFAZ
// ==========================================

const prediccion =
    document.getElementById("prediction");

const confianza =
    document.getElementById("confidence");

const barra =
    document.querySelector(".confidence-fill");

const estadoModelo =
    document.getElementById("modelStatus");

// ==========================================
// VARIABLES
// ==========================================

let modeloJS = null;
let etiquetas = [];

let ultimoEnvio = 0;
let ultimoDiagnostico = 0;

let modoJZActivo = false;
let bloqueoDinamicoHasta = 0;

// ==========================================
// CONFIGURACIÓN
// ==========================================

const UMBRAL_CONFIANZA = 0.50;
const INTERVALO_PREDICCION = 200;
const INTERVALO_DIAGNOSTICO = 1000;
const DURACION_LETRA_DINAMICA = 1800;

// ==========================================
// COMPROBAR MÓDULO TRADUCTOR
// ==========================================

function estaEnTraductor() {
    return document.getElementById("t")
        ?.classList.contains("on") === true;
}

// ==========================================
// MOSTRAR ESTADO DEL MODELO
// ==========================================

function mostrarEstado(mensaje) {
    console.log("[SeñaLive]", mensaje);

    if (estadoModelo) {
        estadoModelo.textContent =
            window.senaliveModeloPalabrasCargado
                ? "TensorFlow.js activo: 26 letras + 10 palabras ASL"
                : mensaje;
    }
}

// ==========================================
// LIMPIAR PREDICCIÓN
// ==========================================

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

// ==========================================
// INDICADOR DE MOVIMIENTO
// ==========================================

function mostrarModoMovimiento() {
    if (prediccion) {
        prediccion.textContent = "…";
    }

    if (confianza) {
        confianza.textContent = "Detectando movimiento";
    }

    if (barra) {
        barra.style.width = "0%";
    }
}

// ==========================================
// CARGAR MODELO DE 24 LETRAS
// ==========================================

async function cargarModelo() {
    let red = null;

    try {
        mostrarEstado("Cargando TensorFlow.js...");

        if (!tf) {
            throw new Error(
                "TensorFlow.js no está disponible"
            );
        }

        await tf.ready();

        mostrarEstado("Cargando modelo de 24 letras...");

        const [
            respuestaPesos,
            respuestaEtiquetas
        ] = await Promise.all([
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
        const nuevasEtiquetas =
            await respuestaEtiquetas.json();

        // Verificar etiquetas y pesos
        if (
            !Array.isArray(datos.weights) ||
            datos.weights.length !== 6
        ) {
            throw new Error(
                "Se esperaban 6 tensores de pesos"
            );
        }

        if (
            !Array.isArray(nuevasEtiquetas) ||
            nuevasEtiquetas.length !== 24
        ) {
            throw new Error(
                "Se necesitan 24 etiquetas ASL"
            );
        }

        // ==================================
        // CREAR RED NEURONAL
        // ==================================

        red = tf.sequential();

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

        // ==================================
        // CARGAR Y VERIFICAR PESOS
        // ==================================

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
            for (
                let i = 0;
                i < datos.weights.length;
                i++
            ) {
                const peso = datos.weights[i];
                const forma = formasEsperadas[i];

                const longitudEsperada =
                    forma.reduce(
                        (a, b) => a * b,
                        1
                    );

                if (
                    !Array.isArray(peso.shape) ||
                    !Array.isArray(peso.values) ||
                    JSON.stringify(peso.shape) !==
                        JSON.stringify(forma) ||
                    peso.values.length !==
                        longitudEsperada
                ) {
                    throw new Error(
                        "Pesos incompatibles en posición " + i
                    );
                }

                pesos.push(
                    tf.tensor(
                        peso.values,
                        forma,
                        "float32"
                    )
                );
            }

            red.setWeights(pesos);

        } finally {
            pesos.forEach(
                peso => peso.dispose()
            );
        }

        // ==================================
        // MODELO PREPARADO
        // ==================================

        etiquetas = nuevasEtiquetas;
        modeloJS = red;

        mostrarEstado(
            "TensorFlow.js activo: 24 letras | " +
            "J/Z con modelo independiente"
        );

        const titulo =
            document.querySelector("header .pill");

        if (titulo) {
            titulo.textContent =
                window.senaliveModeloPalabrasCargado
                    ? "ASL · 26 letras + 10 palabras"
                    : "ASL · 24 estáticas + J y Z";
        }

        console.log(
            "[SeñaLive] Modelo de 24 letras cargado"
        );

        console.log(
            "[SeñaLive] Letras:",
            etiquetas.join(", ")
        );

    } catch (error) {
        if (red && !modeloJS) {
            red.dispose();
        }

        console.error(
            "[SeñaLive] Error cargando modelo:",
            error
        );

        mostrarEstado(
            "Error del modelo: " + error.message
        );
    }
}

// ==========================================
// NORMALIZAR LOS 21 PUNTOS DE LA MANO
// ==========================================

function normalizarMano(puntos) {
    if (!puntos || puntos.length !== 21) {
        return null;
    }

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

    // 21 puntos x 3 coordenadas = 63 valores
    const features = puntos.flatMap(p => [
        (p.x - muneca.x) / escala,
        (p.y - muneca.y) / escala,
        (p.z - muneca.z) / escala
    ]);

    if (
        features.length !== 63 ||
        !features.every(Number.isFinite)
    ) {
        return null;
    }

    return features;
}

// ==========================================
// PREDECIR LETRA ESTÁTICA
// ==========================================

function predecir(features) {
    if (!modeloJS) {
        return null;
    }

    const probabilidades = tf.tidy(() => {
        const entrada = tf.tensor2d(
            [features],
            [1, 63]
        );

        return Array.from(
            modeloJS.predict(entrada).dataSync()
        );
    });

    if (probabilidades.length !== etiquetas.length) {
        throw new Error(
            "La salida del modelo no coincide con las etiquetas"
        );
    }

    const resultados = probabilidades
        .map((valor, indice) => ({
            letra: etiquetas[indice],
            confianza: valor
        }))
        .sort(
            (a, b) =>
                b.confianza - a.confianza
        );

    return {
        letra: resultados[0].letra,
        confianza: resultados[0].confianza,
        mejoresTres: resultados.slice(0, 3)
    };
}

// ==========================================
// DIAGNÓSTICO DE PREDICCIONES
// ==========================================

function mostrarDiagnostico(resultado) {
    const ahora = performance.now();

    if (
        ahora - ultimoDiagnostico <
        INTERVALO_DIAGNOSTICO
    ) {
        return;
    }

    ultimoDiagnostico = ahora;

    console.table(
        resultado.mejoresTres.map(
            (item, indice) => ({
                Posicion: indice + 1,
                Letra: item.letra,
                Confianza:
                    (item.confianza * 100).toFixed(2) + "%"
            })
        )
    );
}

// ==========================================
// EVENTO DE MOVIMIENTO J Y Z
// ==========================================

window.addEventListener(
    "senalive:movimiento-activo",
    evento => {
        modoJZActivo =
            evento.detail?.activo === true;

        console.log(
            "[SeñaLive] Movimiento J/Z:",
            modoJZActivo ? "ACTIVO" : "FINALIZADO"
        );

        if (!estaEnTraductor()) return;

        if (
            performance.now() <
            bloqueoDinamicoHasta
        ) {
            return;
        }

        if (
            performance.now() <
            (window.senalivePalabraVisibleHasta || 0)
        ) {
            return;
        }

        if (modoJZActivo) {
            mostrarModoMovimiento();
        } else {
            limpiarPrediccion();
        }
    }
);

// ==========================================
// RECONOCIMIENTO DE J Y Z
// ==========================================

window.addEventListener(
    "senalive:letra-dinamica",
    evento => {
        if (!estaEnTraductor()) return;

        const letra = evento.detail?.letra;
        const valor = evento.detail?.confianza;

        if (letra !== "J" && letra !== "Z") {
            return;
        }

        // Evitar sobrescribir J/Z con una palabra
        window.senalivePalabraVisibleHasta = 0;

        bloqueoDinamicoHasta =
            performance.now() +
            DURACION_LETRA_DINAMICA;

        if (prediccion) {
            prediccion.textContent = letra;
        }

        const confianzaValida =
            Number.isFinite(valor);

        const porcentaje = confianzaValida
            ? Math.round(valor * 100)
            : 0;

        if (confianza) {
            confianza.textContent =
                confianzaValida
                    ? porcentaje + "%"
                    : "Movimiento";
        }

        if (barra) {
            barra.style.width =
                confianzaValida
                    ? porcentaje + "%"
                    : "0%";
        }

        console.log(
            "[SeñaLive] LETRA DINÁMICA RECONOCIDA:",
            letra,
            confianzaValida ? porcentaje + "%" : ""
        );
    }
);

// ==========================================
// RECONOCIMIENTO DEL TRADUCTOR PRINCIPAL
// ==========================================

window.addEventListener(
    "senalive:landmarks",
    evento => {
        if (
            !estaEnTraductor() ||
            evento.detail?.modo !== "t"
        ) {
            return;
        }

        const ahora = performance.now();

        // Prioridad al modelo de 10 palabras
        if (
            window.senaliveCapturandoPalabra === true ||
            ahora <
            (window.senalivePalabraVisibleHasta || 0)
        ) {
            return;
        }

        // Prioridad a J y Z
        if (ahora < bloqueoDinamicoHasta) {
            return;
        }

        if (modoJZActivo) {
            return;
        }

        if (!modeloJS) {
            return;
        }

        if (
            ahora - ultimoEnvio <
            INTERVALO_PREDICCION
        ) {
            return;
        }

        ultimoEnvio = ahora;

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
            const resultado = predecir(features);

            if (!resultado) return;

            mostrarDiagnostico(resultado);

            const porcentaje = Math.round(
                resultado.confianza * 100
            );

            if (prediccion) {
                prediccion.textContent =
                    resultado.confianza >= UMBRAL_CONFIANZA
                        ? resultado.letra
                        : "—";
            }

            if (confianza) {
                confianza.textContent = porcentaje + "%";
            }

            if (barra) {
                barra.style.width = porcentaje + "%";
            }

        } catch (error) {
            console.error(
                "[SeñaLive] Error de predicción:",
                error
            );
        }
    }
);

// ==========================================
// MODO APRENDIZAJE
// ==========================================

let ultimoEnvioAprendizaje = 0;

window.addEventListener(
    "senalive:landmarks",
    evento => {
        if (
            evento.detail?.modo !== "a" ||
            !document.getElementById("a")
                ?.classList.contains("on")
        ) {
            return;
        }

        const ahora = performance.now();

        if (ahora - ultimoEnvioAprendizaje < 200) {
            return;
        }

        ultimoEnvioAprendizaje = ahora;

        const puntos =
            evento.detail.landmarks ??
            evento.detail.manos?.[0] ??
            null;

        const features = normalizarMano(puntos);

        if (!modeloJS || !features) {
            window.dispatchEvent(
                new CustomEvent(
                    "senalive:letra-aprendizaje",
                    {
                        detail: {
                            letra: null,
                            confianza: 0,
                            hayMano: Boolean(features),
                            modeloListo: Boolean(modeloJS)
                        }
                    }
                )
            );

            return;
        }

        try {
            const resultado = predecir(features);

            if (!resultado) return;

            window.dispatchEvent(
                new CustomEvent(
                    "senalive:letra-aprendizaje",
                    {
                        detail: {
                            letra: String(
                                resultado.letra
                            ).toUpperCase(),

                            confianza: resultado.confianza,
                            hayMano: true,
                            modeloListo: true
                        }
                    }
                )
            );

        } catch (error) {
            console.error(
                "Error en práctica de letras:",
                error
            );
        }
    }
);

// ==========================================
// MODO JUEGO
// ==========================================

let ultimoEnvioJuego = 0;

window.addEventListener(
    "senalive:landmarks",
    evento => {
        if (
            evento.detail?.modo !== "j" ||
            !document.getElementById("j")
                ?.classList.contains("on")
        ) {
            return;
        }

        const ahora = performance.now();

        if (ahora - ultimoEnvioJuego < 200) {
            return;
        }

        ultimoEnvioJuego = ahora;

        const puntos =
            evento.detail.landmarks ??
            evento.detail.manos?.[0] ??
            null;

        const features = normalizarMano(puntos);

        const enviar = detail =>
            window.dispatchEvent(
                new CustomEvent(
                    "senalive:letra-juego",
                    { detail }
                )
            );

        if (!modeloJS || !features) {
            enviar({
                letra: null,
                confianza: 0,
                hayMano: Boolean(features),
                modeloListo: Boolean(modeloJS)
            });

            return;
        }

        try {
            const resultado = predecir(features);

            if (!resultado) return;

            enviar({
                letra: String(resultado.letra).toUpperCase(),
                confianza: resultado.confianza,
                hayMano: true,
                modeloListo: true
            });

        } catch (error) {
            console.error(
                "Juego: error al predecir letra",
                error
            );
        }
    }
);

// ==========================================
// INICIAR EL MODELO
// ==========================================

cargarModelo();
