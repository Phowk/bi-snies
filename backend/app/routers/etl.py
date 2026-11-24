"""Router para la subida de archivos y el seguimiento del pipeline ETL.

Todas las consultas trabajan sobre audit.log_cargas (Diseño Sistema ELT SNIES, sección 4), que es la
misma tabla que actualiza etl_pipeline.ejecutar_etl. Las respuestas siguen el contrato `Carga` del
frontend (snies-frontend/src/app/core/models.ts).
"""
import logging
import os
import shutil
import tempfile
import uuid
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from app.db import get_cursor
from app.etl_pipeline import ejecutar_etl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/etl", tags=["Sistema ETL"])

TEMP_UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "snies_etl_uploads")
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

EXTENSIONES_PERMITIDAS = (".xlsx", ".xls", ".csv")

COLUMNAS_CARGA = """
    id_carga, nombre_archivo, peso_archivo_kb, fecha_inicio, fecha_fin, estado,
    total_filas_origen, filas_cargadas_hechos, filas_rechazadas, mensaje_error
"""


def _procesar_en_segundo_plano(ruta: str, id_carga: int) -> None:
    """Ejecuta el ETL y borra el archivo temporal. El estado final queda en audit.log_cargas."""
    try:
        ejecutar_etl(ruta, id_carga)
    except Exception:
        # ejecutar_etl ya marcó la carga como ERROR con el mensaje; aquí solo se deja rastro en el log.
        logger.exception("Falló el ETL de la carga %s", id_carga)
    finally:
        try:
            os.remove(ruta)
        except OSError:
            pass


@router.post("/upload", status_code=202, summary="Subir archivo Excel/CSV y lanzar el pipeline ETL")
def subir_archivo_etl(
    background_tasks: BackgroundTasks,
    archivo: UploadFile = File(..., description="Archivo oficial del SNIES (.xlsx, .xls, .csv)"),
):
    nombre = os.path.basename(archivo.filename or "archivo_desconocido")
    if not nombre.lower().endswith(EXTENSIONES_PERMITIDAS):
        raise HTTPException(status_code=400, detail="Formato inválido. Use Excel (.xlsx, .xls) o CSV (.csv).")

    ruta = os.path.join(TEMP_UPLOAD_DIR, f"{uuid.uuid4().hex}_{nombre}")
    with open(ruta, "wb") as destino:
        shutil.copyfileobj(archivo.file, destino)

    peso_kb = round(os.path.getsize(ruta) / 1024.0, 2)
    if peso_kb == 0:
        os.remove(ruta)
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO audit.log_cargas (nombre_archivo, peso_archivo_kb, estado)
            VALUES (%s, %s, 'EN_PROCESO')
            RETURNING id_carga;
            """,
            (nombre, peso_kb),
        )
        id_carga = cur.fetchone()["id_carga"]

    background_tasks.add_task(_procesar_en_segundo_plano, ruta, id_carga)
    return {"id_carga": id_carga}


@router.get("/cargas", summary="Historial de cargas (audit.log_cargas), más reciente primero")
def listar_cargas():
    with get_cursor() as cur:
        cur.execute(f"SELECT {COLUMNAS_CARGA} FROM audit.log_cargas ORDER BY id_carga DESC;")
        return cur.fetchall()


@router.get("/cargas/{id_carga}", summary="Estado de una carga (para el sondeo del frontend)")
def obtener_carga(id_carga: int):
    with get_cursor() as cur:
        cur.execute(f"SELECT {COLUMNAS_CARGA} FROM audit.log_cargas WHERE id_carga = %s;", (id_carga,))
        carga = cur.fetchone()
    if not carga:
        raise HTTPException(status_code=404, detail=f"Carga con ID {id_carga} no encontrada.")
    return carga


@router.get("/cargas/{id_carga}/errores", summary="Anomalías registradas en audit.log_errores_etl para una carga")
def resumen_errores_carga(id_carga: int):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT columna, motivo, COUNT(*) AS ocurrencias, MIN(fila_origen) AS primera_fila
            FROM audit.log_errores_etl
            WHERE id_carga = %s
            GROUP BY columna, motivo
            ORDER BY ocurrencias DESC;
            """,
            (id_carga,),
        )
        items = cur.fetchall()
    return {"id_carga": id_carga, "total_tipos": len(items), "items": items}
