import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError, map } from 'rxjs';
import { ProjectRole } from './auth.service';

export type ExecutionResultKey = 'PASS' | 'FAIL' | 'ERROR' | 'TIMEOUT' | 'RUNNING';
export type ProjectStatusKey = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface DashboardKpis {
  activeProjects: number;
  totalProjects: number;
  totalScenarios: number;
  totalExecutions: number;
  passRate: number;
  passRateDeltaPct: number;
  openFailures: number;
  totalUsers?: number;
}

export interface ResultBreakdownItem {
  result: ExecutionResultKey;
  count: number;
  pct: number;
}

export interface TrendPoint {
  date: string;
  total: number;
  pass: number;
  fail: number;
  passRate: number;
}

export interface DashboardProjectRow {
  id: string;
  name: string;
  status: ProjectStatusKey;
  framework: string;
  createdAt: string;
  executionCount: number;
  passRate: number;
  lastExecutionAt: string | null;
  scenarioCount: number;
  role?: ProjectRole;
  ownerName?: string | null;
  memberCount?: number;
}

export interface ActivityItem {
  id: string;
  result: ExecutionResultKey;
  scenarioName: string;
  projectId: string;
  projectName: string;
  userName: string | null;
  occurredAt: string;
}

export interface DashboardSummary {
  scope: 'member' | 'platform';
  generatedAt: string;
  kpis: DashboardKpis;
  resultBreakdown: ResultBreakdownItem[];
  trend: TrendPoint[];
  projects: DashboardProjectRow[];
  recentActivity: ActivityItem[];
  topFailingProjects?: DashboardProjectRow[];
  usersByRole?: { SUPER_ADMIN: number; ADMIN: number; USER: number };
  projectsByStatus?: { DRAFT: number; ACTIVE: number; ARCHIVED: number };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getSummary(): Observable<DashboardSummary> {
    return this.http
      .get<ApiResponse<DashboardSummary>>(`${this.baseUrl}/dashboard/summary`)
      .pipe(map((res) => res.data), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message =
      error.error?.message ||
      error.error?.errors?.map((e: any) => e.msg).join(', ') ||
      'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}
