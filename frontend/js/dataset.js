
// ====================================
// SEÑALIVE - DATASET.JS
// Recolección de datos para TensorFlow
// ====================================

// Configuración
const CLAVE = "senalive_dataset_v1";

// Una muestra cada 160 milisegundos
const INTERVALO_MS = 160;

// Límite de muestras almacenadas
const LIMITE_MUESTRAS = 5000;


// ====================================
// ELEMENTOS HTML
// ====================================

const letraInput =
    document.getElementById("captureLabel");

const personaInput =
    document.getElementById("personId");

const objetivoInput =
    document.getElementById("captureTarget");

const botonInicio =
    document.getElementById("startCapture");

const botonStop =
    document.getElementById("stopCapture");

const botonExportar =
    document.getElementById("downloadDataset");

const botonBorrar =
    document.getElementById("clearDataset");

const contador =
    document.getElementById("captureCounter");

const progreso =
    document.getElementById("captureProgress");

const estado =
    document.getElementById("captureStatus");

const total =
    document.getElementById("datasetTotal");

const desglose =
    document.getElementById("datasetCounts");


// ====================================
// VARIABLES
// ====================================

let registros = cargarRegistros();

let capturando = false;
let capturadas = 0;
let meta = 50;

let etiquetaActual = "A";
let participanteActual = "P01";
let sesionActual = "";

let ultimoRegistro = 0;


// ====================================
// CARGAR DATOS GUARDADOS
// ====================================

function cargarRegistros() {

    try {

        const datos = JSON.parse(
            localStorage.getItem(CLAVE) || "[]"
        );

        if (!Array.isArray(datos)) {
            return [];
        }

        return datos.filter(muestra =>
            muestra &&
            Array.isArray(muestra.features) &&
            muestra.features.length === 63
        );

    } catch (error) {

        console.error(
            "Error al cargar el dataset:",
            error
        );

        return [];
    }

}


// ====================================
// GUARDAR DATOS
// ====================================

function guardarRegistros() {

    try {

        localStorage.setItem(
            CLAVE,
            JSON.stringify(registros)
        );

        return true;

    } catch (error) {

        console.error(
            "Error al guardar muestras:",
            error
        );

        return false;
    }

}


// ====================================
// NORMALIZAR LOS 21 PUNTOS
// ====================================

function normalizarPuntos(puntos) {

    if (
        !Array.isArray(puntos) ||
        puntos.length !== 21
    ) {
        return null;
    }

    // Punto 0: muñeca
    const muneca = puntos[0];

    // Calcular escala de la mano
    const escala = Math.max(
        ...puntos.map(punto =>
            Math.hypot(
                punto.x - muneca.x,
                punto.y - muneca.y
            )
        )
    );

    if (
        !Number.isFinite(escala) ||
        escala < 0.001
    ) {
        return null;
    }

    // Generar 63 características normalizadas
    const resultado = puntos.flatMap(punto => [

        (punto.x - muneca.x) / escala,

        (punto.y - muneca.y) / escala,

        (punto.z - muneca.z) / escala

    ]);

    if (!resultado.every(Number.isFinite)) {
        return null;
    }

    return resultado;
}


// ====================================
// ACTUALIZAR CONTADORES
// ====================================

function actualizarProgreso() {

    contador.textContent =
        `${capturadas} / ${meta}`;

    progreso.style.width =
        `${100 * capturadas / meta}%`;

}


// ====================================
// MOSTRAR RESUMEN
// ====================================

function actualizarResumen() {

    total.textContent = registros.length;

    botonExportar.disabled =
        registros.length === 0;

    botonBorrar.disabled =
        registros.length === 0;

    const conteos = {};

    // Contar muestras por letra
    for (const muestra of registros) {

        conteos[muestra.label] =
            (conteos[muestra.label] || 0) + 1;

    }

    // Limpiar lista
    desglose.replaceChildren();

    // Mostrar cantidades
    for (
        const [letra, cantidad]
        of Object.entries(conteos).sort()
    ) {

        const elemento =
            document.createElement("li");

        const nombre =
            document.createElement("span");

        const numero =
            document.createElement("small");

        nombre.textContent = letra;

        numero.textContent =
            `${cantidad} muestras`;

        elemento.append(nombre, numero);

        desglose.appendChild(elemento);
    }

}


// ====================================
// HABILITAR O DESHABILITAR CONTROLES
// ====================================

function activarFormulario(disponible) {

    letraInput.disabled = !disponible;

    personaInput.disabled = !disponible;

    objetivoInput.disabled = !disponible;

    botonInicio.disabled = !disponible;

    botonStop.disabled = disponible;

}


// ====================================
// DETENER CAPTURA
// ====================================

function detenerCaptura(mensaje) {

    capturando = false;

    activarFormulario(true);

    if (mensaje) {
        estado.textContent = mensaje;
    }

}


// ====================================
// INICIAR CAPTURA
// ====================================

botonInicio.addEventListener("click", () => {

    const etiqueta = letraInput.value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");

    const participante = personaInput.value
        .trim()
        .toUpperCase();

    const objetivo = Number(objetivoInput.value);

    // Validar letra
    if (!/^[A-ZÁÉÍÓÚÜÑ_]{1,24}$/u.test(etiqueta)) {

        estado.textContent =
            "Escribe una letra o seña válida.";

        return;
    }

    // Validar participante
    if (!/^[A-Z0-9_-]{1,20}$/.test(participante)) {

        estado.textContent =
            "Escribe un código como P01.";

        return;
    }

    // Validar cantidad
    if (
        !Number.isInteger(objetivo) ||
        objetivo < 10 ||
        objetivo > 500
    ) {

        estado.textContent =
            "Elige entre 10 y 500 muestras.";

        return;
    }

    if (registros.length >= LIMITE_MUESTRAS) {

        estado.textContent =
            "Exporta tu dataset antes de continuar.";

        return;
    }

    // Preparar sesión
    etiquetaActual = etiqueta;
    participanteActual = participante;

    meta = objetivo;
    capturadas = 0;
    ultimoRegistro = 0;

    sesionActual =
        `${Date.now()}-${Math.random()
            .toString(36).slice(2, 7)}`;

    capturando = true;

    activarFormulario(false);
    actualizarProgreso();

    estado.textContent =
        `Capturando ${etiquetaActual}. ` +
        "Mantén la seña frente a la cámara.";

});


// ====================================
// BOTÓN DETENER
// ====================================

botonStop.addEventListener("click", () => {

    detenerCaptura(
        `Captura detenida: ${capturadas} muestras.`
    );

});


// ====================================
// RECIBIR PUNTOS DESDE CAMERA.JS
// ====================================

window.addEventListener(
    "senalive:landmarks",
    (evento) => {

        if (!capturando) return;

        // Verificar modo entrenamiento
        const modoEntrenar =
            document.getElementById("e");

        if (!modoEntrenar.classList.contains("on")) {

            detenerCaptura(
                "Captura detenida al cambiar de módulo."
            );

            return;
        }

        // Obtener puntos detectados
        const puntos = evento.detail?.landmarks;

        if (!puntos) {

            estado.textContent =
                "Coloca tu mano frente a la cámara.";

            return;
        }

        // Controlar frecuencia de captura
        const ahora = performance.now();

        if (
            ahora - ultimoRegistro <
            INTERVALO_MS
        ) {
            return;
        }

        // Normalizar las coordenadas
        const features = normalizarPuntos(puntos);

        if (!features) return;

        ultimoRegistro = ahora;

        // Crear una nueva muestra
        const muestra = {

            label: etiquetaActual,

            person_id: participanteActual,

            session_id: sesionActual,

            recorded_at:
                new Date().toISOString(),

            features: features

        };

        // Guardar muestra
        registros.push(muestra);

        capturadas++;

        const guardado = guardarRegistros();

        if (!guardado) {

            detenerCaptura(
                "No se pudo guardar. Exporta el CSV."
            );

        }

        // Actualizar interfaz
        actualizarProgreso();
        actualizarResumen();

        if (!capturando) return;

        estado.textContent =
            `Grabando ${etiquetaActual}: ` +
            `${capturadas} de ${meta}`;

        // Finalizar sesión
        if (
            capturadas >= meta ||
            registros.length >= LIMITE_MUESTRAS
        ) {

            detenerCaptura(
                `¡Captura completada! ` +
                `${capturadas} muestras de ${etiquetaActual}.`
            );

        }

    }
);


// ====================================
// EXPORTAR DATASET A CSV
// ====================================

botonExportar.addEventListener("click", () => {

    if (registros.length === 0) return;

    // Columnas principales
    const columnas = [
        "label",
        "person_id",
        "session_id",
        "recorded_at"
    ];

    // Crear columnas de los 21 puntos
    for (let i = 0; i < 21; i++) {

        columnas.push(
            `x${i}`,
            `y${i}`,
            `z${i}`
        );

    }

    const filas = [columnas.join(",")];

    // Crear una fila por muestra
    for (const muestra of registros) {

        const fila = [

            muestra.label,

            muestra.person_id,

            muestra.session_id,

            muestra.recorded_at,

            ...muestra.features.map(
                valor => Number(valor).toFixed(6)
            )

        ];

        filas.push(fila.join(","));
    }

    // Construir archivo CSV
    const csv = filas.join("\r\n");

    const blob = new Blob(
        ["\uFEFF", csv],
        {
            type: "text/csv;charset=utf-8"
        }
    );

    const url = URL.createObjectURL(blob);

    // Descargar archivo
    const enlace = document.createElement("a");

    enlace.href = url;

    enlace.download =
        `senalive_dataset_${new Date()
            .toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    estado.textContent =
        `CSV exportado con ${registros.length} muestras.`;

});


// ====================================
// BORRAR DATASET
// ====================================

botonBorrar.addEventListener("click", () => {

    const confirmar = confirm(
        "¿Deseas borrar todas las muestras? " +
        "Exporta el CSV antes de continuar."
    );

    if (!confirmar) return;

    if (capturando) {
        detenerCaptura();
    }

    registros = [];

    guardarRegistros();

    capturadas = 0;

    actualizarResumen();
    actualizarProgreso();

    estado.textContent =
        "Dataset borrado correctamente.";

});


// ====================================
// DETENER AL CAMBIAR DE MÓDULO
// ====================================

document
    .querySelectorAll("nav button[data-m]")
    .forEach(boton => {

        boton.addEventListener("click", () => {

            if (
                capturando &&
                boton.dataset.m !== "e"
            ) {

                detenerCaptura(
                    "Captura detenida al salir de Entrenar."
                );

            }

        });

    });


// ====================================
// INICIALIZAR
// ====================================

actualizarProgreso();

actualizarResumen();
