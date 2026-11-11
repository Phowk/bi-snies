import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EXTENSIONES_PERMITIDAS, EtlService, TAMANO_MAXIMO_MB, validarArchivo } from '../core/etl.service';
import { Carga } from '../core/models';
import { EstadoCargaComponent } from '../shared/estado-carga';

type Fase = 'inicio' | 'subiendo' | 'procesando' | 'fin';

@Component({
  selector: 'app-carga',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule, RouterLink, DatePipe, DecimalPipe, EstadoCargaComponent],
  templateUrl: './carga.html',
  styleUrl: './carga.scss',
})
export class CargaPage {
  private etl = inject(EtlService);
  private sub?: Subscription;

  protected readonly aceptar = EXTENSIONES_PERMITIDAS.join(',');
  protected readonly maxMb = TAMANO_MAXIMO_MB;

  protected readonly fase = signal<Fase>('inicio');
  protected readonly arrastrando = signal(false);
  protected readonly archivo = signal<File | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly progreso = signal(0);
  protected readonly carga = signal<Carga | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
  }

  protected soltar(ev: DragEvent) {
    ev.preventDefault();
    this.arrastrando.set(false);
    const f = ev.dataTransfer?.files[0];
    if (f) this.elegir(f);
  }

  protected seleccionar(input: HTMLInputElement) {
    const f = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (f) this.elegir(f);
  }

  private elegir(f: File) {
    if (this.fase() === 'subiendo' || this.fase() === 'procesando') return;
    this.error.set(validarArchivo(f));
    this.archivo.set(this.error() ? null : f);
  }

  protected iniciar() {
    const f = this.archivo();
    if (!f) return;
    this.fase.set('subiendo');
    this.progreso.set(0);
    this.error.set(null);
    this.sub = this.etl.subir(f).subscribe({
      next: e => {
        if (e.tipo === 'progreso') this.progreso.set(e.porcentaje);
        else this.seguir(e.id_carga);
      },
      error: (e: HttpErrorResponse) => this.fallar(e),
    });
  }

  private seguir(id: number) {
    this.fase.set('procesando');
    this.sub = this.etl.seguir(id).subscribe({
      next: c => {
        this.carga.set(c);
        if (c.estado !== 'EN_PROCESO') this.fase.set('fin');
      },
      error: (e: HttpErrorResponse) => this.fallar(e),
    });
  }

  private fallar(e: HttpErrorResponse) {
    this.error.set(e.error?.detail ?? `No se pudo contactar el servidor (${e.status || 'sin conexión'}).`);
    this.fase.set('inicio');
  }

  protected reiniciar() {
    this.sub?.unsubscribe();
    this.fase.set('inicio');
    this.archivo.set(null);
    this.carga.set(null);
    this.error.set(null);
  }

  protected tamano(f: File) {
    return f.size / (1024 * 1024);
  }
}
