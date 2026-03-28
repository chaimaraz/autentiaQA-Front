import { Component, signal } from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { inject } from '@angular/core';

interface FluxStep { name: string; type: 'pos' | 'neg' | 'sec'; desc: string; }

@Component({
  selector: 'app-flux-new',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule, RouterLink],
  templateUrl: './flux-new.component.html',
  styleUrl: './flux-new.component.scss',
})
export class FluxNewComponent {
  private router = inject(Router);

  fluxName = 'Parcours achat complet (Positif)';
  steps = signal<FluxStep[]>([]);

  availableScenarios = [
    { name: 'Inscription avec données valides', type: 'pos' as const, desc: '/register → 201 Created' },
    { name: 'Login avec mêmes identifiants', type: 'pos' as const, desc: '/login → redirect /dashboard' },
    { name: 'Login mot de passe incorrect', type: 'neg' as const, desc: '/login → erreur attendue' },
    { name: 'Login email vide', type: 'neg' as const, desc: '/login → validation champ requis' },
    { name: 'Ajouter article au panier', type: 'pos' as const, desc: '/products → cart count +1' },
    { name: 'Modifier quantité panier', type: 'pos' as const, desc: '/cart → total recalculé' },
    { name: 'Commander panier vide', type: 'neg' as const, desc: '/checkout → erreur attendue' },
    { name: 'Passer commande complète', type: 'pos' as const, desc: '/checkout → /confirmation' },
    { name: 'Paiement carte expirée', type: 'neg' as const, desc: '/checkout → erreur paiement' },
    { name: 'Accès commande d\'un autre user', type: 'sec' as const, desc: '/orders/:id → 403 Forbidden' },
  ];

  addStep(scenario: { name: string; type: 'pos' | 'neg' | 'sec'; desc: string }): void {
    this.steps.update(s => [...s, { name: scenario.name, type: scenario.type, desc: scenario.desc }]);
  }

  removeStep(index: number): void {
    this.steps.update(s => s.filter((_, i) => i !== index));
  }

  clearSteps(): void { this.steps.set([]); }

  saveFlux(): void {
    alert(`✓ Flux "${this.fluxName}" sauvegardé !\n\nIl apparaît maintenant dans la liste des flux.`);
    this.router.navigate(['/flux/list']);
  }

  getStepClass(type: string): string {
    return type === 'pos' ? 'pos' : type === 'neg' ? 'neg' : 'sec';
  }
}
