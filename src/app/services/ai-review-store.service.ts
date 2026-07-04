// src/app/services/ai-review-store.service.ts
//
// Store en mémoire (signal) servant uniquement à transmettre les
// propositions de scénarios générées juste après la création d'un projet
// (wizard new-project) vers le nouvel écran de révision AiReviewComponent,
// sans dépendre de query params (trop volumineux) ni de la base de données
// (les propositions ne sont JAMAIS persistées avant validation — besoin #10).
//
// Cycle de vie : posé par new-project.component juste avant la navigation,
// lu et vidé par ai-review.component à l'initialisation.
import { Injectable, signal } from '@angular/core';
import { AIScenarioProposal } from './ai-generation.service';

export interface AIReviewPayload {
  projectId: string;
  projectName: string;
  source: 'document' | 'url';
  proposals: AIScenarioProposal[];
  pagesExplored?: number;
}

@Injectable({ providedIn: 'root' })
export class AIReviewStoreService {
  private readonly _payload = signal<AIReviewPayload | null>(null);

  set(payload: AIReviewPayload): void {
    this._payload.set(payload);
  }

  /** Lecture + vidage immédiat (consommation unique, évite les données périmées) */
  consume(): AIReviewPayload | null {
    const value = this._payload();
    this._payload.set(null);
    return value;
  }

  peek(): AIReviewPayload | null {
    return this._payload();
  }
}
