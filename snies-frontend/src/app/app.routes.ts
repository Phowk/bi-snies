import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'carga', title: 'Cargar archivo · SNIES BI', loadComponent: () => import('./carga/carga').then(m => m.CargaPage) },
  { path: 'historial', title: 'Historial de cargas · SNIES BI', loadComponent: () => import('./historial/historial').then(m => m.HistorialPage) },
  { path: 'dashboard', title: 'Oferta académica · SNIES BI', loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardPage) },
  { path: '**', redirectTo: 'dashboard' },
];
