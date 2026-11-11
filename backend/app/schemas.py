"""Modelos Pydantic para validación estricta y contratos del motor OLAP y ETL."""
from typing import Any, Literal
from pydantic import BaseModel, Field

# Dominios cerrados válidos para dimensiones y métricas (Previene inyección SQL)
DimensionName = Literal[
    "region",
    "departamento",
    "municipio",
    "nombre_institucion",
    "codigo_institucion",
    "sector",
    "caracter_academico",
    "estado_institucion",
    "codigo_snies",
    "nombre_programa",
    "nivel_academico",
    "nivel_formacion",
    "modalidad",
    "estado_programa",
    "reconocimiento",
    "periodicidad",
    "cine_campo_amplio",
    "cine_campo_especifico",
    "cine_campo_detallado",
    "area_conocimiento",
    "nucleo_basico",
    "anio",
    "semestre",
    "periodo"
]

MetricName = Literal[
    "total_programas",
    "total_oferta",
    "total_instituciones",
    "total_municipios",
    "programas_con_costo",
    "promedio_creditos",
    "min_creditos",
    "max_creditos",
    "promedio_periodos",
    "min_periodos",
    "max_periodos",
    "costo_promedio",
    "costo_minimo",
    "costo_maximo",
    "pct_total",
    "variacion_anual",
    "variacion_pct"
]

OlapOperation = Literal["group", "rollup", "cube"]


class OlapFilters(BaseModel):
    departamento: list[str] | None = None
    municipio: list[str] | None = None
    region: list[str] | None = None
    modalidad: list[str] | None = None
    nivel_formacion: list[str] | None = None
    nivel_academico: list[str] | None = None
    sector: list[str] | None = None
    caracter_academico: list[str] | None = None
    estado_programa: list[str] | None = None
    reconocimiento: list[str] | None = None
    cine_campo_amplio: list[str] | None = None
    area_conocimiento: list[str] | None = None
    nombre_institucion: str | None = None
    instituciones: list[str] | None = None
    anio: list[int] | None = None
    anio_desde: int | None = None
    anio_hasta: int | None = None
    costo_min: float | None = None
    costo_max: float | None = None
    creditos_min: int | None = None
    creditos_max: int | None = None
    solo_con_costo: bool = False


class OlapQueryRequest(BaseModel):
    operation: OlapOperation = "group"
    dimensions: list[DimensionName] = Field(min_length=1, max_length=5)
    metrics: list[MetricName] = Field(min_length=1, max_length=10)
    filters: OlapFilters = Field(default_factory=OlapFilters)
    order_by: str | None = None
    order_dir: Literal["ASC", "DESC"] = "DESC"
    limit: int = Field(default=200, ge=1, le=2000)


class OlapPivotRequest(BaseModel):
    row_dims: list[DimensionName] = Field(min_length=1, max_length=3)
    col_dim: DimensionName
    metric: MetricName = "total_programas"
    filters: OlapFilters = Field(default_factory=OlapFilters)
    include_row_totals: bool = True
    include_percentages: bool = True
    limit: int = Field(default=200, ge=1, le=1000)


class OlapCompareRequest(BaseModel):
    mode: Literal["benchmarking_institucion", "participacion_territorial"]
    # Para benchmarking
    institucion_foco: str = "Universidad de Nariño"
    top_n: int = Field(default=10, ge=1, le=50)
    # Para participación territorial
    territorio_col: Literal["departamento", "region"] = "departamento"
    territorio_valor: str = "Nariño"
    campo_agrupador: Literal["cine_campo_amplio", "area_conocimiento", "nivel_formacion", "modalidad"] = "cine_campo_amplio"
    filters: OlapFilters = Field(default_factory=OlapFilters)


class DrillthroughRequest(BaseModel):
    filters: OlapFilters = Field(default_factory=OlapFilters)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=500)
    format: Literal["json", "csv"] = "json"


class FilterOptionsRequest(BaseModel):
    target_dim: DimensionName
    active_filters: OlapFilters = Field(default_factory=OlapFilters)
    search: str | None = None
    limit: int = Field(default=100, ge=1, le=500)


class PresetInfo(BaseModel):
    code: str
    title: str
    description: str
    operation: str
    query: dict[str, Any]
