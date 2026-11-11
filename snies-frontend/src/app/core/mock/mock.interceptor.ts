// Simula el backend FastAPI en el navegador. Se registra solo si environment.useMock = true.
import {
  HttpErrorResponse, HttpEvent, HttpEventType, HttpInterceptorFn, HttpParams, HttpRequest, HttpResponse,
} from '@angular/common/http';
import { Observable, concat, delay, interval, map, of, take, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Carga, Filtros } from '../models';
import { CONSULTAS, NombreConsulta, generarProgramas, kpis, opciones } from './mock-db';

/** Tiempo que tarda una carga simulada en terminar el ETL. */
export const DURACION_ETL_MS = 6000;

const programas = generarProgramas();
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const cargas: Carga[] = [
  { id_carga: 1, nombre_archivo: 'programas_snies_2024-1.xlsx', peso_archivo_kb: 8421.5, fecha_inicio: hace(60 * 24 * 40), fecha_fin: hace(60 * 24 * 40 - 2), estado: 'EXITOSO', total_filas_origen: 13872, filas_cargadas_hechos: 13810, filas_rechazadas: 62, mensaje_error: null },
  { id_carga: 2, nombre_archivo: 'programas_snies_2024-2.xlsx', peso_archivo_kb: 8603.1, fecha_inicio: hace(60 * 24 * 12), fecha_fin: hace(60 * 24 * 12 - 1), estado: 'ERROR', total_filas_origen: 0, filas_cargadas_hechos: 0, filas_rechazadas: 0, mensaje_error: 'column "CÓDIGO_SNIES_DEL_PROGRAMA" not found in sheet 0' },
  { id_carga: 3, nombre_archivo: 'programas_snies_2024-2_corregido.xlsx', peso_archivo_kb: 8610.0, fecha_inicio: hace(60 * 24 * 11), fecha_fin: hace(60 * 24 * 11 - 3), estado: 'EXITOSO', total_filas_origen: 14215, filas_cargadas_hechos: 14170, filas_rechazadas: 45, mensaje_error: null },
];

/** Cierra la carga simulada cuando ya pasó DURACION_ETL_MS. Un archivo con "error" en el nombre falla. */
function avanzar(c: Carga): Carga {
  if (c.estado !== 'EN_PROCESO' || Date.now() - Date.parse(c.fecha_inicio) < DURACION_ETL_MS) return c;
  c.fecha_fin = new Date().toISOString();
  if (/error/i.test(c.nombre_archivo)) {
    c.estado = 'ERROR';
    c.mensaje_error = 'invalid input syntax for type integer: "N/A" (fila 1834, columna NÚMERO_CRÉDITOS)';
  } else {
    c.estado = 'EXITOSO';
    c.total_filas_origen = 13000 + Math.floor(Math.random() * 2000);
    c.filas_rechazadas = Math.floor(Math.random() * 80);
    c.filas_cargadas_hechos = c.total_filas_origen - c.filas_rechazadas;
  }
  return c;
}

function leerFiltros(p: HttpParams): Filtros {
  return {
    anio: p.getAll('anio')?.map(Number) ?? [],
    departamento: p.getAll('departamento') ?? [],
    modalidad: p.getAll('modalidad') ?? [],
    nivel: p.getAll('nivel') ?? [],
    sector: p.getAll('sector') ?? [],
  };
}

const ok = <T>(body: T): Observable<HttpEvent<T>> => of(new HttpResponse({ status: 200, body })).pipe(delay(250));
const fallo = (status: number, error: string) => throwError(() => new HttpErrorResponse({ status, error: { detail: error } }));

function subir(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const archivo = (req.body as FormData).get('archivo') as File | null;
  if (!archivo) return fallo(422, 'Falta el archivo');
  const carga: Carga = {
    id_carga: Math.max(...cargas.map(c => c.id_carga)) + 1,
    nombre_archivo: archivo.name, peso_archivo_kb: Math.round(archivo.size / 102.4) / 10,
    fecha_inicio: new Date().toISOString(), fecha_fin: null, estado: 'EN_PROCESO',
    total_filas_origen: 0, filas_cargadas_hechos: 0, filas_rechazadas: 0, mensaje_error: null,
  };
  const pasos = 10;
  return concat(
    of({ type: HttpEventType.Sent } as HttpEvent<unknown>),
    interval(120).pipe(take(pasos), map(i => ({
      type: HttpEventType.UploadProgress, loaded: ((i + 1) / pasos) * archivo.size, total: archivo.size,
    }) as HttpEvent<unknown>)),
    of(0).pipe(map(() => {
      carga.fecha_inicio = new Date().toISOString(); // el ETL arranca al terminar la subida
      cargas.push(carga);
      return new HttpResponse({ status: 202, body: { id_carga: carga.id_carga } });
    })),
  );
}

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.apiUrl;
  if (!req.url.startsWith(base)) return next(req);
  const ruta = req.url.slice(base.length);

  if (req.method === 'POST' && ruta === '/etl/upload') return subir(req);
  if (req.method === 'GET' && ruta === '/etl/cargas') {
    return ok(cargas.map(avanzar).slice().sort((a, b) => b.id_carga - a.id_carga));
  }
  const mCarga = ruta.match(/^\/etl\/cargas\/(\d+)$/);
  if (req.method === 'GET' && mCarga) {
    const c = cargas.find(x => x.id_carga === +mCarga[1]);
    return c ? ok({ ...avanzar(c) }) : fallo(404, 'Carga no encontrada');
  }
  if (req.method === 'GET' && ruta === '/olap/filtros') return ok(opciones(programas));
  if (req.method === 'GET' && ruta === '/olap/kpis') return ok(kpis(programas, leerFiltros(req.params)));
  const mOlap = ruta.match(/^\/olap\/(\w+)$/);
  if (req.method === 'GET' && mOlap && mOlap[1] in CONSULTAS) {
    return ok(CONSULTAS[mOlap[1] as NombreConsulta](programas, leerFiltros(req.params)));
  }
  return fallo(404, `Ruta simulada no encontrada: ${req.method} ${ruta}`);
};
