import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { mockInterceptor } from './core/mock/mock.interceptor';

registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors(environment.useMock ? [mockInterceptor] : [])),
    provideEchartsCore({ echarts: () => import('echarts') }),
    { provide: LOCALE_ID, useValue: 'es-CO' },
  ],
};
