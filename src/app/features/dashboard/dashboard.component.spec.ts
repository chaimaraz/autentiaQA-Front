import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';

const summaryFixture: DashboardSummary = {
  scope: 'member',
  generatedAt: '2026-01-01T00:00:00.000Z',
  kpis: {
    activeProjects: 5,
    totalProjects: 6,
    totalScenarios: 42,
    totalExecutions: 120,
    passRate: 87,
    passRateDeltaPct: 3,
    openFailures: 2,
  },
  resultBreakdown: [
    { result: 'PASS', count: 100, pct: 83 },
    { result: 'FAIL', count: 20, pct: 17 },
  ],
  trend: [
    { date: '2026-01-01', total: 10, pass: 9, fail: 1, passRate: 90 },
  ],
  projects: [
    { id: 'p1', name: 'Projet 1', status: 'ACTIVE', framework: 'web', createdAt: '2026-01-01T00:00:00.000Z', executionCount: 10, passRate: 90, lastExecutionAt: '2026-01-01T00:00:00.000Z', scenarioCount: 5 },
    { id: 'p2', name: 'Projet 2', status: 'DRAFT', framework: 'web', createdAt: '2026-01-01T00:00:00.000Z', executionCount: 4, passRate: 50, lastExecutionAt: null, scenarioCount: 2 },
    { id: 'p3', name: 'Projet 3', status: 'ARCHIVED', framework: 'web', createdAt: '2026-01-01T00:00:00.000Z', executionCount: 8, passRate: 75, lastExecutionAt: '2026-01-01T00:00:00.000Z', scenarioCount: 3 },
  ],
  recentActivity: [
    { id: 'a1', result: 'PASS', scenarioName: 'S1', projectId: 'p1', projectName: 'Projet 1', userName: 'Alice', occurredAt: new Date().toISOString() },
    { id: 'a2', result: 'FAIL', scenarioName: 'S2', projectId: 'p1', projectName: 'Projet 1', userName: 'Bob', occurredAt: new Date().toISOString() },
    { id: 'a3', result: 'ERROR', scenarioName: 'S3', projectId: 'p2', projectName: 'Projet 2', userName: null, occurredAt: new Date().toISOString() },
    { id: 'a4', result: 'RUNNING', scenarioName: 'S4', projectId: 'p3', projectName: 'Projet 3', userName: 'Alice', occurredAt: new Date().toISOString() },
  ],
};

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let dashboardSvc: jasmine.SpyObj<DashboardService>;

  async function setup(summary$ = of(summaryFixture)) {
    TestBed.resetTestingModule();
    const router = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    // RouterLink needs these to render its href — the spy needs harmless stand-ins.
    (router as any).events = of();
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/');

    dashboardSvc = jasmine.createSpyObj('DashboardService', ['getSummary']);
    dashboardSvc.getSummary.and.returnValue(summary$);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideCharts(withDefaultRegisterables()),
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
        { provide: DashboardService, useValue: dashboardSvc },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('stats', () => {
    it('exposes 4 stat cards with the expected labels for a member-scoped summary', () => {
      expect(component.statCards().length).toBe(4);
      expect(component.statCards().map(s => s.label)).toEqual([
        'Projets actifs', 'Taux de réussite', 'Scénarios', 'Échecs à traiter',
      ]);
    });

    it('renders one .stat-card element per stat', () => {
      const cards = fixture.nativeElement.querySelectorAll('.stat-card');
      expect(cards.length).toBe(4);
    });
  });

  describe('projects', () => {
    it('exposes the projects returned by the dashboard summary', () => {
      expect(component.projects().length).toBe(3);
      expect(component.projects().map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
      expect(component.projects().map(p => p.status)).toEqual(['ACTIVE', 'DRAFT', 'ARCHIVED']);
    });
  });

  describe('recentActivity', () => {
    it('exposes 4 activity entries mapped with their result label and icon', () => {
      const activity = component.recentActivity();
      expect(activity.length).toBe(4);
      expect(activity[0].resultLabel).toBe('Réussi');
      expect(activity[0].icon).toBe('fa-circle-check');
      expect(activity[1].resultLabel).toBe('Échec');
    });

    it('applies the ngClass icon binding on each activity icon element', () => {
      const icons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.activity-icon i'));
      expect(icons.length).toBe(4);
      component.recentActivity().forEach((a, i) => {
        expect(icons[i].classList.contains(a.icon)).toBeTrue();
        // base class from the template is always present alongside the dynamic ngClass icon
        expect(icons[i].classList.contains('fa-solid')).toBeTrue();
      });
    });
  });

  describe('error handling', () => {
    it('surfaces the error message and stops loading when the summary request fails', async () => {
      await setup(throwError(() => new Error('Impossible de charger le dashboard.')));
      expect(component.loading()).toBeFalse();
      expect(component.error()).toBe('Impossible de charger le dashboard.');
    });
  });
});
