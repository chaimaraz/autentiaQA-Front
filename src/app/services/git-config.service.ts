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

  // ── NOUVEAU : alternative "fichier CI" au webhook — même déclencheur côté
  // backend (POST sur la même URL de webhook, avec { source: "AUTENTIA_CI_FILE" }
  // dans le body), juste une autre façon de l'appeler que doit fournir l'utilisateur
  // dans son propre pipeline plutôt que via les réglages webhook de sa plateforme.

  /** Nom de fichier suggéré pour le téléchargement, selon le provider du repo. */
  buildCiFileName(repo: GitRepoConfig): string {
    switch (repo.provider) {
      case 'GITHUB':    return 'autentiaqa.yml';
      case 'GITLAB':    return 'autentiaqa-gitlab-snippet.yml';
      case 'BITBUCKET': return 'autentiaqa-bitbucket-snippet.yml';
      default:          return 'autentiaqa-ci-example.sh';
    }
  }

  /** Contenu du fichier/extrait CI, prêt à copier ou télécharger. */
  buildCiFileContent(repo: GitRepoConfig, webhookUrl: string): string {
    switch (repo.provider) {
      case 'GITHUB':    return this._githubWorkflow(repo, webhookUrl);
      case 'GITLAB':    return this._gitlabSnippet(repo, webhookUrl);
      case 'BITBUCKET': return this._bitbucketSnippet(repo, webhookUrl);
      default:          return this._genericExample(repo, webhookUrl);
    }
  }

  private _githubWorkflow(repo: GitRepoConfig, webhookUrl: string): string {
    const branchFilter = repo.branch ? `\n    branches: [ "${repo.branch}" ]` : '';
    return `# À placer dans .github/workflows/autentiaqa.yml de votre dépôt.
# Créez d'abord le secret "AUTENTIAQA_WEBHOOK_SECRET" (valeur = secret affiché
# ci-contre) dans Settings → Secrets and variables → Actions.
name: Autentia QA
on:
  push:${branchFilter}
  pull_request:${branchFilter}

jobs:
  notify-autentiaqa:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Autentia QA
        env:
          AUTENTIAQA_WEBHOOK_SECRET: \${{ secrets.AUTENTIAQA_WEBHOOK_SECRET }}
        run: |
          curl -sf -X POST "${webhookUrl}" \\
            -H "Content-Type: application/json" \\
            -H "x-webhook-secret: $AUTENTIAQA_WEBHOOK_SECRET" \\
            -d "$(cat <<EOF
          {
            "source": "AUTENTIA_CI_FILE",
            "provider": "GITHUB",
            "eventType": "\${{ github.event_name == 'pull_request' && 'PULL_REQUEST' || 'PUSH' }}",
            "branch": "\${{ github.head_ref || github.ref_name }}",
            "commitSha": "\${{ github.sha }}",
            "commitMessage": \${{ toJSON(github.event.head_commit.message || github.event.pull_request.title || '') }},
            "authorName": "\${{ github.actor }}",
            "authorEmail": ""
          }
          EOF
          )"
`;
  }

  private _gitlabSnippet(repo: GitRepoConfig, webhookUrl: string): string {
    return `# Extrait à FUSIONNER dans votre .gitlab-ci.yml existant (GitLab n'autorise
# qu'un seul fichier de config CI par dépôt — ne remplacez pas le vôtre).
# Créez d'abord la variable CI/CD "AUTENTIAQA_WEBHOOK_SECRET" (masquée, valeur
# = secret affiché ci-contre) dans Settings → CI/CD → Variables.
notify-autentiaqa:
  stage: .post   # stage réservé, s'exécute en dernier sans devoir être déclaré dans "stages:"
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" || $CI_PIPELINE_SOURCE == "merge_request_event"'
  script:
    - >
      curl -sf -X POST "${webhookUrl}"
      -H "Content-Type: application/json"
      -H "x-webhook-secret: $AUTENTIAQA_WEBHOOK_SECRET"
      -d "{
        \\"source\\": \\"AUTENTIA_CI_FILE\\",
        \\"provider\\": \\"GITLAB\\",
        \\"eventType\\": \\"$([ \\"$CI_PIPELINE_SOURCE\\" = \\"merge_request_event\\" ] && echo PULL_REQUEST || echo PUSH)\\",
        \\"branch\\": \\"\${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME:-$CI_COMMIT_REF_NAME}\\",
        \\"commitSha\\": \\"$CI_COMMIT_SHA\\",
        \\"commitMessage\\": \\"$(echo "$CI_COMMIT_MESSAGE" | tr -d '\\"' | tr '\\n' ' ')\\",
        \\"authorName\\": \\"$GITLAB_USER_NAME\\",
        \\"authorEmail\\": \\"$GITLAB_USER_EMAIL\\"
      }"
`;
  }

  private _bitbucketSnippet(repo: GitRepoConfig, webhookUrl: string): string {
    const curl = (eventType: string) => `
            - >
              curl -sf -X POST "${webhookUrl}"
              -H "Content-Type: application/json"
              -H "x-webhook-secret: $AUTENTIAQA_WEBHOOK_SECRET"
              -d "{\\"source\\":\\"AUTENTIA_CI_FILE\\",\\"provider\\":\\"BITBUCKET\\",\\"eventType\\":\\"${eventType}\\",\\"branch\\":\\"$BITBUCKET_BRANCH\\",\\"commitSha\\":\\"$BITBUCKET_COMMIT\\",\\"commitMessage\\":\\"\\",\\"authorName\\":\\"$BITBUCKET_STEP_TRIGGERER_UUID\\",\\"authorEmail\\":\\"\\"}"`;
    return `# Extraits à FUSIONNER dans votre bitbucket-pipelines.yml existant (Bitbucket
# n'autorise qu'un seul fichier de config CI par dépôt — ne remplacez pas le vôtre).
# Créez d'abord la variable de dépôt "AUTENTIAQA_WEBHOOK_SECRET" (sécurisée,
# valeur = secret affiché ci-contre) dans Settings → Pipelines → Repository variables.

# ── section pipelines.default (push) ──
pipelines:
  default:
    - step:
        name: Notify Autentia QA
        script:${curl('PUSH')}

  # ── section pipelines.pull-requests (pull request) ──
  pull-requests:
    '**':
      - step:
          name: Notify Autentia QA
          script:${curl('PULL_REQUEST')}
`;
  }

  private _genericExample(repo: GitRepoConfig, webhookUrl: string): string {
    return `#!/usr/bin/env bash
# Exemple générique à adapter à votre système CI (provider "Autre" — pas de
# plateforme standardisée détectée). Placez le secret dans une variable
# d'environnement AUTENTIAQA_WEBHOOK_SECRET plutôt qu'en clair dans ce script.
curl -sf -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: $AUTENTIAQA_WEBHOOK_SECRET" \\
  -d '{
    "source": "AUTENTIA_CI_FILE",
    "provider": "OTHER",
    "eventType": "PUSH",
    "branch": "'"$BRANCH_NAME"'",
    "commitSha": "'"$COMMIT_SHA"'",
    "commitMessage": "",
    "authorName": "",
    "authorEmail": ""
  }'
`;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message =
      error.error?.message ||
      error.error?.errors?.map((e: any) => e.msg).join(', ') ||
      'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}
