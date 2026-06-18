// src/app/services/scenario.service.ts
import { Injectable }   from '@angular/core';
import { HttpClient }   from '@angular/common/http';
import { Observable }   from 'rxjs';
import { map }          from 'rxjs/operators';
import { ExecutionCaptureConfig } from './execution.service';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface ScenarioVariable {
  id:       string;
  key:      string;
  value:    string;
  isSecret: boolean;
}

export interface Scenario {
  id:             string;
  projectId:      string;
  name:           string;
  type:           'POSITIVE' | 'NEGATIVE' | 'SECURITY' | 'PERFORMANCE';
  creationMode:   'NLP' | 'RECORD';
  nlpText?:       string;
  scriptTemplate: string;
  status:         'DRAFT' | 'ACTIVE';
  createdAt:      string;
  updatedAt:      string;
  variables?:     ScenarioVariable[];
  _count?:        { executions: number };
}

export interface PaginatedScenarios {
  success:    boolean;
  data:       Scenario[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface ScenarioExecutionRef {
  id:         string;
  scenarioId: string;
  result:     'PASS' | 'FAIL' | 'ERROR' | 'RUNNING';
  startedAt:  string;
}

export interface BatchExecutionRef {
  id:         string;
  projectId:  string;
  status:     string;
  totalCount: number;
}

export interface CreateScenarioPayload {
  name:           string;
  type:           Scenario['type'];
  creationMode:   Scenario['creationMode'];
  nlpText?:       string;
  scriptTemplate: string;
  variables?:     Omit<ScenarioVariable, 'id'>[];
}

export interface ScenarioFilterParams {
  page?:     number;
  limit?:    number;
  search?:   string;
  type?:     string;
  status?:   string;
  mode?:     string;
  dateFrom?: string;
  dateTo?:   string;
}

export interface ProjectEnvVar {
  id:        string;
  key:       string;
  value:     string;
  isSecret:  boolean;
  createdAt: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private readonly base = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // ── CRUD Scénarios ──────────────────────────────────────────────────────────

  getAll(projectId: string, params: ScenarioFilterParams = {}): Observable<PaginatedScenarios> {
    const {
      page = 1, limit = 10, search = '', type = '', status = '', mode = '',
      dateFrom = '', dateTo = '',
    } = params;

    const query = new URLSearchParams({
      page: String(page), limit: String(limit), search, type, status, mode, dateFrom, dateTo,
    });

    return this.http.get<PaginatedScenarios>(`${this.base}/projects/${projectId}/scenarios?${query}`);
  }

  getOne(projectId: string, scenarioId: string): Observable<Scenario> {
    return this.http
      .get<{ data: Scenario }>(`${this.base}/projects/${projectId}/scenarios/${scenarioId}`)
      .pipe(map(r => r.data));
  }

  create(projectId: string, payload: CreateScenarioPayload): Observable<Scenario> {
    return this.http
      .post<{ data: Scenario }>(`${this.base}/projects/${projectId}/scenarios`, payload)
      .pipe(map(r => r.data));
  }

  update(projectId: string, scenarioId: string, payload: Partial<CreateScenarioPayload>): Observable<Scenario> {
    return this.http
      .put<{ data: Scenario }>(`${this.base}/projects/${projectId}/scenarios/${scenarioId}`, payload)
      .pipe(map(r => r.data));
  }

  remove(projectId: string, scenarioId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/projects/${projectId}/scenarios/${scenarioId}`);
  }

  // ── Variables ───────────────────────────────────────────────────────────────

  getVariables(projectId: string, scenarioId: string): Observable<ScenarioVariable[]> {
    return this.http
      .get<{ data: ScenarioVariable[] }>(`${this.base}/projects/${projectId}/scenarios/${scenarioId}/variables`)
      .pipe(map(r => r.data));
  }

  regenerateVariables(projectId: string, scenarioId: string, variables: Omit<ScenarioVariable, 'id'>[]): Observable<ScenarioVariable[]> {
    return this.http
      .put<{ data: ScenarioVariable[] }>(`${this.base}/projects/${projectId}/scenarios/${scenarioId}/variables`, { variables })
      .pipe(map(r => r.data));
  }

  copyVariablesFrom(projectId: string, targetScenarioId: string, sourceScenarioId: string): Observable<ScenarioVariable[]> {
    return this.http
      .post<{ data: ScenarioVariable[] }>(`${this.base}/projects/${projectId}/scenarios/${targetScenarioId}/copy-variables`, { sourceScenarioId })
      .pipe(map(r => r.data));
  }

  // ── Script ──────────────────────────────────────────────────────────────────

  updateScript(projectId: string, scenarioId: string, scriptTemplate: string): Observable<Scenario> {
    return this.http
      .put<{ data: Scenario }>(`${this.base}/projects/${projectId}/scenarios/${scenarioId}/script`, { scriptTemplate })
      .pipe(map(r => r.data));
  }

  // ── Exécutions ──────────────────────────────────────────────────────────────

  /** Lance un scénario unique avec la config de capture choisie dans la popup */
  execute(projectId: string, scenarioId: string, captureConfig: ExecutionCaptureConfig): Observable<ScenarioExecutionRef> {
    return this.http
      .post<{ data: ScenarioExecutionRef }>(
        `${this.base}/projects/${projectId}/scenarios/${scenarioId}/executions`,
        { captureConfig }
      )
      .pipe(map(r => r.data));
  }

  /** Lance tous les scénarios actifs du projet avec la config de capture choisie */
  executeAll(projectId: string, captureConfig: ExecutionCaptureConfig): Observable<BatchExecutionRef> {
    return this.http
      .post<{ data: BatchExecutionRef }>(
        `${this.base}/projects/${projectId}/scenarios/execute-all`,
        { captureConfig }
      )
      .pipe(map(r => r.data));
  }

  getExecutions(projectId: string, scenarioId: string): Observable<ScenarioExecutionRef[]> {
    return this.http
      .get<{ data: ScenarioExecutionRef[] }>(`${this.base}/projects/${projectId}/scenarios/${scenarioId}/executions`)
      .pipe(map(r => r.data));
  }

  // ── ProjectEnvVar ───────────────────────────────────────────────────────────

  getEnvVars(projectId: string): Observable<ProjectEnvVar[]> {
    return this.http
      .get<{ data: ProjectEnvVar[] }>(`${this.base}/projects/${projectId}/env-vars`)
      .pipe(map(r => r.data));
  }

  createEnvVar(projectId: string, payload: Omit<ProjectEnvVar, 'id' | 'createdAt'>): Observable<ProjectEnvVar> {
    return this.http
      .post<{ data: ProjectEnvVar }>(`${this.base}/projects/${projectId}/env-vars`, payload)
      .pipe(map(r => r.data));
  }

  updateEnvVar(projectId: string, envVarId: string, payload: Partial<ProjectEnvVar>): Observable<ProjectEnvVar> {
    return this.http
      .put<{ data: ProjectEnvVar }>(`${this.base}/projects/${projectId}/env-vars/${envVarId}`, payload)
      .pipe(map(r => r.data));
  }

  removeEnvVar(projectId: string, envVarId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/projects/${projectId}/env-vars/${envVarId}`);
  }
}