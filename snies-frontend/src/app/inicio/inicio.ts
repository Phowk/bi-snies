import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EtlService } from '../core/etl.service';
import { Carga, FILTROS_VACIOS, Kpis } from '../core/models';
import { OlapService } from '../core/olap.service';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, MatButtonModule, MatIconModule, DecimalPipe, DatePipe],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class InicioPage {
  private olap = inject(OlapService);

  protected readonly kpis = this.olap.consulta<Kpis>('kpis', signal(FILTROS_VACIOS));
  private readonly cargas = toSignal(inject(EtlService).listar().pipe(catchError(() => of(null as Carga[] | null))));

  /** Última carga exitosa: indica qué tan actualizados están los datos. */
  protected readonly ultima = computed(() => this.cargas()?.find(c => c.estado === 'EXITOSO') ?? null);
  protected readonly sinDatos = computed(() => this.kpis.hasValue() && this.kpis.value().total_programas === 0);

  protected readonly preguntas = [
    {
      vista: 'udenar', icono: 'account_balance', acento: 'acento-naranja',
      titulo: '¿Qué ofrece la Universidad de Nariño?',
      texto: 'Sus programas por modalidad y su posición frente a las instituciones con mayor oferta del país.',
    },
    {
      vista: 'territorio', icono: 'map', acento: 'acento-verde',
      titulo: '¿En qué se diferencia Nariño del país?',
      texto: 'Áreas del conocimiento donde la región concentra más o menos oferta, y el detalle por municipio.',
    },
    {
      vista: 'panorama', icono: 'dashboard', acento: 'acento-azul',
      titulo: '¿Qué niveles y modalidades predominan?',
      texto: 'Composición de la oferta por nivel de formación, modalidad, sector y costo de matrícula.',
    },
    {
      vista: 'tendencias', icono: 'trending_up', acento: 'acento-violeta',
      titulo: '¿Cómo ha cambiado la oferta?',
      texto: 'Programas registrados por año y variación anual en Nariño y los departamentos vecinos.',
    },
  ];

  protected readonly pasos = [
    { icono: 'upload_file', acento: 'acento-azul', titulo: 'Cargue el reporte del SNIES', texto: 'Arrastre el archivo Excel o CSV de programas. No hace falta prepararlo.' },
    { icono: 'cleaning_services', acento: 'acento-verde', titulo: 'El sistema lo organiza', texto: 'Limpia los datos, descarta duplicados y los carga en la bodega. Cada carga queda auditada.' },
    { icono: 'insights', acento: 'acento-naranja', titulo: 'Explore y compare', texto: 'Filtre por año, departamento, modalidad, nivel o sector y vea las cifras al instante.' },
  ];
}
