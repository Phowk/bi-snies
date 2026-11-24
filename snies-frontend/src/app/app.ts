import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { TemaService } from './core/tema.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly tema = inject(TemaService);
  protected readonly modoSimulado = environment.useMock;
  protected readonly enlaces = [
    { ruta: '/explorar', icono: 'insights', texto: 'Explorar la oferta' },
    { ruta: '/carga', icono: 'upload_file', texto: 'Cargar datos' },
    { ruta: '/historial', icono: 'history', texto: 'Historial de cargas' },
  ];
  protected readonly anio = new Date().getFullYear();
}
