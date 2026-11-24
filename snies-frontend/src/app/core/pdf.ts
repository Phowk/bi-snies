// Exportación de reportes del cubo a PDF. jsPDF, autotable y ECharts se cargan solo al pedir la descarga.
import type { EChartsCoreOption } from 'echarts/core';
import type { jsPDF } from 'jspdf';

export type Celda = string | number | null;

/** Lo que aporta cada panel: su gráfico (en tema claro) y la tabla con los datos. */
export interface ContenidoReporte {
  grafico?: EChartsCoreOption;
  /** Alto del gráfico en píxeles al renderizarlo (el ancho es fijo); define su proporción en la página. */
  altoGrafico?: number;
  tabla: {
    columnas: { titulo: string; num?: boolean }[];
    filas: Celda[][];
    /** Índices de filas a resaltar (subtotales, la Universidad de Nariño…). */
    destacadas?: number[];
  };
  /** Texto de los filtros aplicados. */
  filtros: string;
}

export interface Reporte extends ContenidoReporte {
  titulo: string;
  descripcion: string;
  codigo: string;
  operacion: string;
}

/** Reporte general: portada con cifras y contenido, y luego todos los reportes agrupados por sección. */
export interface ReporteGeneral {
  filtros: string;
  cifras: { etiqueta: string; valor: string }[];
  secciones: { titulo: string; intro: string; reportes: (Reporte | { titulo: string; codigo: string; sinDatos: string })[] }[];
}

type AutoTable = (typeof import('jspdf-autotable'))['autoTable'];

const ANCHO_GRAFICO = 1000;
const M = 40;
const AZUL: [number, number, number] = [42, 120, 214];
const TINTA: [number, number, number] = [11, 11, 11];
const GRIS: [number, number, number] = [82, 81, 78];
const GRIS_CLARO: [number, number, number] = [137, 135, 129];
const FUENTE = 'Fuente: SNIES, Ministerio de Educación Nacional. Bodega de datos dw.fact_programa.';

async function cargar() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable };
}

const orientacion = (r: Reporte) => (r.tabla.columnas.length > 6 ? 'landscape' : 'portrait');
const fechaLarga = (d: Date) => d.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });

/** Genera el PDF de un reporte y lo descarga. */
export async function descargarPdf(r: Reporte): Promise<void> {
  const { jsPDF, autoTable } = await cargar();
  const generado = new Date();
  const doc = new jsPDF({ orientation: orientacion(r), unit: 'pt', format: 'a4' });
  await dibujarReporte(doc, autoTable, r, generado);
  pies(doc, 1);
  doc.save(nombreArchivo(r, generado));
}

/** Genera el reporte general (portada + todos los reportes) y lo descarga. */
export async function descargarReporteGeneral(g: ReporteGeneral): Promise<void> {
  const { jsPDF, autoTable } = await cargar();
  const generado = new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const indice: { seccion: string; titulo: string; codigo: string; pagina: number | null }[] = [];

  // La portada ocupa la página 1; el contenido se escribe al final, cuando ya se conocen las páginas.
  for (const s of g.secciones) {
    s.reportes.forEach(r => {
      indice.push({ seccion: s.titulo, titulo: r.titulo, codigo: r.codigo, pagina: 'sinDatos' in r ? null : 0 });
    });
  }
  let k = 0;
  for (const s of g.secciones) {
    for (const [i, r] of s.reportes.entries()) {
      const entrada = indice[k++];
      if ('sinDatos' in r) continue;
      doc.addPage('a4', orientacion(r));
      entrada.pagina = doc.getNumberOfPages();
      await dibujarReporte(doc, autoTable, r, generado, i === 0 ? { titulo: s.titulo, intro: s.intro } : undefined);
    }
  }

  doc.setPage(1);
  portada(doc, g, indice, generado);
  pies(doc, 2);
  doc.save(`snies-reporte-general-${dia(generado)}.pdf`);
}

/** Dibuja un reporte desde la parte superior de la página actual. */
async function dibujarReporte(doc: jsPDF, autoTable: AutoTable, r: Reporte, generado: Date, seccion?: { titulo: string; intro: string }) {
  const W = doc.internal.pageSize.getWidth();
  const util = W - 2 * M;
  let y = encabezado(doc, generado);

  if (seccion) {
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...AZUL);
    doc.text(seccion.titulo.toUpperCase(), M, y);
    y += 14;
    doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...GRIS);
    const intro = doc.splitTextToSize(seccion.intro, util);
    doc.text(intro, M, y);
    y += intro.length * 12 + 14;
  }

  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...TINTA);
  const titulo = doc.splitTextToSize(r.titulo, util);
  doc.text(titulo, M, y);
  y += titulo.length * 20;

  if (r.descripcion) {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS);
    const d = doc.splitTextToSize(r.descripcion, util);
    doc.text(d, M, y);
    y += d.length * 13 + 4;
  }

  doc.setFontSize(9);
  for (const [k, v] of [['Consulta', `${r.codigo} · ${r.operacion}`], ['Filtros', r.filtros]]) {
    doc.setFont('helvetica', 'bold').setTextColor(...GRIS).text(`${k}:`, M, y);
    doc.setFont('helvetica', 'normal').setTextColor(...TINTA);
    const lineas = doc.splitTextToSize(v, util - 52);
    doc.text(lineas, M + 52, y);
    y += lineas.length * 12;
  }
  y += 12;

  if (r.grafico) {
    const alto = r.altoGrafico ?? 420;
    const png = await renderizarGrafico(r.grafico, alto);
    const h = (util * alto) / ANCHO_GRAFICO;
    if (y + h > doc.internal.pageSize.getHeight() - M) {
      doc.addPage('a4', orientacion(r));
      y = encabezado(doc, generado);
    }
    doc.addImage(png, 'PNG', M, y, util, h);
    y += h + 16;
  }

  const ancha = r.tabla.columnas.length > 6;
  const destacadas = new Set(r.tabla.destacadas ?? []);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: M + 30, bottom: 48 },
    head: [r.tabla.columnas.map(c => c.titulo)],
    body: r.tabla.filas.map(f => f.map(v => (v === null ? '-' : String(v)))),
    styles: { font: 'helvetica', fontSize: ancha ? 8 : 9, cellPadding: 4, textColor: TINTA, lineColor: [225, 224, 217], lineWidth: { bottom: 0.5 } },
    headStyles: { fillColor: [240, 239, 236], textColor: GRIS, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [252, 252, 251] },
    columnStyles: Object.fromEntries(r.tabla.columnas.map((c, i) => [i, { halign: c.num ? 'right' : 'left' }])),
    didParseCell: d => {
      if (d.section === 'body' && destacadas.has(d.row.index)) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [205, 226, 251];
      }
    },
    // Las páginas que agrega la tabla al continuar también llevan encabezado.
    willDrawPage: d => {
      if (d.pageNumber > 1) encabezado(doc, generado);
    },
  });
}

/** Franja superior de cada página. Devuelve la altura donde empieza el contenido. */
function encabezado(doc: jsPDF, generado: Date): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...AZUL);
  doc.text('SNIES BI · UNIVERSIDAD DE NARIÑO', M, M);
  doc.setFont('helvetica', 'normal').setTextColor(...GRIS_CLARO);
  doc.text(`Generado el ${fechaLarga(generado)}`, W - M, M, { align: 'right' });
  doc.setDrawColor(...AZUL).setLineWidth(1.5).line(M, M + 10, W - M, M + 10);
  return M + 36;
}

/** Fuente y número de página, desde `desde` (la portada no lleva pie). */
function pies(doc: jsPDF, desde: number) {
  const total = doc.getNumberOfPages();
  for (let p = desde; p <= total; p++) {
    doc.setPage(p);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS_CLARO);
    doc.text(FUENTE, M, H - 24);
    doc.text(`Página ${p} de ${total}`, W - M, H - 24, { align: 'right' });
  }
}

function portada(
  doc: jsPDF, g: ReporteGeneral,
  indice: { seccion: string; titulo: string; codigo: string; pagina: number | null }[], generado: Date,
) {
  const W = doc.internal.pageSize.getWidth();
  const util = W - 2 * M;

  doc.setFillColor(...AZUL).rect(0, 0, W, 8, 'F');
  let y = 90;
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...AZUL);
  doc.text('SNIES BI · UNIVERSIDAD DE NARIÑO · INTELIGENCIA DE NEGOCIOS', M, y);
  y += 34;
  doc.setFontSize(28).setTextColor(...TINTA);
  const titulo = doc.splitTextToSize('Reporte general de la oferta académica', util);
  doc.text(titulo, M, y);
  y += titulo.length * 32 + 4;
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...GRIS);
  doc.text(`Generado el ${fechaLarga(generado)}`, M, y);
  y += 26;

  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...GRIS).text('Filtros:', M, y);
  doc.setFont('helvetica', 'normal').setTextColor(...TINTA);
  const filtros = doc.splitTextToSize(g.filtros, util - 44);
  doc.text(filtros, M + 44, y);
  y += filtros.length * 12 + 24;

  // Cifras principales en una fila de recuadros
  const n = g.cifras.length;
  const gap = 8;
  const ancho = (util - gap * (n - 1)) / n;
  g.cifras.forEach((c, i) => {
    const x = M + i * (ancho + gap);
    doc.setFillColor(i === 0 ? 205 : 243, i === 0 ? 226 : 242, i === 0 ? 251 : 238).roundedRect(x, y, ancho, 62, 6, 6, 'F');
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS).text(c.etiqueta, x + 10, y + 18);
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...TINTA).text(c.valor, x + 10, y + 44);
  });
  y += 62 + 40;

  // Contenido
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...TINTA).text('Contenido', M, y);
  y += 22;
  let seccion = '';
  for (const e of indice) {
    if (e.seccion !== seccion) {
      seccion = e.seccion;
      y += 6;
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...AZUL).text(seccion, M, y);
      y += 16;
    }
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...(e.pagina ? TINTA : GRIS_CLARO));
    doc.text(`${e.codigo}`, M + 10, y);
    doc.text(doc.splitTextToSize(e.titulo, util - 120)[0], M + 50, y);
    doc.text(e.pagina ? String(e.pagina) : 'sin datos', W - M, y, { align: 'right' });
    y += 15;
  }

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS_CLARO);
  doc.text(FUENTE, M, doc.internal.pageSize.getHeight() - 24);
}

/** Dibuja el gráfico en un contenedor fuera de pantalla y devuelve su imagen PNG. */
async function renderizarGrafico(opciones: EChartsCoreOption, alto: number): Promise<string> {
  const echarts = await import('echarts');
  const div = document.createElement('div');
  const chart = echarts.init(div, null, { renderer: 'canvas', width: ANCHO_GRAFICO, height: alto, devicePixelRatio: 2 });
  try {
    chart.setOption({ ...opciones, animation: false });
    return chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
  } finally {
    chart.dispose();
  }
}

const dia = (f: Date) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

export function nombreArchivo(r: Pick<Reporte, 'codigo' | 'titulo'>, fecha: Date): string {
  const slug = r.titulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .split('-').slice(0, 6).join('-');
  return `snies-${r.codigo.toLowerCase()}-${slug}-${dia(fecha)}.pdf`;
}
