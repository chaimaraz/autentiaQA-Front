import { Component, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

const TITLES: Record<string, string> = {
  '/dashboard':    'Tableau de bord',
  '/projects':     'Projets',
  '/scenarios':    'Scénarios IA',
  '/flux/list':    'Flux personnalisés',
  '/flux/new':     'Créer un flux',
  '/execution':    'Exécution en cours',
  '/history':      'Historique',
  '/performance':  'Tests de performance',
  '/security':     'Sécurité OWASP',
  '/reports':      'Rapports',
  '/settings':     'Paramètres',
  '/profile':      'Mon profil',
};

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private router = inject(Router);

  pageTitle$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => TITLES[(e as NavigationEnd).urlAfterRedirects] ?? 'Autentia QA'),
  );
}
