
# ==========================================
# SEÑALIVE - ENTRENAMIENTO CON TENSORFLOW
# Reconocimiento de letras ASL
# ==========================================

from pathlib import Path
from urllib.request import urlretrieve
import json

import numpy as np
import mediapipe as mp
import tensorflow as tf

from PIL import Image
from sklearn.model_selection import train_test_split


# ==========================================
# 1. CONFIGURACIÓN
# ==========================================

BACKEND = Path(__file__).resolve().parents[1]

# Dataset descargado anteriormente con KaggleHub
DATASET = (
    Path.home()
    / ".cache"
    / "kagglehub"
    / "datasets"
    / "grassknoted"
    / "asl-alphabet"
    / "versions"
    / "1"
    / "asl_alphabet_train"
    / "asl_alphabet_train"
)

# Carpeta para guardar el modelo
MODELOS = BACKEND / "models"
MODELOS.mkdir(parents=True, exist_ok=True)

# Modelo detector de MediaPipe
RUTA_DETECTOR = MODELOS / "hand_landmarker.task"

# Letras que vamos a entrenar
LETRAS = ["A", "B", "C", "D", "E"]

# Cantidad de imágenes por letra
MAX_IMAGENES = 300

# Configuración de TensorFlow
EPOCAS = 25
BATCH_SIZE = 32

np.random.seed(42)
tf.keras.utils.set_random_seed(42)


# ==========================================
# 2. PREPARAR MODELO DE MEDIAPIPE
# ==========================================

def preparar_detector():

    if RUTA_DETECTOR.exists():
        print("Detector MediaPipe encontrado.")
        return

    print("Descargando detector MediaPipe...")

    url = (
        "https://storage.googleapis.com/"
        "mediapipe-models/hand_landmarker/"
        "hand_landmarker/float16/1/"
        "hand_landmarker.task"
    )

    urlretrieve(url, RUTA_DETECTOR)

    print("Detector descargado correctamente.")


# ==========================================
# 3. NORMALIZAR PUNTOS DE LA MANO
# ==========================================

def normalizar_puntos(puntos):

    if len(puntos) != 21:
        return None

    # El punto 0 es la muñeca
    muneca = puntos[0]

    # Calcular escala de la mano
    escala = max(
        np.hypot(
            punto.x - muneca.x,
            punto.y - muneca.y
        )
        for punto in puntos
    )

    if escala < 0.001:
        return None

    # Convertir 21 puntos en 63 características
    features = []

    for punto in puntos:

        x = (punto.x - muneca.x) / escala
        y = (punto.y - muneca.y) / escala
        z = (punto.z - muneca.z) / escala

        features.extend([x, y, z])

    resultado = np.array(
        features,
        dtype=np.float32
    )

    if not np.all(np.isfinite(resultado)):
        return None

    return resultado


# ==========================================
# 4. EXTRAER DATOS DEL DATASET
# ==========================================

def cargar_dataset():

    X = []
    y = []

    rng = np.random.default_rng(42)

    # Configuración de MediaPipe
    opciones = mp.tasks.vision.HandLandmarkerOptions(

        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(RUTA_DETECTOR)
        ),

        running_mode=mp.tasks.vision.RunningMode.IMAGE,

        num_hands=1,

        min_hand_detection_confidence=0.4
    )

    print("\nIniciando extracción de coordenadas...")

    with mp.tasks.vision.HandLandmarker.create_from_options(
        opciones
    ) as detector:

        # Procesar cada letra
        for indice, letra in enumerate(LETRAS):

            carpeta = DATASET / letra

            if not carpeta.is_dir():
                raise FileNotFoundError(
                    f"No existe la carpeta: {carpeta}"
                )

            # Buscar imágenes de la letra
            imagenes = sorted([
                archivo
                for archivo in carpeta.iterdir()
                if archivo.suffix.lower() in [
                    ".jpg", ".jpeg", ".png"
                ]
            ])

            if not imagenes:
                raise ValueError(
                    f"No hay imágenes para la letra {letra}"
                )

            # Seleccionar una cantidad de imágenes
            indices = rng.choice(
                len(imagenes),
                size=min(MAX_IMAGENES, len(imagenes)),
                replace=False
            )

            validas = 0

            print(f"\nProcesando letra {letra}...")

            for indice_imagen in indices:

                ruta = imagenes[int(indice_imagen)]

                try:

                    # Abrir imagen y convertir a RGB
                    with Image.open(ruta) as imagen:

                        rgb = np.ascontiguousarray(
                            np.asarray(
                                imagen.convert("RGB"),
                                dtype=np.uint8
                            )
                        )

                    # Convertir al formato MediaPipe
                    imagen_mp = mp.Image(
                        image_format=mp.ImageFormat.SRGB,
                        data=rgb
                    )

                    # Detectar puntos de la mano
                    resultado = detector.detect(imagen_mp)

                    if not resultado.hand_landmarks:
                        continue

                    puntos = resultado.hand_landmarks[0]

                    # Normalizar coordenadas
                    features = normalizar_puntos(puntos)

                    if features is None:
                        continue

                    # Guardar datos y etiqueta
                    X.append(features)
                    y.append(indice)

                    validas += 1

                except (OSError, ValueError) as error:

                    print(
                        f"Error en {ruta.name}: {error}"
                    )

            print(
                f"Letra {letra}: "
                f"{validas}/{len(indices)} imágenes válidas"
            )

    return (
        np.array(X, dtype=np.float32),
        np.array(y, dtype=np.int32)
    )


# ==========================================
# 5. CREAR RED NEURONAL
# ==========================================

def crear_modelo():

    modelo = tf.keras.Sequential([

        # Entrada: 21 puntos × 3 coordenadas
        tf.keras.layers.Input(shape=(63,)),

        # Primera capa oculta
        tf.keras.layers.Dense(
            128,
            activation="relu"
        ),

        tf.keras.layers.Dropout(0.2),

        # Segunda capa oculta
        tf.keras.layers.Dense(
            64,
            activation="relu"
        ),

        # Salida: una neurona por letra
        tf.keras.layers.Dense(
            len(LETRAS),
            activation="softmax"
        )
    ])

    modelo.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )

    return modelo


# ==========================================
# 6. ENTRENAR TENSORFLOW
# ==========================================

def entrenar():

    print("===================================")
    print("SEÑALIVE - ENTRENAMIENTO DE LETRAS")
    print("===================================")

    # Verificar ruta del dataset
    if not DATASET.is_dir():

        raise FileNotFoundError(
            f"No se encontró el dataset:\n{DATASET}"
        )

    # Preparar detector
    preparar_detector()

    # Extraer datos
    X, y = cargar_dataset()

    print("\nTotal de muestras:", len(X))

    # Comprobar que haya datos suficientes
    conteos = np.bincount(
        y,
        minlength=len(LETRAS)
    )

    if np.any(conteos < 10):

        raise ValueError(
            f"Muestras insuficientes: {conteos}"
        )

    # Separar entrenamiento y prueba
    X_train, X_test, y_train, y_test = (
        train_test_split(
            X,
            y,
            test_size=0.20,
            random_state=42,
            stratify=y
        )
    )

    # Separar validación
    X_train, X_val, y_train, y_val = (
        train_test_split(
            X_train,
            y_train,
            test_size=0.20,
            random_state=42,
            stratify=y_train
        )
    )

    print("\nCreando red neuronal...")

    modelo = crear_modelo()

    modelo.summary()

    print("\nIniciando entrenamiento...")

    modelo.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCAS,
        batch_size=BATCH_SIZE
    )

    # Evaluar resultados
    perdida, precision = modelo.evaluate(
        X_test,
        y_test,
        verbose=0
    )

    print("\n===================================")
    print("RESULTADOS DEL ENTRENAMIENTO")
    print("===================================")

    print(f"Precisión: {precision * 100:.2f}%")
    print(f"Pérdida: {perdida:.4f}")

    # Guardar modelo entrenado
    ruta_modelo = MODELOS / "letras.keras"

    modelo.save(ruta_modelo)

    # Guardar etiquetas
    ruta_etiquetas = MODELOS / "labels.json"

    with open(
        ruta_etiquetas,
        "w",
        encoding="utf-8"
    ) as archivo:

        json.dump(
            LETRAS,
            archivo,
            indent=4,
            ensure_ascii=False
        )

    print("\nModelo guardado en:")
    print(ruta_modelo)

    print("\nEtiquetas guardadas en:")
    print(ruta_etiquetas)

    print("\n¡Entrenamiento finalizado!")


# ==========================================
# 7. EJECUTAR PROGRAMA
# ==========================================

if __name__ == "__main__":
    entrenar()
