import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom, toArray } from 'rxjs';
import { EtlService } from '../etl.service';
import { DURACION_ETL_MS, mockInterceptor } from './mock.interceptor';

describe('mockInterceptor', () => {
  let etl: EtlService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    etl = TestBed.inject(EtlService);
  });

  afterEach(() => vi.useRealTimers());

  it('simula subida, ETL en proceso y cierre exitoso', async () => {
    vi.useFakeTimers();
    const subida = lastValueFrom(etl.subir(new File(['x'.repeat(1000)], 'prog.xlsx')).pipe(toArray()));
    await vi.advanceTimersByTimeAsync(2000);
    const eventos = await subida;
    expect(eventos.at(-2)).toEqual({ tipo: 'progreso', porcentaje: 100 });
    const ultimo = eventos.at(-1)!;
    if (ultimo.tipo !== 'aceptado') throw new Error('no aceptado');

    const estados: string[] = [];
    etl.seguir(ultimo.id_carga).subscribe(c => estados.push(c.estado));
    await vi.advanceTimersByTimeAsync(DURACION_ETL_MS + 3000);
    expect(estados[0]).toBe('EN_PROCESO');
    expect(estados.at(-1)).toBe('EXITOSO');
  });

  it('un archivo con "error" en el nombre termina en ERROR con mensaje', async () => {
    vi.useFakeTimers();
    const subida = lastValueFrom(etl.subir(new File(['x'], 'prog_error.xlsx')).pipe(toArray()));
    await vi.advanceTimersByTimeAsync(2000);
    const ultimo = (await subida).at(-1)!;
    if (ultimo.tipo !== 'aceptado') throw new Error('no aceptado');
    await vi.advanceTimersByTimeAsync(DURACION_ETL_MS + 100);
    let estado = '';
    let mensaje: string | null = null;
    etl.obtener(ultimo.id_carga).subscribe(x => ((estado = x.estado), (mensaje = x.mensaje_error)));
    await vi.advanceTimersByTimeAsync(500);
    expect(estado).toBe('ERROR');
    expect(mensaje).toContain('NÚMERO_CRÉDITOS');
  });
});
