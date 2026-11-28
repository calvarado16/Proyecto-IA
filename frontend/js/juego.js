
/* ==========================================
   SEÑALIVE - JUEGO: DELETREA LA PALABRA
   TENSORFLOW.JS - 24 LETRAS ESTÁTICAS
========================================== */

(() => {
    "use strict";

    // ======================================
    // CONFIGURACIÓN
    // ======================================

    const BANCO = [
        "SOL", "LUNA", "CASA", "MANO", "AMOR",
        "MESA", "GATO", "PATO", "BESO", "ROSA",
        "VASO", "SOPA", "CAMA", "RANA", "DADO",
        "PESO", "PALA", "LAGO", "TELA", "FARO"
    ];

    const TOTAL = 5;
    const SEGUNDOS_POR_PALABRA = 45;
    const UMBRAL = 0.75;
    const CONFIRMACIONES = 4;

    const PUNTOS_POR_LETRA = 10;
    const BONO_PALABRA = 30;

    const ESPERA_ENTRE_LETRAS_MS = 650;
    const ESPERA_ENTRE_PALABRAS_MS = 1400;

    const $ = id => document.getElementById(id);

    // ======================================
    // ELEMENTOS DEL HTML
    // ======================================

    const el = {
        modo: $("j"),
        camara: $("gameCamera"),
        ronda: $("gameRound"),
        palabra: $("gameWord"),
        feedback: $("gameFeedback"),
        tiempo: $("gameTime"),
        barra: $("gameTimerFill"),
        puntos: $("gamePoints"),
        racha: $("gameStreak"),
        completadas: $("gameCompleted"),
        reiniciar: $("gameRestart"),
        saltar: $("gameSkip"),
        confianza: $("gameConfidence")
    };

    if (Object.values(el).some(nodo => !nodo)) {
        console.error(
            "Juego Señalive: faltan elementos en index.html"
        );

        return;
    }

    // ======================================
    // VARIABLES DEL JUEGO
    // ======================================

    let palabras = [];
    let indicePalabra = 0;
    let indiceLetra = 0;

    let puntuacion = 0;
    let racha = 0;
    let completadas = 0;

    let segundosRestantes =
        SEGUNDOS_POR_PALABRA;

    let confirmaciones = 0;
    let ultimaPrediccion = "";

    let bloqueado = false;
    let terminado = false;
    let requiereSoltar = false;

    let disponibleDesde = 0;
    let ultimoTick = performance.now();

    let temporizadorAvance = null;

    // ======================================
    // COMPROBAR SI EL JUEGO ESTÁ ACTIVO
    // ======================================

    const activo = () =>
        el.modo.classList.contains("on") &&
        document.visibilityState !== "hidden";

    // ======================================
    // MEZCLAR PALABRAS
    // ======================================

    function mezclar(lista) {
        const copia = [...lista];

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

    // ======================================
    // FORMATO DEL CRONÓMETRO
    // ======================================

    function formatoTiempo(segundos) {
        const valor = Math.max(
            0,
            Math.ceil(segundos)
        );

        return `00:${String(valor).padStart(2, "0")}`;
    }

    // ======================================
    // ACTUALIZAR CRONÓMETRO
    // ======================================

    function actualizarTiempo() {
        el.tiempo.textContent =
            formatoTiempo(segundosRestantes);

        const porcentaje =
            segundosRestantes /
            SEGUNDOS_POR_PALABRA * 100;

        el.barra.style.width =
            `${Math.max(0, porcentaje)}%`;
    }

    // ======================================
    // ACTUALIZAR PUNTOS Y RACHA
    // ======================================

    function actualizarMarcadores() {
        el.puntos.textContent =
            String(puntuacion);

        el.racha.textContent =
            `x${racha}`;

        el.completadas.textContent =
            `${completadas}/${TOTAL}`;
    }

    // ======================================
    // DIBUJAR PALABRA
    // ======================================

    function dibujarPalabra() {
        const palabra =
            palabras[indicePalabra];

        el.palabra.replaceChildren();

        for (let i = 0; i < palabra.length; i++) {
            const letra =
                document.createElement("span");

            letra.textContent = palabra[i];

            if (i < indiceLetra) {
                letra.className = "d";
            }

            if (i === indiceLetra) {
                letra.className = "c";
            }

            el.palabra.appendChild(letra);
        }

        el.palabra.setAttribute(
            "aria-label",
            `Deletrea ${palabra}`
        );
    }

    // ======================================
    // CANCELAR AVANCE PENDIENTE
    // ======================================

    function cancelarAvance() {
        if (temporizadorAvance !== null) {
            clearTimeout(temporizadorAvance);
            temporizadorAvance = null;
        }
    }

    // ======================================
    // MOSTRAR NUEVA PALABRA
    // ======================================

    function mostrarPalabra() {
        cancelarAvance();

        confirmaciones = 0;
        ultimaPrediccion = "";
        requiereSoltar = false;

        disponibleDesde =
            performance.now() + 600;

        segundosRestantes =
            SEGUNDOS_POR_PALABRA;

        ultimoTick = performance.now();
        bloqueado = false;

        el.camara.classList.remove("ok");
        el.saltar.disabled = false;

        if (indicePalabra >= TOTAL) {
            finalizar();
            return;
        }

        indiceLetra = 0;

        el.ronda.textContent =
            `Palabra ${indicePalabra + 1} de ${TOTAL}`;

        el.feedback.textContent =
            "Muestra tu mano y haz la primera letra.";

        el.confianza.textContent = "Sin mano";

        dibujarPalabra();
        actualizarTiempo();
        actualizarMarcadores();
    }

    // ======================================
    // FINALIZAR PARTIDA
    // ======================================

    function finalizar() {
        terminado = true;
        bloqueado = true;

        el.ronda.textContent =
            "Partida finalizada";

        el.palabra.replaceChildren();

        el.feedback.textContent =
            `¡Terminaste! ${completadas} de ${TOTAL} palabras. ` +
            `Puntuación: ${puntuacion}.`;

        el.saltar.disabled = true;

        el.confianza.textContent =
            "Finalizado";

        actualizarMarcadores();
        actualizarTiempo();
    }

    // ======================================
    // PASAR A SIGUIENTE PALABRA
    // ======================================

    function siguientePalabra() {
        cancelarAvance();

        indicePalabra++;

        if (indicePalabra >= TOTAL) {
            finalizar();
        } else {
            mostrarPalabra();
        }
    }

    // ======================================
    // REGISTRAR PALABRA TERMINADA
    // ======================================

    function finalizarPalabra(exito, razon = "") {
        if (bloqueado || terminado) return;

        bloqueado = true;
        el.saltar.disabled = true;

        confirmaciones = 0;

        if (exito) {
            puntuacion += BONO_PALABRA;
            completadas++;
            racha++;

            el.camara.classList.add("ok");

            el.feedback.textContent =
                `¡Palabra ${palabras[indicePalabra]} completada! ` +
                `+${BONO_PALABRA} puntos de bono.`;

        } else {
            racha = 0;

            el.feedback.textContent =
                razon ||
                "No completaste la palabra.";
        }

        actualizarMarcadores();

        temporizadorAvance = setTimeout(
            siguientePalabra,
            ESPERA_ENTRE_PALABRAS_MS
        );
    }

    // ======================================
    // INICIAR O REINICIAR PARTIDA
    // ======================================

    function iniciar() {
        cancelarAvance();

        palabras =
            mezclar(BANCO).slice(0, TOTAL);

        indicePalabra = 0;
        indiceLetra = 0;

        puntuacion = 0;
        racha = 0;
        completadas = 0;

        terminado = false;
        bloqueado = false;

        mostrarPalabra();
    }

    // ======================================
    // VALIDAR LETRA CORRECTA
    // ======================================

    function siguienteLetra() {
        const palabra =
            palabras[indicePalabra];

        const letraAceptada =
            palabra[indiceLetra];

        indiceLetra++;

        puntuacion += PUNTOS_POR_LETRA;

        actualizarMarcadores();

        confirmaciones = 0;
        ultimaPrediccion = "";

        disponibleDesde =
            performance.now() +
            ESPERA_ENTRE_LETRAS_MS;

        if (indiceLetra >= palabra.length) {
            dibujarPalabra();
            finalizarPalabra(true);

        } else {
            requiereSoltar =
                palabra[indiceLetra] === letraAceptada;

            dibujarPalabra();

            el.feedback.textContent =
                requiereSoltar
                    ? "Suelta la seña antes de repetir esta letra."
                    : `¡Correcto! Ahora haz la letra ${palabra[indiceLetra]}.`;
        }
    }

    // ======================================
    // RECIBIR PREDICCIÓN DE TENSORFLOW
    // ======================================

    function recibirPrediccion(datos) {
        if (
            !activo() ||
            bloqueado ||
            terminado
        ) {
            return;
        }

        const {
            letra,
            confianza = 0,
            hayMano = false,
            modeloListo = false
        } = datos;

        // ==================================
        // MODELO NO DISPONIBLE
        // ==================================

        if (!modeloListo) {
            el.confianza.textContent =
                "Cargando modelo...";

            el.feedback.textContent =
                "Esperando TensorFlow.js...";

            confirmaciones = 0;
            ultimaPrediccion = "";

            return;
        }

        // ==================================
        // MANO NO DETECTADA
        // ==================================

        if (!hayMano || !letra) {
            el.confianza.textContent =
                "Sin mano";

            confirmaciones = 0;
            ultimaPrediccion = "";

            if (requiereSoltar) {
                requiereSoltar = false;

                el.feedback.textContent =
                    "Puedes repetir la letra.";

            } else {
                el.feedback.textContent =
                    "Coloca una mano frente a la cámara.";
            }

            return;
        }

        const letraDetectada =
            String(letra).toUpperCase();

        const porcentaje = Math.round(
            Number(confianza) * 100
        );

        el.confianza.textContent =
            `${letraDetectada} · ${porcentaje}%`;

        // ==================================
        // EVITAR LETRAS REPETIDAS
        // ==================================

        if (requiereSoltar) {
            el.feedback.textContent =
                "Retira la mano un instante para repetir la letra.";

            return;
        }

        if (
            performance.now() <
            disponibleDesde
        ) {
            return;
        }

        const esperada =
            palabras[indicePalabra][indiceLetra];

        // ==================================
        // COMPROBAR LETRA Y CONFIANZA
        // ==================================

        if (
            letraDetectada !== esperada ||
            confianza < UMBRAL
        ) {
            confirmaciones = 0;
            ultimaPrediccion = "";

            el.feedback.textContent =
                letraDetectada === esperada
                    ? "Seña detectada, pero necesitas al menos 75 % de confianza."
                    : `Detecto ${letraDetectada}. Debes hacer ${esperada}.`;

            return;
        }

        // ==================================
        // CUATRO PREDICCIONES CONSECUTIVAS
        // ==================================

        confirmaciones =
            ultimaPrediccion === letraDetectada
                ? confirmaciones + 1
                : 1;

        ultimaPrediccion = letraDetectada;

        el.feedback.textContent =
            `Mantén ${esperada} estable ` +
            `(${confirmaciones}/${CONFIRMACIONES}).`;

        if (confirmaciones >= CONFIRMACIONES) {
            siguienteLetra();
        }
    }

    // ======================================
    // CRONÓMETRO
    // ======================================

    function avanzarReloj() {
        const ahora = performance.now();

        const transcurrido =
            (ahora - ultimoTick) / 1000;

        ultimoTick = ahora;

        if (
            !activo() ||
            bloqueado ||
            terminado
        ) {
            return;
        }

        segundosRestantes = Math.max(
            0,
            segundosRestantes - transcurrido
        );

        actualizarTiempo();

        if (segundosRestantes <= 0) {
            finalizarPalabra(
                false,
                "Se acabó el tiempo. Pasamos a otra palabra."
            );
        }
    }

    // ======================================
    // BOTÓN REINICIAR
    // ======================================

    el.reiniciar.addEventListener(
        "click",
        iniciar
    );

    // ======================================
    // BOTÓN SALTAR PALABRA
    // ======================================

    el.saltar.addEventListener(
        "click",
        () => {
            if (bloqueado || terminado) {
                return;
            }

            finalizarPalabra(
                false,
                "Palabra saltada. Continuamos con la siguiente."
            );
        }
    );

    // ======================================
    // EVENTO DE RECONOCIMIENTO
    // ======================================

    window.addEventListener(
        "senalive:letra-juego",
        evento => {
            recibirPrediccion(
                evento.detail ?? {}
            );
        }
    );

    // ======================================
    // PAUSA AL CAMBIAR DE PESTAÑA
    // ======================================

    window.addEventListener(
        "visibilitychange",
        () => {
            ultimoTick = performance.now();
        }
    );

    setInterval(avanzarReloj, 100);

    // ======================================
    // INICIAR JUEGO
    // ======================================

    iniciar();

})();
