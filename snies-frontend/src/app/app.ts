import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly modoSimulado = environment.useMock;
  protected readonly enlaces = [
    { ruta: '/dashboard', icono: 'insights', texto: 'Oferta académica' },
    { ruta: '/carga', icono: 'upload_file', texto: 'Cargar archivo' },
    { ruta: '/historial', icono: 'history', texto: 'Historial de cargas' },
  ];
}
