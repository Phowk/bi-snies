"""Motor de consultas OLAP dinámico y seguro sobre el modelo dimensional de 6 dimensiones."""
from typing import Any
from app.db import get_cursor
from app.schemas import (
    DimensionName,
    MetricName,
    OlapCompareRequest,
    OlapFilters,
    OlapPivotRequest,
    OlapQueryRequest,
)

# Mapeo formal a las 6 dimensiones físicas creadas en dw
DIMENSIONS_MAP: dict[DimensionName, dict[str, Any]] = {
    # 1. Dimensión Ubicación
    "region": {"expr": "u.region", "alias": "u", "join": "JOIN dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion"},
    "departamento": {"expr": "u.departamento", "alias": "u", "join": "JOIN dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion"},
    "municipio": {"expr": "u.municipio", "alias": "u", "join": "JOIN dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion"},
    # 2. Dimensión Institución
    "nombre_institucion": {"expr": "i.nombre_institucion", "alias": "i", "join": "JOIN dw.dim_institucion i ON i.sk_institucion = f.sk_institucion"},
    "codigo_institucion": {"expr": "i.codigo_institucion", "alias": "i", "join": "JOIN dw.dim_institucion i ON i.sk_institucion = f.sk_institucion"},
    "sector": {"expr": "i.sector", "alias": "i", "join": "JOIN dw.dim_institucion i ON i.sk_institucion = f.sk_institucion"},
    "caracter_academico": {"expr": "i.caracter_academico", "alias": "i", "join": "JOIN dw.dim_institucion i ON i.sk_institucion = f.sk_institucion"},
    "estado_institucion": {"expr": "i.estado_institucion", "alias": "i", "join": "JOIN dw.dim_institucion i ON i.sk_institucion = f.sk_institucion"},
    # 3. Dimensión Modalidad
    "modalidad": {"expr": "m.modalidad", "alias": "m", "join": "JOIN dw.dim_modalidad m ON m.sk_modalidad = f.sk_modalidad"},
    # 4. Dimensión Área de Conocimiento
    "cine_campo_amplio": {"expr": "a.cine_campo_amplio", "alias": "a", "join": "JOIN dw.dim_area_conocimiento a ON a.sk_area = f.sk_area"},
    "cine_campo_especifico": {"expr": "a.cine_campo_especifico", "alias": "a", "join": "JOIN dw.dim_area_conocimiento a ON a.sk_area = f.sk_area"},
    "cine_campo_detallado": {"expr": "a.cine_campo_detallado", "alias": "a", "join": "JOIN dw.dim_area_conocimiento a ON a.sk_area = f.sk_area"},
    "area_conocimiento": {"expr": "a.area_conocimiento", "alias": "a", "join": "JOIN dw.dim_area_conocimiento a ON a.sk_area = f.sk_area"},
    "nucleo_basico": {"expr": "a.nucleo_basico", "alias": "a", "join": "JOIN dw.dim_area_conocimiento a ON a.sk_area = f.sk_area"},
    # 5. Dimensión Tiempo
    "anio": {"expr": "t.anio", "alias": "t", "join": "JOIN dw.dim_tiempo t ON t.sk_tiempo = f.sk_tiempo"},
    "semestre": {"expr": "t.semestre", "alias": "t", "join": "JOIN dw.dim_tiempo t ON t.sk_tiempo = f.sk_tiempo"},
    "periodo": {"expr": "t.periodo", "alias": "t", "join": "JOIN dw.dim_tiempo t ON t.sk_tiempo = f.sk_tiempo"},
    # 6. Dimensión Programa
    "codigo_snies": {"expr": "p.codigo_snies", "alias": "p", "join": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa"},
    "nombre_programa": {"expr": "p.nombre_programa", "alias": "p", "join": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa"},
    "nivel_academico": {"expr": "p.nivel_academico", "alias": "p", "join": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa"},
    "nivel_formacion": {"expr": "p.nivel_formacion", "alias": "p", "join": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa"},
    "estado_programa": {"expr": "p.estado_programa", "alias": "p", "join": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa"},
    "reconocimiento": {"expr": "p.reconocimiento", "alias": "p", "join": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa"},
    "periodicidad": {"expr": "p.periodicidad", "alias": "p", "join": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa"},
}

METRICS_MAP: dict[MetricName, str] = {
    "total_programas": "COUNT(DISTINCT f.sk_programa)",
    "total_oferta": "COUNT(f.sk_fact)",
    "total_instituciones": "COUNT(DISTINCT f.sk_institucion)",
    "total_municipios": "COUNT(DISTINCT f.sk_ubicacion)",
    "programas_con_costo": "COUNT(DISTINCT f.sk_programa) FILTER (WHERE f.costo_matricula_nuevos IS NOT NULL)",
    "promedio_creditos": "ROUND(AVG(f.numero_creditos), 1)",
    "min_creditos": "MIN(f.numero_creditos)",
    "max_creditos": "MAX(f.numero_creditos)",
    "promedio_periodos": "ROUND(AVG(f.numero_periodos_duracion), 1)",
    "min_periodos": "MIN(f.numero_periodos_duracion)",
    "max_periodos": "MAX(f.numero_periodos_duracion)",
    "costo_promedio": "ROUND(AVG(f.costo_matricula_nuevos), 0)",
    "costo_minimo": "ROUND(MIN(f.costo_matricula_nuevos), 0)",
    "costo_maximo": "ROUND(MAX(f.costo_matricula_nuevos), 0)",
    "pct_total": "ROUND(100.0 * COUNT(DISTINCT f.sk_programa) / NULLIF(SUM(COUNT(DISTINCT f.sk_programa)) OVER (), 0), 2)",
    "variacion_anual": "COUNT(DISTINCT f.sk_programa) - LAG(COUNT(DISTINCT f.sk_programa)) OVER w",
    "variacion_pct": "ROUND(100.0 * (COUNT(DISTINCT f.sk_programa) - LAG(COUNT(DISTINCT f.sk_programa)) OVER w) / NULLIF(LAG(COUNT(DISTINCT f.sk_programa)) OVER w, 0), 2)"
}


def _construir_where(filters: OlapFilters, joins_necesarios: set[str]) -> tuple[list[str], list[Any]]:
    where_clauses: list[str] = ["f.sk_programa <> -1"]
    params: list[Any] = []

    def agregar_in(col_expr: str, join_alias: str, items: list[Any] | None):
        if items:
            joins_necesarios.add(join_alias)
            placeholders = ", ".join(["%s"] * len(items))
            where_clauses.append(f"{col_expr} IN ({placeholders})")
            params.extend(items)

    agregar_in("u.departamento", "u", filters.departamento)
    agregar_in("u.municipio", "u", filters.municipio)
    agregar_in("u.region", "u", filters.region)
    agregar_in("m.modalidad", "m", filters.modalidad)
    agregar_in("p.nivel_formacion", "p", filters.nivel_formacion)
    agregar_in("p.nivel_academico", "p", filters.nivel_academico)
    agregar_in("i.sector", "i", filters.sector)
    agregar_in("i.caracter_academico", "i", filters.caracter_academico)
    agregar_in("p.estado_programa", "p", filters.estado_programa)
    agregar_in("p.reconocimiento", "p", filters.reconocimiento)
    agregar_in("a.cine_campo_amplio", "a", filters.cine_campo_amplio)
    agregar_in("a.area_conocimiento", "a", filters.area_conocimiento)
    agregar_in("t.anio", "t", filters.anio)

    if filters.instituciones:
        joins_necesarios.add("i")
        placeholders = ", ".join(["%s"] * len(filters.instituciones))
        where_clauses.append(f"i.nombre_institucion IN ({placeholders})")
        params.extend(filters.instituciones)

    if filters.nombre_institucion:
        joins_necesarios.add("i")
        where_clauses.append("i.nombre_institucion ILIKE %s")
        params.append(f"%{filters.nombre_institucion}%")

    if filters.anio_desde:
        joins_necesarios.add("t")
        where_clauses.append("t.anio >= %s")
        params.append(filters.anio_desde)

    if filters.anio_hasta:
        joins_necesarios.add("t")
        where_clauses.append("t.anio <= %s")
        params.append(filters.anio_hasta)

    if filters.costo_min is not None:
        where_clauses.append("f.costo_matricula_nuevos >= %s")
        params.append(filters.costo_min)

    if filters.costo_max is not None:
        where_clauses.append("f.costo_matricula_nuevos <= %s")
        params.append(filters.costo_max)

    if filters.creditos_min is not None:
        where_clauses.append("f.numero_creditos >= %s")
        params.append(filters.creditos_min)

    if filters.creditos_max is not None:
        where_clauses.append("f.numero_creditos <= %s")
        params.append(filters.creditos_max)

    if filters.solo_con_costo:
        where_clauses.append("f.costo_matricula_nuevos IS NOT NULL")

    return where_clauses, params


def _construir_joins(joins_alias: set[str]) -> str:
    join_map = {
        "u": "JOIN dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion",
        "i": "JOIN dw.dim_institucion i ON i.sk_institucion = f.sk_institucion",
        "m": "JOIN dw.dim_modalidad m ON m.sk_modalidad = f.sk_modalidad",
        "a": "JOIN dw.dim_area_conocimiento a ON a.sk_area = f.sk_area",
        "t": "JOIN dw.dim_tiempo t ON t.sk_tiempo = f.sk_tiempo",
        "p": "JOIN dw.dim_programa p ON p.sk_programa = f.sk_programa",
    }
    return "\n".join(join_map[a] for a in sorted(joins_alias) if a in join_map)


def ejecutar_olap_query(req: OlapQueryRequest) -> list[dict[str, Any]]:
    joins_alias: set[str] = set()

    for dim in req.dimensions:
        joins_alias.add(DIMENSIONS_MAP[dim]["alias"])

    select_parts = []
    dim_exprs = []
    group_exprs = []

    for dim in req.dimensions:
        expr = DIMENSIONS_MAP[dim]["expr"]
        dim_exprs.append(expr)
        if req.operation in ("rollup", "cube"):
            select_parts.append(f"COALESCE({expr}::text, '(Todos)') AS {dim}")
        else:
            select_parts.append(f"{expr} AS {dim}")
        group_exprs.append(expr)

    if req.operation == "rollup":
        group_clause = f"ROLLUP ({', '.join(group_exprs)})"
        grouping_exprs = " + ".join([f"GROUPING({e})" for e in group_exprs])
        select_parts.append(f"({grouping_exprs}) AS nivel_agregacion")
    elif req.operation == "cube":
        group_clause = f"CUBE ({', '.join(group_exprs)})"
        grouping_exprs = " + ".join([f"GROUPING({e})" for e in group_exprs])
        select_parts.append(f"({grouping_exprs}) AS nivel_agregacion")
    else:
        group_clause = ", ".join(group_exprs)

    tiene_lag = False
    for m in req.metrics:
        expr = METRICS_MAP[m]
        select_parts.append(f"{expr} AS {m}")
        if "LAG(" in expr:
            tiene_lag = True

    where_clauses, params = _construir_where(req.filters, joins_alias)
    where_sql = " AND ".join(where_clauses)
    joins_sql = _construir_joins(joins_alias)

    window_clause = ""
    if tiene_lag:
        joins_alias.add("t")
        joins_sql = _construir_joins(joins_alias)
        where_clauses.append("t.anio > 1900")
        if len(req.dimensions) > 1 and "anio" in req.dimensions:
            part_dims = [DIMENSIONS_MAP[d]["expr"] for d in req.dimensions if d != "anio"]
            window_clause = f"WINDOW w AS (PARTITION BY {', '.join(part_dims)} ORDER BY t.anio)"
        else:
            window_clause = "WINDOW w AS (ORDER BY t.anio)"

    if req.order_by and req.order_by in req.metrics:
        order_clause = f"ORDER BY {req.order_by} {req.order_dir} NULLS LAST"
    elif req.operation in ("rollup", "cube"):
        order_clause = f"ORDER BY ({grouping_exprs}) ASC, {req.metrics[0]} {req.order_dir}"
    else:
        order_clause = f"ORDER BY {req.metrics[0]} {req.order_dir}"

    sql_query = f"""
        SELECT
            {', '.join(select_parts)}
        FROM dw.fact_programa f
        {joins_sql}
        WHERE {where_sql}
        GROUP BY {group_clause}
        {window_clause}
        {order_clause}
        LIMIT %s;
    """
    params.append(req.limit)

    with get_cursor() as cur:
        cur.execute(sql_query, params)
        return cur.fetchall()


def ejecutar_olap_pivot(req: OlapPivotRequest) -> dict[str, Any]:
    joins_alias: set[str] = {DIMENSIONS_MAP[req.col_dim]["alias"]}
    for d in req.row_dims:
        joins_alias.add(DIMENSIONS_MAP[d]["alias"])

    col_expr = DIMENSIONS_MAP[req.col_dim]["expr"]
    where_clauses, filter_params = _construir_where(req.filters, joins_alias)
    where_sql = " AND ".join(where_clauses)
    joins_sql = _construir_joins(joins_alias)

    query_cols = f"""
        SELECT DISTINCT {col_expr} AS valor
        FROM dw.fact_programa f
        {joins_sql}
        WHERE {where_sql} AND {col_expr} IS NOT NULL AND {col_expr} <> 'No especificado'
        ORDER BY valor
        LIMIT 20;
    """

    with get_cursor() as cur:
        cur.execute(query_cols, filter_params)
        col_values = [r["valor"] for r in cur.fetchall() if r["valor"]]

    if not col_values:
        return {"columns": [], "rows": []}

    metric_template = METRICS_MAP[req.metric]
    select_parts = [f"{DIMENSIONS_MAP[d]['expr']} AS {d}" for d in req.row_dims]

    for val in col_values:
        safe_alias = "col_" + "".join(c if c.isalnum() else "_" for c in str(val).lower()).strip("_")
        if "COUNT(DISTINCT" in metric_template:
            col_sql = f"COUNT(DISTINCT f.sk_programa) FILTER (WHERE {col_expr} = %s) AS {safe_alias}"
        elif "AVG(" in metric_template:
            inside = metric_template[metric_template.find("(") + 1:metric_template.find(")")]
            col_sql = f"ROUND(AVG({inside}) FILTER (WHERE {col_expr} = %s), 1) AS {safe_alias}"
        else:
            col_sql = f"COUNT(f.sk_fact) FILTER (WHERE {col_expr} = %s) AS {safe_alias}"
        select_parts.append(col_sql)

    if req.include_row_totals:
        select_parts.append(f"{metric_template} AS total_fila")

    group_by = ", ".join([DIMENSIONS_MAP[d]["expr"] for d in req.row_dims])
    # En el SELECT van los %s de col_values y en el WHERE van los de filter_params
    pivot_params = list(col_values) + list(filter_params) + [req.limit]

    sql_pivot = f"""
        SELECT
            {', '.join(select_parts)}
        FROM dw.fact_programa f
        {joins_sql}
        WHERE {where_sql}
        GROUP BY {group_by}
        ORDER BY total_fila DESC NULLS LAST
        LIMIT %s;
    """

    with get_cursor() as cur:
        cur.execute(sql_pivot, pivot_params)
        rows = cur.fetchall()

    return {
        "col_dimension": req.col_dim,
        "categories": col_values,
        "row_dimensions": req.row_dims,
        "rows": rows
    }


def ejecutar_olap_compare(req: OlapCompareRequest) -> list[dict[str, Any]]:
    joins_alias: set[str] = set()
    where_clauses, params = _construir_where(req.filters, joins_alias)

    if req.mode == "benchmarking_institucion":
        joins_alias.add("i")
        joins_sql = _construir_joins(joins_alias)
        where_sql = " AND ".join(where_clauses)

        sql_query = f"""
            WITH base AS (
                SELECT
                    i.nombre_institucion,
                    i.sector,
                    i.caracter_academico,
                    COUNT(DISTINCT f.sk_programa) AS total_programas,
                    ROUND(AVG(f.numero_creditos), 1) AS prom_creditos,
                    ROUND(AVG(f.numero_periodos_duracion), 1) AS prom_periodos,
                    ROUND(AVG(f.costo_matricula_nuevos), 0) AS costo_promedio
                FROM dw.fact_programa f
                {joins_sql}
                WHERE {where_sql} AND i.nombre_institucion IS NOT NULL AND i.nombre_institucion <> 'Institución no identificada'
                GROUP BY i.nombre_institucion, i.sector, i.caracter_academico
            ),
            ranking AS (
                SELECT
                    b.*,
                    RANK() OVER (ORDER BY total_programas DESC) AS puesto_oferta,
                    AVG(costo_promedio) OVER () AS costo_prom_sistema
                FROM base b
            )
            SELECT
                puesto_oferta,
                nombre_institucion,
                sector,
                caracter_academico,
                total_programas,
                prom_creditos,
                prom_periodos,
                costo_promedio,
                ROUND(100.0 * (costo_promedio - costo_prom_sistema) / NULLIF(costo_prom_sistema, 0), 1) AS dif_costo_pct
            FROM ranking
            WHERE puesto_oferta <= %s
               OR nombre_institucion ILIKE %s
            ORDER BY puesto_oferta ASC;
        """
        exec_params = params + [req.top_n, f"%{req.institucion_foco}%"]
        with get_cursor() as cur:
            cur.execute(sql_query, exec_params)
            return cur.fetchall()

    elif req.mode == "participacion_territorial":
        joins_alias.update({"u", "a"})
        joins_sql = _construir_joins(joins_alias)
        campo_expr = DIMENSIONS_MAP[req.campo_agrupador]["expr"]
        terr_expr = "u.departamento" if req.territorio_col == "departamento" else "u.region"
        where_sql = " AND ".join(where_clauses)

        sql_query = f"""
            WITH nacional AS (
                SELECT
                    {campo_expr} AS categoria,
                    COUNT(DISTINCT f.sk_programa) AS total_nal
                FROM dw.fact_programa f
                {joins_sql}
                WHERE {where_sql} AND {campo_expr} IS NOT NULL AND {campo_expr} <> 'No especificado'
                GROUP BY {campo_expr}
            ),
            local_terr AS (
                SELECT
                    {campo_expr} AS categoria,
                    COUNT(DISTINCT f.sk_programa) AS total_local
                FROM dw.fact_programa f
                {joins_sql}
                WHERE {where_sql} AND {terr_expr} = %s AND {campo_expr} IS NOT NULL AND {campo_expr} <> 'No especificado'
                GROUP BY {campo_expr}
            )
            SELECT
                nal.categoria,
                COALESCE(loc.total_local, 0) AS programas_local,
                nal.total_nal AS programas_nacional,
                ROUND(100.0 * COALESCE(loc.total_local, 0) / NULLIF(SUM(loc.total_local) OVER (), 0), 2) AS pct_local,
                ROUND(100.0 * nal.total_nal / NULLIF(SUM(nal.total_nal) OVER (), 0), 2) AS pct_nacional,
                ROUND(
                    (100.0 * COALESCE(loc.total_local, 0) / NULLIF(SUM(loc.total_local) OVER (), 0)) -
                    (100.0 * nal.total_nal / NULLIF(SUM(nal.total_nal) OVER (), 0)),
                    2
                ) AS diferencia_pp
            FROM nacional nal
            LEFT JOIN local_terr loc ON loc.categoria = nal.categoria
            ORDER BY diferencia_pp DESC;
        """
        exec_params = params + params + [req.territorio_valor]
        with get_cursor() as cur:
            cur.execute(sql_query, exec_params)
            return cur.fetchall()

    return []


def ejecutar_drillthrough(filters: OlapFilters, page: int = 1, page_size: int = 50) -> dict[str, Any]:
    joins_alias: set[str] = {"p", "i", "u", "m", "a", "t"}
    where_clauses, params = _construir_where(filters, joins_alias)
    where_sql = " AND ".join(where_clauses)
    joins_sql = _construir_joins(joins_alias)

    offset = (page - 1) * page_size

    sql_count = f"""
        SELECT COUNT(DISTINCT f.sk_programa) AS total
        FROM dw.fact_programa f
        {joins_sql}
        WHERE {where_sql};
    """

    sql_data = f"""
        SELECT
            p.codigo_snies,
            p.nombre_programa,
            p.titulo_otorgado,
            p.nivel_formacion,
            m.modalidad,
            i.nombre_institucion,
            i.sector,
            u.departamento,
            u.municipio,
            u.region,
            a.cine_campo_amplio,
            a.area_conocimiento,
            t.anio AS anio_registro,
            f.numero_creditos,
            f.numero_periodos_duracion,
            f.costo_matricula_nuevos
        FROM dw.fact_programa f
        {joins_sql}
        WHERE {where_sql}
        ORDER BY p.codigo_snies ASC, f.costo_matricula_nuevos DESC NULLS LAST
        LIMIT %s OFFSET %s;
    """

    with get_cursor() as cur:
        cur.execute(sql_count, params)
        total_items = cur.fetchone()["total"]

        cur.execute(sql_data, params + [page_size, offset])
        items = cur.fetchall()

    return {
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": (total_items + page_size - 1) // page_size if total_items > 0 else 1,
        "items": items
    }
