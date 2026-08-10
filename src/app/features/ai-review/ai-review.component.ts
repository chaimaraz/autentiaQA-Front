// src/app/features/ai-review/ai-review.component.ts
//
// Écran affiché juste après la création d'un projet en mode SPEC_DOCUMENT
// ou URL_CRAWL avec analyse IA. Affiche les scénarios proposés en texte
// NLP + étapes (PAS de script à ce stade). L'utilisateur édite/sélectionne,
// confirme → l'IA génère les scripts → l'utilisateur peut encore ajuster →
// enregistrement final via scenarioService (par le backend, inchangé).
import { Component, OnInit, inject, signal } from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  AIGenerationService,
  AIScenarioProposal, AIScenarioStep, AIScenarioVariable,
  AIJobProgress, AIJobResult,
} from '../../services/ai-generation.service';
import { AIReviewStoreService, AIReviewPayload } from '../../services/ai-review-store.service';

type ScreenStage = 'review' | 'generating_scripts' | 'scripts_ready' | 'saving' | 'done';

const TYPE_LABEL: Record<string, string> = {
  POSITIVE: 'POSITIF', NEGATIVE: 'NÉGATIF', SECURITY: 'SÉCURITÉ', PERFORMANCE: 'PERF',
};
const TYPE_CLASS: Record<string, string> = {
  POSITIVE: 'positive', NEGATIVE: 'negative', SECURITY: 'security', PERFORMANCE: 'perf',
};

@Component({
  selector: 'app-ai-review',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule, RouterLink],
  templateUrl: './ai-review.component.html',
  styleUrl: './ai-review.component.scss',
})
export class AiReviewComponent implements OnInit {

  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private aiSvc  = inject(AIGenerationService);
  private store  = inject(AIReviewStoreService);

  readonly typeLabel = TYPE_LABEL;
  readonly typeClass = TYPE_CLASS;

  projectId    = signal('');
  projectName  = signal('');
  source       = signal<'document' | 'url'>('document');
  pagesExplored = signal<number | null>(null);

  proposals = signal<AIScenarioProposal[]>([]);
  expandedId = signal<string | null>(null);

  stage = signal<ScreenStage>('review');
  globalError = signal('');
  saveErrors  = signal<{ name: string; message: string }[]>([]);
  savedCount  = signal(0);

  ngOnInit(): void {
    const payload = this.store.consume();

    if (!payload) {
      // Rechargement de page ou accès direct : pas de données en mémoire.
      // On redirige vers la liste des projets plutôt que d'afficher un
      // écran vide et déroutant.
      this.globalError.set('Aucune analyse IA en attente. Relancez la génération depuis le projet.');
      return;
    }

    this.projectId.set(payload.projectId);
    this.projectName.set(payload.projectName);
    this.source.set(payload.source);
    this.pagesExplored.set(payload.pagesExplored ?? null);
    this.proposals.set(payload.proposals.map(p => ({ ...p, selected: true })));
  }

  // ── Sélection / édition ──────────────────────────────────────────────────

  get selectedCount(): number {
    return this.proposals().filter(p => p.selected).length;
  }

  toggleSelected(p: AIScenarioProposal): void { p.selected = !p.selected; }
  selectAll(state: boolean): void { this.proposals.update(list => list.map(p => ({ ...p, selected: state }))); }
  toggleExpanded(p: AIScenarioProposal): void { this.expandedId.update(v => v === p.tempId ? null : p.tempId); }
  removeProposal(p: AIScenarioProposal): void { this.proposals.update(list => list.filter(x => x.tempId !== p.tempId)); }

 addStep(p: AIScenarioProposal): void {
  p.steps = [...p.steps, { action: 'click', selector: '', description: '' }];
}
  removeStep(p: AIScenarioProposal, step: AIScenarioStep): void {
    p.steps = p.steps.filter(s => s !== step);
  }

  addVariable(p: AIScenarioProposal): void {
    p.variables = [...p.variables, { key: '', value: '', isSecret: false }];
  }
  removeVariable(p: AIScenarioProposal, v: AIScenarioVariable): void {
    p.variables = p.variables.filter(x => x !== v);
  }

  // ── Étape 1 : confirmer → génération des scripts par l'IA ───────────────

  confirmAndGenerateScripts(): void {
    const selected = this.proposals().filter(p => p.selected);
    if (!selected.length) { this.globalError.set('Sélectionnez au moins un scénario.'); return; }

    const invalid = selected.find(p => !p.name.trim() || p.steps.length === 0);
    if (invalid) {
      this.globalError.set(`Le scénario "${invalid.name || '(sans nom)'}" doit avoir un nom et au moins une étape.`);
      return;
    }

    this.globalError.set('');
    this.stage.set('generating_scripts');

    const job = this.aiSvc.generateScripts(this.projectId(), selected);

    job.progress$.subscribe(() => {});

    job.result$.subscribe((data: { scenarios: AIScenarioProposal[] }) => {
      const byId = new Map(data.scenarios.map((s: AIScenarioProposal) => [s.tempId, s]));
      this.proposals.update(list =>
        list.map(p => (byId.has(p.tempId) ? { ...p, ...byId.get(p.tempId)! } : p))
      );
      this.stage.set('scripts_ready');
    });

    job.error$.subscribe((message: string) => {
      this.stage.set('review');
      this.globalError.set(message || 'Erreur lors de la génération des scripts IA.');
    });
  }

  // ── Étape 2 : enregistrement final ──────────────────────────────────────

  saveAll(): void {
    const selected = this.proposals().filter(p => p.selected);
    if (!selected.length) { this.globalError.set('Sélectionnez au moins un scénario.'); return; }

    this.globalError.set('');
    this.saveErrors.set([]);
    this.stage.set('saving');

    this.aiSvc.bulkCreate(this.projectId(), selected).subscribe({
      next: (res) => {
        this.savedCount.set(res.data?.length ?? 0);
        this.saveErrors.set(res.errors || []);
        this.stage.set('done');
      },
      error: (err: unknown) => {
        this.stage.set('scripts_ready');
        this.globalError.set(this._extractErrorMessage(err, 'Erreur lors de l\'enregistrement des scénarios.'));
      },
    });
  }

  goToScenarios(): void {
    this.router.navigate(['/projects', this.projectId(), 'scenarios']);
  }

  goBackToReview(): void {
    this.stage.set('review');
  }

  private _extractErrorMessage(err: unknown, fallback: string): string {
    const httpErr = err as { error?: { message?: string }; message?: string };
    return httpErr?.error?.message || httpErr?.message || fallback;
  }
}
