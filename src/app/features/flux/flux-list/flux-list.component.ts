import { Component } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-flux-list',
  standalone: true,
  imports: [NgFor, NgClass, RouterLink],
  templateUrl: './flux-list.component.html',
  styleUrl: './flux-list.component.scss',
})
export class FluxListComponent {
  fluxList = [
    {
      icon: '✅', iconClass: 'pos',
      name: 'Parcours achat complet — Positif',
      meta: '5 scénarios · Dernière exéc: il y a 2h',
      status: 'passed', statusLabel: 'PASSÉ 5/5',
      steps: [
        { label: '① Inscription valide', color: 'green' },
        { label: '② Login (mêmes données)', color: 'green' },
        { label: '③ Ajout article panier', color: 'green' },
        { label: '④ Validation panier', color: 'green' },
        { label: '⑤ Commande & confirmation', color: 'green' },
      ],
    },
    {
      icon: '❌', iconClass: 'neg',
      name: 'Authentification incorrecte — Négatif',
      meta: '3 scénarios · Dernière exéc: hier',
      status: 'passed', statusLabel: 'PASSÉ 3/3',
      steps: [
        { label: '① Inscription (données valides)', color: 'red' },
        { label: '② Login (mauvais mdp)', color: 'red' },
        { label: '③ Vérif. message erreur affiché', color: 'red' },
      ],
    },
    {
      icon: '🔐', iconClass: 'mix',
      name: 'Accès admin sans droits — Sécurité',
      meta: '4 scénarios · Jamais exécuté',
      status: 'idle', statusLabel: 'IDLE',
      steps: [
        { label: '① Login utilisateur standard', color: 'orange' },
        { label: '② Accès direct /admin', color: 'orange' },
        { label: '③ Vérif. 403 Forbidden', color: 'orange' },
        { label: '④ Tentative bypass token', color: 'orange' },
      ],
    },
  ];
}
