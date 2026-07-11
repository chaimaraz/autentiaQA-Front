// src/app/services/ai-generation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';

export interface AIScenarioStep {
  action: string;
  selector: string | null;
  value?: string | null;      // NOUVEAU : texte à saisir pour fill/press
  description?: string | null; // NOUVEAU : libellé humain court
}

export interface AIScenarioVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface AIScenarioProposal {
  tempId: string;
  name: string;
  type: 'POSITIVE' | 'NEGATIVE' | 'SECURITY' | 'PERFORMANCE';
  steps: AIScenarioStep[];
  expectedResult: string;
  variables: AIScenarioVariable[];
  scriptTemplate: string;
  nlpText?: string;
  selected?: boolean;
}

export interface AIJobProgress {
  status: 'extracting' | 'crawling' | 'generating';
  message: string;
}

export interface AIJobResult {
  scenarios: AIScenarioProposal[];
  pagesExplored?: number;
}

export interface NlpScriptResult {
  name: string;
  nlpText: string;
  scriptTemplate: string;
  type?: 'POSITIVE' | 'NEGATIVE' | 'SECURITY' | 'PERFORMANCE';
  steps?: AIScenarioStep[];      // NOUVEAU
  variables?: AIScenarioVariable[]; // NOUVEAU
}

export interface BulkCreateResult {
  success: boolean;
  data: any[];
  errors: { name: string; message: string }[];
}

/**
 * Résultat observable d'un job IA long (document/URL/scripts).
 * Le job démarre dès la souscription, pousse des progress puis un result
 * ou une error, puis se complete automatiquement.
 */
export interface AIJobObservable {
  progress$: Subject<AIJobProgress>;
  result$: Subject<AIJobResult>;
  error$: Subject<string>;
}

@Injectable({ providedIn: 'root' })
export class AIGenerationService {
  private readonly base = 'http://localhost:3000/api/ai/projects';
  private readonly SERVER = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  /**
   * Flux #2 — document → scénarios.
   * Retourne un objet avec 3 subjects (progress, result, error).
   * Le backend répond 202 immédiatement avec un jobId, puis pousse via Socket.IO.
   */
  generateFromDocument(projectId: string, file: File): AIJobObservable {
    const fd = new FormData();
    fd.append('document', file, file.name);
    return this._startJob(
      this.http.post<{ data: { jobId: string } }>(
        `${this.base}/${projectId}/generate-from-document`, fd
      ).pipe(map(r => r.data.jobId))
    );
  }

  /**
   * Flux #3 — URL crawl → scénarios.
   */
  generateFromUrl(
    projectId: string,
    url: string,
    options: { maxPages?: number; maxDepth?: number } = {}
  ): AIJobObservable {
    return this._startJob(
      this.http.post<{ data: { jobId: string } }>(
        `${this.base}/${projectId}/generate-from-url`,
        { url, ...options }
      ).pipe(map(r => r.data.jobId))
    );
  }

  /**
   * Flux — génération de scripts pour scénarios confirmés.
   */
  generateScripts(projectId: string, scenarios: AIScenarioProposal[]): AIJobObservable {
    const payload = scenarios.map(s => ({
      tempId: s.tempId,
      name: s.name,
      type: s.type,
      steps: s.steps,
      expectedResult: s.expectedResult,
      variables: s.variables,
    }));
    return this._startJob(
      this.http.post<{ data: { jobId: string } }>(
        `${this.base}/${projectId}/generate-scripts`, { scenarios: payload }
      ).pipe(map(r => r.data.jobId))
    );
  }

  /** Flux #4 — NLP → script (opération rapide, pas besoin de job async) */
  generateScriptFromNlp(
    projectId: string,
    payload: { title: string; description: string; steps: string; expectedResult: string }
  ): Observable<NlpScriptResult> {
    return this.http
      .post<{ data: NlpScriptResult }>(`${this.base}/${projectId}/generate-script-from-nlp`, payload)
      .pipe(map(r => r.data));
  }

  /** Validation utilisateur — sauvegarde en base */
  bulkCreate(projectId: string, scenarios: AIScenarioProposal[]): Observable<BulkCreateResult> {
    const payload = scenarios.map(s => ({
      name: s.name,
      type: s.type,
      nlpText: s.nlpText ?? s.expectedResult,
      scriptTemplate: s.scriptTemplate,
      variables: s.variables,
    }));
    return this.http.post<BulkCreateResult>(
      `${this.base}/${projectId}/scenarios/bulk-create`, { scenarios: payload }
    );
  }

  /**
   * Démarre un job async : envoie la requête HTTP (obtient le jobId),
   * connecte Socket.IO /ai, écoute ai_progress / ai_result / ai_error,
   * pousse dans les 3 subjects et déconnecte quand terminé.
   */
  private _startJob(jobId$: Observable<string>): AIJobObservable {
    const progress$ = new Subject<AIJobProgress>();
    const result$   = new Subject<AIJobResult>();
    const error$    = new Subject<string>();

    jobId$.subscribe({
      next: (jobId) => {
        const socket: Socket = io(`${this.SERVER}/ai`, {
          transports: ['websocket'],
          query: { jobId },
        });

        socket.on('connect', () => socket.emit('subscribe', { jobId }));

        socket.on('ai_progress', (data: AIJobProgress) => {
          progress$.next(data);
        });

        socket.on('ai_result', (data: AIJobResult) => {
          result$.next(data);
          result$.complete();
          progress$.complete();
          socket.disconnect();
        });

        socket.on('ai_error', (data: { message: string }) => {
          error$.next(data.message);
          error$.complete();
          progress$.complete();
          socket.disconnect();
        });

        socket.on('connect_error', () => {
          error$.next('Impossible de se connecter au serveur pour recevoir les résultats IA.');
          error$.complete();
          progress$.complete();
        });
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Erreur lors du démarrage du job IA.';
        error$.next(msg);
        error$.complete();
        progress$.complete();
      },
    });

    return { progress$, result$, error$ };
  }
}
