// src/app/features/execution/execution.component.ts
import {
  Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, AfterViewChecked,
} from '@angular/core';
import { NgFor, NgClass, NgIf, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router }          from '@angular/router';
import { io, Socket }                                  from 'socket.io-client';
import { HttpClient }                                  from '@angular/common/http';
import {
  ExecutionService,
  ExecutionStep,
  StepUpdateEvent,
  LogEntry,
  ExecCompleteEvent,
  ArtifactType,
} from '../../services/execution.service';

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
  imports:     [NgFor, NgClass, NgIf, DecimalPipe, DatePipe, RouterLink],
  templateUrl: './execution.component.html',
  styleUrl:    './execution.component.scss',
})
export class ExecutionComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('logContainer') logContainer!: ElementRef;

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
  traceUrl      = signal<string | null>(null); // lien Playwright Trace Viewer

  // Étapes en temps réel — Map pour mise à jour idempotente par stepIndex
  private stepsMap = new Map<number, ExecutionStep>();
  steps = signal<ExecutionStep[]>([]);

  showReport   = signal(false);
  expandedStep = signal<number | null>(null);

  batchProgress     = signal<BatchProgress | null>(null);
  batchDone         = signal(false);
  expandedScenario  = signal<string | null>(null);

  stages = signal([
    { icon: '▷',  label: 'Lancement\nPlaywright', state: 'running' },
    { icon: '⚙',  label: 'Exécution\ntests',      state: 'pending' },
    { icon: '📊', label: 'Rapport\nfinal',         state: 'pending' },
  ]);

  private shouldScroll = false;

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.scenarioName.set(p['scenarioName'] || 'Scénario');
    this.projectId.set(p['projectId'] || '');

    if (p['batchId']) {
      this.mode.set('batch');
      this.batchId.set(p['batchId']);
      this._connectSocket();
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

    this.socket = io(`${this.SERVER}/execution`, { transports: ['websocket'], query });

    this.socket.on('connect', () => {
      if (this.executionId()) this.socket?.emit('subscribe', { executionId: this.executionId() });
      if (this.batchId())     this.socket?.emit('subscribeBatch', { batchId: this.batchId() });
      this._addLog({ time: this._now(), level: 'info', msg: "🔌 Connecté — en attente de l'exécution..." });
    });

    this.socket.on('exec_log', (entry: LogEntry) => this._addLog(entry));

    // Nouveau : mise à jour temps réel d'une étape précise (begin ou end)
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

    this.socket.on('exec_complete', (data: ExecCompleteEvent) => {
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
    });

    this.socket.on('batch_progress', (data: BatchProgress) => {
      this.batchProgress.set(data);
      if (data.status === 'DONE') {
        this.batchDone.set(true);
        this.showReport.set(true);
        this.socket?.disconnect();
      }
    });

    this.socket.on('connect_error', () => {
      this._addLog({ time: this._now(), level: 'error', msg: '⚠ Connexion au serveur perdue.' });
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
      error: () => {},
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