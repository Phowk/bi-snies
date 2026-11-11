// Constructores de opciones ECharts. Funciones puras: reciben filas de la API y devuelven la configuración del gráfico.
import type { EChartsCoreOption } from 'echarts/core';
import { Cc6Row, Cc7Row, Cs1Row, Cs2Row, Cs3Row, Cs4Row } from '../core/models';

/** Paleta categórica en orden fijo (nunca se cicla). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const TINTA = '#0b0b0b';
const TINTA_2 = '#52514e';
const MUTED = '#898781';
const GRID = '#e1e0d9';
const EJE = '#c3c2b7';
const POSITIVO = '#2a78d6';
const NEGATIVO = '#e34948';

const fmt = new Intl.NumberFormat('es-CO');
export const millones = (v: number) => `$${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;

const base = {
  textStyle: { fontFamily: 'Roboto, system-ui, sans-serif', color: TINTA_2 },
  animationDuration: 300,
  tooltip: { backgroundColor: '#fff', borderColor: GRID, textStyle: { color: TINTA }, confine: true },
};

const ejeValor = (formatter?: (v: number) => string) => ({
  type: 'value' as const,
  axisLabel: { color: MUTED, formatter },
  splitLine: { lineStyle: { color: GRID } },
  axisLine: { show: false },
});

const ejeCategoria = (data: string[], extra: object = {}) => ({
  type: 'category' as const,
  data,
  axisLabel: { color: TINTA_2, width: 170, overflow: 'truncate' as const },
  axisLine: { lineStyle: { color: EJE } },
  axisTick: { show: false },
  ...extra,
});

/** Barras horizontales de una sola serie, ordenadas de mayor a menor (la primera arriba). */
function barrasH(
  etiquetas: string[], valores: number[], nombre: string,
  formato: (v: number) => string = v => fmt.format(v), formatoEje: (v: number) => string = formato,
): EChartsCoreOption {
  return {
    ...base,
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => formato(v) },
    xAxis: ejeValor(formatoEje),
    yAxis: ejeCategoria([...etiquetas].reverse()),
    series: [{
      name: nombre, type: 'bar', data: [...valores].reverse(), barMaxWidth: 22,
      itemStyle: { color: SERIES[0], borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: TINTA_2, formatter: (p: { value: number }) => formato(p.value) },
    }],
  };
}

export const graficoCs1 = (rows: Cs1Row[]) =>
  barrasH(rows.map(r => r.nivel_formacion), rows.map(r => r.total_programas), 'Programas');

export const graficoCs2 = (rows: Cs2Row[]) =>
  barrasH(rows.map(r => r.modalidad), rows.map(r => r.total_programas), 'Programas Udenar');

export const graficoCs4 = (rows: Cs4Row[]) =>
  barrasH(rows.map(r => r.departamento), rows.map(r => r.costo_promedio_matricula), 'Costo promedio', millones, millones);

/** Líneas: una serie por grupo, con leyenda arriba y la serie identificada también al final de cada línea. */
function lineas<T>(rows: T[], grupo: (r: T) => string, x: (r: T) => number, y: (r: T) => number, etiquetasFinales = true): EChartsCoreOption {
  const xs = [...new Set(rows.map(x))].sort((a, b) => a - b);
  const grupos = [...new Set(rows.map(grupo))].sort();
  return {
    ...base,
    color: SERIES,
    legend: { top: 0, icon: 'roundRect', textStyle: { color: TINTA_2 } },
    grid: { left: 8, right: 90, top: 36, bottom: 8, containLabel: true },
    tooltip: { ...base.tooltip, trigger: 'axis' },
    xAxis: ejeCategoria(xs.map(String), { boundaryGap: false }),
    yAxis: ejeValor(),
    series: grupos.map(g => ({
      name: g, type: 'line', showSymbol: true, symbolSize: 8, lineStyle: { width: 2 },
      data: xs.map(v => {
        const r = rows.find(r => grupo(r) === g && x(r) === v);
        return r ? y(r) : null;
      }),
      endLabel: { show: etiquetasFinales && grupos.length <= 4, formatter: '{a}', color: TINTA_2 },
    })),
  };
}

// CS-3: las series pequeñas quedan juntas cerca de cero y sus etiquetas finales se superponen; basta la leyenda.
export const graficoCs3 = (rows: Cs3Row[]) => lineas(rows, r => r.periodicidad, r => r.anio, r => r.total_programas, false);
export const graficoCc7 = (rows: Cc7Row[]) => lineas(rows, r => r.departamento, r => r.anio, r => r.total_programas);

/** Barras divergentes: puntos porcentuales de Nariño sobre (azul) o bajo (rojo) el promedio nacional. */
export function graficoCc6(rows: Cc6Row[]): EChartsCoreOption {
  const r = [...rows].reverse();
  return {
    ...base,
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps: { dataIndex: number }[]) => {
        const f = r[ps[0].dataIndex];
        return `<b>${f.campo_amplio}</b><br>Nariño: ${f.pct_narino} % (${f.programas_narino})<br>Colombia: ${f.pct_nacional} % (${f.programas_nacional})<br>Diferencia: ${f.diferencia_pp > 0 ? '+' : ''}${f.diferencia_pp} pp`;
      },
    },
    xAxis: ejeValor(v => `${v > 0 ? '+' : ''}${v} pp`),
    yAxis: ejeCategoria(r.map(x => x.campo_amplio), { axisLabel: { color: TINTA_2, width: 220, overflow: 'truncate' } }),
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: r.map(x => ({
        value: x.diferencia_pp,
        itemStyle: { color: x.diferencia_pp >= 0 ? POSITIVO : NEGATIVO, borderRadius: x.diferencia_pp >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
        label: { position: x.diferencia_pp >= 0 ? 'right' : 'left' },
      })),
      label: { show: true, color: TINTA_2, formatter: (p: { value: number }) => `${p.value > 0 ? '+' : ''}${p.value}` },
    }],
  };
}
