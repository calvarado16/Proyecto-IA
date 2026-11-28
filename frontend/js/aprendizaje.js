
// ============================================
// SEÑALIVE - MODO APRENDIZAJE
// 24 LETRAS ASL ESTÁTICAS
// ============================================

(() => {
    "use strict";

    const SECUENCIA =
        "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

    const TOTAL = 10;
    const UMBRAL = 0.75;
    const REPETICIONES = 4;

    const $ = id => document.getElementById(id);

    // ========================================
    // ELEMENTOS DEL HTML
    // ========================================

    const el = {
        modo: $("a"),
        cam: $("learnCamera"),
        objetivo: $("learnTarget"),
        conf: $("learnConfidence"),
        feedback: $("learnFeedback"),
        instruccion: $("learnInstruction"),
        puntos: $("learnPoints"),
        racha: $("learnStreak"),
        avance: $("learnCompleted"),
        progreso: $("learnProgressFill"),
        reiniciar: $("learnRestart"),
        saltar: $("learnSkip"),
        imagen: $("learnReferenceImage"),
        refTexto: $("learnReferenceText")
    };

    if (Object.values(el).some(x => !x)) {
        console.error(
            "SeñaLive aprendizaje: faltan elementos del HTML"
        );
        return;
    }

    // ========================================
    // VARIABLES
    // ========================================

    let secuencia = [];
    let posicion = 0;
    let puntos = 0;
    let racha = 0;

    let ultimaLetra = null;
    let confirmaciones = 0;

    let bloqueado = false;
    let terminado = false;
    let avancePendiente = null;

    // ========================================
    // MEZCLAR LETRAS
    // ========================================

    function mezclar(letras) {
        const copia = [...letras];

        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(
                Math.random() * (i + 1)
            );

            [copia[i], copia[j]] = [
                copia[j], copia[i]
            ];
        }

        return copia;
    }

    // ========================================
    // ACTUALIZAR PUNTOS Y RACHA
    // ========================================

    function actualizarMarcadores() {
        el.puntos.textContent = String(puntos);

        el.racha.textContent = String(racha);

        el.avance.textContent =
            `${posicion}/${TOTAL}`;

        el.progreso.style.width =
            `${posicion / TOTAL * 100}%`;
    }

    // ========================================
    // MOSTRAR IMAGEN DE REFERENCIA
    // ========================================

    function referencia(letra) {
        el.imagen.hidden = true;
        el.imagen.removeAttribute("src");

        el.imagen.alt =
            `Seña de referencia para la letra ${letra}`;

        el.refTexto.hidden = false;

        el.refTexto.textContent =
            `Referencia ${letra}: agrega ${letra}.png`;

        el.imagen.onload = () => {
            el.imagen.hidden = false;
            el.refTexto.hidden = true;
        };

        el.imagen.onerror = () => {
            el.imagen.hidden = true;
            el.refTexto.hidden = false;
        };

        el.imagen.src =
            `./referencias/${letra}.png`;
    }

    // ========================================
    // PRESENTAR EJERCICIO
    // ========================================

    function presentar() {
        confirmaciones = 0;
        ultimaLetra = null;
        bloqueado = false;

        el.cam.classList.remove("ok");

        actualizarMarcadores();

        if (posicion >= TOTAL) {
            terminado = true;

            el.objetivo.textContent = "✓";

            el.feedback.textContent =
                `¡Práctica completada! Obtuviste ${puntos} puntos.`;

            el.instruccion.textContent =
                "Puedes comenzar otra práctica de 10 letras.";

            el.conf.textContent = "Finalizado";

            el.saltar.disabled = true;
            el.imagen.hidden = true;

            el.refTexto.textContent = "¡Bien hecho!";
            el.refTexto.hidden = false;

            return;
        }

        terminado = false;
        el.saltar.disabled = false;

        const letra = secuencia[posicion];

        el.objetivo.textContent = letra;

        el.instruccion.textContent =
            `Haz la letra ${letra} frente a la cámara y mantenla estable.`;

        el.feedback.textContent =
            "Esperando tu mano...";

        el.conf.textContent =
            "Esperando detección";

        referencia(letra);
    }

    // ========================================
    // REINICIAR PRÁCTICA
    // ========================================

    function iniciar() {
        if (avancePendiente !== null) {
            clearTimeout(avancePendiente);
            avancePendiente = null;
        }

        secuencia = mezclar(SECUENCIA).slice(0, TOTAL);

        posicion = 0;
        puntos = 0;
        racha = 0;

        terminado = false;

        presentar();
    }

    // ========================================
    // SIGUIENTE LETRA
    // ========================================

    function siguiente() {
        if (avancePendiente !== null) {
            clearTimeout(avancePendiente);
            avancePendiente = null;
        }

        posicion++;

        presentar();
    }

    // ========================================
    // BOTÓN REINICIAR
    // ========================================

    el.reiniciar.addEventListener(
        "click",
        iniciar
    );

    // ========================================
    // BOTÓN SALTAR
    // ========================================

    el.saltar.addEventListener(
        "click",
        () => {
            if (terminado || bloqueado) {
                return;
            }

            racha = 0;
            siguiente();
        }
    );

    // ========================================
    // RECIBIR PREDICCIÓN DE TENSORFLOW.JS
    // ========================================

    window.addEventListener(
        "senalive:letra-aprendizaje",
        evento => {
            if (
                !el.modo.classList.contains("on") ||
                bloqueado ||
                terminado
            ) {
                return;
            }

            const {
                letra,
                confianza,
                hayMano,
                modeloListo
            } = evento.detail ?? {};

            // =================================
            // ESPERAR MODELO
            // =================================

            if (!modeloListo) {
                el.conf.textContent =
                    "Cargando TensorFlow...";

                el.feedback.textContent =
                    "Esperando el modelo de 24 letras.";

                confirmaciones = 0;
                ultimaLetra = null;

                return;
            }

            // =================================
            // DETECTAR MANO
            // =================================

            if (!hayMano || !letra) {
                el.conf.textContent = "Sin mano";

                el.feedback.textContent =
                    "Muestra una mano frente a la cámara.";

                confirmaciones = 0;
                ultimaLetra = null;

                return;
            }

            // =================================
            // MOSTRAR CONFIANZA
            // =================================

            const porcentaje = Math.round(
                confianza * 100
            );

            el.conf.textContent =
                `${letra} · ${porcentaje}%`;

            const objetivo = secuencia[posicion];

            // =================================
            // VERIFICAR RESPUESTA
            // =================================

            if (
                letra !== objetivo ||
                confianza < UMBRAL
            ) {
                confirmaciones = 0;
                ultimaLetra = null;

                if (letra === objetivo) {
                    el.feedback.textContent =
                        "Necesitas al menos 75% de confianza.";
                } else {
                    el.feedback.textContent =
                        `Detecto ${letra}. Intenta la letra ${objetivo}.`;
                }

                return;
            }

            // =================================
            // CONFIRMACIONES CONSECUTIVAS
            // =================================

            confirmaciones =
                ultimaLetra === letra
                    ? confirmaciones + 1
                    : 1;

            ultimaLetra = letra;

            el.feedback.textContent =
                `Mantén ${letra} estable ` +
                `(${confirmaciones}/${REPETICIONES})`;

            // =================================
            // LETRA RECONOCIDA
            // =================================

            if (confirmaciones >= REPETICIONES) {
                bloqueado = true;

                puntos += 10;
                racha++;

                el.cam.classList.add("ok");

                el.feedback.textContent =
                    `¡Correcto! ${letra} · +10 puntos`;

                actualizarMarcadores();

                avancePendiente = setTimeout(
                    siguiente,
                    1000
                );
            }
        }
    );

    // ========================================
    // INICIAR MODO APRENDIZAJE
    // ========================================

    iniciar();

})();
