import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

import { HistoryComponent } from './history.component';
import { ExecutionService, HistoryRun, HistoryResponse, ExecutionArtifact, ExecutionStep, GlobalStats } from '../../services/execution.service';
import { __setPdfReportForTests, __resetPdfReport } from '../../shared/utils/pdf-report';

describe('HistoryComponent', () => {
  let component: HistoryComponent;
  let fixture: ComponentFixture<HistoryComponent>;
  let svc: jasmine.SpyObj<ExecutionService>;

  const makeStep = (over: Partial<ExecutionStep> = {}): ExecutionStep => ({
    stepIndex: 0, action: 'click', result: 'PASS', ...over,
  });

  const makeArtifact = (over: Partial<ExecutionArtifact> = {}): ExecutionArtifact => ({
    id: 'a1', type: 'SCREENSHOT', filePath: '/files/shot.png', createdAt: '2024-01-01T00:00:00.000Z', ...over,
  });

  const makeRun = (over: Partial<HistoryRun> = {}): HistoryRun => ({
    id: 'r1',
    result: 'PASS',
    durationMs: 1500,
    passCount: 3,
    failCount: 0,
    totalCount: 3,
    errorMessage: null,
    startedAt: '2024-01-01T00:00:00.000Z',
    finishedAt: '2024-01-01T00:00:05.000Z',
    scenario: { id: 'sc1', name: 'Login', type: 'POSITIVE', projectId: 'p1', project: { name: 'Shop' } },
    steps: [makeStep({ stepIndex: 0, result: 'PASS' }), makeStep({ stepIndex: 1, result: 'FAIL', action: 'fill' })],
    artifacts: [makeArtifact()],
    ...over,
  });

  const historyResponse = (over: Partial<HistoryResponse> = {}): HistoryResponse => ({
    data: [makeRun()], total: 1, page: 1, limit: 20, totalPages: 1, ...over,
  });

  function configure(routeStub: any = { snapshot: { params: {}, queryParams: {} } }) {
    svc = jasmine.createSpyObj<ExecutionService>('ExecutionService', [
      'getHistory', 'computeStats', 'findArtifact', 'getArtifactUrl', 'getTraceViewerUrl',
      'getPassWidth', 'getFailWidth', 'getRate', 'getTypeClass', 'getTypeLabel', 'formatDuration',
    ]);
    svc.getHistory.and.returnValue(of(historyResponse()));
    svc.computeStats.and.returnValue({ totalRuns: 1, passRate: 100, failedRuns: 0, avgDuration: 2, jiraBugs: 0 } as GlobalStats);
    svc.findArtifact.and.callFake((artifacts: ExecutionArtifact[], type) => artifacts.find(a => a.type === type));
    svc.getArtifactUrl.and.callFake((p: string) => `http://localhost:3000${p}`);
    svc.getTraceViewerUrl.and.callFake((p: string) => `https://trace.playwright.dev/?trace=${p}`);
    svc.getPassWidth.and.returnValue(100);
    svc.getFailWidth.and.returnValue(0);
    svc.getRate.and.returnValue(100);
    svc.getTypeClass.and.returnValue('positive');
    svc.getTypeLabel.and.returnValue('POSITIF');
    svc.formatDuration.and.callFake((ms: number | null | undefined) => !ms ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

    TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [
        { provide: ExecutionService, useValue: svc },
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    __resetPdfReport();
  });

  describe('ngOnInit / loadHistory', () => {
    it('reads projectId from route params and loads history on init', () => {
      configure({ snapshot: { params: { id: 'p1' }, queryParams: {} } });
      fixture.detectChanges();

      expect(component).toBeTruthy();
      expect(component.projectId).toBe('p1');
      expect(svc.getHistory).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1, limit: 20, projectId: 'p1' }));
      expect(component.runs().length).toBe(1);
      expect(component.totalRuns).toBe(1);
      expect(component.totalPages).toBe(1);
      expect(component.globalStats().passRate).toBe(100);
      expect(component.loading()).toBeFalse();
    });

    it('falls back to the projectId query param when no route param is present', () => {
      configure({ snapshot: { params: {}, queryParams: { projectId: 'p2' } } });
      fixture.detectChanges();
      expect(component.projectId).toBe('p2');
    });

    it('defaults projectId to empty string when neither is present', () => {
      configure();
      fixture.detectChanges();
      expect(component.projectId).toBe('');
    });

    it('sets loading false and does not throw when the request fails', () => {
      configure();
      svc.getHistory.and.returnValue(throwError(() => new Error('network down')));
      fixture.detectChanges();
      expect(component.loading()).toBeFalse();
      expect(component.runs()).toEqual([]);
    });
  });

  describe('toggleRun / toggleStep', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('toggleRun expands then collapses a run, resetting expandedStep', () => {
      component.expandedStep.set(2);
      component.toggleRun('r1');
      expect(component.expandedRun()).toBe('r1');
      expect(component.expandedStep()).toBeNull();

      component.toggleRun('r1');
      expect(component.expandedRun()).toBeNull();
    });

    it('toggleStep flips the expanded step index', () => {
      component.toggleStep(3);
      expect(component.expandedStep()).toBe(3);
      component.toggleStep(3);
      expect(component.expandedStep()).toBeNull();
    });
  });

  describe('artifact helpers', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('openImage opens the given url in a new tab', () => {
      spyOn(window, 'open');
      component.openImage('http://x/img.png');
      expect(window.open).toHaveBeenCalledWith('http://x/img.png', '_blank');
    });

    it('openTrace opens the trace viewer url when a TRACE artifact exists', () => {
      spyOn(window, 'open');
      const run = makeRun({ artifacts: [makeArtifact({ type: 'TRACE', filePath: '/files/trace.zip' })] });
      component.openTrace(run);
      expect(svc.getTraceViewerUrl).toHaveBeenCalledWith('/files/trace.zip');
      expect(window.open).toHaveBeenCalledWith('https://trace.playwright.dev/?trace=/files/trace.zip', '_blank');
    });

    it('openTrace does nothing when there is no TRACE artifact', () => {
      spyOn(window, 'open');
      component.openTrace(makeRun({ artifacts: [] }));
      expect(window.open).not.toHaveBeenCalled();
    });

    it('hasTrace / hasVideo reflect artifact presence', () => {
      expect(component.hasTrace(makeRun({ artifacts: [makeArtifact({ type: 'TRACE' })] }))).toBeTrue();
      expect(component.hasTrace(makeRun({ artifacts: [] }))).toBeFalse();
      expect(component.hasVideo(makeRun({ artifacts: [makeArtifact({ type: 'VIDEO' })] }))).toBeTrue();
      expect(component.hasVideo(makeRun({ artifacts: [] }))).toBeFalse();
    });

    it('getScreenshotUrl / getVideoUrl return built urls or null', () => {
      const run = makeRun({ artifacts: [makeArtifact({ type: 'SCREENSHOT', filePath: '/f/s.png' })] });
      expect(component.getScreenshotUrl(run)).toBe('http://localhost:3000/f/s.png');
      expect(component.getVideoUrl(run)).toBeNull();
    });
  });

  describe('filters and pagination actions', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); svc.getHistory.calls.reset(); });

    it('applyFilters resets to page 1 and reloads', () => {
      component.currentPage = 4;
      component.applyFilters();
      expect(component.currentPage).toBe(1);
      expect(svc.getHistory).toHaveBeenCalled();
    });

    it('resetFilters clears all filters, resets page and reloads', () => {
      component.filterStatus = 'FAIL';
      component.filterSearch = 'x';
      component.filterDateFrom = '2024-01-01';
      component.filterDateTo = '2024-02-01';
      component.currentPage = 3;

      component.resetFilters();

      expect(component.filterStatus).toBe('');
      expect(component.filterSearch).toBe('');
      expect(component.filterDateFrom).toBe('');
      expect(component.filterDateTo).toBe('');
      expect(component.currentPage).toBe(1);
      expect(svc.getHistory).toHaveBeenCalled();
    });

    it('goToPage ignores out-of-range pages', () => {
      component.totalPages = 5;
      component.currentPage = 2;
      component.goToPage(0);
      component.goToPage(6);
      expect(component.currentPage).toBe(2);
      expect(svc.getHistory).not.toHaveBeenCalled();
    });

    it('goToPage navigates to a valid page and reloads', () => {
      component.totalPages = 5;
      component.goToPage(3);
      expect(component.currentPage).toBe(3);
      expect(svc.getHistory).toHaveBeenCalled();
    });
  });

  describe('service-delegating helpers', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('delegates width/rate/type/duration helpers to ExecutionService', () => {
      const run = makeRun();
      expect(component.getPassWidth(run)).toBe(100);
      expect(component.getFailWidth(run)).toBe(0);
      expect(component.getRate(run)).toBe(100);
      expect(component.getTypeClass('POSITIVE')).toBe('positive');
      expect(component.getTypeLabel('POSITIVE')).toBe('POSITIF');
      expect(component.formatDuration(1500)).toBe('1.5s');
      expect(svc.getPassWidth).toHaveBeenCalledWith(run);
    });
  });

  describe('step helpers', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('getPassSteps / getFailSteps filter by result', () => {
      const run = makeRun();
      expect(component.getPassSteps(run).length).toBe(1);
      expect(component.getFailSteps(run).length).toBe(1);
    });

    it('getFirstFailedStep returns the action of the first FAIL step, or empty string', () => {
      const run = makeRun();
      expect(component.getFirstFailedStep(run)).toBe('fill');
      expect(component.getFirstFailedStep(makeRun({ steps: [] }))).toBe('');
    });
  });

  describe('causeLabelFr / causeIconFr', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('maps every known cause category to a French label', () => {
      expect(component.causeLabelFr('APPLICATION_BUG')).toBe('Bug application');
      expect(component.causeLabelFr('SCRIPT_ISSUE')).toBe('Script/sélecteur');
      expect(component.causeLabelFr('ENVIRONMENT')).toBe('Environnement');
      expect(component.causeLabelFr('TIMING')).toBe('Timing');
      expect(component.causeLabelFr('UNKNOWN')).toBe('Indéterminé');
    });

    it('falls back to the raw category for an unknown value', () => {
      expect(component.causeLabelFr('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
    });

    it('maps every known cause category to an icon, with a fallback', () => {
      expect(component.causeIconFr('APPLICATION_BUG')).toBe('fa-bug');
      expect(component.causeIconFr('SCRIPT_ISSUE')).toBe('fa-file-code');
      expect(component.causeIconFr('ENVIRONMENT')).toBe('fa-globe');
      expect(component.causeIconFr('TIMING')).toBe('fa-stopwatch');
      expect(component.causeIconFr('UNKNOWN')).toBe('fa-circle-question');
      expect(component.causeIconFr('NOPE')).toBe('fa-circle-question');
    });
  });

  describe('exportRunReport', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('builds a report VM from the run and delegates to generateSingleReportPdf', async () => {
      const singleSpy = jasmine.createSpy('generateSingleReportPdf').and.returnValue(Promise.resolve());
      __setPdfReportForTests({ single: singleSpy });
      const run = makeRun();

      await component.exportRunReport(run);

      expect(singleSpy).toHaveBeenCalledWith(jasmine.objectContaining({
        projectName: 'Shop',
        executedAt: run.finishedAt,
        scenario: jasmine.objectContaining({
          scenarioName: 'Login', result: 'PASS', passCount: 3, failCount: 0, totalCount: 3,
        }),
      }));
    });
  });

  describe('pages / isEllipsis / pageRangeStart / pageRangeEnd', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('returns the full range without ellipsis for a small number of pages', () => {
      component.totalPages = 3;
      component.currentPage = 1;
      expect(component.pages).toEqual([1, 2, 3]);
    });

    it('inserts ellipsis for a larger range around the current page', () => {
      component.totalPages = 10;
      component.currentPage = 5;
      const pages = component.pages;
      expect(pages[0]).toBe(1);
      expect(pages).toContain('...');
      expect(pages[pages.length - 1]).toBe(10);
      expect(pages).toContain(4);
      expect(pages).toContain(5);
      expect(pages).toContain(6);
    });

    it('isEllipsis narrows the union correctly', () => {
      expect(component.isEllipsis('...')).toBeTrue();
      expect(component.isEllipsis(2)).toBeFalse();
    });

    it('pageRangeStart / pageRangeEnd compute the visible slice', () => {
      component.totalRuns = 45;
      component.pageSize = 20;
      component.currentPage = 2;
      expect(component.pageRangeStart()).toBe(21);
      expect(component.pageRangeEnd()).toBe(40);
    });

    it('pageRangeStart is 0 and pageRangeEnd is capped when there are no runs', () => {
      component.totalRuns = 0;
      expect(component.pageRangeStart()).toBe(0);
      expect(component.pageRangeEnd()).toBe(0);
    });
  });

  describe('Jira ticket modal integration', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('openJiraModal remembers the run id and opens the modal', () => {
      const openSpy = jasmine.createSpy('open');
      component.jiraModal = { open: openSpy } as any;
      component.openJiraModal(makeRun({ id: 'r9' }));
      expect(openSpy).toHaveBeenCalledWith('r9');
    });

    it('onJiraTicketCreated patches the matching run with the ticket key/url', () => {
      const openSpy = jasmine.createSpy('open');
      component.jiraModal = { open: openSpy } as any;
      component.runs.set([makeRun({ id: 'r1' }), makeRun({ id: 'r2' })]);
      component.openJiraModal(component.runs()[0]);

      component.onJiraTicketCreated({ key: 'QA-42', url: 'https://jira/QA-42', alreadyExisted: false });

      const updated = component.runs().find(r => r.id === 'r1');
      expect(updated?.jiraTicketKey).toBe('QA-42');
      expect(updated?.jiraTicketUrl).toBe('https://jira/QA-42');
      expect(component.runs().find(r => r.id === 'r2')?.jiraTicketKey).toBeUndefined();
    });

    it('onJiraTicketCreated does nothing if no modal run id was recorded', () => {
      component.runs.set([makeRun({ id: 'r1' })]);
      component.onJiraTicketCreated({ key: 'QA-1', url: 'u', alreadyExisted: false });
      expect(component.runs()[0].jiraTicketKey).toBeUndefined();
    });
  });
});
