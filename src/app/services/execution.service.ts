// src/app/services/execution.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ════════════════════════════════════════════════════════════════════════
// Types alignés sur le nouveau schéma Prisma
// ════════════════════════════════════════════════════════════════════════

export type CaptureMode = 'NEVER' | 'ON_FAILURE' | 'ON_SUCCESS' | 'ALWAYS';
export type TraceMode   = 'NEVER' | 'ON_FAILURE' | 'ALWAYS';

export interface AiFailureAnalysis {
  stepIndex: number | null;
  action: string;
  causeCategory: 'APPLICATION_BUG' | 'SCRIPT_ISSUE' | 'ENVIRONMENT' | 'TIMING' | 'UNKNOWN';
  explanation: string;
  recommendation: string;
}

export interface AiAnalysis {
  summary: string;
  failures: AiFailureAnalysis[];
}
export interface ExecutionCaptureConfig {
  screenshotMode: CaptureMode;
  videoMode:      CaptureMode;
  traceMode:      TraceMode;
}

export type ExecutionResultType = 'RUNNING' | 'PASS' | 'FAIL' | 'ERROR';
export type StepResultType      = 'RUNNING' | 'PASS' | 'FAIL' | 'SKIP';
export type ArtifactType        = 'SCREENSHOT' | 'VIDEO' | 'TRACE' | 'REPORT_JSON';

export interface ExecutionArtifact {
  id:        string;
  type:      ArtifactType;
  filePath:  string;
  createdAt: string;
}

export interface ExecutionStep {
  id?:           string;
  stepIndex:     number;
  action:        string;
  selector?:     string;
  value?:        string;
  result:        StepResultType;
  startedAt?:    string;
  finishedAt?:   string;
  durationMs?:   number;
  errorMessage?: string | null;
  errorStack?:   string | null;
  artifacts?:    ExecutionArtifact[];
}

export interface HistoryRun {
  id:          string;
  result:      ExecutionResultType;
  durationMs:  number | null;
  passCount:   number;
  failCount:   number;
  totalCount:  number;
  errorMessage: string | null;
  startedAt:   string;
  finishedAt:  string | null;
  triggeredByUser?: { id: string; name: string } | null;
  scenario: {
    id: string; name: string; type: string; projectId: string;
    project: { name: string };
  };
  steps:     ExecutionStep[];
  artifacts: ExecutionArtifact[];
  jiraTicketKey?: string | null;
  jiraTicketUrl?: string | null;
  aiAnalysis?: AiAnalysis | null;
}

export interface ExecutionDetail extends HistoryRun {
  captureConfig?: ExecutionCaptureConfig;
}

// ── Rapport de batch détaillé (résultat par scénario + IA + artefacts) ─────

export interface BatchScenarioExecution {
  id: string;
  result: ExecutionResultType;
  durationMs: number | null;
  passCount: number;
  failCount: number;
  totalCount: number;
  errorMessage: string | null;
  aiAnalysis?: AiAnalysis | null;
  scenario: { id: string; name: string; type: string };
  steps: ExecutionStep[];
  artifacts: ExecutionArtifact[];
}

export interface BatchDetail {
  id: string;
  projectId: string;
  status: 'RUNNING' | 'DONE';
  totalCount: number;
  passCount: number;
  failCount: number;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  executions: BatchScenarioExecution[];
}

export interface HistoryResponse {
  data: HistoryRun[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HistoryParams {
  page: number;
  limit: number;
  projectId?: string;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface GlobalStats {
  totalRuns: number;
  passRate: number;
  failedRuns: number;
  avgDuration: number;
  jiraBugs: number;
}

// ── Ticket Jira (aperçu / création) ─────────────────────────────────────────

export interface JiraPreviewArtifact {
  id: string;
  type: ArtifactType;
  url: string;
}

export interface JiraPreview {
  execution: { id: string; scenarioName: string; result: ExecutionResultType; startedAt: string; finishedAt: string | null };
  title: string;
  description: string;
  failedSteps: { stepIndex: number; action: string; errorMessage: string | null; errorStack: string | null }[];
  aiAnalysis: AiAnalysis;
  artifacts: JiraPreviewArtifact[];
  existingTicket: { key: string; url: string } | null;
}

export interface JiraTicketPayload {
  title: string;
  description: string;
}

export interface JiraTicketResult {
  key: string;
  url: string;
  alreadyExisted: boolean;
}

// ── Événements Socket.IO temps réel ────────────────────────────────────────

export interface LogEntry {
  time:  string;
  level: 'info' | 'pass' | 'fail' | 'error' | 'detail' | 'ai';
  msg:   string;
}

export interface StepUpdateEvent {
  stepId?:       string;
  stepIndex:     number;
  action:        string;
  result:        StepResultType;
  startedAt?:    number;
  durationMs?:   number;
  errorMessage?: string | null;
}

export interface ExecCompleteEvent {
  executionId: string;
  result:      ExecutionResultType;
  durationMs:  number;
  stats:       { pass: number; fail: number; skipped: number; total: number };
  errorMessage: string | null;
  artifacts:   { type: ArtifactType; url: string }[];
}

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private readonly SERVER = 'http://localhost:3000';
  private http = inject(HttpClient);

  getHistory(params: HistoryParams): Observable<HistoryResponse> {
    const query = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      projectId: params.projectId || '',
      status: params.status || '',
      search: params.search || '',
      dateFrom: params.dateFrom || '',
      dateTo: params.dateTo || '',
    });
    return this.http.get<any>(`${this.SERVER}/api/executions/history?${query}`);
  }

  getExecutionDetail(executionId: string): Observable<ExecutionDetail> {
    return this.http
      .get<{ data: ExecutionDetail }>(`${this.SERVER}/api/executions/${executionId}`)
      .pipe(map(r => r.data));
  }

  /** Détail complet d'un batch (résultats par scénario, captures, analyse IA) — recharge/lien profond inclus. */
  getBatchDetail(projectId: string, batchId: string): Observable<BatchDetail> {
    return this.http
      .get<{ data: BatchDetail }>(`${this.SERVER}/api/projects/${projectId}/scenarios/batches/${batchId}`)
      .pipe(map(r => r.data));
  }

  getSteps(executionId: string): Observable<ExecutionStep[]> {
    return this.http
      .get<{ data: ExecutionStep[] }>(`${this.SERVER}/api/executions/${executionId}/steps`)
      .pipe(map(r => r.data));
  }

  getArtifacts(executionId: string): Observable<ExecutionArtifact[]> {
    return this.http
      .get<{ data: ExecutionArtifact[] }>(`${this.SERVER}/api/executions/${executionId}/artifacts`)
      .pipe(map(r => r.data));
  }

  /** URL du Trace Viewer Playwright hébergé, pointant vers notre trace.zip */
  getTraceViewerUrl(traceFilePath: string): string {
    const absoluteUrl = `${this.SERVER}${traceFilePath}`;
    return `https://trace.playwright.dev/?trace=${encodeURIComponent(absoluteUrl)}`;
  }

  computeStats(runs: HistoryRun[], totalRuns: number): GlobalStats {
    const total = runs.length;
    const passed = runs.filter(r => r.result === 'PASS').length;
    const failed = runs.filter(r => r.result === 'FAIL' || r.result === 'ERROR').length;
    const avgDur = total > 0
      ? Math.round(runs.reduce((s, r) => s + (r.durationMs || 0), 0) / total / 1000)
      : 0;
    return {
      totalRuns,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      failedRuns: failed,
      avgDuration: avgDur,
      jiraBugs: failed,
    };
  }
  
  analyzeExecution(executionId: string): Observable<AiAnalysis> {
  return this.http
    .post<{ data: { aiAnalysis: AiAnalysis } }>(`${this.SERVER}/api/executions/${executionId}/analyze`, {})
    .pipe(map(r => r.data.aiAnalysis));
}
  getPassWidth(r: HistoryRun): number {
    return r.totalCount > 0 ? Math.round((r.passCount / r.totalCount) * 100) : 0;
  }

  getFailWidth(r: HistoryRun): number {
    return r.totalCount > 0 ? Math.round((r.failCount / r.totalCount) * 100) : 0;
  }

  getRate(r: HistoryRun): number {
    return r.totalCount > 0
      ? Math.round((r.passCount / r.totalCount) * 100)
      : r.result === 'PASS' ? 100 : 0;
  }

  formatDuration(ms: number | null | undefined): string {
    if (!ms) return '—';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  getJiraPreview(executionId: string): Observable<JiraPreview> {
    return this.http
      .get<{ data: JiraPreview }>(`${this.SERVER}/api/executions/${executionId}/jira-preview`)
      .pipe(map(r => r.data));
  }

  createJiraTicket(executionId: string, payload: JiraTicketPayload): Observable<JiraTicketResult> {
    return this.http
      .post<{ data: JiraTicketResult }>(`${this.SERVER}/api/executions/${executionId}/jira-ticket`, payload)
      .pipe(map(r => r.data));
  }

  getArtifactUrl(path: string): string {
    return `${this.SERVER}${path}`;
  }

  findArtifact(artifacts: ExecutionArtifact[], type: ArtifactType): ExecutionArtifact | undefined {
    return artifacts.find(a => a.type === type);
  }

  getTypeClass(type: string): string {
    return ({ POSITIVE: 'positive', NEGATIVE: 'negative', SECURITY: 'security', PERFORMANCE: 'perf' } as any)[type] || 'positive';
  }

  getTypeLabel(type: string): string {
    return ({ POSITIVE: 'POSITIF', NEGATIVE: 'NÉGATIF', SECURITY: 'SÉCURITÉ', PERFORMANCE: 'PERF' } as any)[type] || type;
  }
}