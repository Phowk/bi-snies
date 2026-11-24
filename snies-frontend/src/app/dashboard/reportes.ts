// Contenido PDF de cada panel: gráfico en tema claro (se imprime en papel blanco) y tabla con todos los datos.
import {
  Cc2Row, Cc4Row, Cc5Row, Cc6Row, Cc7Row, Cs1Row, Cs2Row, Cs3Row, Cs4Row, Cs5Row,
} from '../core/models';
import { ContenidoReporte } from '../core/pdf';
import { TEMA_CLARO as T, graficoCc6, graficoCc7, graficoCs1, graficoCs2, graficoCs3, graficoCs4, millones } from './graficos';

export type ContenidoPanel = Omit<ContenidoReporte, 'filtros'>;

const entero = new Intl.NumberFormat('es-CO');
const decimal = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n = (v: number | null) => (v === null ? null : entero.format(v));
const d = (v: number | null) => (v === null ? null : decimal.format(v));
const dosDecimales = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $ = (v: number | null) => (v === null ? null : millones(v));
const pct = (v: number | null, signo = false) => (v === null ? null : `${signo && v > 0 ? '+' : ''}${decimal.format(v)} %`);
const col = (titulo: string, num = false) => ({ titulo, num });

/** Alto para barras horizontales: una franja por categoría. */
const altoBarras = (filas: number) => Math.max(260, filas * 30 + 60);

export const repCs1 = (r: Cs1Row[]): ContenidoPanel => ({
  grafico: graficoCs1(r, T), altoGrafico: altoBarras(r.length),
  tabla: { columnas: [col('Nivel de formación'), col('Programas', true)], filas: r.map(x => [x.nivel_formacion, n(x.total_programas)]) },
});

export const repCs2 = (r: Cs2Row[]): ContenidoPanel => ({
  grafico: graficoCs2(r, T), altoGrafico: altoBarras(r.length),
  tabla: {
    columnas: [col('Modalidad'), col('Programas', true), col('Créditos promedio', true)],
    filas: r.map(x => [x.modalidad, n(x.total_programas), d(x.promedio_creditos)]),
  },
});

export const repCs3 = (r: Cs3Row[]): ContenidoPanel => ({
  grafico: graficoCs3(r, T), altoGrafico: 460,
  tabla: { columnas: [col('Año'), col('Periodicidad'), col('Programas', true)], filas: r.map(x => [x.anio, x.periodicidad, n(x.total_programas)]) },
});

export const repCs4 = (r: Cs4Row[]): ContenidoPanel => ({
  grafico: graficoCs4(r, T), altoGrafico: altoBarras(r.length),
  tabla: {
    columnas: [col('Departamento'), col('Programas con costo', true), col('Costo promedio de matrícula', true)],
    filas: r.map(x => [x.departamento, n(x.programas_con_costo), $(x.costo_promedio_matricula)]),
  },
});

export const repCs5 = (r: Cs5Row[]): ContenidoPanel => ({
  tabla: {
    columnas: [col('Modalidad'), col('Programas', true), col('Créditos promedio', true), col('Periodos promedio', true)],
    filas: r.map(x => [x.modalidad, n(x.total_programas), d(x.promedio_creditos), d(x.promedio_periodos)]),
  },
});

/** CC-2 completo: cada departamento seguido de sus municipios, y el total nacional al final. */
export function repCc2(r: Cc2Row[]): ContenidoPanel {
  const orden = [...r].sort((a, b) =>
    a.nivel_agregacion === 2 ? 1 : b.nivel_agregacion === 2 ? -1
      : a.departamento.localeCompare(b.departamento) || b.nivel_agregacion - a.nivel_agregacion || a.municipio.localeCompare(b.municipio));
  return {
    tabla: {
      columnas: [col('Departamento / municipio'), col('Programas', true), col('Matrícula promedio', true)],
      filas: orden.map(x => [
        x.nivel_agregacion === 2 ? 'Total nacional' : x.nivel_agregacion === 1 ? x.departamento : `      ${x.municipio}`,
        n(x.total_programas), $(x.costo_promedio),
      ]),
      destacadas: orden.flatMap((x, i) => (x.nivel_agregacion > 0 ? [i] : [])),
    },
  };
}

export interface MatrizCc3 {
  sectores: string[];
  niveles: { nivel: string; total: number; celdas: number[] }[];
  totales: { total: number; celdas: number[] };
}

export const repCc3 = (m: MatrizCc3): ContenidoPanel => ({
  tabla: {
    columnas: [col('Nivel de formación'), ...m.sectores.map(s => col(s, true)), col('Total', true)],
    filas: [
      ...m.niveles.map(x => [x.nivel, ...x.celdas.map(v => `${n(v)} (${x.total ? Math.round((100 * v) / x.total) : 0} %)`), n(x.total)]),
      ['Total', ...m.totales.celdas.map(n), n(m.totales.total)],
    ],
    destacadas: [m.niveles.length],
  },
});

export const repCc4 = (r: Cc4Row[]): ContenidoPanel => ({
  tabla: {
    columnas: [col('Departamento'), col('Presencial', true), col('Virtual', true), col('A distancia', true), col('Total', true), col('% presencial', true)],
    filas: r.map(x => [x.departamento, n(x.presencial), n(x.virtual), n(x.a_distancia), n(x.total), pct(x.pct_presencial)]),
  },
});

export const repCc5 = (r: Cc5Row[], esUdenar: (nombre: string) => boolean): ContenidoPanel => ({
  tabla: {
    columnas: [
      col('Puesto', true), col('Institución'), col('Sector'), col('Programas', true), col('Créditos', true),
      col('Periodos', true), col('Matrícula prom.', true), col('vs. promedio', true),
    ],
    filas: r.map(x => [
      x.puesto_oferta, x.nombre_institucion, x.sector, n(x.total_programas), d(x.prom_creditos),
      d(x.prom_periodos), $(x.costo_promedio), pct(x.dif_costo_pct, true),
    ]),
    destacadas: r.flatMap((x, i) => (esUdenar(x.nombre_institucion) ? [i] : [])),
  },
});

export const repCc6 = (r: Cc6Row[]): ContenidoPanel => ({
  grafico: graficoCc6(r, T), altoGrafico: altoBarras(r.length),
  tabla: {
    columnas: [col('Campo amplio'), col('Programas Nariño', true), col('Programas Colombia', true), col('% Nariño', true), col('% Colombia', true), col('Diferencia (pp)', true)],
    filas: r.map(x => [
      x.campo_amplio, n(x.programas_narino), n(x.programas_nacional), pct(x.pct_narino), pct(x.pct_nacional),
      `${x.diferencia_pp > 0 ? '+' : ''}${dosDecimales.format(x.diferencia_pp)}`,
    ]),
  },
});

export const repCc7 = (r: Cc7Row[]): ContenidoPanel => ({
  grafico: graficoCc7(r, T), altoGrafico: 460,
  tabla: {
    columnas: [col('Departamento'), col('Año'), col('Programas', true), col('Año anterior', true), col('Variación', true), col('Variación %', true)],
    filas: r.map(x => [
      x.departamento, x.anio, n(x.total_programas), n(x.programas_anio_anterior),
      x.variacion === null ? null : `${x.variacion > 0 ? '+' : ''}${n(x.variacion)}`, pct(x.variacion_pct, true),
    ]),
  },
});
