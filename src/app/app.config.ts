// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { APP_ROUTES } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor'; // ── NOUVEAU

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(
      withFetch(), // Requis pour ProjectApiService
      withInterceptors([authInterceptor]) // ── NOUVEAU : ajoute le JWT sur chaque requête
    ),
    provideRouter(
      APP_ROUTES,
      withComponentInputBinding(),
      withViewTransitions()   // transitions fluides entre routes
    ),
  ],
};