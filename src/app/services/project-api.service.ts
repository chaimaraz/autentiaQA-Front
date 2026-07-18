// src/app/services/project-api.service.ts
// Service HTTP Angular — point d'entrée unique vers l'API backend
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface GitRepoPayload {
  name: string;
  role: 'FRONTEND' | 'BACKEND' | 'MOBILE' | 'INFRA' | 'OTHER';
  provider?: 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'OTHER';
  repoUrl: string;
  branch?: string;
  onPush?: boolean;
  onPr?: boolean;
  onTag?: boolean;
  onSchedule?: boolean;
  notifyEmail?: boolean;
  notifySlack?: boolean;
  createJiraBug?: boolean;
  blockMerge?: boolean;
  notifyEmails?: string; // emails séparés par des virgules
}

export interface CreateProjectPayload {
  name: string;
  url: string;
  description: string;
  generationMode: 'URL_CRAWL' | 'SPEC_DOCUMENT';
  testTypes: string[];          // ex: ['FUNCTIONAL', 'E2E']
  frameworkName: string;        // ex: 'PLAYWRIGHT'
  // ── NOUVEAU : plusieurs dépôts (frontend, backend, microservices...), optionnel ──
  repos?: GitRepoPayload[];
  // ── legacy : un seul repo (toujours supporté côté backend pour compatibilité) ──
  repoUrl?: string;
  branch?: string;
  onPush?: boolean;
  onPr?: boolean;
  onTag?: boolean;
  onSchedule?: boolean;
  notifyEmail?: boolean;
  notifySlack?: boolean;
  createJiraBug?: boolean;
  blockMerge?: boolean;
  files?: File[];               // uniquement si generationMode = SPEC_DOCUMENT
}

/**
 * Champs modifiables depuis le panneau "Général" des Paramètres.
 * ── NOUVEAU : nécessite un endpoint PATCH /api/projects/:id côté backend
 * (voir project.routes.js / project.controller.js / project.service.js).
 * Tant que cet endpoint n'existe pas, updateProject() renverra une erreur 404
 * que le composant General affiche proprement.
 */
export interface UpdateProjectPayload {
  name?: string;
  url?: string;
  description?: string;
  frameworkName?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  /**
   * Crée un projet.
   * Envoie toujours en multipart/form-data pour supporter l'upload de fichiers.
   */
  createProject(payload: CreateProjectPayload): Observable<ApiResponse<any>> {
    const formData = this.buildFormData(payload);

    return this.http
      .post<ApiResponse<any>>(`${this.baseUrl}/projects`, formData)
      .pipe(catchError(this.handleError));
  }

  listProjects(): Observable<ApiResponse<any[]>> {
    return this.http
      .get<ApiResponse<any[]>>(`${this.baseUrl}/projects`)
      .pipe(catchError(this.handleError));
  }

  getProject(id: string): Observable<ApiResponse<any>> {
    return this.http
      .get<ApiResponse<any>>(`${this.baseUrl}/projects/${id}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * ── NOUVEAU ── Met à jour les infos générales d'un projet.
   * Requiert : router.patch('/:id', projectController.updateProject) côté backend.
   */
  updateProject(id: string, payload: UpdateProjectPayload): Observable<ApiResponse<any>> {
    return this.http
      .patch<ApiResponse<any>>(`${this.baseUrl}/projects/${id}`, payload)
      .pipe(catchError(this.handleError));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Construit un FormData depuis le payload.
   * Note : Ne pas setter le Content-Type manuellement — Angular + FormData le gère avec boundary.
   */
  private buildFormData(payload: CreateProjectPayload): FormData {
    const fd = new FormData();

    fd.append('name', payload.name);
    fd.append('url', payload.url);
    fd.append('description', payload.description);
    fd.append('generationMode', payload.generationMode);
    fd.append('testTypes', JSON.stringify(payload.testTypes));
    fd.append('frameworkName', payload.frameworkName);

    // ── NOUVEAU : plusieurs dépôts — envoyés en JSON stringifié (comme testTypes) ──
    if (payload.repos?.length) fd.append('repos', JSON.stringify(payload.repos));

    // Champs optionnels CI/CD (legacy, un seul repo)
    if (payload.repoUrl)        fd.append('repoUrl', payload.repoUrl);
    if (payload.branch)         fd.append('branch', payload.branch);
    if (payload.onPush != null)        fd.append('onPush', String(payload.onPush));
    if (payload.onPr != null)          fd.append('onPr', String(payload.onPr));
    if (payload.onTag != null)         fd.append('onTag', String(payload.onTag));
    if (payload.onSchedule != null)    fd.append('onSchedule', String(payload.onSchedule));
    if (payload.notifyEmail != null)   fd.append('notifyEmail', String(payload.notifyEmail));
    if (payload.notifySlack != null)   fd.append('notifySlack', String(payload.notifySlack));
    if (payload.createJiraBug != null) fd.append('createJiraBug', String(payload.createJiraBug));
    if (payload.blockMerge != null)    fd.append('blockMerge', String(payload.blockMerge));

    // Fichiers — champ 'documents' correspondant à multer.array('documents', 10)
    if (payload.files?.length) {
      payload.files.forEach((file) => fd.append('documents', file, file.name));
    }

    return fd;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message =
      error.error?.message ||
      error.error?.errors?.map((e: any) => e.msg).join(', ') ||
      'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}