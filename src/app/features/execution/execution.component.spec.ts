import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ExecutionComponent } from './execution.component';
import {
  ExecutionService, ExecCompleteEvent, StepUpdateEvent, BatchDetail, AiAnalysis,
  ExecutionStep, BatchScenarioExecution,
} from '../../services/execution.service';
import { __setSocketFactoryForTests, __resetSocketFactory } from '../../shared/utils/socket-factory';
import { __setExportElementAsPdfForTests, __resetExportElementAsPdf } from '../../shared/utils/export-pdf';

describe('ExecutionComponent', () => {
  let component: ExecutionComponent;
  let fixture: ComponentFixture<ExecutionComponent>;
  let execSvc: jasmine.SpyObj<ExecutionService>;
  let router: jasmine.SpyObj<Router>;
  let fakeSocket: jasmine.SpyObj<any>;
  let ioSpy: jasmine.Spy;

  const baseBatchDetail: BatchDetail = {
    id: 'batch1', projectId: 'p1', status: 'RUNNING', totalCount: 2, passCount: 0, failCount: 0,
    durationMs: null, startedAt: '2024-01-01T00:00:00.000Z', finishedAt: null, executions: [],
  };

  const baseAiAnalysis: AiAnalysis = { summary: 'All good', failures: [] };

  function socketHandler(event: string): ((payload?: any) => void) | undefined {
    const call = fakeSocket.on.calls.allArgs().find((args: any[]) => args[0] === event);
    return call ? call[1] : undefined;
  }

  function configure(queryParams: Record<string, string>) {
    execSvc = jasmine.createSpyObj<ExecutionService>('ExecutionService', [
      'analyzeExecution', 'getBatchDetail', 'findArtifact', 'getArtifactUrl',
      'getSteps', 'getTraceViewerUrl', 'formatDuration',
    ]);
    execSvc.formatDuration.and.callFake((ms: number | null | undefined) =>
      !ms ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
    execSvc.getBatchDetail.and.returnValue(of(baseBatchDetail));
    execSvc.getSteps.and.returnValue(of([]));
    execSvc.analyzeExecution.and.returnValue(of(baseAiAnalysis));
    execSvc.getTraceViewerUrl.and.callFake((p: string) => `https://trace.playwright.dev/?trace=${p}`);
    execSvc.findArtifact.and.returnValue(undefined);
    execSvc.getArtifactUrl.and.callFake((p: string) => `http://localhost:3000${p}`);

    router = jasmine.createSpyObj('Router', ['navigate']);

    fakeSocket = jasmine.createSpyObj('Socket', ['on', 'emit', 'disconnect']);
    // `import * as X` namespace objects are non-configurable per the ES
    // module spec, so spyOn(X, 'io') can never work here — the component
    // routes socket creation through an overridable factory instead.
    ioSpy = jasmine.createSpy('io').and.returnValue(fakeSocket);
    __setSocketFactoryForTests(ioSpy);

    TestBed.configureTestingModule({
      imports: [ExecutionComponent],
      providers: [
        provideHttpClient(),
        { provide: ExecutionService, useValue: execSvc },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutionComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    __resetSocketFactory();
    __resetExportElementAsPdf();
  });

  // ── ngOnInit / socket bootstrap ──────────────────────────────────────────

  describe('ngOnInit — single execution mode', () => {
    beforeEach(() => {
      configure({ executionId: 'exec1', scenarioName: 'Login test', projectId: 'p1' });
      fixture.detectChanges();
    });

    it('sets mode/executionId/scenarioName/projectId and connects the socket', () => {
      expect(component).toBeTruthy();
      expect(component.mode()).toBe('single');
      expect(component.executionId()).toBe('exec1');
      expect(component.scenarioName()).toBe('Login test');
      expect(component.projectId()).toBe('p1');
      expect(ioSpy).toHaveBeenCalledWith('http://localhost:3000/execution', {
        transports: ['websocket'], query: { executionId: 'exec1' },
      });
    });

    it('subscribes to the execution room and logs a connect message on the "connect" event', () => {
      socketHandler('connect')!();
      expect(fakeSocket.emit).toHaveBeenCalledWith('subscribe', { executionId: 'exec1' });
      expect(fakeSocket.emit).not.toHaveBeenCalledWith('subscribeBatch', jasmine.anything());
      expect(component.logs().some(l => l.msg.includes('Connecté'))).toBeTrue();
    });
  });

  describe('ngOnInit — batch mode', () => {
    beforeEach(() => {
      configure({ batchId: 'batch1', projectId: 'p1' });
      fixture.detectChanges();
    });

    it('sets mode/batchId and connects the socket with the batch query', () => {
      expect(component.mode()).toBe('batch');
      expect(component.batchId()).toBe('batch1');
      expect(ioSpy).toHaveBeenCalledWith('http://localhost:3000/execution', {
        transports: ['websocket'], query: { batchId: 'batch1' },
      });
    });

    it('loads the batch detail up front for deep-link/reload scenarios', () => {
      expect(execSvc.getBatchDetail).toHaveBeenCalledWith('p1', 'batch1');
      expect(component.batchDetail()).toEqual(baseBatchDetail);
      expect(component.loadingBatchDetail()).toBeFalse();
    });

    it('shows the report immediately if the reloaded batch is already DONE', () => {
      execSvc.getBatchDetail.and.returnValue(of({ ...baseBatchDetail, status: 'DONE' }));
      component.showReport.set(false);
      (component as any)._loadBatchDetail('batch1');
      expect(component.showReport()).toBeTrue();
    });

    it('subscribes to the batch room on connect', () => {
      socketHandler('connect')!();
      expect(fakeSocket.emit).toHaveBeenCalledWith('subscribeBatch', { batchId: 'batch1' });
    });
  });

  describe('ngOnInit — no execution/batch id', () => {
    beforeEach(() => {
      configure({});
      fixture.detectChanges();
    });

    it('sets an ERROR result and logs a message, without connecting a socket', () => {
      expect(component.result()).toBe('ERROR');
      expect(component.logs()[0].msg).toBe('Aucune exécution en cours.');
      expect(ioSpy).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('disconnects and clears the socket', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
      component.ngOnDestroy();
      expect(fakeSocket.disconnect).toHaveBeenCalled();
      expect((component as any).socket).toBeNull();
    });
  });

  // ── socket-event-driven state transitions ────────────────────────────────

  describe('socket event: exec_log', () => {
    it('appends the entry to the logs signal', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
      const entry = { time: '10:00:00', level: 'info' as const, msg: 'step started' };
      socketHandler('exec_log')!(entry);
      expect(component.logs()).toContain(entry);
    });
  });

  describe('socket event: exec_step_update', () => {
    beforeEach(() => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
    });

    it('adds a new step, recomputes stats and moves the stage pipeline forward', () => {
      const ev: StepUpdateEvent = { stepIndex: 0, action: 'click #btn', result: 'PASS', durationMs: 120 };
      socketHandler('exec_step_update')!(ev);

      expect(component.steps().length).toBe(1);
      expect(component.steps()[0].result).toBe('PASS');
      expect(component.stats().pass).toBe(1);
      expect(component.stats().running).toBe(0);
      expect(component.stats().total).toBe(1);
      expect(component.stages()[0].state).toBe('done');
      expect(component.stages()[1].state).toBe('running');
    });

    it('merges a later update for the same stepIndex instead of duplicating', () => {
      socketHandler('exec_step_update')!({ stepIndex: 0, action: 'click #btn', result: 'RUNNING' });
      socketHandler('exec_step_update')!({ stepIndex: 0, action: 'click #btn', result: 'PASS', durationMs: 55 });

      expect(component.steps().length).toBe(1);
      expect(component.steps()[0].result).toBe('PASS');
      expect(component.steps()[0].durationMs).toBe(55);
    });

    it('keeps steps sorted by stepIndex and tallies mixed results', () => {
      socketHandler('exec_step_update')!({ stepIndex: 1, action: 'b', result: 'FAIL' });
      socketHandler('exec_step_update')!({ stepIndex: 0, action: 'a', result: 'PASS' });

      expect(component.steps().map(s => s.stepIndex)).toEqual([0, 1]);
      expect(component.stats().pass).toBe(1);
      expect(component.stats().fail).toBe(1);
      expect(component.stats().total).toBe(2);
    });
  });

  describe('socket event: batch_progress', () => {
    beforeEach(() => {
      configure({ batchId: 'batch1', projectId: 'p1' });
      fixture.detectChanges();
      execSvc.getBatchDetail.calls.reset();
    });

    it('updates the batchProgress signal', () => {
      const data = { batchId: 'batch1', pass: 1, fail: 0, total: 3, done: 1 };
      socketHandler('batch_progress')!(data);
      expect(component.batchProgress()).toEqual(data as any);
    });

    it('subscribes to the current scenario execution and resets the step console when it changes', () => {
      socketHandler('batch_progress')!({
        batchId: 'batch1', pass: 0, fail: 0, total: 3, done: 0,
        currentScenario: 'Login flow', currentExecutionId: 'e1',
      });

      expect(fakeSocket.emit).toHaveBeenCalledWith('subscribe', { executionId: 'e1' });
      expect((component as any).currentBatchExecId).toBe('e1');
      expect(component.steps()).toEqual([]);
      expect(component.logs().some(l => l.msg === 'Login flow')).toBeTrue();
    });

    it('unsubscribes from the previous execution before subscribing to the next one', () => {
      socketHandler('batch_progress')!({
        batchId: 'batch1', pass: 0, fail: 0, total: 3, done: 1,
        currentScenario: 'Scenario A', currentExecutionId: 'e1',
      });
      fakeSocket.emit.calls.reset();

      socketHandler('batch_progress')!({
        batchId: 'batch1', pass: 1, fail: 0, total: 3, done: 2,
        currentScenario: 'Scenario B', currentExecutionId: 'e2',
      });

      expect(fakeSocket.emit).toHaveBeenCalledWith('unsubscribe', { executionId: 'e1' });
      expect(fakeSocket.emit).toHaveBeenCalledWith('subscribe', { executionId: 'e2' });
      expect((component as any).currentBatchExecId).toBe('e2');
    });

    it('does not re-subscribe when the currentExecutionId is unchanged', () => {
      socketHandler('batch_progress')!({
        batchId: 'batch1', pass: 0, fail: 0, total: 3, done: 1,
        currentScenario: 'Scenario A', currentExecutionId: 'e1',
      });
      fakeSocket.emit.calls.reset();

      socketHandler('batch_progress')!({
        batchId: 'batch1', pass: 0, fail: 0, total: 3, done: 1,
        currentScenario: 'Scenario A', currentExecutionId: 'e1',
      });

      expect(fakeSocket.emit).not.toHaveBeenCalledWith('subscribe', jasmine.anything());
    });

    it('shows the report and reloads batch detail once the batch is DONE', () => {
      socketHandler('batch_progress')!({ batchId: 'batch1', pass: 2, fail: 0, total: 2, done: 2, status: 'DONE' });
      expect(component.showReport()).toBeTrue();
      expect(execSvc.getBatchDetail).toHaveBeenCalledWith('p1', 'batch1');
    });
  });

  describe('socket event: exec_complete', () => {
    const artifacts = [
      { type: 'SCREENSHOT' as const, url: '/files/shot.png' },
      { type: 'VIDEO' as const, url: '/files/vid.mp4' },
      { type: 'TRACE' as const, url: '/files/trace.zip' },
    ];
    const completeEvent: ExecCompleteEvent = {
      executionId: 'exec1', result: 'PASS', durationMs: 4200,
      stats: { pass: 3, fail: 0, skipped: 0, total: 3 },
      errorMessage: null, artifacts,
    };

    it('in single mode: updates result/stats/artifacts, advances stages, shows the report, disconnects and triggers AI analysis', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();

      socketHandler('exec_complete')!(completeEvent);

      expect(component.result()).toBe('PASS');
      expect(component.stats()).toEqual({ pass: 3, fail: 0, running: 0, skipped: 0, total: 3 });
      expect(component.durationMs()).toBe(4200);
      expect(component.errorMessage()).toBeNull();
      expect(component.screenshotUrl()).toBe('http://localhost:3000/files/shot.png');
      expect(component.videoUrl()).toBe('http://localhost:3000/files/vid.mp4');
      expect(component.traceUrl()).toBe('https://trace.playwright.dev/?trace=/files/trace.zip');
      expect(component.stages()[component.stages().length - 1].state).toBe('done');
      expect(component.showReport()).toBeTrue();
      expect(fakeSocket.disconnect).toHaveBeenCalled();
      expect(execSvc.analyzeExecution).toHaveBeenCalledWith('exec1');
    });

    it('sets the last stage to "fail" when the result is not PASS', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
      socketHandler('exec_complete')!({ ...completeEvent, result: 'FAIL' });
      expect(component.stages()[component.stages().length - 1].state).toBe('fail');
    });

    it('loads steps from the API when no step updates were received yet', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
      socketHandler('exec_complete')!(completeEvent);
      expect(execSvc.getSteps).toHaveBeenCalledWith('exec1');
    });

    it('does not reload steps when steps were already tracked via socket updates', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
      socketHandler('exec_step_update')!({ stepIndex: 0, action: 'a', result: 'PASS' });
      execSvc.getSteps.calls.reset();
      socketHandler('exec_complete')!(completeEvent);
      expect(execSvc.getSteps).not.toHaveBeenCalled();
    });

    it('in batch mode: only logs the per-scenario result and does not touch the global result/stats', () => {
      configure({ batchId: 'batch1', projectId: 'p1' });
      fixture.detectChanges();
      const before = component.result();

      socketHandler('exec_complete')!(completeEvent);

      expect(component.result()).toBe(before);
      expect(component.logs().some(l => l.level === 'pass' && l.msg.includes('Scénario terminé'))).toBeTrue();
      expect(fakeSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('socket event: connect_error', () => {
    it('logs a connection-lost error message', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
      socketHandler('connect_error')!();
      expect(component.logs().some(l => l.level === 'error' && l.msg === 'Connexion au serveur perdue.')).toBeTrue();
    });
  });

  // ── analyzeWithAi ─────────────────────────────────────────────────────────

  describe('analyzeWithAi', () => {
    beforeEach(() => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
    });

    it('does nothing when there is no executionId', () => {
      component.executionId.set(null);
      component.analyzeWithAi();
      expect(execSvc.analyzeExecution).not.toHaveBeenCalled();
    });

    it('sets aiAnalysis and clears the loading flag on success', () => {
      component.analyzeWithAi();
      expect(component.analyzingAi()).toBeFalse();
      expect(component.aiAnalysis()).toEqual(baseAiAnalysis);
    });

    it('alerts and clears the loading flag on failure', () => {
      spyOn(window, 'alert');
      execSvc.analyzeExecution.and.returnValue(throwError(() => new Error('boom')));
      component.analyzeWithAi();
      expect(component.analyzingAi()).toBeFalse();
      expect(window.alert).toHaveBeenCalledWith("Erreur lors de l'analyse IA.");
    });
  });

  // ── pure getters / methods ────────────────────────────────────────────────

  describe('causeLabelFr / causeIconFr', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    it('maps every known category to a French label, with a raw fallback', () => {
      expect(component.causeLabelFr('APPLICATION_BUG')).toBe('Bug application');
      expect(component.causeLabelFr('SCRIPT_ISSUE')).toBe('Script/sélecteur');
      expect(component.causeLabelFr('ENVIRONMENT')).toBe('Environnement');
      expect(component.causeLabelFr('TIMING')).toBe('Timing');
      expect(component.causeLabelFr('UNKNOWN')).toBe('Indéterminé');
      expect(component.causeLabelFr('X')).toBe('X');
    });

    it('maps every known category to an icon, with a fallback icon', () => {
      expect(component.causeIconFr('APPLICATION_BUG')).toBe('fa-bug');
      expect(component.causeIconFr('SCRIPT_ISSUE')).toBe('fa-file-code');
      expect(component.causeIconFr('ENVIRONMENT')).toBe('fa-globe');
      expect(component.causeIconFr('TIMING')).toBe('fa-stopwatch');
      expect(component.causeIconFr('UNKNOWN')).toBe('fa-circle-question');
      expect(component.causeIconFr('X')).toBe('fa-circle-question');
    });
  });

  describe('progress getters', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    it('progress is 0 when there is no total', () => {
      expect(component.progress).toBe(0);
    });

    it('progress computes the percentage of pass+fail+skipped over total', () => {
      component.stats.set({ pass: 1, fail: 1, running: 2, skipped: 0, total: 4 });
      expect(component.progress).toBe(50);
    });

    it('batchProgress_pct is 0 without a batch in progress', () => {
      expect(component.batchProgress_pct).toBe(0);
    });

    it('batchProgress_pct computes done/total as a percentage', () => {
      component.batchProgress.set({ batchId: 'b1', pass: 3, fail: 0, total: 10, done: 3 });
      expect(component.batchProgress_pct).toBe(30);
    });

    it('batchPassRate is 0 without a batch in progress', () => {
      expect(component.batchPassRate).toBe(0);
    });

    it('batchPassRate computes pass/total as a percentage', () => {
      component.batchProgress.set({ batchId: 'b1', pass: 3, fail: 1, total: 10, done: 4 });
      expect(component.batchPassRate).toBe(30);
    });
  });

  describe('duration helpers', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    it('durationLabel delegates to ExecutionService.formatDuration with the current durationMs', () => {
      component.durationMs.set(2500);
      expect(component.durationLabel).toBe('2.5s');
      expect(execSvc.formatDuration).toHaveBeenCalledWith(2500);
    });

    it('formatDuration() method delegates to ExecutionService', () => {
      expect(component.formatDuration(500)).toBe('500ms');
    });

    it('getBatchTotalDuration delegates using the batch durationMs, or null when no batch', () => {
      expect(component.getBatchTotalDuration()).toBe('—');
      component.batchProgress.set({ batchId: 'b1', pass: 1, fail: 0, total: 1, done: 1, durationMs: 6000 });
      expect(component.getBatchTotalDuration()).toBe('6.0s');
    });
  });

  describe('passSteps / failSteps', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    it('filter the steps signal by result', () => {
      component.steps.set([
        { stepIndex: 0, action: 'a', result: 'PASS' },
        { stepIndex: 1, action: 'b', result: 'FAIL' },
        { stepIndex: 2, action: 'c', result: 'PASS' },
      ] as ExecutionStep[]);
      expect(component.passSteps.length).toBe(2);
      expect(component.failSteps.length).toBe(1);
    });
  });

  describe('batch report helpers', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    const scenarioExec = (over: Partial<BatchScenarioExecution> = {}): BatchScenarioExecution => ({
      id: 'e1', result: 'FAIL', durationMs: 1000, passCount: 1, failCount: 1, totalCount: 2,
      errorMessage: 'boom', scenario: { id: 's1', name: 'S1', type: 'POSITIVE' },
      steps: [
        { stepIndex: 0, action: 'a', result: 'PASS' },
        { stepIndex: 1, action: 'b', result: 'FAIL' },
      ],
      artifacts: [],
      ...over,
    });

    it('getExecScreenshotUrl returns a built url when a screenshot artifact exists', () => {
      const shot = { id: 'a1', type: 'SCREENSHOT' as const, filePath: '/f/s.png', createdAt: '' };
      execSvc.findArtifact.and.returnValue(shot);
      const url = component.getExecScreenshotUrl(scenarioExec());
      expect(execSvc.getArtifactUrl).toHaveBeenCalledWith('/f/s.png');
      expect(url).toBe('http://localhost:3000/f/s.png');
    });

    it('getExecScreenshotUrl returns null when there is no screenshot artifact', () => {
      execSvc.findArtifact.and.returnValue(undefined);
      expect(component.getExecScreenshotUrl(scenarioExec())).toBeNull();
    });

    it('getFailedSteps filters only FAIL steps', () => {
      expect(component.getFailedSteps(scenarioExec()).length).toBe(1);
      expect(component.getFailedSteps(scenarioExec()).every(s => s.result === 'FAIL')).toBeTrue();
    });
  });

  // ── UI-triggered actions ──────────────────────────────────────────────────

  describe('toggleStep / toggleScenarioDetail', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    it('toggleStep flips the expanded step index', () => {
      component.toggleStep(2);
      expect(component.expandedStep()).toBe(2);
      component.toggleStep(2);
      expect(component.expandedStep()).toBeNull();
    });

    it('toggleScenarioDetail flips the expanded scenario id', () => {
      component.toggleScenarioDetail('s1');
      expect(component.expandedScenario()).toBe('s1');
      component.toggleScenarioDetail('s1');
      expect(component.expandedScenario()).toBeNull();
    });
  });

  describe('goBack / goToHistory', () => {
    it('navigates to the project scenarios page when a projectId is set', () => {
      configure({ executionId: 'exec1', projectId: 'p1' });
      fixture.detectChanges();
      component.goBack();
      expect(router.navigate).toHaveBeenCalledWith(['/projects', 'p1', 'scenarios']);
      component.goToHistory();
      expect(router.navigate).toHaveBeenCalledWith(['/projects', 'p1', 'history']);
    });

    it('falls back to the generic routes without a projectId', () => {
      configure({ executionId: 'exec1' });
      fixture.detectChanges();
      component.goBack();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
      component.goToHistory();
      expect(router.navigate).toHaveBeenCalledWith(['/history']);
    });
  });

  describe('openTraceViewer', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    it('opens the trace url in a new tab when present', () => {
      spyOn(window, 'open');
      component.traceUrl.set('https://trace.playwright.dev/?trace=x');
      component.openTraceViewer();
      expect(window.open).toHaveBeenCalledWith('https://trace.playwright.dev/?trace=x', '_blank');
    });

    it('does nothing without a trace url', () => {
      spyOn(window, 'open');
      component.openTraceViewer();
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('Jira ticket modal integration', () => {
    beforeEach(() => { configure({ executionId: 'exec1' }); fixture.detectChanges(); });

    it('openJiraModal opens the modal with the current executionId', () => {
      const openSpy = jasmine.createSpy('open');
      component.jiraModal = { open: openSpy } as any;
      component.openJiraModal();
      expect(openSpy).toHaveBeenCalledWith('exec1');
    });

    it('openJiraModal does nothing without an executionId', () => {
      const openSpy = jasmine.createSpy('open');
      component.jiraModal = { open: openSpy } as any;
      component.executionId.set(null);
      component.openJiraModal();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('onJiraTicketCreated stores the returned ticket key/url', () => {
      component.onJiraTicketCreated({ key: 'QA-7', url: 'https://jira/QA-7', alreadyExisted: false });
      expect(component.jiraTicketKey()).toBe('QA-7');
      expect(component.jiraTicketUrl()).toBe('https://jira/QA-7');
    });
  });

  describe('exportSingleReport / exportBatchReport', () => {
    beforeEach(() => { configure({ executionId: 'exec1', batchId: 'batch1', projectId: 'p1' }); fixture.detectChanges(); });

    it('exportSingleReport exports the single report element with a scenario-based filename', async () => {
      const exportSpy = jasmine.createSpy('exportElementAsPdf').and.returnValue(Promise.resolve());
      __setExportElementAsPdfForTests(exportSpy);
      const el = document.createElement('div');
      (component as any).singleReportEl = { nativeElement: el };
      await component.exportSingleReport();
      expect(exportSpy).toHaveBeenCalledWith(el, `rapport-${component.scenarioName()}.pdf`);
    });

    it('exportSingleReport does nothing when the report element is not present', async () => {
      const exportSpy = jasmine.createSpy('exportElementAsPdf').and.returnValue(Promise.resolve());
      __setExportElementAsPdfForTests(exportSpy);
      (component as any).singleReportEl = undefined;
      await component.exportSingleReport();
      expect(exportSpy).not.toHaveBeenCalled();
    });

    it('exportBatchReport exports the batch report element with a batchId-based filename', async () => {
      const exportSpy = jasmine.createSpy('exportElementAsPdf').and.returnValue(Promise.resolve());
      __setExportElementAsPdfForTests(exportSpy);
      const el = document.createElement('div');
      (component as any).batchReportEl = { nativeElement: el };
      await component.exportBatchReport();
      expect(exportSpy).toHaveBeenCalledWith(el, `rapport-batch-${component.batchId()}.pdf`);
    });
  });
});
