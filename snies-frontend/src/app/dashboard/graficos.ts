// Constructores de opciones ECharts. Funciones puras: reciben filas de la API y el tema, y devuelven la configuración.
// ECharts no lee CSS, así que los colores de cada modo viven aquí (paleta de referencia validada para claro y oscuro).
import type { EChartsCoreOption } from 'echarts/core';
import { Cc6Row, Cc7Row, Cs1Row, Cs2Row, Cs3Row, Cs4Row } from '../core/models';

export interface TemaGrafico {
  /** Paleta categórica en orden fijo (nunca se cicla). */
  series: string[];
  tinta: string;
  tinta2: string;
  muted: string;
  grid: string;
  eje: string;
  superficie: string;
  positivo: string;
  negativo: string;
}

export const TEMA_CLARO: TemaGrafico = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  tinta: '#0b0b0b', tinta2: '#52514e', muted: '#898781', grid: '#e1e0d9', eje: '#c3c2b7',
  superficie: '#fcfcfb', positivo: '#2a78d6', negativo: '#e34948',
};

export const TEMA_OSCURO: TemaGrafico = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
  tinta: '#f0efec', tinta2: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', eje: '#383835',
  superficie: '#1a1a19', positivo: '#3987e5', negativo: '#e66767',
};

const fmt = new Intl.NumberFormat('es-CO');
const pp = (v: number) => `${v > 0 ? '+' : ''}${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
export const millones = (v: number) => `$${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;

const base = (t: TemaGrafico) => ({
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Roboto, system-ui, sans-serif', color: t.tinta2 },
  animationDuration: 300,
  tooltip: { backgroundColor: t.superficie, borderColor: t.grid, textStyle: { color: t.tinta }, confine: true },
});

const ejeValor = (t: TemaGrafico, formatter?: (v: number) => string) => ({
  type: 'value' as const,
  axisLabel: { color: t.muted, formatter },
  splitLine: { lineStyle: { color: t.grid } },
  axisLine: { show: false },
});

const ejeCategoria = (t: TemaGrafico, data: string[], extra: object = {}) => ({
  type: 'category' as const,
  data,
  axisLabel: { color: t.tinta2, width: 170, overflow: 'truncate' as const },
  axisLine: { lineStyle: { color: t.eje } },
  axisTick: { show: false },
  ...extra,
});

/** Barras horizontales de una sola serie, ordenadas de mayor a menor (la primera arriba). */
function barrasH(
  t: TemaGrafico, etiquetas: string[], valores: number[], nombre: string,
  formato: (v: number) => string = v => fmt.format(v), formatoEje: (v: number) => string = formato,
): EChartsCoreOption {
  const b = base(t);
  return {
    ...b,
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...b.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => formato(v) },
    xAxis: ejeValor(t, formatoEje),
    yAxis: ejeCategoria(t, [...etiquetas].reverse()),
    series: [{
      name: nombre, type: 'bar', data: [...valores].reverse(), barMaxWidth: 22,
      itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: t.tinta2, formatter: (p: { value: number }) => formato(p.value) },
    }],
  };
}

export const graficoCs1 = (rows: Cs1Row[], t: TemaGrafico) =>
  barrasH(t, rows.map(r => r.nivel_formacion), rows.map(r => r.total_programas), 'Programas');

export const graficoCs2 = (rows: Cs2Row[], t: TemaGrafico) =>
  barrasH(t, rows.map(r => r.modalidad), rows.map(r => r.total_programas), 'Programas Udenar');

export const graficoCs4 = (rows: Cs4Row[], t: TemaGrafico) =>
  barrasH(t, rows.map(r => r.departamento), rows.map(r => r.costo_promedio_matricula), 'Costo promedio', millones, millones);

/** Líneas: una serie por grupo, con leyenda arriba y la serie identificada también al final de cada línea. */
function lineas<T>(
  t: TemaGrafico, rows: T[], grupo: (r: T) => string, x: (r: T) => number, y: (r: T) => number, etiquetasFinales = true,
): EChartsCoreOption {
  const b = base(t);
  const xs = [...new Set(rows.map(x))].sort((a, c) => a - c);
  // El color sigue a la entidad: el orden de los grupos es alfabético, no por tamaño.
  const grupos = [...new Set(rows.map(grupo))].sort().slice(0, t.series.length);
  return {
    ...b,
    color: t.series,
    legend: { top: 0, icon: 'roundRect', textStyle: { color: t.tinta2 } },
    grid: { left: 8, right: 90, top: 36, bottom: 8, containLabel: true },
    tooltip: { ...b.tooltip, trigger: 'axis' },
    xAxis: ejeCategoria(t, xs.map(String), { boundaryGap: false }),
    yAxis: ejeValor(t),
    series: grupos.map(g => ({
      name: g, type: 'line', showSymbol: true, symbolSize: 8, lineStyle: { width: 2 },
      data: xs.map(v => {
        const r = rows.find(r => grupo(r) === g && x(r) === v);
        return r ? y(r) : null;
      }),
      endLabel: { show: etiquetasFinales && grupos.length <= 4, formatter: '{a}', color: t.tinta2 },
    })),
  };
}

// CS-3: las series pequeñas quedan juntas cerca de cero y sus etiquetas finales se superponen; basta la leyenda.
export const graficoCs3 = (rows: Cs3Row[], t: TemaGrafico) => lineas(t, rows, r => r.periodicidad, r => r.anio, r => r.total_programas, false);
export const graficoCc7 = (rows: Cc7Row[], t: TemaGrafico) => lineas(t, rows, r => r.departamento, r => r.anio, r => r.total_programas);

/** Barras divergentes: puntos porcentuales de Nariño sobre (azul) o bajo (rojo) el promedio nacional. */
export function graficoCc6(rows: Cc6Row[], t: TemaGrafico): EChartsCoreOption {
  const b = base(t);
  const r = [...rows].reverse();
  return {
    ...b,
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...b.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps: { dataIndex: number }[]) => {
        const f = r[ps[0].dataIndex];
        return `<b>${f.campo_amplio}</b><br>Nariño: ${pp(f.pct_narino).replace('+', '')} % (${fmt.format(f.programas_narino)})<br>Colombia: ${pp(f.pct_nacional).replace('+', '')} % (${fmt.format(f.programas_nacional)})<br>Diferencia: ${pp(f.diferencia_pp)} pp`;
      },
    },
    xAxis: ejeValor(t, v => `${pp(v)} pp`),
    yAxis: ejeCategoria(t, r.map(x => x.campo_amplio), { axisLabel: { color: t.tinta2, width: 220, overflow: 'truncate' } }),
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: r.map(x => ({
        value: x.diferencia_pp,
        itemStyle: { color: x.diferencia_pp >= 0 ? t.positivo : t.negativo, borderRadius: x.diferencia_pp >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
        label: { position: x.diferencia_pp >= 0 ? 'right' : 'left' },
      })),
      label: { show: true, color: t.tinta2, formatter: (p: { value: number }) => pp(p.value) },
    }],
  };
}
