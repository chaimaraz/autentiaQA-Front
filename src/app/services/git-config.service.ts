// src/app/services/git-config.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiResponse, GitRepoPayload } from './project-api.service';

export interface GitRepoConfig extends GitRepoPayload {
  id: string;
  projectId: string;
  webhookSecret: string;
  lastEventAt?: string | null;
  createdAt: string;
}

export interface GitWebhookEventItem {
  id: string;
  projectId: string;
  repoId: string;
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'OTHER';
  eventType: 'PUSH' | 'PULL_REQUEST' | 'TAG';
  branch?: string | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  decision: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SKIPPED';
  decisionReason?: string | null;
  emailSentAt?: string | null;
  createdAt: string;
  repo?: { id: string; name: string; role: string };
  batchExecution?: {
    id: string; status: string; totalCount: number; passCount: number;
    failCount: number; durationMs?: number | null; startedAt: string; finishedAt?: string | null;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class GitConfigService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  list(projectId: string): Observable<ApiResponse<GitRepoConfig[]>> {
    return this.http
      .get<ApiResponse<GitRepoConfig[]>>(`${this.baseUrl}/projects/${projectId}/repos`)
      .pipe(catchError(this.handleError));
  }

  getOne(projectId: string, repoId: string): Observable<ApiResponse<GitRepoConfig>> {
    return this.http
      .get<ApiResponse<GitRepoConfig>>(`${this.baseUrl}/projects/${projectId}/repos/${repoId}`)
      .pipe(catchError(this.handleError));
  }

  create(projectId: string, dto: GitRepoPayload): Observable<ApiResponse<GitRepoConfig>> {
    return this.http
      .post<ApiResponse<GitRepoConfig>>(`${this.baseUrl}/projects/${projectId}/repos`, dto)
      .pipe(catchError(this.handleError));
  }

  update(projectId: string, repoId: string, dto: Partial<GitRepoPayload>): Observable<ApiResponse<GitRepoConfig>> {
    return this.http
      .put<ApiResponse<GitRepoConfig>>(`${this.baseUrl}/projects/${projectId}/repos/${repoId}`, dto)
      .pipe(catchError(this.handleError));
  }

  remove(projectId: string, repoId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/projects/${projectId}/repos/${repoId}`)
      .pipe(catchError(this.handleError));
  }

  regenerateSecret(projectId: string, repoId: string): Observable<ApiResponse<GitRepoConfig>> {
    return this.http
      .post<ApiResponse<GitRepoConfig>>(`${this.baseUrl}/projects/${projectId}/repos/${repoId}/regenerate-secret`, {})
      .pipe(catchError(this.handleError));
  }

  /** Historique des events webhook (rapports). Si repoId est omis, retourne tous les repos du projet. */
  getEvents(projectId: string, repoId?: string, page = 1, limit = 20): Observable<ApiResponse<GitWebhookEventItem[]> & { total: number; totalPages: number }> {
    const path = repoId ? `${repoId}/events` : `events`;
    return this.http
      .get<any>(`${this.baseUrl}/projects/${projectId}/repos/${path}?page=${page}&limit=${limit}`)
      .pipe(catchError(this.handleError));
  }

  /** URL de webhook à coller côté GitHub/GitLab/Bitbucket pour un repo donné */
  buildWebhookUrl(backendBaseUrl: string, repoId: string): string {
    return `${backendBaseUrl.replace(/\/$/, '')}/api/webhooks/git/${repoId}`;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message =
      error.error?.message ||
      error.error?.errors?.map((e: any) => e.msg).join(', ') ||
      'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}
