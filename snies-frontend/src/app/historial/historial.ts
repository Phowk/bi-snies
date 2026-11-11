import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap } from 'rxjs';
import { EtlService, INTERVALO_SONDEO_MS } from '../core/etl.service';
import { Carga } from '../core/models';
import { EstadoCargaComponent } from '../shared/estado-carga';

/** Duración en segundos, o null si la carga no ha terminado. */
export function duracionSeg(c: Carga): number | null {
  return c.fecha_fin ? Math.round((Date.parse(c.fecha_fin) - Date.parse(c.fecha_inicio)) / 1000) : null;
}

/** Porcentaje de filas del origen que llegaron a la tabla de hechos. */
export function reconciliacion(c: Carga): number | null {
  return c.total_filas_origen ? (100 * c.filas_cargadas_hechos) / c.total_filas_origen : null;
}

@Component({
  selector: 'app-historial',
  imports: [MatTableModule, MatSortModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule, RouterLink, DatePipe, DecimalPipe, EstadoCargaComponent],
  templateUrl: './historial.html',
  styleUrl: './historial.scss',
})
export class HistorialPage {
  private etl = inject(EtlService);
  private recargar$ = new Subject<void>();

  protected readonly columnas = ['id_carga', 'nombre_archivo', 'fecha_inicio', 'duracion', 'estado', 'total_filas_origen', 'filas_cargadas_hechos', 'filas_rechazadas', 'reconciliacion'];
  protected readonly duracionSeg = duracionSeg;
  protected readonly reconciliacion = reconciliacion;

  protected readonly error = signal(false);
  protected readonly cargas = toSignal(
    this.recargar$.pipe(
      startWith(undefined),
      switchMap(() => this.etl.listar().pipe(catchError(() => (this.error.set(true), of([] as Carga[]))))),
    ),
  );
  protected readonly seleccionada = signal<Carga | null>(null);
  protected readonly fuente = new MatTableDataSource<Carga>([]);
  private readonly sort = viewChild(MatSort);

  protected readonly resumen = computed(() => {
    const cs = this.cargas() ?? [];
    return { total: cs.length, exitosas: cs.filter(c => c.estado === 'EXITOSO').length, errores: cs.filter(c => c.estado === 'ERROR').length };
  });

  constructor() {
    this.fuente.sortingDataAccessor = (c, col) =>
      col === 'duracion' ? duracionSeg(c) ?? -1 : col === 'reconciliacion' ? reconciliacion(c) ?? -1 : (c as any)[col];
    effect(() => {
      this.fuente.data = this.cargas() ?? [];
      const s = this.sort();
      if (s) this.fuente.sort = s;
    });
    // Mientras haya cargas en proceso, refresca solo.
    effect(onCleanup => {
      if (!this.cargas()?.some(c => c.estado === 'EN_PROCESO')) return;
      const t = setTimeout(() => this.recargar$.next(), INTERVALO_SONDEO_MS);
      onCleanup(() => clearTimeout(t));
    });
  }

  protected actualizar() {
    this.error.set(false);
    this.recargar$.next();
  }

  protected alternar(c: Carga) {
    this.seleccionada.set(this.seleccionada()?.id_carga === c.id_carga ? null : c);
  }
}
