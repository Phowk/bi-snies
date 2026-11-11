"""Router para la gestión, subida y monitoreo del pipeline ETL."""
import os
import shutil
import tempfile
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile
from app.db import get_cursor
from app.etl_pipeline import ejecutar_etl

router = APIRouter(prefix="/api/etl", tags=["Sistema ETL"])

TEMP_UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "snies_etl_uploads")
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)


@router.post("/upload", summary="Subir archivo Excel/CSV y ejecutar pipeline ETL")
async def subir_archivo_etl(
    background_tasks: BackgroundTasks,
    archivo: UploadFile = File(..., description="Archivo oficial del SNIES (.xlsx, .xls, .csv)")
):
    nombre = archivo.filename or "archivo_desconocido"
    nombre_lower = nombre.lower()

    if not nombre_lower.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(
            status_code=400,
            detail="Formato de archivo inválido. Debe ser Excel (.xlsx, .xls) o CSV (.csv)."
        )

    # Guardar archivo en disco
    ruta_guardado = os.path.join(TEMP_UPLOAD_DIR, f"{tempfile.mktemp().split(os.sep)[-1]}_{nombre}")
    with open(ruta_guardado, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    peso_kb = round(os.path.getsize(ruta_guardado) / 1024.0, 2)

    # Registrar lote en staging.stg_cargas
    with get_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO staging.stg_cargas (archivo_programas, archivo_instituciones, estado, mensaje)
            VALUES (%s, %s, 'EN_PROCESO', %s)
            RETURNING id_carga;
        """, (nombre, nombre, f"Archivo recibido ({peso_kb} KB). Procesando..."))
        id_carga = cur.fetchone()["id_carga"]

    # Despachar procesamiento asíncrono
    background_tasks.add_task(ejecutar_etl, ruta_guardado, id_carga)

    return {
        "id_carga": id_carga,
        "mensaje": "Archivo recibido. Procesamiento ETL iniciado en segundo plano.",
        "nombre_archivo": nombre,
        "peso_kb": peso_kb,
        "estado": "EN_PROCESO"
    }


@router.get("/status/{id_carga}", summary="Consultar estado de una carga por ID")
def consultar_estado_carga(id_carga: int):
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                id_carga,
                archivo_programas AS nombre_archivo,
                fecha_inicio,
                fecha_fin,
                estado,
                registros_programas,
                registros_instituciones,
                mensaje
            FROM staging.stg_cargas
            WHERE id_carga = %s;
        """, (id_carga,))
        carga = cur.fetchone()

        if not carga:
            raise HTTPException(status_code=404, detail=f"Carga con ID {id_carga} no encontrada.")

        # Obtener detalle del proceso ETL asociado si existe
        cur.execute("""
            SELECT
                id_etl,
                fecha_inicio,
                fecha_fin,
                estado,
                instituciones_procesadas,
                programas_procesados,
                registros_auditados,
                mensaje
            FROM etl.control_etl
            WHERE id_carga = %s
            ORDER BY id_etl DESC
            LIMIT 1;
        """, (id_carga,))
        etl_info = cur.fetchone()

    carga["control_etl"] = etl_info
    return carga


@router.get("/history", summary="Historial paginado de ejecuciones ETL")
def listar_historial_cargas(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100)
):
    offset = (page - 1) * page_size
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM staging.stg_cargas;")
        total_items = cur.fetchone()["total"]

        cur.execute("""
            SELECT
                c.id_carga,
                c.archivo_programas AS nombre_archivo,
                c.fecha_inicio,
                c.fecha_fin,
                c.estado,
                c.registros_programas,
                c.registros_instituciones,
                c.mensaje,
                e.estado AS estado_etl,
                e.registros_auditados
            FROM staging.stg_cargas c
            LEFT JOIN etl.control_etl e ON e.id_carga = c.id_carga
            ORDER BY c.id_carga DESC
            LIMIT %s OFFSET %s;
        """, (page_size, offset))
        items = cur.fetchall()

    return {
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": (total_items + page_size - 1) // page_size if total_items > 0 else 1,
        "items": items
    }


@router.get("/audit/{id_carga}", summary="Resumen de transformaciones auditadas de una carga")
def resumen_auditoria_carga(id_carga: int):
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                tabla_destino,
                columna,
                regla,
                descripcion,
                registros_afectados
            FROM etl.v_resumen_auditoria
            WHERE id_carga = %s
            ORDER BY registros_afectados DESC;
        """, (id_carga,))
        items = cur.fetchall()

    return {
        "id_carga": id_carga,
        "total_reglas_aplicadas": len(items),
        "items": items
    }
