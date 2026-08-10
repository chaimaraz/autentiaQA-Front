// src/app/services/ai-config.service.ts
// Service HTTP pour la configuration globale du fournisseur IA — /api/admin/ai-config (Super Admin uniquement)
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse } from './project-api.service';

export interface AiProviderConfig {
  id: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  maxScenarios: number;
  crawlMaxPages: number;
  crawlMaxDepth: number;
  hasApiKey: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
}

export interface AiProviderConfigPayload {
  provider: string;
  model: string;
  apiKey?: string; // vide = on garde la clé déjà enregistrée
  temperature: number;
  maxTokens: number;
  maxScenarios: number;
  crawlMaxPages: number;
  crawlMaxDepth: number;
}

export interface AiProviderMeta {
  id: string;
  label: string;
  exampleModels: string[];
}

export interface AiTestResult {
  ok: boolean;
  model?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AiConfigService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  listProviders(): Observable<AiProviderMeta[]> {
    return this.http
      .get<ApiResponse<AiProviderMeta[]>>(`${this.baseUrl}/admin/ai-config/providers`)
      .pipe(map((r) => r.data), catchError(this.handleError));
  }

  getConfig(): Observable<AiProviderConfig | null> {
    return this.http
      .get<ApiResponse<AiProviderConfig | null>>(`${this.baseUrl}/admin/ai-config`)
      .pipe(map((r) => r.data), catchError(this.handleError));
  }

  saveConfig(payload: AiProviderConfigPayload): Observable<AiProviderConfig> {
    return this.http
      .put<ApiResponse<AiProviderConfig>>(`${this.baseUrl}/admin/ai-config`, payload)
      .pipe(map((r) => r.data), catchError(this.handleError));
  }

  /** Si apiKey est fourni, teste ces valeurs sans rien sauvegarder ; sinon teste la clé déjà enregistrée. */
  testConnection(payload: Partial<AiProviderConfigPayload>): Observable<AiTestResult> {
    return this.http
      .post<ApiResponse<AiTestResult>>(`${this.baseUrl}/admin/ai-config/test`, payload)
      .pipe(map((r) => r.data), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message || 'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}
