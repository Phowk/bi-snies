import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EstadoCarga } from '../core/models';

const VISTA: Record<EstadoCarga, { icono: string; texto: string }> = {
  EN_PROCESO: { icono: 'sync', texto: 'En proceso' },
  EXITOSO: { icono: 'check_circle', texto: 'Exitoso' },
  ERROR: { icono: 'error', texto: 'Error' },
};

/** Etiqueta de color para el estado de una carga. */
@Component({
  selector: 'app-estado-carga',
  imports: [MatIconModule],
  template: `<span class="estado" [class]="estado()"><mat-icon inline>{{ vista().icono }}</mat-icon>{{ vista().texto }}</span>`,
  styles: `
    .estado { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 12px; font: var(--mat-sys-label-medium); white-space: nowrap; }
    .EN_PROCESO { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .EXITOSO { background: #d6f5dd; color: #0b5a23; }
    .ERROR { background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
  `,
})
export class EstadoCargaComponent {
  readonly estado = input.required<EstadoCarga>();
  protected readonly vista = computed(() => VISTA[this.estado()]);
}
