"""Endpoints de las 12 consultas del cubo OLAP (ACTIVIDAD CUBO OLAP.md) para el dashboard Angular.

Cada endpoint reproduce el SQL del documento (CS-1..CS-5, CC-1..CC-7). Los valores fijos del documento
(año 2024, departamentos, modalidades) se reemplazan por los filtros del dashboard, que se aplican
como un *dice* común. Algunas consultas ignoran el filtro que ellas mismas fijan (p. ej. CC-6 fija
Nariño vs. Colombia, así que ignora el filtro de departamento).

Contrato de respuesta: snies-frontend/src/app/core/models.ts.
"""
from dataclasses import dataclass, field
from typing import Any, Iterable
from fastapi import APIRouter, Depends, Query
from app.db import get_cursor

router = APIRouter(prefix="/api/olap", tags=["Cubo OLAP (dashboard)"])

# Coincidencias tolerantes a mayúsculas y a la Ñ (el SNIES no es consistente en la escritura).
PATRON_UDENAR = "%universidad de nari_o%"
PATRON_NARINO = "nari_o"
VECINOS_NARINO = ["nari_o", "cauca", "putumayo"]

FROM_CUBO = """
    FROM dw.fact_programa f
    JOIN dw.dim_programa p          ON p.sk_programa = f.sk_programa
    JOIN dw.dim_institucion i       ON i.sk_institucion = f.sk_institucion
    JOIN dw.dim_ubicacion u         ON u.sk_ubicacion = f.sk_ubicacion
    JOIN dw.dim_modalidad m         ON m.sk_modalidad = f.sk_modalidad
    JOIN dw.dim_area_conocimiento a ON a.sk_area = f.sk_area
    JOIN dw.dim_tiempo t            ON t.sk_tiempo = f.sk_tiempo
"""

# Filtro del dashboard -> columna del modelo dimensional
COLUMNAS_FILTRO = {
    "anio": "t.anio",
    "departamento": "u.departamento",
    "modalidad": "m.modalidad",
    "nivel": "p.nivel_formacion",
    "sector": "i.sector",
}


@dataclass
class Filtros:
    anio: list[int] = field(default_factory=list)
    departamento: list[str] = field(default_factory=list)
    modalidad: list[str] = field(default_factory=list)
    nivel: list[str] = field(default_factory=list)
    sector: list[str] = field(default_factory=list)


def leer_filtros(
    anio: list[int] = Query(default=[]),
    departamento: list[str] = Query(default=[]),
    modalidad: list[str] = Query(default=[]),
    nivel: list[str] = Query(default=[]),
    sector: list[str] = Query(default=[]),
) -> Filtros:
    """Query params repetidos: ?departamento=Nariño&departamento=Cauca. Vacío significa 'todos'."""
    return Filtros(anio, departamento, modalidad, nivel, sector)


def dice(f: Filtros, ignorar: Iterable[str] = (), extra: Iterable[str] = ()) -> tuple[str, list[Any]]:
    """Construye el WHERE común: excluye el miembro desconocido del programa y aplica los filtros."""
    condiciones = ["f.sk_programa <> -1", *extra]
    params: list[Any] = []
    for nombre, columna in COLUMNAS_FILTRO.items():
        valores = getattr(f, nombre)
        if valores and nombre not in ignorar:
            condiciones.append(f"{columna} = ANY(%s)")
            params.append(valores)
    return "WHERE " + " AND ".join(condiciones), params


def consultar(sql: str, params: list[Any]) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


# --------------------------------------------------------------------------- filtros y KPIs

@router.get("/filtros", summary="Valores disponibles para cada filtro del dashboard")
def opciones_filtro():
    def distintos(columna: str, extra: str = "") -> list[Any]:
        filas = consultar(
            f"SELECT DISTINCT {columna} AS v {FROM_CUBO} WHERE f.sk_programa <> -1 {extra} ORDER BY v;", []
        )
        return [r["v"] for r in filas if r["v"] is not None]

    return {
        "anio": distintos("t.anio", "AND t.sk_tiempo <> -1"),
        "departamento": distintos("u.departamento", "AND u.sk_ubicacion <> -1"),
        "modalidad": distintos("m.modalidad", "AND m.sk_modalidad <> -1"),
        "nivel": distintos("p.nivel_formacion"),
        "sector": distintos("i.sector", "AND i.sk_institucion <> -1"),
    }


@router.get("/kpis", summary="Indicadores principales del cubo con los filtros aplicados")
def kpis(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f)
    return consultar(f"""
        SELECT COUNT(DISTINCT f.sk_programa)               AS total_programas,
               COUNT(DISTINCT f.sk_institucion) FILTER (WHERE f.sk_institucion <> -1) AS total_instituciones,
               COUNT(DISTINCT u.departamento) FILTER (WHERE u.sk_ubicacion <> -1)     AS total_departamentos,
               ROUND(AVG(f.numero_creditos), 1)            AS promedio_creditos,
               ROUND(AVG(f.numero_periodos_duracion), 1)   AS promedio_periodos,
               ROUND(AVG(f.costo_matricula_nuevos), 0)     AS costo_promedio
        {FROM_CUBO} {where};
    """, params)[0]


# --------------------------------------------------------------------------- consultas simples

@router.get("/cs1", summary="CS-1 Cantidad de programas por nivel de formación")
def cs1(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f)
    return consultar(f"""
        SELECT p.nivel_formacion, COUNT(DISTINCT f.sk_programa) AS total_programas
        {FROM_CUBO} {where}
        GROUP BY p.nivel_formacion
        ORDER BY total_programas DESC;
    """, params)


@router.get("/cs2", summary="CS-2 Oferta de la Universidad de Nariño por modalidad (slice)")
def cs2(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f, ignorar=["departamento", "sector"], extra=["i.nombre_institucion ILIKE %s"])
    return consultar(f"""
        SELECT i.nombre_institucion,
               m.modalidad,
               COUNT(DISTINCT f.sk_programa)    AS total_programas,
               ROUND(AVG(f.numero_creditos), 1) AS promedio_creditos
        {FROM_CUBO} {where}
        GROUP BY i.nombre_institucion, m.modalidad
        ORDER BY total_programas DESC;
    """, [PATRON_UDENAR, *params])


@router.get("/cs3", summary="CS-3 Programas por año y periodicidad")
def cs3(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f, ignorar=["anio"], extra=["t.sk_tiempo <> -1"])
    return consultar(f"""
        SELECT t.anio, p.periodicidad, COUNT(DISTINCT f.sk_programa) AS total_programas
        {FROM_CUBO} {where}
        GROUP BY t.anio, p.periodicidad
        ORDER BY t.anio, p.periodicidad;
    """, params)


@router.get("/cs4", summary="CS-4 Costo promedio de matrícula por departamento")
def cs4(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f, extra=["f.costo_matricula_nuevos IS NOT NULL"])
    return consultar(f"""
        SELECT u.departamento,
               COUNT(DISTINCT f.sk_programa)           AS programas_con_costo,
               ROUND(AVG(f.costo_matricula_nuevos), 0) AS costo_promedio_matricula
        {FROM_CUBO} {where}
        GROUP BY u.departamento
        ORDER BY costo_promedio_matricula DESC;
    """, params)


@router.get("/cs5", summary="CS-5 Créditos y duración promedio por modalidad")
def cs5(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f)
    return consultar(f"""
        SELECT m.modalidad,
               ROUND(AVG(f.numero_creditos), 1)          AS promedio_creditos,
               ROUND(AVG(f.numero_periodos_duracion), 1) AS promedio_periodos,
               COUNT(DISTINCT f.sk_programa)             AS total_programas
        {FROM_CUBO} {where}
        GROUP BY m.modalidad
        ORDER BY total_programas DESC;
    """, params)


# --------------------------------------------------------------------------- consultas complejas

@router.get("/cc1", summary="CC-1 Dice: oferta por año, modalidad, departamento y nivel")
def cc1(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f, extra=["t.sk_tiempo <> -1"])
    return consultar(f"""
        SELECT t.anio, m.modalidad, u.departamento, p.nivel_formacion,
               COUNT(DISTINCT f.sk_programa)           AS total_programas,
               ROUND(AVG(f.numero_creditos), 1)        AS promedio_creditos,
               ROUND(AVG(f.costo_matricula_nuevos), 0) AS costo_promedio
        {FROM_CUBO} {where}
        GROUP BY t.anio, m.modalidad, u.departamento, p.nivel_formacion
        ORDER BY t.anio, u.departamento, m.modalidad, p.nivel_formacion
        LIMIT 2000;
    """, params)


@router.get("/cc2", summary="CC-2 Roll-up / drill-down geográfico (ROLLUP departamento, municipio)")
def cc2(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f)
    return consultar(f"""
        SELECT CASE WHEN GROUPING(u.departamento) = 1 THEN 'TOTAL NACIONAL' ELSE u.departamento END AS departamento,
               CASE WHEN GROUPING(u.municipio) = 1 THEN '(todos)' ELSE u.municipio END            AS municipio,
               GROUPING(u.departamento) + GROUPING(u.municipio) AS nivel_agregacion,
               COUNT(DISTINCT f.sk_programa)                    AS total_programas,
               ROUND(AVG(f.costo_matricula_nuevos), 0)          AS costo_promedio
        {FROM_CUBO} {where}
        GROUP BY ROLLUP (u.departamento, u.municipio)
        ORDER BY GROUPING(u.departamento), u.departamento, GROUPING(u.municipio), u.municipio;
    """, params)


@router.get("/cc3", summary="CC-3 Cubo completo: modalidad × nivel de formación × sector (CUBE)")
def cc3(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f)
    return consultar(f"""
        SELECT COALESCE(m.modalidad, 'TODAS')       AS modalidad,
               COALESCE(p.nivel_formacion, 'TODOS') AS nivel_formacion,
               COALESCE(i.sector, 'TODOS')          AS sector,
               COUNT(DISTINCT f.sk_programa)             AS total_programas,
               ROUND(AVG(f.numero_creditos), 1)          AS promedio_creditos,
               ROUND(AVG(f.numero_periodos_duracion), 1) AS promedio_periodos
        {FROM_CUBO} {where}
        GROUP BY CUBE (m.modalidad, p.nivel_formacion, i.sector)
        ORDER BY GROUPING(m.modalidad), GROUPING(p.nivel_formacion), GROUPING(i.sector), total_programas DESC;
    """, params)


@router.get("/cc4", summary="CC-4 Pivot: departamentos en filas y modalidades en columnas")
def cc4(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f)
    return consultar(f"""
        SELECT u.departamento,
               COUNT(DISTINCT f.sk_programa) FILTER (WHERE m.modalidad ILIKE 'presencial') AS presencial,
               COUNT(DISTINCT f.sk_programa) FILTER (WHERE m.modalidad ILIKE 'virtual')    AS virtual,
               COUNT(DISTINCT f.sk_programa) FILTER (WHERE m.modalidad ILIKE '%%distancia%%') AS a_distancia,
               COUNT(DISTINCT f.sk_programa) AS total,
               ROUND(100.0 * COUNT(DISTINCT f.sk_programa) FILTER (WHERE m.modalidad ILIKE 'presencial')
                     / NULLIF(COUNT(DISTINCT f.sk_programa), 0), 1) AS pct_presencial
        {FROM_CUBO} {where}
        GROUP BY u.departamento
        ORDER BY total DESC;
    """, params)


@router.get("/cc5", summary="CC-5 Benchmarking institucional: top 10 + Universidad de Nariño")
def cc5(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f)
    return consultar(f"""
        WITH base AS (
            SELECT i.nombre_institucion, i.sector,
                   COUNT(DISTINCT f.sk_programa)   AS total_programas,
                   AVG(f.numero_creditos)          AS prom_creditos,
                   AVG(f.numero_periodos_duracion) AS prom_periodos,
                   AVG(f.costo_matricula_nuevos)   AS prom_costo
            {FROM_CUBO} {where}
            GROUP BY i.nombre_institucion, i.sector
        ),
        ranking AS (
            SELECT b.*,
                   RANK() OVER (ORDER BY total_programas DESC) AS puesto_oferta,
                   AVG(prom_costo) OVER ()                     AS costo_prom_instituciones
            FROM base b
        )
        SELECT puesto_oferta, nombre_institucion, sector, total_programas,
               ROUND(prom_creditos, 1) AS prom_creditos,
               ROUND(prom_periodos, 1) AS prom_periodos,
               ROUND(prom_costo, 0)    AS costo_promedio,
               ROUND(100.0 * (prom_costo - costo_prom_instituciones)
                     / NULLIF(costo_prom_instituciones, 0), 1) AS dif_costo_pct
        FROM ranking
        WHERE puesto_oferta <= 10 OR nombre_institucion ILIKE %s
        ORDER BY puesto_oferta;
    """, [*params, PATRON_UDENAR])


@router.get("/cc6", summary="CC-6 Participación por campo amplio: Nariño vs. Colombia")
def cc6(f: Filtros = Depends(leer_filtros)):
    where, params = dice(f, ignorar=["departamento"])
    return consultar(f"""
        WITH nacional AS (
            SELECT a.cine_campo_amplio AS campo_amplio, COUNT(DISTINCT f.sk_programa) AS total_nal
            {FROM_CUBO} {where}
            GROUP BY a.cine_campo_amplio
        ),
        narino AS (
            SELECT a.cine_campo_amplio AS campo_amplio, COUNT(DISTINCT f.sk_programa) AS total_nar
            {FROM_CUBO} {where} AND u.departamento ILIKE %s
            GROUP BY a.cine_campo_amplio
        ),
        unido AS (
            SELECT nal.campo_amplio,
                   COALESCE(nar.total_nar, 0) AS programas_narino,
                   nal.total_nal              AS programas_nacional,
                   COALESCE(100.0 * COALESCE(nar.total_nar, 0) / NULLIF(SUM(nar.total_nar) OVER (), 0), 0) AS pct_nar,
                   100.0 * nal.total_nal / NULLIF(SUM(nal.total_nal) OVER (), 0)                          AS pct_nal
            FROM nacional nal
            LEFT JOIN narino nar ON nar.campo_amplio = nal.campo_amplio
        )
        SELECT campo_amplio, programas_narino, programas_nacional,
               ROUND(pct_nar, 2)           AS pct_narino,
               ROUND(pct_nal, 2)           AS pct_nacional,
               ROUND(pct_nar - pct_nal, 2) AS diferencia_pp
        FROM unido
        ORDER BY diferencia_pp DESC;
    """, [*params, *params, PATRON_NARINO])


@router.get("/cc7", summary="CC-7 Variación anual por departamento (LAG). Por defecto Nariño y vecinos")
def cc7(f: Filtros = Depends(leer_filtros)):
    if f.departamento:
        filtro_depto, valor = "u.departamento = ANY(%s)", f.departamento
    else:
        filtro_depto, valor = "u.departamento ILIKE ANY(%s)", VECINOS_NARINO
    where, params = dice(f, ignorar=["anio", "departamento"], extra=["t.sk_tiempo <> -1", filtro_depto])
    return consultar(f"""
        WITH oferta AS (
            SELECT u.departamento, t.anio, COUNT(DISTINCT f.sk_programa) AS total_programas
            {FROM_CUBO} {where}
            GROUP BY u.departamento, t.anio
        )
        SELECT departamento, anio, total_programas,
               LAG(total_programas) OVER w                   AS programas_anio_anterior,
               total_programas - LAG(total_programas) OVER w AS variacion,
               ROUND(100.0 * (total_programas - LAG(total_programas) OVER w)
                     / NULLIF(LAG(total_programas) OVER w, 0), 2) AS variacion_pct
        FROM oferta
        WINDOW w AS (PARTITION BY departamento ORDER BY anio)
        ORDER BY departamento, anio;
    """, [valor, *params])
