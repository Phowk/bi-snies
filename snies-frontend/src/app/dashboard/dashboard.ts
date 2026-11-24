import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import {
  Cc2Row, Cc3Row, Cc4Row, Cc5Row, Cc6Row, Cc7Row, Cs1Row, Cs2Row, Cs3Row, Cs4Row, Cs5Row, FILTROS_VACIOS, Filtros, Kpis,
} from '../core/models';
import { OlapService } from '../core/olap.service';
import { ContenidoReporte, descargarReporteGeneral } from '../core/pdf';
import { TemaService } from '../core/tema.service';
import { TEMA_CLARO, TEMA_OSCURO, graficoCc6, graficoCc7, graficoCs1, graficoCs2, graficoCs3, graficoCs4, millones } from './graficos';
import { ClavePanel, PANELES, SECCIONES } from './paneles';
import { PanelComponent } from './panel';
import {
  ContenidoPanel, repCc2, repCc3, repCc4, repCc5, repCc6, repCc7, repCs1, repCs2, repCs3, repCs4, repCs5,
} from './reportes';


const entero = new Intl.NumberFormat('es-CO');
const decimal = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** El SNIES escribe el nombre en mayúsculas; el mock, en tipo título. */
export const esUdenar = (nombre: string) => /universidad de nari.o/i.test(nombre);
const esNarino = (depto: string) => /^nari.o$/i.test(depto);

@Component({
  selector: 'app-dashboard',
  imports: [
    MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, MatTabsModule, MatChipsModule,
    NgxEchartsDirective, DecimalPipe, PanelComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPage {
  private olap = inject(OlapService);
  private router = inject(Router);
  private temaSvc = inject(TemaService);

  /** ?vista=udenar (enlazado por withComponentInputBinding). */
  readonly vista = input<string>();
  protected readonly vistas = SECCIONES;
  protected readonly P = PANELES;
  protected readonly indiceVista = computed(() => Math.max(0, SECCIONES.findIndex(v => v.id === this.vista())));

  protected readonly filtros = signal<Filtros>(FILTROS_VACIOS);
  protected readonly hayFiltros = computed(() => Object.values(this.filtros()).some(v => v.length > 0));
  protected readonly campos: { clave: keyof Filtros; etiqueta: string }[] = [
    { clave: 'anio', etiqueta: 'Año de registro' },
    { clave: 'departamento', etiqueta: 'Departamento' },
    { clave: 'modalidad', etiqueta: 'Modalidad' },
    { clave: 'nivel', etiqueta: 'Nivel de formación' },
    { clave: 'sector', etiqueta: 'Sector' },
  ];

  /** Filtros activos, uno por valor, para mostrarlos como chips que se pueden quitar. */
  protected readonly activos = computed(() =>
    this.campos.flatMap(c => this.filtros()[c.clave].map(valor => ({ clave: c.clave, etiqueta: c.etiqueta, valor }))),
  );

  /** httpResource + sus filas ([] mientras carga o si falla; resource.value() lanza en estado de error). */
  private consulta<T>(nombre: string) {
    const res = this.olap.consulta<T[]>(nombre, this.filtros);
    const filas = computed(() => (res.hasValue() ? res.value() : ([] as T[])));
    return { res, filas, vacio: computed(() => res.hasValue() && res.value().length === 0) };
  }

  protected readonly opciones = this.olap.opciones();
  protected readonly kpis = this.olap.consulta<Kpis>('kpis', this.filtros);
  protected readonly cs1 = this.consulta<Cs1Row>('cs1');
  protected readonly cs2 = this.consulta<Cs2Row>('cs2');
  protected readonly cs3 = this.consulta<Cs3Row>('cs3');
  protected readonly cs4 = this.consulta<Cs4Row>('cs4');
  protected readonly cs5 = this.consulta<Cs5Row>('cs5');
  protected readonly cc2 = this.consulta<Cc2Row>('cc2');
  protected readonly cc3 = this.consulta<Cc3Row>('cc3');
  protected readonly cc4 = this.consulta<Cc4Row>('cc4');
  protected readonly cc5 = this.consulta<Cc5Row>('cc5');
  protected readonly cc6 = this.consulta<Cc6Row>('cc6');
  protected readonly cc7 = this.consulta<Cc7Row>('cc7');

  private readonly t = computed(() => (this.temaSvc.oscuro() ? TEMA_OSCURO : TEMA_CLARO));
  protected readonly gCs1 = computed(() => graficoCs1(this.cs1.filas(), this.t()));
  protected readonly gCs2 = computed(() => graficoCs2(this.cs2.filas(), this.t()));
  protected readonly gCs3 = computed(() => graficoCs3(this.cs3.filas(), this.t()));
  protected readonly gCs4 = computed(() => graficoCs4(this.cs4.filas(), this.t()));
  /** Una barra por departamento: el alto crece con las filas para que las etiquetas no se encimen. */
  protected readonly altoCs4 = computed(() => Math.max(300, this.cs4.filas().length * 26 + 40));
  protected readonly gCc6 = computed(() => graficoCc6(this.cc6.filas(), this.t()));
  protected readonly gCc7 = computed(() => graficoCc7(this.cc7.filas(), this.t()));

  /** Posición de Udenar en el ranking CC-5, para el titular de la pestaña. */
  protected readonly udenarEnRanking = computed(() => this.cc5.filas().find(r => esUdenar(r.nombre_institucion)) ?? null);
  protected readonly totalUdenar = computed(() => this.cs2.filas().reduce((s, r) => s + r.total_programas, 0));

  /** CC-3 (CUBE) mostrado como matriz nivel × sector: se usan las celdas con modalidad = TODAS. */
  protected readonly matrizCc3 = computed(() => {
    const filas = this.cc3.filas().filter(r => r.modalidad === 'TODAS');
    const sectores = [...new Set(filas.map(r => r.sector).filter(s => s !== 'TODOS'))].sort();
    const celda = (nivel: string, sector: string) => filas.find(r => r.nivel_formacion === nivel && r.sector === sector)?.total_programas ?? 0;
    const niveles = filas
      .filter(r => r.sector === 'TODOS' && r.nivel_formacion !== 'TODOS')
      .sort((a, b) => b.total_programas - a.total_programas)
      .map(r => ({ nivel: r.nivel_formacion, total: r.total_programas, celdas: sectores.map(s => celda(r.nivel_formacion, s)) }));
    const totales = { total: celda('TODOS', 'TODOS'), celdas: sectores.map(s => celda('TODOS', s)) };
    return { sectores, niveles, totales };
  });

  /** Drill-down geográfico (CC-2): departamentos desplegados. */
  protected readonly abiertos = signal<ReadonlySet<string>>(new Set());
  protected readonly filasCc2 = computed(() => {
    const abiertos = this.abiertos();
    return this.cc2.filas().filter(r => r.nivel_agregacion > 0 || abiertos.has(r.departamento))
      // ROLLUP entrega el subtotal después de sus municipios; para la vista lo subimos antes.
      .sort((a, b) => (a.nivel_agregacion === 2 ? 1 : b.nivel_agregacion === 2 ? -1 : a.departamento.localeCompare(b.departamento) || b.nivel_agregacion - a.nivel_agregacion));
  });

  /** Valor de "Nariño" tal como viene en las opciones (puede venir en mayúsculas). */
  protected readonly narino = computed(() => this.opcionesDe('departamento').find(d => esNarino(String(d))) as string | undefined);
  protected readonly soloNarino = computed(() => {
    const d = this.filtros().departamento;
    return d.length === 1 && esNarino(d[0]);
  });

  protected readonly millones = millones;
  protected readonly esUdenar = esUdenar;

  /** Filtros activos en texto, para la ficha del PDF. Marca los que la consulta no usa. */
  protected textoFiltros(ignorados: (keyof Filtros)[] = []): string {
    const partes = this.campos
      .filter(c => this.filtros()[c.clave].length)
      .map(c => `${c.etiqueta}: ${this.filtros()[c.clave].join(', ')}${ignorados.includes(c.clave) ? ' (no aplica a esta consulta)' : ''}`);
    return partes.length ? partes.join(' · ') : 'Ninguno (toda la oferta nacional registrada en el SNIES)';
  }

  /** Contenido PDF de cada panel; se arma recién al pulsar el botón de descarga. */
  private pdf(contenido: () => ContenidoPanel, ignorados: (keyof Filtros)[] = []) {
    return () => ({ ...contenido(), filtros: this.textoFiltros(ignorados) });
  }
  protected readonly pdfCs1 = this.pdf(() => repCs1(this.cs1.filas()));
  protected readonly pdfCs2 = this.pdf(() => repCs2(this.cs2.filas()), ['departamento', 'sector']);
  protected readonly pdfCs3 = this.pdf(() => repCs3(this.cs3.filas()), ['anio']);
  protected readonly pdfCs4 = this.pdf(() => repCs4(this.cs4.filas()));
  protected readonly pdfCs5 = this.pdf(() => repCs5(this.cs5.filas()));
  protected readonly pdfCc2 = this.pdf(() => repCc2(this.cc2.filas()));
  protected readonly pdfCc3 = this.pdf(() => repCc3(this.matrizCc3()));
  protected readonly pdfCc4 = this.pdf(() => repCc4(this.cc4.filas()));
  protected readonly pdfCc5 = this.pdf(() => repCc5(this.cc5.filas(), esUdenar));
  protected readonly pdfCc6 = this.pdf(() => repCc6(this.cc6.filas()), ['departamento']);
  protected readonly pdfCc7 = this.pdf(() => repCc7(this.cc7.filas()), ['anio']);

  // ------------------------------------------------------------ reporte general

  /** Consulta, contenido PDF y estado de cada panel, por clave. */
  private readonly todos: Record<ClavePanel, { res: { isLoading(): boolean; error(): unknown }; vacio: () => boolean; pdf: () => ContenidoReporte }> = {
    cs1: { ...this.cs1, pdf: this.pdfCs1 }, cs2: { ...this.cs2, pdf: this.pdfCs2 }, cs3: { ...this.cs3, pdf: this.pdfCs3 },
    cs4: { ...this.cs4, pdf: this.pdfCs4 }, cs5: { ...this.cs5, pdf: this.pdfCs5 }, cc2: { ...this.cc2, pdf: this.pdfCc2 },
    cc3: { ...this.cc3, pdf: this.pdfCc3 }, cc4: { ...this.cc4, pdf: this.pdfCc4 }, cc5: { ...this.cc5, pdf: this.pdfCc5 },
    cc6: { ...this.cc6, pdf: this.pdfCc6 }, cc7: { ...this.cc7, pdf: this.pdfCc7 },
  };

  /** Listo cuando terminaron todas las consultas (las que fallan o vienen vacías se anotan como "sin datos"). */
  protected readonly listoGeneral = computed(() => this.kpis.hasValue() && Object.values(this.todos).every(p => !p.res.isLoading()));
  protected readonly generandoGeneral = signal(false);
  protected readonly errorGeneral = signal(false);

  protected async descargarGeneral() {
    if (!this.kpis.hasValue()) return;
    const k = this.kpis.value();
    this.generandoGeneral.set(true);
    this.errorGeneral.set(false);
    try {
      await descargarReporteGeneral({
        filtros: this.textoFiltros(),
        cifras: [
          { etiqueta: 'Programas', valor: entero.format(k.total_programas) },
          { etiqueta: 'Instituciones', valor: entero.format(k.total_instituciones) },
          { etiqueta: 'Créditos promedio', valor: k.promedio_creditos === null ? '-' : decimal.format(k.promedio_creditos) },
          { etiqueta: 'Duración (periodos)', valor: k.promedio_periodos === null ? '-' : decimal.format(k.promedio_periodos) },
          { etiqueta: 'Matrícula promedio', valor: k.costo_promedio === null ? '-' : millones(k.costo_promedio) },
        ],
        secciones: SECCIONES.map(s => ({
          titulo: s.texto,
          intro: s.intro,
          reportes: s.paneles.map(clave => {
            const p = this.todos[clave];
            const info = PANELES[clave];
            if (p.res.error()) return { titulo: info.titulo, codigo: info.codigo, sinDatos: 'error' };
            if (p.vacio()) return { titulo: info.titulo, codigo: info.codigo, sinDatos: 'vacio' };
            return { ...p.pdf(), titulo: info.titulo, descripcion: info.ayuda, codigo: info.codigo, operacion: info.operacion };
          }),
        })),
      });
    } catch (e) {
      console.error(e);
      this.errorGeneral.set(true);
    } finally {
      this.generandoGeneral.set(false);
    }
  }

  protected elegirVista(i: number) {
    this.router.navigate([], { queryParams: { vista: SECCIONES[i].id }, replaceUrl: true });
  }

  protected cambiar(clave: keyof Filtros, valor: (string | number)[]) {
    this.filtros.update(f => ({ ...f, [clave]: valor }));
  }

  protected quitar(clave: keyof Filtros, valor: string | number) {
    this.filtros.update(f => ({ ...f, [clave]: (f[clave] as (string | number)[]).filter(v => v !== valor) }));
  }

  protected alternarNarino() {
    const n = this.narino();
    if (n) this.cambiar('departamento', this.soloNarino() ? [] : [n]);
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
