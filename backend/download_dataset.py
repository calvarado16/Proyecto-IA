
import kagglehub
from pathlib import Path

print("Descargando dataset ASL Alphabet...")

# Usar la caché predeterminada de KaggleHub
ruta = kagglehub.dataset_download(
    "grassknoted/asl-alphabet"
)

print("\nDataset disponible en:")
print(ruta)

# Buscar las carpetas de entrenamiento
raiz = Path(ruta)

carpetas = [
    p for p in raiz.rglob("asl_alphabet_train")
    if p.is_dir() and (p / "A").is_dir()
]

if carpetas:
    entrenamiento = carpetas[0]

    print("\nCarpeta de entrenamiento:")
    print(entrenamiento)

    for letra in ["A", "B", "C", "D", "E"]:
        carpeta = entrenamiento / letra

        cantidad = (
            len(list(carpeta.glob("*.jpg")))
            if carpeta.exists()
            else 0
        )

        print(f"Letra {letra}: {cantidad} imágenes")
else:
    print("No se encontró asl_alphabet_train.")
    print("Contenido:", [p.name for p in raiz.iterdir()])
