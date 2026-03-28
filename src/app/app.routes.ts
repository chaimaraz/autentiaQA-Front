// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/projects.component').then(m => m.ProjectsComponent),
      },
      {
        path: 'scenarios',
        loadComponent: () =>
          import('./features/scenarios/scenarios.component').then(m => m.ScenariosComponent),
      },
      {
        path: 'flux',
        children: [
          { path: '', redirectTo: 'list', pathMatch: 'full' },
          {
            path: 'list',
            loadComponent: () =>
              import('./features/flux/flux-list/flux-list.component').then(m => m.FluxListComponent),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/flux/flux-new/flux-new.component').then(m => m.FluxNewComponent),
          },
        ],
      },
      {
        path: 'execution',
        loadComponent: () =>
          import('./features/execution/execution.component').then(m => m.ExecutionComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/history/history.component').then(m => m.HistoryComponent),
      },
      {
        path: 'performance',
        loadComponent: () =>
          import('./features/performance/performance.component').then(m => m.PerformanceComponent),
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/security/security.component').then(m => m.SecurityComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(m => m.ReportsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.component').then(m => m.RegisterComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
