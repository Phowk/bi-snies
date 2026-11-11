import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { NgxEchartsDirective } from 'ngx-echarts';
import {
  Cc2Row, Cc4Row, Cc5Row, Cc6Row, Cc7Row, Cs1Row, Cs2Row, Cs3Row, Cs4Row, Cs5Row, FILTROS_VACIOS, Filtros, Kpis,
} from '../core/models';
import { OlapService } from '../core/olap.service';
import { graficoCc6, graficoCc7, graficoCs1, graficoCs2, graficoCs3, graficoCs4, millones } from './graficos';
import { PanelComponent } from './panel';

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, NgxEchartsDirective, DecimalPipe, PanelComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPage {
  private olap = inject(OlapService);

  protected readonly filtros = signal<Filtros>(FILTROS_VACIOS);
  protected readonly hayFiltros = computed(() => Object.values(this.filtros()).some(v => v.length > 0));
  protected readonly campos: { clave: keyof Filtros; etiqueta: string }[] = [
    { clave: 'anio', etiqueta: 'Año' },
    { clave: 'departamento', etiqueta: 'Departamento' },
    { clave: 'modalidad', etiqueta: 'Modalidad' },
    { clave: 'nivel', etiqueta: 'Nivel de formación' },
    { clave: 'sector', etiqueta: 'Sector' },
  ];

  /** httpResource + sus filas ([] mientras carga o si falla; resource.value() lanza en estado de error). */
  private consulta<T>(nombre: string) {
    const res = this.olap.consulta<T[]>(nombre, this.filtros);
    return { res, filas: computed(() => (res.hasValue() ? res.value() : ([] as T[]))) };
  }

  protected readonly opciones = this.olap.opciones();
  protected readonly kpis = this.olap.consulta<Kpis>('kpis', this.filtros);
  protected readonly cs1 = this.consulta<Cs1Row>('cs1');
  protected readonly cs2 = this.consulta<Cs2Row>('cs2');
  protected readonly cs3 = this.consulta<Cs3Row>('cs3');
  protected readonly cs4 = this.consulta<Cs4Row>('cs4');
  protected readonly cs5 = this.consulta<Cs5Row>('cs5');
  protected readonly cc2 = this.consulta<Cc2Row>('cc2');
  protected readonly cc4 = this.consulta<Cc4Row>('cc4');
  protected readonly cc5 = this.consulta<Cc5Row>('cc5');
  protected readonly cc6 = this.consulta<Cc6Row>('cc6');
  protected readonly cc7 = this.consulta<Cc7Row>('cc7');

  protected readonly gCs1 = computed(() => graficoCs1(this.cs1.filas()));
  protected readonly gCs2 = computed(() => graficoCs2(this.cs2.filas()));
  protected readonly gCs3 = computed(() => graficoCs3(this.cs3.filas()));
  protected readonly gCs4 = computed(() => graficoCs4(this.cs4.filas()));
  protected readonly gCc6 = computed(() => graficoCc6(this.cc6.filas()));
  protected readonly gCc7 = computed(() => graficoCc7(this.cc7.filas()));

  /** Drill-down geográfico (CC-2): departamentos desplegados. */
  protected readonly abiertos = signal<ReadonlySet<string>>(new Set());
  protected readonly filasCc2 = computed(() => {
    const abiertos = this.abiertos();
    return this.cc2.filas().filter(r => r.nivel_agregacion > 0 || abiertos.has(r.departamento))
      // ROLLUP entrega el subtotal después de sus municipios; para la vista lo subimos antes.
      .sort((a, b) => (a.nivel_agregacion === 2 ? 1 : b.nivel_agregacion === 2 ? -1 : a.departamento.localeCompare(b.departamento) || b.nivel_agregacion - a.nivel_agregacion));
  });

  protected readonly millones = millones;

  protected cambiar(clave: keyof Filtros, valor: (string | number)[]) {
    this.filtros.update(f => ({ ...f, [clave]: valor }));
  }

  protected limpiar() {
    this.filtros.set(FILTROS_VACIOS);
  }

  protected alternar(depto: string) {
    this.abiertos.update(s => {
      const n = new Set(s);
      n.has(depto) ? n.delete(depto) : n.add(depto);
      return n;
    });
  }

  protected opcionesDe(clave: keyof Filtros): (string | number)[] {
    return this.opciones.hasValue() ? this.opciones.value()[clave] : [];
  }
}
