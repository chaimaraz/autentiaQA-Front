// src/app/services/jira-config.service.ts
// Service HTTP pour la configuration Jira d'un projet — /api/projects/:projectId/jira
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse } from './project-api.service';

export interface JiraConfig {
  id: string;
  projectId: string;
  jiraUrl: string;
  jiraEmail: string;
  projectKey: string;
  defaultIssueType: string;
  autoCreateOnFail: boolean;
  attachScreenshot: boolean;
  attachVideo: boolean;
  attachTrace: boolean;
  includeErrorStack: boolean;
  hasApiToken: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
}

export interface JiraConfigPayload {
  jiraUrl: string;
  jiraEmail: string;
  apiToken?: string; // vide = on garde le token déjà enregistré
  projectKey: string;
  defaultIssueType: string;
  autoCreateOnFail: boolean;
  attachScreenshot: boolean;
  attachVideo: boolean;
  includeErrorStack: boolean;
}

export interface JiraTestResult {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

@Injectable({ providedIn: 'root' })
export class JiraConfigService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getConfig(projectId: string): Observable<JiraConfig | null> {
    return this.http
      .get<ApiResponse<JiraConfig | null>>(`${this.baseUrl}/projects/${projectId}/jira`)
      .pipe(map((r) => r.data), catchError(this.handleError));
  }

  saveConfig(projectId: string, payload: JiraConfigPayload): Observable<JiraConfig> {
    return this.http
      .put<ApiResponse<JiraConfig>>(`${this.baseUrl}/projects/${projectId}/jira`, payload)
      .pipe(map((r) => r.data), catchError(this.handleError));
  }

  /** Si apiToken est fourni, teste ces valeurs sans rien sauvegarder ; sinon teste le token déjà enregistré. */
  testConnection(projectId: string, payload: Partial<JiraConfigPayload>): Observable<JiraTestResult> {
    return this.http
      .post<ApiResponse<JiraTestResult>>(`${this.baseUrl}/projects/${projectId}/jira/test`, payload)
      .pipe(map((r) => r.data), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message || 'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}
