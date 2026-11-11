import { FILTROS_VACIOS } from '../models';
import { aParams } from '../olap.service';
import { avg, cc2, cc5, cc6, cc7, filtrar, generarProgramas, kpis } from './mock-db';

const ps = generarProgramas(800, 7);

describe('bodega simulada', () => {
  it('AVG ignora nulos', () => {
    expect(avg([2, null, 4])).toBe(3);
    expect(avg([null])).toBeNull();
  });

  it('el dice combina filtros con AND y valores con OR', () => {
    const f = { ...FILTROS_VACIOS, departamento: ['Nariño', 'Cauca'], modalidad: ['Presencial'] };
    const x = filtrar(ps, f);
    expect(x.length).toBeGreaterThan(0);
    expect(x.every(p => ['Nariño', 'Cauca'].includes(p.departamento) && p.modalidad === 'Presencial')).toBe(true);
    expect(kpis(ps, f).total_programas).toBe(x.length);
  });

  it('CC-2 ROLLUP: municipios suman el departamento y departamentos suman el total', () => {
    const filas = cc2(ps, FILTROS_VACIOS);
    const total = filas.find(r => r.nivel_agregacion === 2)!;
    const deptos = filas.filter(r => r.nivel_agregacion === 1);
    expect(deptos.reduce((s, r) => s + r.total_programas, 0)).toBe(total.total_programas);
    for (const d of deptos) {
      const munis = filas.filter(r => r.nivel_agregacion === 0 && r.departamento === d.departamento);
      expect(munis.reduce((s, r) => s + r.total_programas, 0)).toBe(d.total_programas);
    }
  });

  it('CC-5 siempre incluye a la Universidad de Nariño', () => {
    const f = { ...FILTROS_VACIOS, departamento: ['Nariño'] };
    expect(cc5(ps, f).some(r => r.nombre_institucion === 'Universidad de Nariño')).toBe(true);
  });

  it('CC-6: las participaciones de Nariño y del país suman 100 %', () => {
    const filas = cc6(ps, FILTROS_VACIOS);
    const suma = (k: 'pct_narino' | 'pct_nacional') => filas.reduce((s, r) => s + r[k], 0);
    expect(suma('pct_narino')).toBeCloseTo(100, 0);
    expect(suma('pct_nacional')).toBeCloseTo(100, 0);
  });

  it('CC-7: LAG toma el año anterior del mismo departamento', () => {
    const filas = cc7(ps, FILTROS_VACIOS).filter(r => r.departamento === 'Nariño');
    expect(filas[0].programas_anio_anterior).toBeNull();
    for (let i = 1; i < filas.length; i++) {
      expect(filas[i].programas_anio_anterior).toBe(filas[i - 1].total_programas);
    }
  });

  it('aParams omite filtros vacíos', () => {
    expect(aParams({ ...FILTROS_VACIOS, anio: [2024] })).toEqual({ anio: [2024] });
  });
});
