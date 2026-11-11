import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/** Mínimo que necesita el panel de un httpResource para mostrar su estado. */
interface EstadoRecurso {
  isLoading(): boolean;
  error(): unknown;
}

/** Tarjeta de un indicador del cubo: título, código de la consulta y estados de carga/error. */
@Component({
  selector: 'app-panel',
  imports: [MatCardModule, MatProgressBarModule],
  template: `
    <mat-card appearance="outlined" class="panel">
      <header>
        <h2>{{ titulo() }}</h2>
        <span class="codigo" [title]="operacion()">{{ codigo() }} · {{ operacion() }}</span>
      </header>
      @if (recurso().isLoading()) { <mat-progress-bar mode="indeterminate" class="cargando" /> }
      @if (recurso().error()) {
        <p class="estado">No se pudo consultar el cubo.</p>
      }
      <!-- El contenido proyectado se crea siempre; solo se oculta, para no recrear los gráficos. -->
      <div [hidden]="recurso().error()"><ng-content /></div>
    </mat-card>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .panel { height: 100%; padding: 16px; box-sizing: border-box; position: relative; }
    header { margin-bottom: 8px; }
    h2 { font: var(--mat-sys-title-medium); margin: 0; }
    .codigo { font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }
    .cargando { position: absolute; top: 0; left: 0; right: 0; }
    .estado { color: var(--mat-sys-error); }
  `,
})
export class PanelComponent {
  readonly titulo = input.required<string>();
  readonly codigo = input.required<string>();
  readonly operacion = input('');
  readonly recurso = input.required<EstadoRecurso>();
}
