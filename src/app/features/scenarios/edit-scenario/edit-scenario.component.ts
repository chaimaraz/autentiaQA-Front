// src/app/features/scenarios/edit-scenario/edit-scenario.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ScenarioService, Scenario, EtapeScenario,
} from '../../../services/scenario.service';

@Component({
  selector: 'app-edit-scenario',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, RouterLink],
  templateUrl: './edit-scenario.component.html',
  styleUrl: './edit-scenario.component.scss',
})
export class EditScenarioComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private scenarioSvc = inject(ScenarioService);

  projectId  = '';
  scenarioId = '';

  loading      = signal(false);
  saving       = signal(false);
  regenerating = signal(false);
  error        = signal<string | null>(null);
  saveOk       = signal(false);

  name        = '';
  description = '';
  expectedResult = '';
  steps       = signal<EtapeScenario[]>([]);
  scriptTemplate = signal('');

  ngOnInit(): void {
    this.projectId  = this.route.snapshot.params['id'];
    this.scenarioId = this.route.snapshot.params['scenarioId'];
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.scenarioSvc.getFull(this.projectId, this.scenarioId).subscribe({
      next: (s: Scenario) => {
        this.name = s.name;
        this.description = s.description ?? '';
        this.steps.set(s.etapesScenarios ?? []);
        this.scriptTemplate.set(s.scriptTemplate);
        // ── le résultat attendu n'est pas un champ dédié en base, on le
        // déduit du nlpText s'il suit le format "Résultat attendu : ..."
        const match = s.nlpText?.match(/Résultat attendu\s*:\s*(.+)$/s);
        this.expectedResult = match?.[1]?.trim() ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le scénario.');
        this.loading.set(false);
      },
    });
  }

  addStep(): void {
    this.steps.update(list => [...list, { action: 'click', selector: null, value: null, description: '' }]);
  }

  removeStep(step: EtapeScenario): void {
    this.steps.update(list => list.filter(s => s !== step));
  }

  /** Bouton "🔁 Régénérer le script" — recalcule le script via l'IA depuis la description/étapes actuelles */
  regenerateScript(): void {
    this.regenerating.set(true);
    this.error.set(null);
    this.scenarioSvc.regenerateScript(this.projectId, this.scenarioId, {
      description: this.description,
      steps: this.steps(),
      expectedResult: this.expectedResult,
    }).subscribe({
      next: (updated: Scenario) => {
        this.scriptTemplate.set(updated.scriptTemplate);
        this.steps.set(updated.etapesScenarios ?? this.steps());
        this.regenerating.set(false);
      },
      error: (err) => {
        this.regenerating.set(false);
        this.error.set(err?.error?.message || 'Erreur lors de la régénération du script.');
      },
    });
  }

  /**
   * Bouton "💾 Enregistrer" — persiste name/description/étapes/script tels
   * qu'affichés, SANS jamais régénérer le script via l'IA (ça, c'est le
   * rôle exclusif du bouton "🔁 Régénérer le script" ci-dessus). Une
   * édition manuelle du script ne doit jamais être écrasée par une
   * régénération implicite au moment de la sauvegarde.
   */
  save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.saveOk.set(false);

    this.scenarioSvc.update(this.projectId, this.scenarioId, { name: this.name } as Partial<any>).subscribe({
      next: () => {
        this.scenarioSvc.updateScript(this.projectId, this.scenarioId, this.scriptTemplate()).subscribe({
          next: () => {
            this.scenarioSvc.updateMeta(this.projectId, this.scenarioId, {
              description: this.description,
              etapesScenarios: this.steps(),
            }).subscribe({
              next: () => {
                this.saving.set(false);
                this.saveOk.set(true);
                setTimeout(() => this.saveOk.set(false), 2500);
              },
              error: () => {
                // Le script (le plus critique) est déjà sauvegardé ; seule
                // la description/étapes n'a pas pu être synchronisée.
                this.saving.set(false);
                this.error.set("Script enregistré, mais la description/étapes n'a pas pu être synchronisée.");
              },
            });
          },
          error: () => {
            this.saving.set(false);
            this.error.set('Erreur lors de la sauvegarde du script.');
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Erreur lors de la sauvegarde du nom.');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/projects', this.projectId, 'scenarios']);
  }
}