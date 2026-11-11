import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EtlService, EventoSubida, INTERVALO_SONDEO_MS, validarArchivo } from './etl.service';
import { Carga, EstadoCarga } from './models';

const carga = (estado: EstadoCarga): Carga => ({
  id_carga: 7, nombre_archivo: 'a.xlsx', peso_archivo_kb: 1, fecha_inicio: '2026-11-11T10:00:00Z', fecha_fin: null,
  estado, total_filas_origen: 0, filas_cargadas_hechos: 0, filas_rechazadas: 0, mensaje_error: null,
});

describe('validarArchivo', () => {
  const archivo = (nombre: string, bytes: number) => new File([new Uint8Array(bytes)], nombre);

  it('acepta xlsx y csv', () => {
    expect(validarArchivo(archivo('programas.XLSX', 10))).toBeNull();
    expect(validarArchivo(archivo('programas.csv', 10))).toBeNull();
  });

  it('rechaza otros formatos y archivos vacíos', () => {
    expect(validarArchivo(archivo('programas.pdf', 10))).toContain('Formato no permitido');
    expect(validarArchivo(archivo('programas.xlsx', 0))).toContain('vacío');
  });
});

describe('EtlService', () => {
  let svc: EtlService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(EtlService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('sube el archivo como multipart en el campo "archivo" y entrega el id_carga', () => {
    const eventos: EventoSubida[] = [];
    svc.subir(new File(['x'], 'p.xlsx')).subscribe(e => eventos.push(e));
    const req = http.expectOne('/api/etl/upload');
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    req.event({ type: 1, loaded: 50, total: 100 }); // HttpEventType.UploadProgress
    req.flush({ id_carga: 7 }, { status: 202, statusText: 'Accepted' });
    expect(eventos).toEqual([{ tipo: 'progreso', porcentaje: 50 }, { tipo: 'aceptado', id_carga: 7 }]);
  });

  it('sondea la carga hasta que termina y emite el estado final', () => {
    vi.useFakeTimers();
    const estados: EstadoCarga[] = [];
    let completo = false;
    svc.seguir(7).subscribe({ next: c => estados.push(c.estado), complete: () => (completo = true) });

    vi.advanceTimersByTime(0);
    http.expectOne('/api/etl/cargas/7').flush(carga('EN_PROCESO'));
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS);
    http.expectOne('/api/etl/cargas/7').flush(carga('EXITOSO'));
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 3);

    http.expectNone('/api/etl/cargas/7');
    expect(estados).toEqual(['EN_PROCESO', 'EXITOSO']);
    expect(completo).toBe(true);
  });
});
