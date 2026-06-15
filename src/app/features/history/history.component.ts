import { MinPipe } from './../../shared/pipes/min.pipe';
// src/app/features/history/history.component.ts
import {
  Component, OnInit, signal, inject,
} from '@angular/core';
import {
  NgFor,
  NgClass,
  NgIf,
  DatePipe,
  SlicePipe
} from '@angular/common';
import { FormsModule }                    from '@angular/forms';
import { RouterLink, ActivatedRoute }     from '@angular/router';
import { HttpClient }                     from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';
import { FailedStepsPipe } from '../../shared/pipes/failed-steps.pipe';
import { StepNamePipe } from '../../shared/pipes/step-name.pipe';


export interface HistoryRun {
  id:            string;
  result:        'PASS' | 'FAIL' | 'ERROR' | 'RUNNING';
  durationMs:    number | null;
  passCount:     number;
  failCount:     number;
  totalCount:    number;
  screenshotPath: string | null;
  videoPath:     string | null;
  executedAt:    string;
  scenario: {
    id:        string;
    name:      string;
    type:      string;
    projectId: string;
    project:   { name: string };
  };
  steps: {
    stepIndex:     number;
    action:        string;
    selector?:     string;
    result:        'pass' | 'fail' | 'skip';
    durationMs?:   number;
    errorMessage?: string;
    screenshotPath?: string;
  }[];
}

interface GlobalStats {
  totalRuns:   number;
  passRate:    number;
  failedRuns:  number;
  avgDuration: number;
  jiraBugs:    number;
}

@Component({
  selector:    'app-history',
  standalone:  true,
  imports: [
  NgFor,
  NgClass,
  NgIf,
  FormsModule,
  RouterLink,
  DatePipe,
  SlicePipe,
  FailedStepsPipe,
  StepNamePipe,
  MinPipe
],
  templateUrl: './history.component.html',
  styleUrl:    './history.component.scss',
})
export class HistoryComponent implements OnInit {

  private http  = inject(HttpClient);
  private route = inject(ActivatedRoute);

  readonly SERVER = 'http://localhost:3000';

  // ── Filters ──────────────────────────────────────────────────────────────────
  projectId  = '';
  filterStatus   = '';
  filterSearch   = '';
  filterDateFrom = '';
  filterDateTo   = '';

  // ── Pagination ───────────────────────────────────────────────────────────────
  currentPage  = 1;
  pageSize     = 20;
  totalRuns    = 0;
  totalPages   = 1;

  // ── Data ─────────────────────────────────────────────────────────────────────
  runs        = signal<HistoryRun[]>([]);
  loading     = signal(false);
  expandedRun = signal<string | null>(null);
  expandedStep = signal<number | null>(null);

  globalStats = signal<GlobalStats>({
    totalRuns: 0, passRate: 0, failedRuns: 0, avgDuration: 0, jiraBugs: 0,
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.projectId = this.route.snapshot.params['id'] || this.route.snapshot.queryParams['projectId'] || '';
    this.loadHistory();
  }

  // ── Load ─────────────────────────────────────────────────────────────────────

  openImage(url: string): void {
  window.open(url, '_blank');
}
  loadHistory(): void {
    this.loading.set(true);
    const params = new URLSearchParams({
      page:     String(this.currentPage),
      limit:    String(this.pageSize),
      projectId: this.projectId,
      status:   this.filterStatus,
      search:   this.filterSearch,
      dateFrom: this.filterDateFrom,
      dateTo:   this.filterDateTo,
    });

    this.http.get<any>(`${this.SERVER}/api/executions/history?${params}`)
      .subscribe({
        next: (res) => {
          this.runs.set(res.data);
          this.totalRuns  = res.total;
          this.totalPages = res.totalPages;
          this.loading.set(false);
          this._computeStats(res.data);
        },
        error: () => this.loading.set(false),
      });
  }

  private _computeStats(runs: HistoryRun[]): void {
    const total    = runs.length;
    const passed   = runs.filter(r => r.result === 'PASS').length;
    const failed   = runs.filter(r => r.result === 'FAIL' || r.result === 'ERROR').length;
    const avgDur   = total > 0
      ? Math.round(runs.reduce((s, r) => s + (r.durationMs || 0), 0) / total / 1000)
      : 0;

    this.globalStats.set({
      totalRuns:   this.totalRuns,
      passRate:    total > 0 ? Math.round(passed / total * 100) : 0,
      failedRuns:  failed,
      avgDuration: avgDur,
      jiraBugs:    failed, // simplification : 1 bug Jira par run échoué
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  toggleRun(id: string): void {
    this.expandedRun.update(v => v === id ? null : id);
    this.expandedStep.set(null);
  }

  toggleStep(idx: number): void {
    this.expandedStep.update(v => v === idx ? null : idx);
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadHistory();
  }

  resetFilters(): void {
    this.filterStatus = this.filterSearch = this.filterDateFrom = this.filterDateTo = '';
    this.currentPage = 1;
    this.loadHistory();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
    this.loadHistory();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getPassWidth(r: HistoryRun): number {
    return r.totalCount > 0 ? Math.round(r.passCount / r.totalCount * 100) : 0;
  }
  getFailWidth(r: HistoryRun): number {
    return r.totalCount > 0 ? Math.round(r.failCount / r.totalCount * 100) : 0;
  }
  getRate(r: HistoryRun): number {
    return r.totalCount > 0 ? Math.round(r.passCount / r.totalCount * 100) : (r.result === 'PASS' ? 100 : 0);
  }
  getTypeClass(type: string): string {
    return ({ POSITIVE: 'positive', NEGATIVE: 'negative', SECURITY: 'security', PERFORMANCE: 'perf' })[type] || 'positive';
  }
  getTypeLabel(type: string): string {
    return ({ POSITIVE: 'POSITIF', NEGATIVE: 'NÉGATIF', SECURITY: 'SÉCURITÉ', PERFORMANCE: 'PERF' })[type] || type;
  }
  formatDuration(ms: number | null): string {
    if (!ms) return '—';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  get pages(): (number | '...')[] {
    const result: (number | '...')[] = [];
    const range = new Set<number>([1, this.totalPages]);
    for (let i = Math.max(2, this.currentPage - 1); i <= Math.min(this.totalPages - 1, this.currentPage + 1); i++) {
      range.add(i);
    }
    let prev = 0;
    for (const p of Array.from(range).sort((a, b) => a - b)) {
      if (p - prev > 1) result.push('...');
      result.push(p);
      prev = p;
    }
    return result;
  }

  isEllipsis(p: number | '...'): p is '...' { return p === '...'; }
}
