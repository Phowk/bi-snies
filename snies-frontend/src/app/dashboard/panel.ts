import { Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContenidoReporte, descargarPdf } from '../core/pdf';
import { InfoPanel } from './paneles';

/** Mínimo que necesita el panel de un httpResource para mostrar su estado. */
interface EstadoRecurso {
  isLoading(): boolean;
  error(): unknown;
  reload(): boolean;
}

/**
 * Tarjeta de un indicador del cubo. El título es la pregunta que responde, en lenguaje llano;
 * el código de la consulta (CS-1, CC-5…) queda como distintivo discreto con la operación OLAP en el tooltip.
 */
@Component({
  selector: 'app-panel',
  imports: [MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, MatIconModule, MatButtonModule],
  template: `
    <section class="panel" [attr.aria-busy]="recurso().isLoading()">
      @if (recurso().isLoading()) { <mat-progress-bar mode="indeterminate" class="cargando" /> }
      <header>
        <div>
          <h3>{{ info().titulo }}</h3>
          @if (info().ayuda) { <p class="ayuda">{{ info().ayuda }}</p> }
        </div>
        <div class="herramientas">
          <span class="codigo" tabindex="0" [matTooltip]="'Operación OLAP: ' + info().operacion" [attr.aria-label]="'Consulta ' + info().codigo + ', operación OLAP: ' + info().operacion">
            {{ info().codigo }}
          </span>
          @if (pdf()) {
            <button mat-icon-button class="descargar" (click)="descargar()"
              [disabled]="generando() || recurso().isLoading() || !!recurso().error() || vacio()"
              matTooltip="Descargar como PDF" [attr.aria-label]="'Descargar como PDF: ' + info().titulo">
              @if (generando()) { <mat-spinner diameter="18" /> } @else { <mat-icon>picture_as_pdf</mat-icon> }
            </button>
          }
        </div>
      </header>
      @if (errorPdf()) { <p class="error-pdf" role="alert">No se pudo generar el PDF. Intente de nuevo.</p> }

      @if (recurso().error()) {
        <div class="estado" role="alert">
          <mat-icon aria-hidden="true">cloud_off</mat-icon>
          <p>No se pudo consultar la bodega de datos.</p>
          <button mat-stroked-button (click)="recurso().reload()">Reintentar</button>
        </div>
      } @else if (vacio() && !recurso().isLoading()) {
        <div class="estado">
          <mat-icon aria-hidden="true">filter_alt_off</mat-icon>
          <p>{{ mensajeVacio() }}</p>
        </div>
      }
      <!-- El contenido proyectado se crea siempre; solo se oculta, para no recrear los gráficos. -->
      <div class="cuerpo" [hidden]="recurso().error() || vacio()"><ng-content /></div>
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .panel {
      position: relative;
      height: 100%;
      box-sizing: border-box;
      padding: 20px;
      border-radius: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-top: 4px solid var(--acento, var(--mat-sys-primary));
      /* Tinte suave del acento en la cabecera, que se desvanece hacia el contenido */
      background:
        linear-gradient(to bottom, color-mix(in srgb, var(--acento, var(--mat-sys-primary)) 9%, transparent), transparent 96px),
        var(--mat-sys-surface-container-lowest);
      overflow: hidden;
    }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    h3 { font: var(--mat-sys-title-medium); margin: 0; }
    .ayuda { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); margin: 4px 0 0; max-width: 60ch; }
    .herramientas { flex: none; display: flex; align-items: center; gap: 2px; margin: -8px -8px 0 0; }
    .descargar { color: var(--mat-sys-on-surface-variant); }
    .error-pdf { margin: 0 0 8px; color: var(--mat-sys-error); font: var(--mat-sys-body-small); }
    .codigo {
      flex: none;
      padding: 2px 8px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--acento, var(--mat-sys-primary)) 16%, var(--mat-sys-surface-container-lowest));
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-small);
      letter-spacing: 0.04em;
      cursor: help;
      &:focus-visible { outline: 2px solid var(--mat-sys-primary); }
    }
    .cargando { position: absolute; top: 0; left: 0; right: 0; }
    .estado {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 32px 16px; text-align: center; color: var(--mat-sys-on-surface-variant);
      mat-icon { font-size: 32px; width: 32px; height: 32px; }
      p { margin: 0; }
    }
    [role='alert'] mat-icon { color: var(--mat-sys-error); }
  `,
})
export class PanelComponent {
  /** Título (la pregunta), ayuda, código de la consulta y operación OLAP. */
  readonly info = input.required<InfoPanel>();
  readonly recurso = input.required<EstadoRecurso>();
  /** true cuando la consulta respondió sin filas. */
  readonly vacio = input(false);
  readonly mensajeVacio = input('No hay programas para los filtros elegidos.');
  /** Contenido del reporte para exportar a PDF. Es una función: solo se arma al pedir la descarga. */
  readonly pdf = input<(() => ContenidoReporte) | null>(null);

  protected readonly generando = signal(false);
  protected readonly errorPdf = signal(false);

  protected async descargar() {
    const contenido = this.pdf();
    if (!contenido) return;
    this.generando.set(true);
    this.errorPdf.set(false);
    try {
      await descargarPdf({
        ...contenido(),
        titulo: this.info().titulo, descripcion: this.info().ayuda, codigo: this.info().codigo, operacion: this.info().operacion,
      });
    } catch (e) {
      console.error(e);
      this.errorPdf.set(true);
    } finally {
      this.generando.set(false);
    }
  }
}
