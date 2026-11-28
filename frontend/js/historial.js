
/* ==========================================
   SEÑALIVE - HISTORIAL
   SIN EXPORTACIÓN JSON
========================================== */

(() => {
    "use strict";

    const CLAVE = "senalive_historial_v1";
    const MAX_REGISTROS = 200;
    const MAX_TEXTO = 600;

    const $ = id => document.getElementById(id);

    const seccion = $("h");

    if (!seccion) {
        console.error("No existe la sección Historial");
        return;
    }

    // ======================================
    // ALMACENAMIENTO LOCAL
    // ======================================

    let registros = [];
    let almacenamientoDisponible = true;

    try {
        const guardados = JSON.parse(
            localStorage.getItem(CLAVE) || "[]"
        );

        if (Array.isArray(guardados)) {
            registros = guardados.filter(r =>
                r &&
                typeof r.id === "string" &&
                typeof r.texto === "string" &&
                typeof r.fecha === "string"
            ).slice(0, MAX_REGISTROS);
        }

    } catch (error) {
        almacenamientoDisponible = false;
        console.warn("Almacenamiento no disponible", error);
    }

    function persistir() {
        if (!almacenamientoDisponible) return;

        try {
            localStorage.setItem(
                CLAVE,
                JSON.stringify(registros)
            );

        } catch (error) {
            almacenamientoDisponible = false;

            mensaje(
                "No se puede guardar permanentemente en este navegador."
            );
        }
    }

    // ======================================
    // ESTILOS DEL HISTORIAL
    // ======================================

    if (!$("senaliveHistorialEstilos")) {
        const estilo = document.createElement("style");

        estilo.id = "senaliveHistorialEstilos";

        estilo.textContent = `
            #h.mode.on {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 16px;
            }

            #h, #h * {
                min-width: 0;
                box-sizing: border-box;
            }

            #h .hist-head {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
            }

            #h .hist-title {
                margin: 0;
                font-size: 20px;
            }

            #h .hist-subtitle {
                margin: 5px 0 0;
                color: var(--mute);
                font-size: 13px;
            }

            #h .hist-total {
                display: inline-flex;
                padding: 6px 12px;
                border: 1px solid var(--line);
                border-radius: 99px;
                background: var(--bg);
                color: var(--accent);
                font-weight: 700;
            }

            #h .hist-form {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 10px;
                margin-top: 18px;
            }

            #h .hist-form input {
                width: 100%;
                padding: 11px 12px;
                border: 1px solid var(--line);
                border-radius: 9px;
                background: var(--bg);
                color: var(--ink);
            }

            #h .hist-button {
                border: 1px solid var(--line);
                border-radius: 9px;
                padding: 10px 14px;
                background: var(--bg);
                color: var(--ink);
                font: inherit;
                font-size: 13px;
                cursor: pointer;
            }

            #h .hist-button.primary {
                background: var(--accent);
                border-color: var(--accent);
                color: #042119;
                font-weight: 700;
            }

            #h .hist-button.danger {
                color: var(--bad);
            }

            #h .hist-button:hover {
                border-color: var(--accent);
            }

            #h .hist-button:focus-visible,
            #h input:focus-visible,
            #h select:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }

            #h .hist-toolbar {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 16px;
            }

            #h .hist-toolbar input {
                flex: 1 1 240px;
                min-width: 160px;
            }

            #h .hist-toolbar select {
                min-height: 40px;
                padding: 8px;
                border: 1px solid var(--line);
                border-radius: 9px;
                background: var(--bg);
                color: var(--ink);
            }

            #h .hist-status {
                min-height: 22px;
                margin: 12px 0 0;
                color: var(--mute);
                font-size: 13px;
            }

            #h .hist-list {
                display: grid;
                grid-template-columns:
                    repeat(auto-fill, minmax(min(100%, 350px), 1fr));
                gap: 12px;
                margin-top: 18px;
            }

            #h .hist-entry {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 15px;
                border: 1px solid var(--line);
                border-radius: 12px;
                background: var(--bg);
            }

            #h .hist-entry-head {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                flex-wrap: wrap;
                gap: 8px;
            }

            #h .hist-type {
                color: var(--accent);
                font-size: 12px;
                font-weight: 700;
            }

            #h .hist-date {
                color: var(--mute);
                font-size: 12px;
            }

            #h .hist-entry-text {
                min-height: 38px;
                margin: 0;
                font-size: 15px;
                line-height: 1.5;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }

            #h .hist-entry-actions {
                display: flex;
                justify-content: flex-end;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: auto;
            }

            #h .hist-empty {
                padding: 26px 16px;
                border: 1px dashed var(--line);
                border-radius: 12px;
                color: var(--mute);
                text-align: center;
            }

            #h .hist-foot {
                margin: 14px 0 0;
                color: var(--mute);
                font-size: 12px;
            }

            @media (max-width: 560px) {
                #h .card {
                    padding: 14px;
                }

                #h .hist-form {
                    grid-template-columns: 1fr;
                }

                #h .hist-form button {
                    width: 100%;
                }

                #h .hist-toolbar input,
                #h .hist-toolbar select {
                    flex: 1 1 100%;
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(estilo);
    }

    // ======================================
    // CREAR INTERFAZ
    // ======================================

    seccion.replaceChildren();

    const tarjeta = document.createElement("div");

    tarjeta.className = "card";

    tarjeta.innerHTML = `
        <div class="hist-head">
            <div>
                <h2 class="hist-title">
                    Historial de Señalive
                </h2>
                <p class="hist-subtitle">
                    Traducciones y resultados de tus prácticas.
                </p>
            </div>

            <span class="hist-total" id="histTotal">
                0 registros
            </span>
        </div>

        <form class="hist-form" id="histManualForm">
            <input
                id="histManualText"
                maxlength="600"
                placeholder="Escribe una nota o frase para guardar"
                aria-label="Nueva nota"
                autocomplete="off">

            <button
                class="hist-button primary"
                type="submit">
                Guardar nota
            </button>
        </form>

        <div class="hist-toolbar">
            <input
                id="histBuscar"
                placeholder="Buscar en el historial..."
                aria-label="Buscar historial">

            <select id="histFiltro">
                <option value="todos">
                    Todos los registros
                </option>
                <option value="Traducción">
                    Traducciones
                </option>
                <option value="Aprender">
                    Aprender
                </option>
                <option value="Juego">
                    Juego
                </option>
                <option value="Nota">
                    Notas
                </option>
            </select>

            <button
                class="hist-button danger"
                id="histVaciar"
                type="button">
                Vaciar historial
            </button>
        </div>

        <p class="hist-status"
           id="histEstado"
           role="status"
           aria-live="polite">
        </p>

        <div class="hist-list" id="histLista"></div>

        <p class="hist-foot">
            Tus registros se guardan únicamente
            en este navegador.
        </p>
    `;

    seccion.appendChild(tarjeta);

    const lista = $("histLista");
    const filtro = $("histFiltro");
    const buscar = $("histBuscar");
    const estado = $("histEstado");

    function mensaje(texto) {
        estado.textContent = texto;
    }

    // ======================================
    // FECHA Y HORA
    // ======================================

    function fechaLocal(fecha) {
        const d = new Date(fecha);

        if (Number.isNaN(d.getTime())) {
            return fecha;
        }

        return d.toLocaleString("es-HN", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    // ======================================
    // CREAR BOTONES
    // ======================================

    function crearBoton(texto, accion, peligro = false) {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.className =
            "hist-button" + (peligro ? " danger" : "");

        boton.textContent = texto;

        boton.addEventListener("click", accion);

        return boton;
    }

    // ======================================
    // MOSTRAR REGISTROS
    // ======================================

    function mostrarRegistros() {
        const consulta =
            buscar.value.trim().toLowerCase();

        const tipoSeleccionado = filtro.value;

        const visibles = registros.filter(registro => {
            const coincideTipo =
                tipoSeleccionado === "todos" ||
                registro.tipo === tipoSeleccionado;

            const coincideBusqueda =
                !consulta ||
                `${registro.texto} ${registro.tipo}`
                    .toLowerCase()
                    .includes(consulta);

            return coincideTipo && coincideBusqueda;
        });

        $("histTotal").textContent =
            `${registros.length} registro` +
            (registros.length === 1 ? "" : "s");

        lista.replaceChildren();

        if (visibles.length === 0) {
            const vacio = document.createElement("div");

            vacio.className = "hist-empty";

            vacio.textContent = registros.length
                ? "No hay resultados para esta búsqueda."
                : "Todavía no hay registros. Guarda una frase, completa un juego o escribe una nota.";

            lista.appendChild(vacio);
            return;
        }

        // Mostrar cada registro
        for (const registro of visibles) {
            const articulo = document.createElement("article");

            articulo.className = "hist-entry";

            const cabecera = document.createElement("div");
            cabecera.className = "hist-entry-head";

            const tipo = document.createElement("span");
            tipo.className = "hist-type";
            tipo.textContent = registro.tipo;

            const fecha = document.createElement("time");
            fecha.className = "hist-date";
            fecha.dateTime = registro.fecha;
            fecha.textContent = fechaLocal(registro.fecha);

            cabecera.append(tipo, fecha);

            const contenido = document.createElement("p");
            contenido.className = "hist-entry-text";
            contenido.textContent = registro.texto;

            const acciones = document.createElement("div");
            acciones.className = "hist-entry-actions";

            // Copiar registro
            const copiar = crearBoton(
                "Copiar",
                async () => {
                    try {
                        await navigator.clipboard.writeText(
                            registro.texto
                        );

                        mensaje("Texto copiado correctamente.");

                    } catch (error) {
                        mensaje(
                            "No se pudo copiar automáticamente."
                        );
                    }
                }
            );

            // Eliminar registro
            const eliminar = crearBoton(
                "Eliminar",
                () => {
                    registros = registros.filter(
                        item => item.id !== registro.id
                    );

                    persistir();
                    mostrarRegistros();

                    mensaje("Registro eliminado.");
                },
                true
            );

            acciones.append(copiar, eliminar);

            articulo.append(
                cabecera,
                contenido,
                acciones
            );

            lista.appendChild(articulo);
        }
    }

    // ======================================
    // GUARDAR REGISTRO
    // ======================================

    function guardar(tipo, texto) {
        const valor = String(texto ?? "")
            .trim()
            .slice(0, MAX_TEXTO);

        if (!valor) {
            mensaje("No hay texto para guardar.");
            return false;
        }

        const tiposValidos = [
            "Traducción",
            "Aprender",
            "Juego",
            "Nota"
        ];

        const categoria = tiposValidos.includes(tipo)
            ? tipo
            : "Nota";

        const id =
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        registros.unshift({
            id,
            tipo: categoria,
            texto: valor,
            fecha: new Date().toISOString()
        });

        registros = registros.slice(0, MAX_REGISTROS);

        persistir();
        mostrarRegistros();

        mensaje(`${categoria} guardada correctamente.`);

        return true;
    }

    // ======================================
    // OBTENER TEXTO DEL TRADUCTOR
    // ======================================

    function leerTraductor() {
        const salida =
            $("out")?.textContent?.trim() || "";

        if (salida) {
            return salida;
        }

        const prediccion =
            $("prediction")?.textContent?.trim() || "";

        if (
            !prediccion ||
            ["—", "-", "…"].includes(prediccion)
        ) {
            return "";
        }

        return prediccion;
    }

    // ======================================
    // GUARDAR DESDE TRADUCTOR
    // ======================================

    function guardarTraduccion() {
        const texto = leerTraductor();

        if (!texto) {
            mensaje(
                "No hay una frase reconocida para guardar."
            );

            window.alert(
                "Primero reconoce una letra, palabra o frase en Traductor."
            );

            return;
        }

        guardar("Traducción", texto);
    }

    // Conectar el botón de Traductor

    document.addEventListener(
        "click",
        evento => {
            const boton = evento.target.closest?.(
                "#t .btns button"
            );

            if (!boton) return;

            if (
                !/^guardar en historial$/i.test(
                    boton.textContent.trim()
                )
            ) {
                return;
            }

            evento.preventDefault();
            evento.stopImmediatePropagation();

            guardarTraduccion();
        },
        true
    );

    // ======================================
    // GUARDAR NOTAS MANUALES
    // ======================================

    $("histManualForm").addEventListener(
        "submit",
        evento => {
            evento.preventDefault();

            if (guardar("Nota", $("histManualText").value)) {
                $("histManualText").value = "";
            }
        }
    );

    // ======================================
    // BÚSQUEDA Y FILTROS
    // ======================================

    buscar.addEventListener(
        "input",
        mostrarRegistros
    );

    filtro.addEventListener(
        "change",
        mostrarRegistros
    );

    // ======================================
    // VACIAR HISTORIAL
    // ======================================

    $("histVaciar").addEventListener(
        "click",
        () => {
            if (!registros.length) return;

            const confirmar = window.confirm(
                "¿Eliminar todos los registros del historial?"
            );

            if (!confirmar) return;

            registros = [];

            persistir();
            mostrarRegistros();

            mensaje("Historial vaciado.");
        }
    );

    // ======================================
    // GUARDAR RESULTADOS DEL JUEGO
    // ======================================

    let juegoRegistrado = false;

    function observarJuego() {
        const ronda = $("gameRound");

        if (!ronda) return;

        function revisar() {
            const finalizado =
                /partida finalizada/i.test(
                    ronda.textContent || ""
                );

            if (!finalizado) {
                juegoRegistrado = false;
                return;
            }

            if (juegoRegistrado) return;

            juegoRegistrado = true;

            const puntos =
                $("gamePoints")?.textContent?.trim() || "0";

            const completadas =
                $("gameCompleted")?.textContent?.trim() || "0/5";

            guardar(
                "Juego",
                `Partida finalizada: ${completadas} palabras completadas, ${puntos} puntos.`
            );
        }

        const observador = new MutationObserver(revisar);

        observador.observe(ronda, {
            childList: true,
            characterData: true,
            subtree: true
        });

        revisar();
    }

    // ======================================
    // GUARDAR RESULTADOS DE APRENDER
    // ======================================

    let aprendizajeRegistrado = false;

    function observarAprender() {
        const feedback = $("learnFeedback");

        if (!feedback) return;

        function revisar() {
            const finalizado =
                /práctica completada/i.test(
                    feedback.textContent || ""
                );

            if (!finalizado) {
                aprendizajeRegistrado = false;
                return;
            }

            if (aprendizajeRegistrado) return;

            aprendizajeRegistrado = true;

            const puntos =
                $("learnPoints")?.textContent?.trim() || "0";

            guardar(
                "Aprender",
                `Práctica de letras completada: ${puntos} puntos.`
            );
        }

        const observador = new MutationObserver(revisar);

        observador.observe(feedback, {
            childList: true,
            characterData: true,
            subtree: true
        });

        revisar();
    }

    observarJuego();
    observarAprender();

    // ======================================
    // CONEXIÓN PARA OTROS MÓDULOS
    // ======================================

    window.SeñaliveHistorial = {
        guardar,
        actualizar: mostrarRegistros
    };

    window.addEventListener(
        "senalive:guardar-historial",
        evento => {
            guardar(
                evento.detail?.tipo,
                evento.detail?.texto
            );
        }
    );

    // ======================================
    // INICIAR
    // ======================================

    mostrarRegistros();

    if (!almacenamientoDisponible) {
        mensaje(
            "El historial será temporal porque el almacenamiento está bloqueado."
        );
    }

})();
