import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'SNIES BI · Universidad de Nariño', loadComponent: () => import('./inicio/inicio').then(m => m.InicioPage) },
  { path: 'explorar', title: 'Explorar la oferta · SNIES BI', loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardPage) },
  { path: 'carga', title: 'Cargar datos · SNIES BI', loadComponent: () => import('./carga/carga').then(m => m.CargaPage) },
  { path: 'historial', title: 'Historial de cargas · SNIES BI', loadComponent: () => import('./historial/historial').then(m => m.HistorialPage) },
  { path: 'dashboard', redirectTo: 'explorar' },
  { path: '**', redirectTo: '' },
];
