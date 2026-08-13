import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';

import { ScenariosComponent } from './scenarios.component';
import { ScenarioService, PaginatedScenarios } from '../../services/scenario.service';
import { ExecutionConfigResult } from '../../shared/components/execution-config-modal/execution-config-modal.component';

describe('ScenariosComponent', () => {
  let component: ScenariosComponent;
  let fixture: ComponentFixture<ScenariosComponent>;
  let svc: jasmine.SpyObj<ScenarioService>;
  let router: jasmine.SpyObj<Router>;

  const paginatedResponse = (overrides: Partial<PaginatedScenarios> = {}): PaginatedScenarios => ({
    success: true,
    data: [
      {
        id: 's1',
        projectId: 'p1',
        name: 'Scenario 1',
        type: 'POSITIVE',
        creationMode: 'NLP',
        scriptTemplate: '',
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        variables: [{ id: 'v1', key: 'k1', value: 'v1', isSecret: false, locked: false }],
        _count: { executions: 2 },
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  });

  beforeEach(async () => {
    svc = jasmine.createSpyObj('ScenarioService', [
      'getAll', 'execute', 'executeAll', 'remove',
      'regenerateAllVariablesServerSide', 'regenerateOneVariable', 'setVariableLock',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    // RouterLink subscribes to router.events — the spy needs an observable there.
    (router as any).events = of();

    svc.getAll.and.returnValue(of(paginatedResponse()));

    await TestBed.configureTestingModule({
      imports: [ScenariosComponent],
      providers: [
        provideHttpClient(),
        { provide: ScenarioService, useValue: svc },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { id: 'p1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScenariosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load scenarios on init', () => {
    expect(component).toBeTruthy();
    expect(component.projectId).toBe('p1');
    expect(svc.getAll).toHaveBeenCalled();
    expect(component.scenarios.length).toBe(1);
    expect(component.total).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('maps backend scenario to display shape correctly', () => {
    const display = component.scenarios[0];
    expect(display.id).toBe('s1');
    expect(display.type).toBe('pos');
    expect(display.typeLabel).toBe('POSITIF');
    expect(display.typeClass).toBe('positive');
    expect(display.status).toBe('ACTIVE');
    expect(display.mode).toBe('NLP');
    expect(display.data).toEqual([{ id: 'v1', k: 'k1', v: 'v1', locked: false }]);
    expect(display.execCount).toBe(2);
  });

  it('sets loading false and keeps scenarios empty on load error', () => {
    svc.getAll.and.returnValue(throwError(() => new Error('fail')));
    component.loadScenarios();
    expect(component.loading).toBeFalse();
  });

  describe('ngOnDestroy', () => {
    it('completes the destroy subject', () => {
      const destroy$ = (component as any).destroy$ as Subject<void>;
      spyOn(destroy$, 'next');
      spyOn(destroy$, 'complete');
      component.ngOnDestroy();
      expect(destroy$.next).toHaveBeenCalled();
      expect(destroy$.complete).toHaveBeenCalled();
    });
  });

  describe('setTab', () => {
    it('updates the active tab, resets page and reloads', () => {
      component.currentPage = 3;
      svc.getAll.calls.reset();
      component.setTab('neg');
      expect(component.activeTab()).toBe('neg');
      expect(component.currentPage).toBe(1);
      expect(svc.getAll).toHaveBeenCalledWith('p1', jasmine.objectContaining({ type: 'NEGATIVE' }));
    });
  });

  describe('onSearch (debounced)', () => {
    it('debounces search and reloads after 350ms', fakeAsync(() => {
      svc.getAll.calls.reset();
      component.onSearch('hello');
      expect(component.searchQuery).toBe('hello');
      // Not yet triggered before debounce time elapses
      tick(100);
      expect(svc.getAll).not.toHaveBeenCalled();
      tick(300);
      expect(svc.getAll).toHaveBeenCalledTimes(1);
      expect(component.currentPage).toBe(1);
    }));

    it('distinctUntilChanged prevents duplicate reload for same value', fakeAsync(() => {
      component.onSearch('same');
      tick(350);
      svc.getAll.calls.reset();
      component.onSearch('same');
      tick(350);
      expect(svc.getAll).not.toHaveBeenCalled();
    }));

    it('clearSearch resets query, page and reloads', () => {
      component.searchQuery = 'abc';
      component.currentPage = 2;
      svc.getAll.calls.reset();
      component.clearSearch();
      expect(component.searchQuery).toBe('');
      expect(component.currentPage).toBe(1);
      expect(svc.getAll).toHaveBeenCalled();
    });
  });

  describe('pagination', () => {
    it('goToPage ignores out-of-range or same page', () => {
      component.totalPages = 5;
      component.currentPage = 2;
      svc.getAll.calls.reset();
      component.goToPage(0);
      component.goToPage(6);
      component.goToPage(2);
      expect(svc.getAll).not.toHaveBeenCalled();
      expect(component.currentPage).toBe(2);
    });

    it('goToPage navigates to a valid page', () => {
      component.totalPages = 5;
      component.currentPage = 2;
      svc.getAll.calls.reset();
      component.goToPage(4);
      expect(component.currentPage).toBe(4);
      expect(svc.getAll).toHaveBeenCalled();
    });

    it('onPageSizeChange updates page size, resets to page 1, reloads', () => {
      component.currentPage = 3;
      svc.getAll.calls.reset();
      component.onPageSizeChange(25);
      expect(component.pageSize()).toBe(25);
      expect(component.currentPage).toBe(1);
      expect(svc.getAll).toHaveBeenCalled();
    });

    it('pageStart / pageEnd compute correctly', () => {
      component.total = 42;
      component.currentPage = 2;
      component.pageSize.set(10);
      expect(component.pageStart).toBe(11);
      expect(component.pageEnd).toBe(20);
    });

    it('pageStart is 0 when there is no total', () => {
      component.total = 0;
      expect(component.pageStart).toBe(0);
    });

    describe('pages getter', () => {
      it('returns full range without ellipsis for small totals', () => {
        component.totalPages = 3;
        component.currentPage = 1;
        expect(component.pages).toEqual([1, 2, 3]);
      });

      it('inserts ellipsis for larger ranges', () => {
        component.totalPages = 10;
        component.currentPage = 5;
        const pages = component.pages;
        expect(pages[0]).toBe(1);
        expect(pages).toContain('...');
        expect(pages[pages.length - 1]).toBe(10);
      });

      it('isEllipsis narrows the union type correctly', () => {
        expect(component.isEllipsis('...')).toBeTrue();
        expect(component.isEllipsis(2)).toBeFalse();
      });
    });
  });

  describe('filters', () => {
    it('toggleFilters flips filtersOpen', () => {
      expect(component.filtersOpen).toBeFalse();
      component.toggleFilters();
      expect(component.filtersOpen).toBeTrue();
    });

    it('applyFilters resets page and reloads', () => {
      component.currentPage = 4;
      svc.getAll.calls.reset();
      component.applyFilters();
      expect(component.currentPage).toBe(1);
      expect(svc.getAll).toHaveBeenCalled();
    });

    it('resetFilters clears all filter state and reloads', () => {
      component.filterStatus.set('ACTIVE');
      component.filterMode.set('NLP');
      component.filterDateFrom = '2024-01-01';
      component.filterDateTo = '2024-02-01';
      component.searchQuery = 'q';
      component.currentPage = 3;
      svc.getAll.calls.reset();

      component.resetFilters();

      expect(component.filterStatus()).toBe('');
      expect(component.filterMode()).toBe('');
      expect(component.filterDateFrom).toBe('');
      expect(component.filterDateTo).toBe('');
      expect(component.searchQuery).toBe('');
      expect(component.currentPage).toBe(1);
      expect(svc.getAll).toHaveBeenCalled();
    });

    describe('activeFiltersCount', () => {
      it('is 0 with no filters applied', () => {
        expect(component.activeFiltersCount).toBe(0);
      });

      it('counts each active filter', () => {
        component.filterStatus.set('ACTIVE');
        component.filterMode.set('NLP');
        component.filterDateFrom = '2024-01-01';
        component.filterDateTo = '2024-02-01';
        component.searchQuery = 'q';
        expect(component.activeFiltersCount).toBe(5);
      });
    });
  });

  describe('toggleData', () => {
    it('flips dataOpen for a given scenario', () => {
      const s = component.scenarios[0];
      expect(s.dataOpen).toBeFalse();
      component.toggleData(s);
      expect(s.dataOpen).toBeTrue();
    });
  });

  describe('openAddModal / onScenarioSaved', () => {
    it('openAddModal calls open() on the child modal', () => {
      const openSpy = jasmine.createSpy('open');
      component.addModal = { open: openSpy } as any;
      component.openAddModal();
      expect(openSpy).toHaveBeenCalled();
    });

    it('onScenarioSaved resets page and reloads', () => {
      component.currentPage = 3;
      svc.getAll.calls.reset();
      component.onScenarioSaved({} as any);
      expect(component.currentPage).toBe(1);
      expect(svc.getAll).toHaveBeenCalled();
    });
  });

  describe('execution flow', () => {
    let openSpy: jasmine.Spy;

    beforeEach(() => {
      openSpy = jasmine.createSpy('open');
      component.execConfigModal = { open: openSpy } as any;
    });

    it('executeScenario stores pending scenario and opens modal in single mode', () => {
      const s = component.scenarios[0];
      component.executeScenario(s);
      expect((component as any).pendingScenario).toBe(s);
      expect(openSpy).toHaveBeenCalledWith(s.name, false);
    });

    it('executeAllScenarios clears pending scenario and opens modal in batch mode with scenario list', () => {
      component.executeAllScenarios();
      expect((component as any).pendingScenario).toBeNull();
      expect(openSpy).toHaveBeenCalledWith(
        'Tous les scénarios actifs',
        true,
        [{ id: 's1', name: 'Scenario 1' }],
      );
    });

    const captureConfig = { screenshotMode: 'ON_FAILURE', videoMode: 'NEVER', traceMode: 'ON_FAILURE' } as any;

    describe('onExecutionConfigConfirmed', () => {
      it('routes to _launchBatch when isBatch is true', () => {
        const batchSpy = spyOn<any>(component, '_launchBatch');
        const res: ExecutionConfigResult = { captureConfig, isBatch: true };
        component.onExecutionConfigConfirmed(res);
        expect(batchSpy).toHaveBeenCalledWith(res);
      });

      it('routes to _launchSingle when isBatch is false and a scenario is pending', () => {
        const singleSpy = spyOn<any>(component, '_launchSingle');
        const s = component.scenarios[0];
        (component as any).pendingScenario = s;
        const res: ExecutionConfigResult = { captureConfig, isBatch: false };
        component.onExecutionConfigConfirmed(res);
        expect(singleSpy).toHaveBeenCalledWith(s, res);
      });

      it('does nothing when isBatch is false and no scenario is pending', () => {
        const singleSpy = spyOn<any>(component, '_launchSingle');
        (component as any).pendingScenario = null;
        component.onExecutionConfigConfirmed({ captureConfig, isBatch: false });
        expect(singleSpy).not.toHaveBeenCalled();
      });
    });

    describe('_launchSingle', () => {
      it('executes and navigates to /execution on success', () => {
        const s = component.scenarios[0];
        svc.execute.and.returnValue(of({ id: 'exec1', scenarioId: s.id, result: 'RUNNING', startedAt: '' } as any));
        (component as any)._launchSingle(s, { captureConfig, isBatch: false });
        expect(component.executingOne()).toBeNull();
        expect(router.navigate).toHaveBeenCalledWith(['/execution'], {
          queryParams: { executionId: 'exec1', scenarioName: s.name, projectId: 'p1' },
        });
      });

      it('alerts and resets executingOne on error', () => {
        spyOn(window, 'alert');
        const s = component.scenarios[0];
        svc.execute.and.returnValue(throwError(() => new Error('boom')));
        (component as any)._launchSingle(s, { captureConfig, isBatch: false });
        expect(component.executingOne()).toBeNull();
        expect(window.alert).toHaveBeenCalledWith("Erreur lors du lancement de l'exécution.");
      });
    });

    describe('_launchBatch', () => {
      it('executes all and navigates to /execution with batchId on success', () => {
        svc.executeAll.and.returnValue(of({ id: 'batch1', projectId: 'p1', status: 'RUNNING', totalCount: 1 } as any));
        (component as any)._launchBatch({ captureConfig, isBatch: true, dataChoices: {} });
        expect(component.executingAll()).toBeFalse();
        expect(router.navigate).toHaveBeenCalledWith(['/execution'], {
          queryParams: { batchId: 'batch1', projectId: 'p1' },
        });
      });

      it('alerts and resets executingAll on error', () => {
        spyOn(window, 'alert');
        svc.executeAll.and.returnValue(throwError(() => new Error('boom')));
        (component as any)._launchBatch({ captureConfig, isBatch: true });
        expect(component.executingAll()).toBeFalse();
        expect(window.alert).toHaveBeenCalledWith("Erreur lors de l'exécution groupée.");
      });
    });
  });

  describe('deleteScenario', () => {
    it('does nothing when confirm is declined', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      svc.remove.calls.reset();
      component.deleteScenario(component.scenarios[0]);
      expect(svc.remove).not.toHaveBeenCalled();
    });

    it('removes the scenario and reloads on confirm + success', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      svc.remove.and.returnValue(of(undefined));
      svc.getAll.calls.reset();
      component.deleteScenario(component.scenarios[0]);
      expect(svc.remove).toHaveBeenCalledWith('p1', 's1');
      expect(svc.getAll).toHaveBeenCalled();
    });

    it('decrements currentPage when deleting the last item of a page beyond page 1', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      svc.remove.and.returnValue(of(undefined));
      component.currentPage = 2;
      component.scenarios = [component.scenarios[0]];
      component.deleteScenario(component.scenarios[0]);
      expect(component.currentPage).toBe(1);
    });

    it('sets deleteError on failure', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      svc.remove.and.returnValue(throwError(() => new Error('boom')));
      component.deleteScenario(component.scenarios[0]);
      expect(component.deleteError).toContain('Impossible de supprimer');
    });
  });

  describe('data regeneration', () => {
    it('regenerateAllData replaces scenario data and clears regenerating id on success', () => {
      const s = component.scenarios[0];
      svc.regenerateAllVariablesServerSide.and.returnValue(of([
        { id: 'v1', key: 'k1', value: 'newval', isSecret: false, locked: false },
      ] as any));
      component.regenerateAllData(s);
      expect(s.data).toEqual([{ id: 'v1', k: 'k1', v: 'newval', locked: false }]);
      expect(component.regeneratingScenarioId()).toBeNull();
    });

    it('regenerateAllData alerts and clears regenerating id on error', () => {
      spyOn(window, 'alert');
      const s = component.scenarios[0];
      svc.regenerateAllVariablesServerSide.and.returnValue(throwError(() => new Error('boom')));
      component.regenerateAllData(s);
      expect(component.regeneratingScenarioId()).toBeNull();
      expect(window.alert).toHaveBeenCalledWith('Erreur lors de la régénération des données.');
    });

    it('regenerateOneData updates matching entry on success', () => {
      const s = component.scenarios[0];
      const d = s.data[0];
      svc.regenerateOneVariable.and.returnValue(of({ id: 'v1', key: 'k1', value: 'updated', isSecret: false, locked: true } as any));
      component.regenerateOneData(s, d);
      expect(s.data[0]).toEqual({ id: 'v1', k: 'k1', v: 'updated', locked: true });
    });

    it('regenerateOneData alerts with the data key on error', () => {
      spyOn(window, 'alert');
      const s = component.scenarios[0];
      const d = s.data[0];
      svc.regenerateOneVariable.and.returnValue(throwError(() => new Error('boom')));
      component.regenerateOneData(s, d);
      expect(window.alert).toHaveBeenCalledWith(`Erreur lors de la régénération de "${d.k}".`);
    });
  });

  describe('toggleLock', () => {
    it('flips lock state via service and updates on success', () => {
      const s = component.scenarios[0];
      const d = s.data[0];
      d.locked = false;
      svc.setVariableLock.and.returnValue(of({ id: 'v1', key: 'k1', value: 'v1', isSecret: false, locked: true } as any));
      component.toggleLock(s, d);
      expect(svc.setVariableLock).toHaveBeenCalledWith('p1', 's1', 'v1', true);
      expect(d.locked).toBeTrue();
    });

    it('alerts on error', () => {
      spyOn(window, 'alert');
      const s = component.scenarios[0];
      const d = s.data[0];
      svc.setVariableLock.and.returnValue(throwError(() => new Error('boom')));
      component.toggleLock(s, d);
      expect(window.alert).toHaveBeenCalledWith('Erreur lors du verrouillage.');
    });
  });
});
