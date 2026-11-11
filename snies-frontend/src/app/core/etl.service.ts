import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, switchMap, takeWhile, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { Carga } from './models';

export const EXTENSIONES_PERMITIDAS = ['.xlsx', '.csv'];
export const TAMANO_MAXIMO_MB = 50;
export const INTERVALO_SONDEO_MS = 2000;

/** Progreso de la subida: porcentaje mientras se envía y id_carga cuando el backend lo acepta. */
export type EventoSubida = { tipo: 'progreso'; porcentaje: number } | { tipo: 'aceptado'; id_carga: number };

/** Devuelve un mensaje de error si el archivo no es válido, o null si se puede subir. */
export function validarArchivo(f: File): string | null {
  const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.includes(ext)) return `Formato no permitido (${ext}). Use ${EXTENSIONES_PERMITIDAS.join(' o ')}.`;
  if (f.size === 0) return 'El archivo está vacío.';
  if (f.size > TAMANO_MAXIMO_MB * 1024 * 1024) return `El archivo supera ${TAMANO_MAXIMO_MB} MB.`;
  return null;
}

@Injectable({ providedIn: 'root' })
export class EtlService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** POST /etl/upload (multipart, campo "archivo"). El backend responde 202 { id_carga } y lanza el ETL en segundo plano. */
  subir(archivo: File): Observable<EventoSubida> {
    const body = new FormData();
    body.append('archivo', archivo);
    return this.http.post<{ id_carga: number }>(`${this.api}/etl/upload`, body, { reportProgress: true, observe: 'events' }).pipe(
      map((e: HttpEvent<{ id_carga: number }>): EventoSubida | null => {
        if (e.type === HttpEventType.UploadProgress) return { tipo: 'progreso', porcentaje: e.total ? Math.round((100 * e.loaded) / e.total) : 0 };
        if (e.type === HttpEventType.Response) return { tipo: 'aceptado', id_carga: e.body!.id_carga };
        return null;
      }),
      filter((e): e is EventoSubida => e !== null),
    );
  }

  listar(): Observable<Carga[]> {
    return this.http.get<Carga[]>(`${this.api}/etl/cargas`);
  }

  obtener(id: number): Observable<Carga> {
    return this.http.get<Carga>(`${this.api}/etl/cargas/${id}`);
  }

  /** Consulta la carga cada INTERVALO_SONDEO_MS hasta que deja de estar EN_PROCESO (emite también el estado final). */
  seguir(id: number): Observable<Carga> {
    return timer(0, INTERVALO_SONDEO_MS).pipe(
      switchMap(() => this.obtener(id)),
      takeWhile(c => c.estado === 'EN_PROCESO', true),
    );
  }
}
