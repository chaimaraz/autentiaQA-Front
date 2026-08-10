// src/app/features/history/history.component.ts
import { Component, OnInit, signal, inject, ViewChild } from '@angular/core';
import { NgFor, NgClass, NgIf, DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  ExecutionService, HistoryRun, GlobalStats, ExecutionStep, JiraTicketResult,
} from '../../services/execution.service';
import { JiraTicketModalComponent } from '../../shared/components/jira-ticket-modal/jira-ticket-modal.component';
import { exportElementAsPdf } from '../../shared/utils/export-pdf';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule, RouterLink, DatePipe, SlicePipe, JiraTicketModalComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  readonly executionSvc = inject(ExecutionService);

  @ViewChild(JiraTicketModalComponent) jiraModal!: JiraTicketModalComponent;
  private jiraModalRunId: string | null = null;

  openJiraModal(run: HistoryRun): void {
    this.jiraModalRunId = run.id;
    this.jiraModal.open(run.id);
  }

  onJiraTicketCreated(result: JiraTicketResult): void {
    const runId = this.jiraModalRunId;
    if (!runId) return;
    this.runs.update(list => list.map(r =>
      r.id === runId ? { ...r, jiraTicketKey: result.key, jiraTicketUrl: result.url } : r
    ));
  }

  projectId    = '';
  filterStatus = '';
  filterSearch = '';
  filterDateFrom = '';
  filterDateTo   = '';

  currentPage = 1;
  pageSize    = 20;
  totalRuns   = 0;
  totalPages  = 1;

  runs        = signal<HistoryRun[]>([]);
  loading     = signal(false);
  expandedRun = signal<string | null>(null);
  expandedStep = signal<number | null>(null);
  globalStats = signal<GlobalStats>({
    totalRuns: 0, passRate: 0, failedRuns: 0, avgDuration: 0, jiraBugs: 0,
  });

  ngOnInit(): void {
    this.projectId = this.route.snapshot.params['id']
      || this.route.snapshot.queryParams['projectId']
      || '';
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading.set(true);
    this.executionSvc.getHistory({
      page:      this.currentPage,
      limit:     this.pageSize,
      projectId: this.projectId,
      status:    this.filterStatus,
      search:    this.filterSearch,
      dateFrom:  this.filterDateFrom,
      dateTo:    this.filterDateTo,
    }).subscribe({
      next: (res) => {
        this.runs.set(res.data);
        this.totalRuns  = res.total;
        this.totalPages = res.totalPages;
        this.globalStats.set(this.executionSvc.computeStats(res.data, res.total));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleRun(id: string): void {
    this.expandedRun.update(v => v === id ? null : id);
    this.expandedStep.set(null);
  }

  toggleStep(idx: number): void {
    this.expandedStep.update(v => v === idx ? null : idx);
  }

  openImage(url: string): void {
    window.open(url, '_blank');
  }

  openTrace(run: HistoryRun): void {
    const trace = this.executionSvc.findArtifact(run.artifacts, 'TRACE');
    if (trace) window.open(this.executionSvc.getTraceViewerUrl(trace.filePath), '_blank');
  }

  hasTrace(run: HistoryRun): boolean {
    return !!this.executionSvc.findArtifact(run.artifacts, 'TRACE');
  }

  hasVideo(run: HistoryRun): boolean {
    return !!this.executionSvc.findArtifact(run.artifacts, 'VIDEO');
  }

  getScreenshotUrl(run: HistoryRun): string | null {
    const shot = this.executionSvc.findArtifact(run.artifacts, 'SCREENSHOT');
    return shot ? this.executionSvc.getArtifactUrl(shot.filePath) : null;
  }

  getVideoUrl(run: HistoryRun): string | null {
    const video = this.executionSvc.findArtifact(run.artifacts, 'VIDEO');
    return video ? this.executionSvc.getArtifactUrl(video.filePath) : null;
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

  getPassWidth  = (r: HistoryRun) => this.executionSvc.getPassWidth(r);
  getFailWidth  = (r: HistoryRun) => this.executionSvc.getFailWidth(r);
  getRate       = (r: HistoryRun) => this.executionSvc.getRate(r);
  getTypeClass  = (type: string)  => this.executionSvc.getTypeClass(type);
  getTypeLabel  = (type: string)  => this.executionSvc.getTypeLabel(type);
  formatDuration = (ms: number | null) => this.executionSvc.formatDuration(ms);

  getPassSteps(run: HistoryRun): ExecutionStep[] {
    return (run.steps || []).filter(s => s.result === 'PASS');
  }

  getFailSteps(run: HistoryRun): ExecutionStep[] {
    return (run.steps || []).filter(s => s.result === 'FAIL');
  }

  getFirstFailedStep(run: HistoryRun): string {
    const failed = (run.steps || []).find(s => s.result === 'FAIL');
    return failed ? failed.action : '';
  }

  causeLabelFr(cat: string): string {
    const labels: Record<string, string> = {
      APPLICATION_BUG: 'Bug application',
      SCRIPT_ISSUE: 'Script/sélecteur',
      ENVIRONMENT: 'Environnement',
      TIMING: 'Timing',
      UNKNOWN: 'Indéterminé',
    };
    return labels[cat] || cat;
  }

  causeIconFr(cat: string): string {
    const icons: Record<string, string> = {
      APPLICATION_BUG: 'fa-bug',
      SCRIPT_ISSUE: 'fa-file-code',
      ENVIRONMENT: 'fa-globe',
      TIMING: 'fa-stopwatch',
      UNKNOWN: 'fa-circle-question',
    };
    return icons[cat] || 'fa-circle-question';
  }

  async exportRunReport(el: HTMLElement, run: HistoryRun): Promise<void> {
    await exportElementAsPdf(el, `rapport-${run.scenario.name}-${run.id}.pdf`);
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

  pageRangeStart(): number {
    return this.totalRuns === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  pageRangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRuns);
  }
}