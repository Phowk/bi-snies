// Contrato de datos entre el frontend y el backend FastAPI.
// Los nombres de campo replican las columnas de audit.log_cargas y los alias de las consultas del cubo OLAP.

export type EstadoCarga = 'EN_PROCESO' | 'EXITOSO' | 'ERROR';

/** Fila de audit.log_cargas */
export interface Carga {
  id_carga: number;
  nombre_archivo: string;
  peso_archivo_kb: number;
  fecha_inicio: string; // ISO
  fecha_fin: string | null;
  estado: EstadoCarga;
  total_filas_origen: number;
  filas_cargadas_hechos: number;
  filas_rechazadas: number;
  mensaje_error: string | null;
}

/** Filtros multidimensionales (dice). Un arreglo vacío significa "todos". */
export interface Filtros {
  anio: number[];
  departamento: string[];
  modalidad: string[];
  nivel: string[];
  sector: string[];
}

export const FILTROS_VACIOS: Filtros = { anio: [], departamento: [], modalidad: [], nivel: [], sector: [] };

/** Valores disponibles para cada filtro (GET /api/olap/filtros) */
export type OpcionesFiltro = Filtros;

export interface Kpis {
  total_programas: number;
  promedio_creditos: number | null;
  promedio_periodos: number | null;
  costo_promedio: number | null;
}

export interface Cs1Row { nivel_formacion: string; total_programas: number }
export interface Cs2Row { nombre_institucion: string; modalidad: string; total_programas: number; promedio_creditos: number | null }
export interface Cs3Row { anio: number; periodicidad: string; total_programas: number }
export interface Cs4Row { departamento: string; programas_con_costo: number; costo_promedio_matricula: number }
export interface Cs5Row { modalidad: string; promedio_creditos: number | null; promedio_periodos: number | null; total_programas: number }
export interface Cc2Row { departamento: string; municipio: string; nivel_agregacion: 0 | 1 | 2; total_programas: number; costo_promedio: number | null }
export interface Cc4Row { departamento: string; presencial: number; virtual: number; a_distancia: number; total: number; pct_presencial: number | null }
export interface Cc5Row {
  puesto_oferta: number; nombre_institucion: string; sector: string; total_programas: number;
  prom_creditos: number | null; prom_periodos: number | null; costo_promedio: number | null; dif_costo_pct: number | null;
}
export interface Cc6Row { campo_amplio: string; programas_narino: number; programas_nacional: number; pct_narino: number; pct_nacional: number; diferencia_pp: number }
export interface Cc7Row { departamento: string; anio: number; total_programas: number; programas_anio_anterior: number | null; variacion: number | null; variacion_pct: number | null }
