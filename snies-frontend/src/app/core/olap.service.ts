import { httpResource } from '@angular/common/http';
import { Injectable, Signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { Filtros, OpcionesFiltro } from './models';

/** Convierte los filtros en query params repetidos (?departamento=Nariño&departamento=Cauca), omitiendo los vacíos. */
export function aParams(f: Filtros): Record<string, (string | number)[]> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v.length > 0));
}

/**
 * Acceso a los endpoints del cubo OLAP. Los métodos devuelven httpResource, que se vuelve a pedir
 * automáticamente cuando cambian los filtros. Deben llamarse en el contexto de inyección de un componente.
 */
@Injectable({ providedIn: 'root' })
export class OlapService {
  private api = environment.apiUrl;

  opciones() {
    return httpResource<OpcionesFiltro>(() => `${this.api}/olap/filtros`);
  }

  /** GET /olap/{nombre}?filtros… — nombre: kpis, cs1..cs5, cc2, cc4..cc7 */
  consulta<T>(nombre: string, filtros: Signal<Filtros>) {
    return httpResource<T>(() => ({ url: `${this.api}/olap/${nombre}`, params: aParams(filtros()) }));
  }
}
