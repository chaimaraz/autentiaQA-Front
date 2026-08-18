// src/app/features/execution/execution.component.ts
import {
  Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, AfterViewChecked,
} from '@angular/core';
import { NgFor, NgClass, NgIf, NgTemplateOutlet, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router }          from '@angular/router';
import { Socket }                                      from 'socket.io-client';
import { HttpClient }                                  from '@angular/common/http';
import { createSocket }                                from '../../shared/utils/socket-factory';
import {
  ExecutionService,
  ExecutionStep,
  StepUpdateEvent,
  LogEntry,
  ExecCompleteEvent,
  ArtifactType,
  AiAnalysis,
  JiraTicketResult,
  BatchDetail,
  BatchScenarioExecution,
} from '../../services/execution.service';
import { JiraTicketModalComponent } from '../../shared/components/jira-ticket-modal/jira-ticket-modal.component';
import { AiFailuresListComponent } from '../../shared/components/ai-failures-list/ai-failures-list.component';
import { generateSingleReportPdf, generateBatchReportPdf, ReportStepVM, ScenarioReportVM } from '../../shared/utils/pdf-report';

export interface ExecStats {
  pass: number; fail: number; running: number; skipped: number; total: number;
}

export interface ScenarioResult {
  scenarioId:   string;
  scenarioName: string;
  executionId:  string;
  result:       'PASS' | 'FAIL' | 'ERROR';
  durationMs:   number;
  passCount:    number;
  failCount:    number;
  totalCount:   number;
}

export interface BatchProgress {
  batchId:             string;
  pass:                number;
  fail:                number;
  total:               number;
  done:                number;
  currentScenario?:    string;
  currentExecutionId?: string;
  status?:             string;
  durationMs?:         number;
  scenarioResults?:    ScenarioResult[];
}

export type ExecResult = 'RUNNING' | 'PASS' | 'FAIL' | 'ERROR';
export type ExecMode   = 'single' | 'batch';

@Component({
  selector:    'app-execution',
  standalone:  true,
  imports:     [NgFor, NgClass, NgIf, NgTemplateOutlet, DecimalPipe, DatePipe, RouterLink, JiraTicketModalComponent, AiFailuresListComponent],
  templateUrl: './execution.component.html',
  styleUrl:    './execution.component.scss',
})
export class ExecutionComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('logContainer') logContainer!: ElementRef;
  @ViewChild(JiraTicketModalComponent) jiraModal!: JiraTicketModalComponent;

  jiraTicketKey = signal<string | null>(null);
  jiraTicketUrl = signal<string | null>(null);

  openJiraModal(): void {
    const execId = this.executionId();
    if (execId) this.jiraModal.open(execId);
  }

  onJiraTicketCreated(result: JiraTicketResult): void {
    this.jiraTicketKey.set(result.key);
    this.jiraTicketUrl.set(result.url);
  }

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private execSvc = inject(ExecutionService);
  private http = inject(HttpClient);
  private socket: Socket | null = null;

  readonly SERVER = 'http://localhost:3000';

  mode         = signal<ExecMode>('single');
  executionId  = signal<string | null>(null);
  batchId      = signal<string | null>(null);
  scenarioName = signal('Scénario');
  projectId    = signal('');

  result      = signal<ExecResult>('RUNNING');
  logs        = signal<LogEntry[]>([]);
  stats       = signal<ExecStats>({ pass: 0, fail: 0, running: 0, skipped: 0, total: 0 });
  durationMs  = signal<number | null>(null);
  errorMessage = signal<string | null>(null);

  screenshotUrl = signal<string | null>(null);
  videoUrl      = signal<string | null>(null);
  traceUrl      = signal<string | null>(null);

  private stepsMap = new Map<number, ExecutionStep>();
  steps = signal<ExecutionStep[]>([]);

  showReport   = signal(false);
  expandedStep = signal<number | null>(null);

  // ── Métadonnées d'en-tête pour le rapport détaillé exporté (projet, dates).
  reportMeta = signal<{ projectName: string; startedAt: string; finishedAt: string | null } | null>(null);

  batchProgress     = signal<BatchProgress | null>(null);
  batchDone         = signal(false);
  expandedScenario  = signal<string | null>(null);
  batchDetail       = signal<BatchDetail | null>(null);
  loadingBatchDetail = signal(false);

  stages = signal([
    { icon: 'fa-play',          label: 'Lancement\nPlaywright', state: 'running' },
    { icon: 'fa-gear',          label: 'Exécution\ntests',      state: 'pending' },
    { icon: 'fa-chart-column',  label: 'Rapport\nfinal',        state: 'pending' },
  ]);

  private shouldScroll = false;

  // ── NOUVEAU : suivi de l'exécution actuellement affichée dans la console
  // en mode batch — évite de rester abonné à une room exec:<id> obsolète et
  // permet d'afficher les logs/steps de CHAQUE scénario du batch, pas juste
  // la barre de progression globale (c'était le bug "exécuter tous"). ──────
  private currentBatchExecId: string | null = null;

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.scenarioName.set(p['scenarioName'] || 'Scénario');
    this.projectId.set(p['projectId'] || '');

    if (p['batchId']) {
      this.mode.set('batch');
      this.batchId.set(p['batchId']);
      this._connectSocket();
      // ── Rechargement de page / lien profond (ex: email de merge) : le batch
      // est peut-être déjà terminé et plus aucun événement socket n'arrivera.
      this._loadBatchDetail(p['batchId']);
    } else if (p['executionId']) {
      this.mode.set('single');
      this.executionId.set(p['executionId']);
      this._connectSocket();
    } else {
      this.result.set('ERROR');
      this.logs.set([{ time: '--:--:--', level: 'error', msg: 'Aucune exécution en cours.' }]);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.logContainer) {
      const el = this.logContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private _connectSocket(): void {
    const query: Record<string, string> = {};
    if (this.executionId()) query['executionId'] = this.executionId()!;
    if (this.batchId())     query['batchId']     = this.batchId()!;

    this.socket = createSocket(`${this.SERVER}/execution`, { transports: ['websocket'], query });

    this.socket.on('connect', () => {
      if (this.executionId()) this.socket?.emit('subscribe', { executionId: this.executionId() });
      if (this.batchId())     this.socket?.emit('subscribeBatch', { batchId: this.batchId() });
      this._addLog({ time: this._now(), level: 'info', msg: "Connecté — en attente de l'exécution..." });
    });

    this.socket.on('exec_log', (entry: LogEntry) => this._addLog(entry));

    this.socket.on('exec_step_update', (ev: StepUpdateEvent) => {
      const existing = this.stepsMap.get(ev.stepIndex) || { stepIndex: ev.stepIndex, action: ev.action, result: 'RUNNING' };
      const merged: ExecutionStep = {
        ...existing,
        action:        ev.action,
        result:        ev.result,
        durationMs:    ev.durationMs ?? existing.durationMs,
        errorMessage:  ev.errorMessage ?? existing.errorMessage,
      };
      this.stepsMap.set(ev.stepIndex, merged);
      this.steps.set(Array.from(this.stepsMap.values()).sort((a, b) => a.stepIndex - b.stepIndex));

      const s = this.stats();
      const running = Array.from(this.stepsMap.values()).filter(x => x.result === 'RUNNING').length;
      const pass    = Array.from(this.stepsMap.values()).filter(x => x.result === 'PASS').length;
      const fail    = Array.from(this.stepsMap.values()).filter(x => x.result === 'FAIL').length;
      this.stats.set({ ...s, running, pass, fail, total: this.stepsMap.size });

      this.stages.update(st => st.map((stage, i) => ({
        ...stage, state: i === 0 ? 'done' : i === 1 ? 'running' : 'pending',
      })));
    });

    // ── NOUVEAU : la progression du batch pilote maintenant l'abonnement
    // à l'exécution courante, pour afficher console + steps en direct
    // pour CHAQUE scénario, et pas juste à la fin. ─────────────────────────

  this.socket.on('batch_progress', (data: BatchProgress) => {

  this.batchProgress.set(data);

  if (data.status === 'DONE') {
    // ── NOUVEAU : le batch est terminé — l'analyse IA des échecs a déjà été
    // générée côté backend avant cet événement, donc ce fetch renvoie le
    // rapport complet (par scénario, captures, IA) en un seul appel.
    this.showReport.set(true);
    if (this.batchId()) this._loadBatchDetail(this.batchId()!);
  }

  if (data.currentExecutionId && data.currentExecutionId !== this.currentBatchExecId) {

    if (this.currentBatchExecId) {
      this.socket?.emit('unsubscribe', {
        executionId: this.currentBatchExecId
      });
    }

    this.currentBatchExecId = data.currentExecutionId;

    this.socket?.emit('subscribe', {
      executionId: data.currentExecutionId
    });

    this.stepsMap.clear();
    this.steps.set([]);

    this._addLog({
      time: this._now(),
      level: 'info',
      msg: `${data.currentScenario}`
    });
  }

});

    this.socket.on('exec_complete', (data: ExecCompleteEvent) => {
      // ── NOUVEAU : en mode batch, exec_complete arrive pour CHAQUE scénario,
      // pas seulement le dernier. On loggue le résultat individuel sans écraser
      // les stats/result globaux du batch (gérés par batch_progress). ────────
      if (this.mode() === 'batch') {
        this._addLog({
          time: this._now(),
          level: data.result === 'PASS' ? 'pass' : 'fail',
          msg: `Scénario terminé — ${data.result} en ${(data.durationMs / 1000).toFixed(1)}s`,
        });
        return;
      }

      this.result.set(data.result as ExecResult);
      this.stats.set({
        pass: data.stats.pass, fail: data.stats.fail,
        running: 0, skipped: data.stats.skipped, total: data.stats.total,
      });
      this.durationMs.set(data.durationMs);
      this.errorMessage.set(data.errorMessage);

      const shot  = data.artifacts.find(a => a.type === 'SCREENSHOT' as ArtifactType);
      const video = data.artifacts.find(a => a.type === 'VIDEO' as ArtifactType);
      const trace = data.artifacts.find(a => a.type === 'TRACE' as ArtifactType);

      if (shot)  this.screenshotUrl.set(`${this.SERVER}${shot.url}`);
      if (video) this.videoUrl.set(`${this.SERVER}${video.url}`);
      if (trace) this.traceUrl.set(this.execSvc.getTraceViewerUrl(trace.url));

      const lastState = data.result === 'PASS' ? 'done' : 'fail';
      this.stages.update(st => st.map((s, i) => ({ ...s, state: i < st.length - 1 ? 'done' : lastState })));

      this.showReport.set(true);
      this.socket?.disconnect();

      if (this.stepsMap.size === 0 && data.executionId) this._loadSteps(data.executionId);
      this._loadReportMeta(data.executionId);
      this.analyzeWithAi();
    });

    this.socket.on('connect_error', () => {
      this._addLog({ time: this._now(), level: 'error', msg: 'Connexion au serveur perdue.' });
    });
  }

  aiAnalysis = signal<AiAnalysis | null>(null);
analyzingAi = signal(false);

analyzeWithAi(): void {
  const execId = this.executionId();
  if (!execId) return;
  this.analyzingAi.set(true);
  this.execSvc.analyzeExecution(execId).subscribe({
    next: (analysis) => {
      this.aiAnalysis.set(analysis);
      this.analyzingAi.set(false);
    },
    error: () => {
      this.analyzingAi.set(false);
      alert("Erreur lors de l'analyse IA.");
    },
  });
}

  private _loadReportMeta(executionId: string): void {
    this.execSvc.getExecutionDetail(executionId).subscribe({
      next: (detail) => {
        this.reportMeta.set({
          projectName: detail.scenario?.project?.name || '',
          startedAt: detail.startedAt,
          finishedAt: detail.finishedAt,
        });
      },
      error: () => undefined,
    });
  }

  private _loadBatchDetail(batchId: string): void {
    const projId = this.projectId();
    if (!projId) return;
    this.loadingBatchDetail.set(true);
    this.execSvc.getBatchDetail(projId, batchId).subscribe({
      next: (detail) => {
        this.batchDetail.set(detail);
        this.loadingBatchDetail.set(false);
        if (detail.status === 'DONE') this.showReport.set(true);
      },
      error: () => this.loadingBatchDetail.set(false),
    });
  }

  getExecScreenshotUrl(exec: BatchScenarioExecution): string | null {
    const shot = this.execSvc.findArtifact(exec.artifacts, 'SCREENSHOT');
    return shot ? this.execSvc.getArtifactUrl(shot.filePath) : null;
  }

  getFailedSteps(exec: BatchScenarioExecution): ExecutionStep[] {
    return (exec.steps || []).filter(s => s.result === 'FAIL');
  }

  private _toStepVM(steps: ExecutionStep[]): ReportStepVM[] {
    return steps.map((s, i) => ({
      index: i + 1,
      label: s.action,
      result: s.result,
      durationMs: s.durationMs ?? null,
      errorMessage: s.errorMessage ?? null,
    }));
  }

  private _toAiFailuresVM(analysis: AiAnalysis | null | undefined) {
    return (analysis?.failures || []).map(f => ({
      stepIndex: f.stepIndex,
      action: f.action,
      causeLabel: this.causeLabelFr(f.causeCategory),
      explanation: f.explanation,
      recommendation: f.recommendation,
    }));
  }

  async exportSingleReport(): Promise<void> {
    const meta = this.reportMeta();
    const s = this.stats();
    const scenario: ScenarioReportVM = {
      scenarioName: this.scenarioName(),
      result: this.result(),
      durationMs: this.durationMs(),
      passCount: s.pass,
      failCount: s.fail,
      totalCount: s.total,
      errorMessage: this.errorMessage(),
      steps: this._toStepVM(this.steps()),
      screenshotUrl: this.screenshotUrl(),
      aiSummary: this.aiAnalysis()?.summary ?? null,
      aiFailures: this._toAiFailuresVM(this.aiAnalysis()),
    };
    await generateSingleReportPdf({
      projectName: meta?.projectName || '',
      executedAt: meta?.finishedAt || meta?.startedAt || null,
      scenario,
    });
  }

  async exportBatchReport(): Promise<void> {
    const bd = this.batchDetail();
    const bp = this.batchProgress();
    if (!bd) return;
    const scenarios: ScenarioReportVM[] = bd.executions.map(exec => ({
      scenarioName: exec.scenario.name,
      result: exec.result,
      durationMs: exec.durationMs,
      passCount: exec.passCount,
      failCount: exec.failCount,
      totalCount: exec.totalCount,
      errorMessage: exec.errorMessage,
      steps: this._toStepVM(exec.steps || []),
      screenshotUrl: this.getExecScreenshotUrl(exec),
      aiSummary: exec.aiAnalysis?.summary ?? null,
      aiFailures: this._toAiFailuresVM(exec.aiAnalysis),
    }));
    await generateBatchReportPdf({
      projectName: bd.project?.name || '',
      executedAt: bd.finishedAt || bd.startedAt || null,
      totalCount: bd.totalCount,
      passCount: bd.passCount,
      failCount: bd.failCount,
      durationMs: bd.durationMs ?? bp?.durationMs ?? null,
      scenarios,
    });
  }

  private _loadSteps(executionId: string): void {
    this.execSvc.getSteps(executionId).subscribe({
      next: (steps) => {
        if (steps.length) {
          steps.forEach(s => this.stepsMap.set(s.stepIndex, s));
          this.steps.set(Array.from(this.stepsMap.values()).sort((a, b) => a.stepIndex - b.stepIndex));
        }
      },
      error: () => undefined,
    });
  }

  toggleStep(index: number): void { this.expandedStep.update(v => v === index ? null : index); }
  toggleScenarioDetail(scenarioId: string): void { this.expandedScenario.update(v => v === scenarioId ? null : scenarioId); }

  goBack(): void {
    const projId = this.projectId();
    this.router.navigate(projId ? ['/projects', projId, 'scenarios'] : ['/']);
  }

  goToHistory(): void {
    const projId = this.projectId();
    this.router.navigate(projId ? ['/projects', projId, 'history'] : ['/history']);
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

  openTraceViewer(): void {
    const url = this.traceUrl();
    if (url) window.open(url, '_blank');
  }

  private _addLog(entry: LogEntry): void {
    this.logs.update(l => [...l, entry]);
    this.shouldScroll = true;
  }

  private _now(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour12: false });
  }

  get progress(): number {
    const s = this.stats();
    if (!s.total) return 0;
    return Math.round(((s.pass + s.fail + s.skipped) / s.total) * 100);
  }

  get batchProgress_pct(): number {
    const b = this.batchProgress();
    if (!b?.total) return 0;
    return Math.round((b.done / b.total) * 100);
  }

  get durationLabel(): string {
    return this.execSvc.formatDuration(this.durationMs());
  }

  get passSteps(): ExecutionStep[] { return this.steps().filter(s => s.result === 'PASS'); }
  get failSteps(): ExecutionStep[] { return this.steps().filter(s => s.result === 'FAIL'); }

  get batchPassRate(): number {
    const b = this.batchProgress();
    if (!b?.total) return 0;
    return Math.round((b.pass / b.total) * 100);
  }

  formatDuration(ms: number | null): string { return this.execSvc.formatDuration(ms); }

  getBatchTotalDuration(): string {
    return this.execSvc.formatDuration(this.batchProgress()?.durationMs ?? null);
  }
}