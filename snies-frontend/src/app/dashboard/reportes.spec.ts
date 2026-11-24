import { nombreArchivo } from '../core/pdf';
import { Cc2Row, Cc5Row } from '../core/models';
import { esUdenar } from './dashboard';
import { repCc2, repCc5, repCc6, repCs5 } from './reportes';

describe('contenido de los reportes PDF', () => {
  it('CC-2 lista cada departamento antes de sus municipios y el total nacional al final, resaltando subtotales', () => {
    const filas: Cc2Row[] = [
      { departamento: 'Nariño', municipio: 'Pasto', nivel_agregacion: 0, total_programas: 5, costo_promedio: null },
      { departamento: 'Cauca', municipio: '(todos)', nivel_agregacion: 1, total_programas: 3, costo_promedio: null },
      { departamento: 'TOTAL NACIONAL', municipio: '(todos)', nivel_agregacion: 2, total_programas: 8, costo_promedio: null },
      { departamento: 'Nariño', municipio: '(todos)', nivel_agregacion: 1, total_programas: 5, costo_promedio: null },
      { departamento: 'Cauca', municipio: 'Popayán', nivel_agregacion: 0, total_programas: 3, costo_promedio: null },
    ];
    const { tabla } = repCc2(filas);
    expect(tabla.filas.map(f => String(f[0]).trim())).toEqual(['Cauca', 'Popayán', 'Nariño', 'Pasto', 'Total nacional']);
    expect(tabla.destacadas).toEqual([0, 2, 4]);
  });

  it('CC-5 resalta a la Universidad de Nariño aunque venga en mayúsculas', () => {
    const fila = (puesto: number, nombre: string): Cc5Row => ({
      puesto_oferta: puesto, nombre_institucion: nombre, sector: 'Oficial', total_programas: 10,
      prom_creditos: null, prom_periodos: null, costo_promedio: null, dif_costo_pct: null,
    });
    const { tabla } = repCc5([fila(1, 'SENA'), fila(45, 'UNIVERSIDAD DE NARIÑO')], esUdenar);
    expect(tabla.destacadas).toEqual([1]);
    expect(tabla.columnas.length).toBe(8);
  });

  it('formatea números en es-CO y deja los nulos vacíos', () => {
    const { tabla } = repCs5([{ modalidad: 'Presencial', total_programas: 26844, promedio_creditos: 92.8, promedio_periodos: null }]);
    expect(tabla.filas[0]).toEqual(['Presencial', '26.844', '92,8', null]);
  });

  it('CC-6 muestra la diferencia con dos decimales para no redondear a -0,0', () => {
    const { tabla } = repCc6([{ campo_amplio: 'Programas genéricos', programas_narino: 0, programas_nacional: 4, pct_narino: 0, pct_nacional: 0.01, diferencia_pp: -0.01 }]);
    expect(tabla.filas[0].at(-1)).toBe('-0,01');
  });

  it('nombra el archivo con el código, el título sin tildes y la fecha', () => {
    const nombre = nombreArchivo({ codigo: 'CS-1', titulo: '¿Qué niveles de formación predominan?' }, new Date(2026, 10, 24));
    expect(nombre).toBe('snies-cs-1-que-niveles-de-formacion-predominan-2026-11-24.pdf');
  });
});
