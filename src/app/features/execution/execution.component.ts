// src/app/features/execution/execution.component.ts
import {
  Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, AfterViewChecked,
} from '@angular/core';
import { NgFor, NgClass, NgIf, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router }          from '@angular/router';
import { io, Socket }                                  from 'socket.io-client';
import { ScenarioService }                             from '../../services/scenario.service';
import { HttpClient }                                  from '@angular/common/http';

export interface LogEntry {
  time:  string;
  level: 'info' | 'pass' | 'fail' | 'error' | 'detail' | 'ai';
  msg:   string;
}

export interface ExecStats {
  pass: number; fail: number; running: number; skipped: number; total: number; elapsed?: number;
}

export interface ExecStep {
  stepIndex:     number;
  action:        string;
  selector?:     string;
  value?:        string;
  result:        'pass' | 'fail' | 'skip';
  durationMs?:   number;
  errorMessage?: string;
  screenshotPath?: string;
}

export interface BatchProgress {
  batchId:         string;
  pass:            number;
  fail:            number;
  total:           number;
  done:            number;
  currentScenario?: string;
  status?:         string;
  durationMs?:     number;
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

  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private svc     = inject(ScenarioService);
  private http    = inject(HttpClient);
  private socket: Socket | null = null;

  readonly SERVER = 'http://localhost:3000';
window = window;
  // ── Mode ────────────────────────────────────────────────────────────────────
  mode           = signal<ExecMode>('single');
  executionId    = signal<string | null>(null);
  batchId        = signal<string | null>(null);
  scenarioName   = signal('Scénario');
  projectId      = signal('');
  captureMode    = signal<'screenshot' | 'video' | 'none'>('screenshot');

  // ── State single ────────────────────────────────────────────────────────────
  result         = signal<ExecResult>('RUNNING');
  logs           = signal<LogEntry[]>([]);
  stats          = signal<ExecStats>({ pass: 0, fail: 0, running: 0, skipped: 0, total: 0 });
  durationMs     = signal<number | null>(null);
  errorLog       = signal<string | null>(null);
  screenshotUrl  = signal<string | null>(null);
  videoUrl       = signal<string | null>(null);
  steps          = signal<ExecStep[]>([]);
  showReport     = signal(false);
  expandedStep   = signal<number | null>(null);

  // ── State batch ─────────────────────────────────────────────────────────────
  batchProgress  = signal<BatchProgress | null>(null);
  batchDone      = signal(false);

  // ── Pipeline ────────────────────────────────────────────────────────────────
  stages = signal([
    { icon: '▷',  label: 'Lancement\nPlaywright', state: 'running' },
    { icon: '⚙',  label: 'Exécution\ntests',      state: 'pending' },
    { icon: '📊', label: 'Rapport\nfinal',         state: 'pending' },
  ]);

  private shouldScroll = false;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.scenarioName.set(p['scenarioName'] || 'Scénario');
    this.projectId.set(p['projectId'] || '');
    this.captureMode.set(p['captureMode'] || 'screenshot');

    if (p['batchId']) {
      this.mode.set('batch');
      this.batchId.set(p['batchId']);
      this._connectSocket();
      this._subscribeBatch(p['batchId']);
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

  // ── Socket ───────────────────────────────────────────────────────────────────

  private _connectSocket(): void {
    const query: Record<string, string> = {};
    if (this.executionId()) query['executionId'] = this.executionId()!;
    if (this.batchId())     query['batchId']     = this.batchId()!;

    this.socket = io(`${this.SERVER}/execution`, {
      transports: ['websocket'], query,
    });

    this.socket.on('connect', () => {
      if (this.executionId()) this.socket?.emit('subscribe', { executionId: this.executionId() });
      if (this.batchId())     this.socket?.emit('subscribeBatch', { batchId: this.batchId() });
      this._addLog({ time: this._now(), level: 'info', msg: 'Connecté au flux d\'exécution...' });
    });

    this.socket.on('exec_log', (entry: LogEntry) => {
      this._addLog(entry);
    });

    this.socket.on('exec_progress', (s: ExecStats) => {
      this.stats.set(s);
      this.stages.update(st => st.map((stage, i) => ({
        ...stage,
        state: i === 0 ? 'done' : i === 1 ? 'running' : 'pending',
      })));
    });

    this.socket.on('exec_complete', (data: {
      executionId: string; result: string; durationMs: number;
      stats: ExecStats; errorLog: string | null;
      screenshotPath?: string; videoPath?: string; steps?: ExecStep[];
    }) => {
      this.result.set(data.result as ExecResult);
      this.stats.set(data.stats);
      this.durationMs.set(data.durationMs);
      this.errorLog.set(data.errorLog);

      if (data.screenshotPath) this.screenshotUrl.set(`${this.SERVER}${data.screenshotPath}`);
      if (data.videoPath)      this.videoUrl.set(`${this.SERVER}${data.videoPath}`);
      if (data.steps?.length)  this.steps.set(data.steps);

      const lastState = data.result === 'PASS' ? 'done' : 'fail';
      this.stages.update(st => st.map((s, i) => ({
        ...s, state: i < st.length - 1 ? 'done' : lastState,
      })));

      this.showReport.set(true);
      this.socket?.disconnect();

      // Charger les étapes depuis l'API si manquantes
      if (!data.steps?.length && data.executionId) {
        this._loadSteps(data.executionId);
      }
    });

    this.socket.on('batch_progress', (data: BatchProgress) => {
      this.batchProgress.set(data);
      if (data.status === 'DONE') {
        this.batchDone.set(true);
        this.showReport.set(true);
      }
    });

    this.socket.on('connect_error', () => {
      this._addLog({ time: this._now(), level: 'error', msg: 'Connexion au serveur perdue.' });
    });
  }

  private _subscribeBatch(batchId: string): void {
    // Déjà géré dans connect via query param
  }

  private _loadSteps(executionId: string): void {
    this.http.get<any>(`${this.SERVER}/api/executions/${executionId}/steps`).subscribe({
      next: (res) => { if (res.data?.length) this.steps.set(res.data); },
      error: () => {},
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  toggleStep(index: number): void {
    this.expandedStep.update(v => v === index ? null : index);
  }

  goBack(): void {
    const projId = this.projectId();
    if (projId) this.router.navigate(['/projects', projId, 'scenarios']);
    else this.router.navigate(['/']);
  }

  goToHistory(): void {
    const projId = this.projectId();
    if (projId) this.router.navigate(['/projects', projId, 'history']);
    else this.router.navigate(['/history']);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
    const ms = this.durationMs();
    if (ms === null) return '—';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  get passSteps(): ExecStep[] { return this.steps().filter(s => s.result === 'pass'); }
  get failSteps(): ExecStep[] { return this.steps().filter(s => s.result === 'fail'); }
}
