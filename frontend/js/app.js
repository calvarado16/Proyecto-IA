
// ===============================
// SEÑALIVE - APP.JS
// Navegación e interfaz
// ===============================

// Puntos de una mano de demostración
const puntosDemo = [
    [200, 250],
    [170, 225],
    [150, 195],
    [135, 165],
    [122, 140],
    [180, 170],
    [177, 125],
    [175, 95],
    [173, 70],
    [205, 165],
    [207, 115],
    [208, 80],
    [209, 52],
    [230, 170],
    [236, 125],
    [240, 95],
    [243, 70],
    [253, 185],
    [268, 148],
    [278, 125],
    [288, 105]
];

// Conexiones de la mano
const conexionesDemo = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18],
    [18, 19], [19, 20]
];

// Dibujar el esqueleto de demostración
const esqueletoDemo = conexionesDemo.map(([a, b]) => {

    return `
        <line
            x1="${puntosDemo[a][0]}"
            y1="${puntosDemo[a][1]}"
            x2="${puntosDemo[b][0]}"
            y2="${puntosDemo[b][1]}"
            stroke="#3ddba8"
            stroke-width="3"
            stroke-linecap="round"
        />
    `;

}).join("") +

puntosDemo.map(p => {

    return `
        <circle
            cx="${p[0]}"
            cy="${p[1]}"
            r="5"
            fill="#fff"
        />
    `;

}).join("") +

`<rect x="105" y="35" width="205" height="235"
rx="8" fill="none" stroke="#3ddba8"
stroke-width="2" stroke-dasharray="6 5"/>`;

// Mostrar dibujos decorativos
document.querySelectorAll(".hand").forEach(svg => {
    svg.innerHTML = esqueletoDemo;
});


// ===============================
// NAVEGACIÓN
// ===============================

const titulos = {
    t: "Traductor",
    a: "Modo aprendizaje",
    j: "Juego: deletrea la palabra",
    d: "Diccionario visual",
    e: "Modo entrenamiento",
    h: "Historial de sesión"
};

document.querySelectorAll("nav button[data-m]")
    .forEach(boton => {

        boton.addEventListener("click", () => {

            // Quitar módulo activo
            document.querySelectorAll(
                "nav button[data-m], .mode"
            ).forEach(elemento => {
                elemento.classList.remove("on");
            });

            // Activar módulo seleccionado
            boton.classList.add("on");

            document.getElementById(
                boton.dataset.m
            ).classList.add("on");

            // Cambiar título
            document.getElementById("ttl").textContent =
                titulos[boton.dataset.m];

        });

    });


// ===============================
// DICCIONARIO VISUAL
// ===============================

const teclas = document.getElementById("keys");

// Alfabeto estático inicial de demostración
const alfabeto = "ABCDEFGHIKLMNOPQRSTUVWXY";

alfabeto.split("").forEach((letra, indice) => {

    const boton = document.createElement("button");

    boton.className =
        "key" + (indice === 0 ? " on" : "");

    boton.textContent = letra;

    boton.addEventListener("click", () => {

        // Deseleccionar otras letras
        teclas.querySelectorAll(".key").forEach(b => {
            b.classList.remove("on");
        });

        // Activar letra
        boton.classList.add("on");

        document.getElementById("kl").textContent =
            letra;

    });

    teclas.appendChild(boton);

});
