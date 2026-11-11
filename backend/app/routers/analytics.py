"""Router analítico para consultas OLAP dinámicas, pivot, benchmarking y presets."""
import csv
import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.db import get_cursor
from app.olap_engine import (
    DIMENSIONS_MAP,
    METRICS_MAP,
    _construir_joins,
    _construir_where,
    ejecutar_drillthrough,
    ejecutar_olap_compare,
    ejecutar_olap_pivot,
    ejecutar_olap_query,
)
from app.schemas import (
    DrillthroughRequest,
    FilterOptionsRequest,
    OlapCompareRequest,
    OlapPivotRequest,
    OlapQueryRequest,
    PresetInfo,
)

router = APIRouter(prefix="/api/analytics", tags=["Cubo OLAP y Analítica"])

# Plantillas de las 12 consultas del documento ACTIVIDAD CUBO OLAP.md
PRESETS: list[PresetInfo] = [
    PresetInfo(
        code="CS-1",
        title="Cantidad de programas por nivel de formación",
        description="Agregación básica de la oferta académica por nivel de formación.",
        operation="group",
        query={
            "dimensions": ["nivel_formacion"],
            "metrics": ["total_programas"],
            "order_by": "total_programas",
            "order_dir": "DESC"
        }
    ),
    PresetInfo(
        code="CS-2",
        title="Oferta de la Universidad de Nariño por modalidad",
        description="Slice: oferta académica y créditos promedio en Udenar.",
        operation="group",
        query={
            "dimensions": ["nombre_institucion", "modalidad"],
            "metrics": ["total_programas", "promedio_creditos"],
            "filters": {"nombre_institucion": "Universidad de Nariño"},
            "order_by": "total_programas",
            "order_dir": "DESC"
        }
    ),
    PresetInfo(
        code="CS-3",
        title="Programas ofertados por año y periodicidad",
        description="Evolución anual de programas según periodicidad.",
        operation="group",
        query={
            "dimensions": ["anio", "periodicidad"],
            "metrics": ["total_programas"],
            "order_by": "total_programas",
            "order_dir": "DESC"
        }
    ),
    PresetInfo(
        code="CS-4",
        title="Costo promedio de matrícula por departamento",
        description="Costo financiero promedio y programas con costo por departamento.",
        operation="group",
        query={
            "dimensions": ["departamento"],
            "metrics": ["programas_con_costo", "costo_promedio"],
            "filters": {"solo_con_costo": True},
            "order_by": "costo_promedio",
            "order_dir": "DESC"
        }
    ),
    PresetInfo(
        code="CS-5",
        title="Créditos y duración promedio por modalidad",
        description="Esfuerzo académico en créditos y semestres según modalidad.",
        operation="group",
        query={
            "dimensions": ["modalidad"],
            "metrics": ["promedio_creditos", "promedio_periodos", "total_programas"],
            "order_by": "total_programas",
            "order_dir": "DESC"
        }
    ),
    PresetInfo(
        code="CC-1",
        title="Dice: oferta por año, modalidad, departamento y nivel",
        description="Subcubo multidimensional con 4 dimensiones de filtrado simultáneo.",
        operation="group",
        query={
            "dimensions": ["anio", "departamento", "modalidad", "nivel_formacion"],
            "metrics": ["total_programas", "promedio_creditos", "costo_promedio"],
            "filters": {
                "modalidad": ["Presencial", "Virtual"],
                "departamento": ["Nariño", "Cauca", "Putumayo"],
                "nivel_formacion": ["Universitario", "Especialización universitaria", "Maestría"]
            },
            "order_by": "total_programas",
            "order_dir": "DESC"
        }
    ),
    PresetInfo(
        code="CC-2",
        title="Roll-up / Drill-down geográfico",
        description="Navegación jerárquica con subtotales: Región -> Departamento -> Municipio.",
        operation="rollup",
        query={
            "dimensions": ["region", "departamento", "municipio"],
            "metrics": ["total_programas", "costo_promedio"],
            "limit": 500
        }
    ),
    PresetInfo(
        code="CC-3",
        title="Cubo completo: modalidad × nivel de formación × sector",
        description="Cálculo de todas las 8 combinaciones posibles de agregación (CUBE).",
        operation="cube",
        query={
            "dimensions": ["modalidad", "nivel_formacion", "sector"],
            "metrics": ["total_programas", "promedio_creditos", "promedio_periodos"],
            "limit": 500
        }
    ),
    PresetInfo(
        code="CC-4",
        title="Pivot: departamentos en filas y modalidades en columnas",
        description="Rotación matricial con porcentaje de oferta presencial.",
        operation="group",
        query={
            "row_dims": ["departamento"],
            "col_dim": "modalidad",
            "metric": "total_programas"
        }
    ),
    PresetInfo(
        code="CC-5",
        title="Benchmarking institucional con ranking",
        description="Ranking nacional de oferta y comparación % frente al costo promedio.",
        operation="group",
        query={
            "mode": "benchmarking_institucion",
            "institucion_foco": "Universidad de Nariño",
            "top_n": 10
        }
    ),
    PresetInfo(
        code="CC-6",
        title="Participación por campo amplio: Nariño vs. Colombia",
        description="Concentración temática local frente a la media nacional en puntos porcentuales.",
        operation="group",
        query={
            "mode": "participacion_territorial",
            "territorio_col": "departamento",
            "territorio_valor": "Nariño",
            "campo_agrupador": "cine_campo_amplio"
        }
    ),
    PresetInfo(
        code="CC-7",
        title="Variación anual de la oferta con LAG",
        description="Análisis temporal interanual de oferta y variación porcentual.",
        operation="group",
        query={
            "dimensions": ["departamento", "anio"],
            "metrics": ["total_programas", "variacion_anual", "variacion_pct"],
            "filters": {"departamento": ["Nariño", "Cauca", "Putumayo"]}
        }
    ),
]


@router.get("/metadata", summary="Metadatos para el constructor visual de consultas")
def obtener_metadatos_olap():
    """Retorna dimensiones disponibles, métricas, operadores y rangos de datos para el frontend."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                MIN(numero_creditos) AS min_cred,
                MAX(numero_creditos) AS max_cred,
                MIN(numero_periodos_duracion) AS min_per,
                MAX(numero_periodos_duracion) AS max_per,
                MIN(costo_matricula_nuevos) AS min_costo,
                MAX(costo_matricula_nuevos) AS max_costo
            FROM dw.fact_programa
            WHERE sk_programa <> -1;
        """)
        rangos = cur.fetchone()

        cur.execute("""
            SELECT DISTINCT anio FROM dw.dim_tiempo
            WHERE sk_tiempo <> -1 AND anio > 1900
            ORDER BY anio DESC;
        """)
        anios = [r["anio"] for r in cur.fetchall()]

    return {
        "dimensions": list(DIMENSIONS_MAP.keys()),
        "hierarchies": {
            "geografica": ["region", "departamento", "municipio"],
            "conocimiento": ["cine_campo_amplio", "cine_campo_especifico", "cine_campo_detallado", "area_conocimiento", "nucleo_basico"],
            "academica": ["nivel_academico", "nivel_formacion", "nombre_programa"],
            "institucional": ["sector", "caracter_academico", "nombre_institucion"],
            "temporal": ["anio", "semestre", "periodo"]
        },
        "metrics": list(METRICS_MAP.keys()),
        "operations": ["group", "rollup", "cube"],
        "ranges": rangos,
        "available_years": anios
    }


@router.get("/kpis", summary="Tarjetas resumen principales")
def obtener_kpis():
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(DISTINCT f.sk_programa) AS total_programas,
                COUNT(DISTINCT f.sk_institucion) AS total_instituciones,
                COUNT(DISTINCT f.sk_ubicacion) AS total_municipios,
                ROUND(AVG(f.numero_creditos), 1) AS promedio_creditos,
                ROUND(AVG(f.numero_periodos_duracion), 1) AS promedio_periodos,
                ROUND(AVG(f.costo_matricula_nuevos), 0) AS costo_promedio,
                COUNT(DISTINCT f.sk_programa) FILTER (WHERE f.costo_matricula_nuevos IS NOT NULL) AS programas_con_costo
            FROM dw.fact_programa f
            WHERE f.sk_programa <> -1;
        """)
        return cur.fetchone()


@router.post("/filter-options", summary="Opciones para filtros dinámicos en cascada")
def obtener_opciones_filtro(req: FilterOptionsRequest):
    dim_info = DIMENSIONS_MAP[req.target_dim]
    col_expr = dim_info["expr"]
    joins_alias = {dim_info["alias"]}

    where_clauses, params = _construir_where(req.active_filters, joins_alias)
    where_clauses.append(f"{col_expr} IS NOT NULL AND {col_expr} <> ''")

    if req.search:
        where_clauses.append(f"{col_expr}::text ILIKE %s")
        params.append(f"%{req.search}%")

    joins_sql = _construir_joins(joins_alias)
    where_sql = " AND ".join(where_clauses)

    sql_query = f"""
        SELECT DISTINCT {col_expr} AS valor
        FROM dw.fact_programa f
        {joins_sql}
        WHERE {where_sql}
        ORDER BY valor ASC
        LIMIT %s;
    """
    params.append(req.limit)

    with get_cursor() as cur:
        cur.execute(sql_query, params)
        return [r["valor"] for r in cur.fetchall()]


@router.post("/query", summary="Ejecutar consulta OLAP dinámica libre (Slice, Dice, Rollup, Cube)")
def consultar_olap(req: OlapQueryRequest):
    try:
        data = ejecutar_olap_query(req)
        return {
            "total_rows": len(data),
            "dimensions": req.dimensions,
            "metrics": req.metrics,
            "operation": req.operation,
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en consulta OLAP: {str(e)}")


@router.post("/pivot", summary="Tabla dinámica con rotación de dimensiones (Pivot)")
def pivot_olap(req: OlapPivotRequest):
    try:
        return ejecutar_olap_pivot(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en pivote OLAP: {str(e)}")


@router.post("/compare", summary="Benchmarking institucional y comparativa territorial")
def comparar_olap(req: OlapCompareRequest):
    try:
        data = ejecutar_olap_compare(req)
        return {
            "mode": req.mode,
            "total_items": len(data),
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en comparación OLAP: {str(e)}")


@router.post("/drillthrough", summary="Detalle de programas o exportación CSV al hacer clic en un dato")
def drillthrough_olap(req: DrillthroughRequest):
    try:
        result = ejecutar_drillthrough(req.filters, page=req.page, page_size=req.page_size)

        if req.format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)

            if result["items"]:
                headers = list(result["items"][0].keys())
                writer.writerow(headers)
                for row in result["items"]:
                    writer.writerow([row[h] for h in headers])

            output.seek(0)
            return StreamingResponse(
                output,
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=programas_detalle.csv"}
            )

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en drillthrough: {str(e)}")


@router.get("/presets", summary="Obtener las 12 consultas del documento como presets editables")
def listar_presets():
    return PRESETS
