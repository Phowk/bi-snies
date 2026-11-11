// Bodega simulada: genera programas con forma SNIES y reimplementa en TypeScript las consultas del cubo OLAP
// (CS-1..CS-5, CC-2, CC-4..CC-7). Solo se usa cuando environment.useMock = true.
import {
  Cc2Row, Cc4Row, Cc5Row, Cc6Row, Cc7Row, Cs1Row, Cs2Row, Cs3Row, Cs4Row, Cs5Row, Filtros, Kpis, OpcionesFiltro,
} from '../models';

export interface Programa {
  codigo_snies: number;
  institucion: string;
  sector: string;
  departamento: string;
  municipio: string;
  modalidad: string;
  nivel_formacion: string;
  campo_amplio: string;
  periodicidad: string;
  anio: number;
  numero_creditos: number | null;
  numero_periodos: number | null;
  costo_matricula: number | null;
}

const UDENAR = 'Universidad de Nariño';

const MUNICIPIOS: Record<string, string[]> = {
  'Nariño': ['Pasto', 'Ipiales', 'Tumaco', 'Túquerres'],
  'Cauca': ['Popayán', 'Santander de Quilichao'],
  'Putumayo': ['Mocoa', 'Puerto Asís'],
  'Valle del Cauca': ['Cali', 'Palmira', 'Tuluá'],
  'Antioquia': ['Medellín', 'Envigado', 'Rionegro'],
  'Bogotá D.C.': ['Bogotá D.C.'],
  'Atlántico': ['Barranquilla', 'Soledad'],
  'Santander': ['Bucaramanga', 'Floridablanca'],
};

// [nombre, sector, departamentos donde oferta, peso relativo de oferta]
const INSTITUCIONES: [string, string, string[], number][] = [
  [UDENAR, 'Oficial', ['Nariño', 'Putumayo'], 6],
  ['Universidad Mariana', 'Privado', ['Nariño'], 3],
  ['Institución Universitaria CESMAG', 'Privado', ['Nariño'], 2],
  ['Universidad Nacional de Colombia', 'Oficial', ['Bogotá D.C.', 'Antioquia', 'Nariño'], 9],
  ['Universidad de Antioquia', 'Oficial', ['Antioquia'], 8],
  ['Universidad del Valle', 'Oficial', ['Valle del Cauca'], 7],
  ['Universidad del Cauca', 'Oficial', ['Cauca'], 4],
  ['Universidad de los Andes', 'Privado', ['Bogotá D.C.'], 5],
  ['Pontificia Universidad Javeriana', 'Privado', ['Bogotá D.C.', 'Valle del Cauca'], 6],
  ['Servicio Nacional de Aprendizaje - SENA', 'Oficial', Object.keys(MUNICIPIOS), 7],
  ['Universidad Cooperativa de Colombia', 'Privado', ['Nariño', 'Antioquia', 'Santander', 'Cauca'], 5],
  ['Universidad Industrial de Santander', 'Oficial', ['Santander'], 4],
  ['Universidad del Norte', 'Privado', ['Atlántico'], 4],
  ['Instituto Tecnológico del Putumayo', 'Oficial', ['Putumayo'], 2],
  ['Universidad Nacional Abierta y a Distancia - UNAD', 'Oficial', Object.keys(MUNICIPIOS), 5],
];

// [nivel, rango créditos, periodos]
const NIVELES: [string, [number, number], number][] = [
  ['Técnico profesional', [60, 80], 4],
  ['Tecnológico', [90, 110], 6],
  ['Universitario', [140, 180], 10],
  ['Especialización universitaria', [24, 32], 2],
  ['Maestría', [40, 60], 4],
  ['Doctorado', [80, 100], 8],
];

const PERIODICIDADES = ['Semestral', 'Anual', 'Trimestral'];
const CAMPOS = [
  'Educación', 'Artes y humanidades', 'Ciencias sociales, periodismo e información',
  'Administración de empresas y derecho', 'Ciencias naturales, matemáticas y estadística',
  'Tecnologías de la información y la comunicación (TIC)', 'Ingeniería, industria y construcción',
  'Agropecuario, silvicultura, pesca y veterinaria', 'Salud y bienestar', 'Servicios',
];

/** Generador pseudoaleatorio con semilla, para que los datos sean estables entre recargas. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function generarProgramas(n = 1500, seed = 42): Programa[] {
  const r = rng(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const pesoTotal = INSTITUCIONES.reduce((s, i) => s + i[3], 0);
  const pickInst = () => {
    let x = r() * pesoTotal;
    for (const i of INSTITUCIONES) if ((x -= i[3]) < 0) return i;
    return INSTITUCIONES[0];
  };
  return Array.from({ length: n }, (_, k) => {
    const [institucion, sector, deptos] = pickInst();
    const departamento = pick(deptos);
    const [nivel, [cmin, cmax], periodos] = pick(NIVELES);
    const modalidad = r() < 0.65 ? 'Presencial' : r() < 0.6 ? 'Virtual' : 'A distancia';
    const base = sector === 'Oficial' ? 1_500_000 : 5_000_000;
    return {
      codigo_snies: 100000 + k,
      institucion,
      sector,
      departamento,
      municipio: pick(MUNICIPIOS[departamento]),
      modalidad,
      nivel_formacion: nivel,
      campo_amplio: departamento === 'Nariño' && r() < 0.25 ? pick(CAMPOS.slice(7)) : pick(CAMPOS),
      periodicidad: r() < 0.85 ? 'Semestral' : pick(PERIODICIDADES),
      anio: 2015 + Math.floor(Math.sqrt(r()) * 11), // más registros en años recientes
      numero_creditos: r() < 0.03 ? null : Math.round(cmin + r() * (cmax - cmin)),
      numero_periodos: r() < 0.03 ? null : periodos,
      costo_matricula: r() < 0.1 ? null : Math.round((base + r() * base * 1.8) / 1000) * 1000,
    };
  });
}

// ---------------------------------------------------------------- utilidades de agregación

const round = (x: number | null, d = 1) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

/** Promedio que ignora nulos, como AVG en PostgreSQL. */
export function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    (m.get(k) ?? m.set(k, []).get(k)!).push(x);
  }
  return m;
}

type ClaveFiltro = keyof Filtros;

/** WHERE del dice. `ignorar` excluye filtros que la consulta fija por sí misma. */
export function filtrar(ps: Programa[], f: Filtros, ignorar: ClaveFiltro[] = []): Programa[] {
  const usa = (k: ClaveFiltro) => f[k].length > 0 && !ignorar.includes(k);
  return ps.filter(p =>
    (!usa('anio') || f.anio.includes(p.anio)) &&
    (!usa('departamento') || f.departamento.includes(p.departamento)) &&
    (!usa('modalidad') || f.modalidad.includes(p.modalidad)) &&
    (!usa('nivel') || f.nivel.includes(p.nivel_formacion)) &&
    (!usa('sector') || f.sector.includes(p.sector)));
}

const porTotal = <T extends { total_programas: number }>(a: T, b: T) => b.total_programas - a.total_programas;

// ---------------------------------------------------------------- consultas del cubo

export function opciones(ps: Programa[]): OpcionesFiltro {
  const uniq = <T>(xs: T[]) => [...new Set(xs)].sort() as T[];
  return {
    anio: uniq(ps.map(p => p.anio)),
    departamento: uniq(ps.map(p => p.departamento)),
    modalidad: uniq(ps.map(p => p.modalidad)),
    nivel: NIVELES.map(n => n[0]),
    sector: uniq(ps.map(p => p.sector)),
  };
}

export function kpis(ps: Programa[], f: Filtros): Kpis {
  const x = filtrar(ps, f);
  return {
    total_programas: x.length,
    promedio_creditos: round(avg(x.map(p => p.numero_creditos))),
    promedio_periodos: round(avg(x.map(p => p.numero_periodos))),
    costo_promedio: round(avg(x.map(p => p.costo_matricula)), 0),
  };
}

export function cs1(ps: Programa[], f: Filtros): Cs1Row[] {
  return [...groupBy(filtrar(ps, f), p => p.nivel_formacion)]
    .map(([nivel_formacion, g]) => ({ nivel_formacion, total_programas: g.length }))
    .sort(porTotal);
}

export function cs2(ps: Programa[], f: Filtros): Cs2Row[] {
  const x = filtrar(ps, f, ['departamento', 'sector']).filter(p => p.institucion === UDENAR);
  return [...groupBy(x, p => p.modalidad)]
    .map(([modalidad, g]) => ({
      nombre_institucion: UDENAR, modalidad, total_programas: g.length,
      promedio_creditos: round(avg(g.map(p => p.numero_creditos))),
    }))
    .sort(porTotal);
}

export function cs3(ps: Programa[], f: Filtros): Cs3Row[] {
  return [...groupBy(filtrar(ps, f, ['anio']), p => `${p.anio}|${p.periodicidad}`)]
    .map(([k, g]) => {
      const [anio, periodicidad] = k.split('|');
      return { anio: +anio, periodicidad, total_programas: g.length };
    })
    .sort((a, b) => a.anio - b.anio || a.periodicidad.localeCompare(b.periodicidad));
}

export function cs4(ps: Programa[], f: Filtros): Cs4Row[] {
  const x = filtrar(ps, f).filter(p => p.costo_matricula !== null);
  return [...groupBy(x, p => p.departamento)]
    .map(([departamento, g]) => ({
      departamento, programas_con_costo: g.length,
      costo_promedio_matricula: round(avg(g.map(p => p.costo_matricula)), 0)!,
    }))
    .sort((a, b) => b.costo_promedio_matricula - a.costo_promedio_matricula);
}

export function cs5(ps: Programa[], f: Filtros): Cs5Row[] {
  return [...groupBy(filtrar(ps, f), p => p.modalidad)]
    .map(([modalidad, g]) => ({
      modalidad,
      promedio_creditos: round(avg(g.map(p => p.numero_creditos))),
      promedio_periodos: round(avg(g.map(p => p.numero_periodos))),
      total_programas: g.length,
    }))
    .sort(porTotal);
}

/** GROUP BY ROLLUP (departamento, municipio) */
export function cc2(ps: Programa[], f: Filtros): Cc2Row[] {
  const x = filtrar(ps, f);
  const costo = (g: Programa[]) => round(avg(g.map(p => p.costo_matricula)), 0);
  const filas: Cc2Row[] = [];
  for (const [departamento, gd] of [...groupBy(x, p => p.departamento)].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const [municipio, gm] of [...groupBy(gd, p => p.municipio)].sort((a, b) => a[0].localeCompare(b[0]))) {
      filas.push({ departamento, municipio, nivel_agregacion: 0, total_programas: gm.length, costo_promedio: costo(gm) });
    }
    filas.push({ departamento, municipio: '(todos)', nivel_agregacion: 1, total_programas: gd.length, costo_promedio: costo(gd) });
  }
  filas.push({ departamento: 'TOTAL NACIONAL', municipio: '(todos)', nivel_agregacion: 2, total_programas: x.length, costo_promedio: costo(x) });
  return filas;
}

/** Pivot: modalidades en columnas */
export function cc4(ps: Programa[], f: Filtros): Cc4Row[] {
  return [...groupBy(filtrar(ps, f), p => p.departamento)]
    .map(([departamento, g]) => {
      const n = (m: string) => g.filter(p => p.modalidad === m).length;
      const presencial = n('Presencial');
      return {
        departamento, presencial, virtual: n('Virtual'), a_distancia: n('A distancia'), total: g.length,
        pct_presencial: g.length ? round((100 * presencial) / g.length) : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Ranking de instituciones: top 10 + Universidad de Nariño */
export function cc5(ps: Programa[], f: Filtros): Cc5Row[] {
  const base = [...groupBy(filtrar(ps, f), p => p.institucion)].map(([nombre_institucion, g]) => ({
    nombre_institucion, sector: g[0].sector, total_programas: g.length,
    prom_creditos: avg(g.map(p => p.numero_creditos)),
    prom_periodos: avg(g.map(p => p.numero_periodos)),
    prom_costo: avg(g.map(p => p.costo_matricula)),
  }));
  const costoInst = avg(base.map(b => b.prom_costo));
  const ordenado = base.sort(porTotal);
  return ordenado
    .map(b => ({
      // RANK(): empates comparten puesto
      puesto_oferta: ordenado.findIndex(o => o.total_programas === b.total_programas) + 1,
      nombre_institucion: b.nombre_institucion,
      sector: b.sector,
      total_programas: b.total_programas,
      prom_creditos: round(b.prom_creditos),
      prom_periodos: round(b.prom_periodos),
      costo_promedio: round(b.prom_costo, 0),
      dif_costo_pct: b.prom_costo !== null && costoInst ? round((100 * (b.prom_costo - costoInst)) / costoInst) : null,
    }))
    .filter(r => r.puesto_oferta <= 10 || r.nombre_institucion === UDENAR);
}

/** Participación por campo amplio: Nariño vs. Colombia */
export function cc6(ps: Programa[], f: Filtros): Cc6Row[] {
  const nal = filtrar(ps, f, ['departamento']);
  const nar = nal.filter(p => p.departamento === 'Nariño');
  const gNal = groupBy(nal, p => p.campo_amplio);
  const gNar = groupBy(nar, p => p.campo_amplio);
  return [...gNal]
    .map(([campo_amplio, g]) => {
      const programas_narino = gNar.get(campo_amplio)?.length ?? 0;
      const pct_narino = nar.length ? (100 * programas_narino) / nar.length : 0;
      const pct_nacional = (100 * g.length) / nal.length;
      return {
        campo_amplio, programas_narino, programas_nacional: g.length,
        pct_narino: round(pct_narino, 2)!, pct_nacional: round(pct_nacional, 2)!,
        diferencia_pp: round(pct_narino - pct_nacional, 2)!,
      };
    })
    .sort((a, b) => b.diferencia_pp - a.diferencia_pp);
}

/** Variación anual con LAG. Sin departamentos filtrados usa Nariño y sus vecinos. */
export function cc7(ps: Programa[], f: Filtros): Cc7Row[] {
  const deptos = f.departamento.length ? f.departamento : ['Nariño', 'Cauca', 'Putumayo'];
  const x = filtrar(ps, f, ['anio', 'departamento']).filter(p => deptos.includes(p.departamento));
  const filas: Cc7Row[] = [];
  for (const [departamento, gd] of [...groupBy(x, p => p.departamento)].sort((a, b) => a[0].localeCompare(b[0]))) {
    let anterior: number | null = null;
    for (const [anio, ga] of [...groupBy(gd, p => String(p.anio))].sort((a, b) => +a[0] - +b[0])) {
      const total = ga.length;
      filas.push({
        departamento, anio: +anio, total_programas: total, programas_anio_anterior: anterior,
        variacion: anterior === null ? null : total - anterior,
        variacion_pct: anterior ? round((100 * (total - anterior)) / anterior, 2) : null,
      });
      anterior = total;
    }
  }
  return filas;
}

export const CONSULTAS = { cs1, cs2, cs3, cs4, cs5, cc2, cc4, cc5, cc6, cc7 } as const;
export type NombreConsulta = keyof typeof CONSULTAS;
