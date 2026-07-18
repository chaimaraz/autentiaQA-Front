// src/app/features/scenario-data/scenario-data.component.ts
//
// ════════════════════════════════════════════════════════════════════════
// Écran "Données" — Sprint 2, section 14 de la note de refonte.
// Composant autonome, à intégrer où tu veux (onglet dans add-scenario-modal,
// route dédiée, etc.) via <app-scenario-data [projectId]="..." [scenarioId]="...">
// Ne modifie aucun fichier existant : aucune régression possible sur ce qui
// tourne déjà, c'est un ajout pur.
// ════════════════════════════════════════════════════════════════════════

import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScenarioService, ScenarioVariable } from '../../services/scenario.service';

const GENERATOR_LABEL: Record<string, string> = {
  MANUAL:  '✍️ Manuel',
  FAKER:   '🎲 Faker',
  PROJECT: '📁 Projet',
  SYSTEM:  '⚙️ Système',
  AI:      '🤖 IA',
};

@Component({
  selector: 'app-scenario-data',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule],
  templateUrl: './scenario-data.component.html',
  styleUrl: './scenario-data.component.scss',
})
export class ScenarioDataComponent implements OnInit {
  @Input({ required: true }) projectId!: string;
  @Input({ required: true }) scenarioId!: string;

  private scenarioSvc = inject(ScenarioService);

  variables   = signal<ScenarioVariable[]>([]);
  loading     = signal(false);
  saving      = signal(false);
  error       = signal<string | null>(null);
  regeneratingId = signal<string | null>(null);
  showSecret  = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.scenarioSvc.getVariables(this.projectId, this.scenarioId).subscribe({
      next: (vars) => { this.variables.set(vars); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les variables.'); this.loading.set(false); },
    });
  }

  /** Bouton "🔁 Détecter les variables" — resynchronise depuis le script (Sprint 1). */
  sync(): void {
    this.loading.set(true);
    this.scenarioSvc.syncVariables(this.projectId, this.scenarioId).subscribe({
      next: ({ variables, created, removed }) => {
        this.variables.set(variables);
        this.loading.set(false);
        if (created.length || removed.length) {
          const parts: string[] = [];
          if (created.length) parts.push(`+${created.length} ajoutée(s)`);
          if (removed.length) parts.push(`-${removed.length} supprimée(s)`);
          this.error.set(null);
          // simple feedback non bloquant
          console.info(`[Données] Synchronisation : ${parts.join(', ')}`);
        }
      },
      error: () => { this.error.set('Erreur lors de la synchronisation.'); this.loading.set(false); },
    });
  }

  /** Bouton "💾 Enregistrer" — persiste les valeurs éditées manuellement. */
  save(): void {
    this.saving.set(true);
    this.scenarioSvc.saveVariables(this.projectId, this.scenarioId, this.variables()).subscribe({
      next: (vars) => { this.variables.set(vars); this.saving.set(false); },
      error: () => { this.error.set('Erreur lors de l\'enregistrement.'); this.saving.set(false); },
    });
  }

  /** Bouton "🎲" sur une ligne — régénère une seule variable via le Data Generator. */
  regenerateOne(variable: ScenarioVariable): void {
    if (variable.generator === 'MANUAL') return; // pas de génération pour du manuel
    this.regeneratingId.set(variable.id);
    this.scenarioSvc.regenerateOneVariable(this.projectId, this.scenarioId, variable.id).subscribe({
      next: (updated) => {
        this.variables.update(list => list.map(v => v.id === updated.id ? updated : v));
        this.regeneratingId.set(null);
      },
      error: () => { this.error.set(`Erreur lors de la régénération de "${variable.key}".`); this.regeneratingId.set(null); },
    });
  }

  /** Bouton "🎲 Régénérer tout" — régénère toutes les variables non-MANUAL. */
  regenerateAll(): void {
    this.loading.set(true);
    this.scenarioSvc.regenerateAllVariablesServerSide(this.projectId, this.scenarioId).subscribe({
      next: (vars) => { this.variables.set(vars); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors de la régénération globale.'); this.loading.set(false); },
    });
  }

  toggleSecretVisibility(id: string): void {
    this.showSecret.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isSecretVisible(id: string): boolean {
    return this.showSecret().has(id);
  }

  generatorLabel(gen?: string): string {
    return GENERATOR_LABEL[gen ?? 'MANUAL'] ?? gen ?? '—';
  }

  /** Export JSON des variables (bouton "⬇ Exporter"). */
  exportJson(): void {
    const payload = this.variables().map(v => ({ key: v.key, value: v.value, isSecret: v.isSecret, type: v.type }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variables-${this.scenarioId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import JSON des variables (bouton "⬆ Importer") — fusionne puis laisse l'utilisateur valider avec "Enregistrer". */
  importJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported: Array<{ key: string; value: string; isSecret?: boolean }> = JSON.parse(reader.result as string);
        if (!Array.isArray(imported)) throw new Error('Format invalide');

        this.variables.update(list => {
          const byKey = new Map(list.map(v => [v.key, v]));
          for (const item of imported) {
            const existing = byKey.get(item.key);
            if (existing) {
              byKey.set(item.key, { ...existing, value: item.value, isSecret: item.isSecret ?? existing.isSecret });
            } else {
              byKey.set(item.key, {
                id: `tmp-${item.key}-${Date.now()}`,
                key: item.key,
                value: item.value,
                isSecret: item.isSecret ?? false,
                generator: 'MANUAL',
              });
            }
          }
          return [...byKey.values()];
        });
        this.error.set(null);
      } catch {
        this.error.set('Fichier JSON invalide.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  toggleLock(v: ScenarioVariable): void {
  const newLocked = !v.locked;
  this.scenarioSvc.setVariableLock(this.projectId, this.scenarioId, v.id, newLocked).subscribe({
    next: (updated) => this.variables.update(list => list.map(x => x.id === updated.id ? updated : x)),
    error: () => this.error.set('Erreur lors du verrouillage.'),
  });
}
}
