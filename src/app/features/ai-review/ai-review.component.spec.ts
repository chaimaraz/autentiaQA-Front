import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { AiReviewComponent } from './ai-review.component';
import { AIGenerationService, AIScenarioProposal, AIJobObservable } from '../../services/ai-generation.service';
import { AIReviewStoreService, AIReviewPayload } from '../../services/ai-review-store.service';

describe('AiReviewComponent', () => {
  let component: AiReviewComponent;
  let fixture: ComponentFixture<AiReviewComponent>;
  let aiSvc: jasmine.SpyObj<AIGenerationService>;
  let store: jasmine.SpyObj<AIReviewStoreService>;
  let router: jasmine.SpyObj<Router>;

  const makeProposal = (over: Partial<AIScenarioProposal> = {}): AIScenarioProposal => ({
    tempId: 't1',
    name: 'Proposal 1',
    type: 'POSITIVE',
    steps: [{ action: 'click', selector: '#btn' }],
    expectedResult: 'ok',
    variables: [{ key: 'k', value: 'v', isSecret: false }],
    scriptTemplate: '',
    ...over,
  });

  const makePayload = (over: Partial<AIReviewPayload> = {}): AIReviewPayload => ({
    projectId: 'p1',
    projectName: 'Project 1',
    source: 'document',
    proposals: [makeProposal()],
    ...over,
  });

  function makeJob(): AIJobObservable {
    return { progress$: new Subject(), result$: new Subject(), error$: new Subject() };
  }

  beforeEach(async () => {
    aiSvc = jasmine.createSpyObj('AIGenerationService', ['generateScripts', 'bulkCreate']);
    store = jasmine.createSpyObj('AIReviewStoreService', ['consume', 'peek', 'set']);
    router = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    // RouterLink needs these to render its href — the spy needs harmless stand-ins.
    (router as any).events = of();
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/');
    store.consume.and.returnValue(makePayload());

    await TestBed.configureTestingModule({
      imports: [AiReviewComponent],
      providers: [
        { provide: AIGenerationService, useValue: aiSvc },
        { provide: AIReviewStoreService, useValue: store },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('loads payload from the store and marks all proposals selected', () => {
      expect(component.projectId()).toBe('p1');
      expect(component.projectName()).toBe('Project 1');
      expect(component.source()).toBe('document');
      expect(component.proposals().length).toBe(1);
      expect(component.proposals()[0].selected).toBeTrue();
    });

    it('sets a global error and does not populate state when the store has no payload', () => {
      store.consume.and.returnValue(null);
      const fresh = TestBed.createComponent(AiReviewComponent);
      fresh.componentInstance.ngOnInit();
      expect(fresh.componentInstance.globalError()).toContain('Aucune analyse IA en attente');
      expect(fresh.componentInstance.proposals()).toEqual([]);
    });

    it('reads pagesExplored when provided', () => {
      store.consume.and.returnValue(makePayload({ pagesExplored: 7 }));
      const fresh = TestBed.createComponent(AiReviewComponent);
      fresh.componentInstance.ngOnInit();
      expect(fresh.componentInstance.pagesExplored()).toBe(7);
    });
  });

  describe('selection / editing', () => {
    it('selectedCount reflects selected proposals', () => {
      expect(component.selectedCount).toBe(1);
      component.proposals()[0].selected = false;
      expect(component.selectedCount).toBe(0);
    });

    it('toggleSelected flips the selected flag', () => {
      const p = component.proposals()[0];
      component.toggleSelected(p);
      expect(p.selected).toBeFalse();
      component.toggleSelected(p);
      expect(p.selected).toBeTrue();
    });

    it('selectAll(true/false) sets all proposals', () => {
      component.selectAll(false);
      expect(component.proposals().every(p => !p.selected)).toBeTrue();
      component.selectAll(true);
      expect(component.proposals().every(p => p.selected)).toBeTrue();
    });

    it('toggleExpanded toggles the expanded id and closes when re-clicked', () => {
      const p = component.proposals()[0];
      component.toggleExpanded(p);
      expect(component.expandedId()).toBe(p.tempId);
      component.toggleExpanded(p);
      expect(component.expandedId()).toBeNull();
    });

    it('removeProposal filters out the given proposal', () => {
      const p = component.proposals()[0];
      component.removeProposal(p);
      expect(component.proposals()).not.toContain(p);
    });

    it('addStep appends a default step to the proposal', () => {
      const p = component.proposals()[0];
      const before = p.steps.length;
      component.addStep(p);
      expect(p.steps.length).toBe(before + 1);
      expect(p.steps[p.steps.length - 1]).toEqual({ action: 'click', selector: '', description: '' });
    });

    it('removeStep removes the given step from the proposal', () => {
      const p = component.proposals()[0];
      const step = p.steps[0];
      component.removeStep(p, step);
      expect(p.steps).not.toContain(step);
    });

    it('addVariable appends a default variable', () => {
      const p = component.proposals()[0];
      const before = p.variables.length;
      component.addVariable(p);
      expect(p.variables.length).toBe(before + 1);
      expect(p.variables[p.variables.length - 1]).toEqual({ key: '', value: '', isSecret: false });
    });

    it('removeVariable removes the given variable', () => {
      const p = component.proposals()[0];
      const v = p.variables[0];
      component.removeVariable(p, v);
      expect(p.variables).not.toContain(v);
    });
  });

  describe('confirmAndGenerateScripts', () => {
    it('sets an error when nothing is selected', () => {
      component.selectAll(false);
      component.confirmAndGenerateScripts();
      expect(component.globalError()).toBe('Sélectionnez au moins un scénario.');
      expect(aiSvc.generateScripts).not.toHaveBeenCalled();
    });

    it('sets an error when a selected proposal has no name or no steps', () => {
      component.proposals()[0].name = '';
      component.confirmAndGenerateScripts();
      expect(component.globalError()).toContain('doit avoir un nom et au moins une étape');
      expect(aiSvc.generateScripts).not.toHaveBeenCalled();
    });

    it('moves to generating_scripts stage and calls the service with selected proposals', () => {
      const job = makeJob();
      aiSvc.generateScripts.and.returnValue(job);
      component.confirmAndGenerateScripts();
      expect(component.stage()).toBe('generating_scripts');
      expect(aiSvc.generateScripts).toHaveBeenCalledWith('p1', component.proposals());
    });

    it('merges result scenarios into proposals by tempId and moves to scripts_ready', () => {
      const job = makeJob();
      aiSvc.generateScripts.and.returnValue(job);
      component.confirmAndGenerateScripts();

      const updated = makeProposal({ tempId: 't1', scriptTemplate: 'generated script' });
      job.result$.next({ scenarios: [updated] });

      expect(component.stage()).toBe('scripts_ready');
      expect(component.proposals()[0].scriptTemplate).toBe('generated script');
    });

    it('returns to review stage and sets globalError on job error', () => {
      const job = makeJob();
      aiSvc.generateScripts.and.returnValue(job);
      component.confirmAndGenerateScripts();

      job.error$.next('AI exploded');

      expect(component.stage()).toBe('review');
      expect(component.globalError()).toBe('AI exploded');
    });

    it('falls back to a generic error message when the job error has none', () => {
      const job = makeJob();
      aiSvc.generateScripts.and.returnValue(job);
      component.confirmAndGenerateScripts();

      job.error$.next('');

      expect(component.globalError()).toBe('Erreur lors de la génération des scripts IA.');
    });
  });

  describe('saveAll', () => {
    it('sets an error when nothing is selected', () => {
      component.selectAll(false);
      component.saveAll();
      expect(component.globalError()).toBe('Sélectionnez au moins un scénario.');
      expect(aiSvc.bulkCreate).not.toHaveBeenCalled();
    });

    it('moves to saving stage then done on success, recording savedCount and saveErrors', () => {
      aiSvc.bulkCreate.and.returnValue(of({ success: true, data: [{}, {}], errors: [] }));
      component.saveAll();
      expect(aiSvc.bulkCreate).toHaveBeenCalledWith('p1', component.proposals());
      expect(component.stage()).toBe('done');
      expect(component.savedCount()).toBe(2);
      expect(component.saveErrors()).toEqual([]);
    });

    it('records partial save errors from the response', () => {
      const errors = [{ name: 'X', message: 'dup' }];
      aiSvc.bulkCreate.and.returnValue(of({ success: true, data: [{}], errors }));
      component.saveAll();
      expect(component.saveErrors()).toEqual(errors);
    });

    it('returns to scripts_ready stage and sets globalError on failure', () => {
      aiSvc.bulkCreate.and.returnValue(throwError(() => ({ error: { message: 'Save failed' } })));
      component.saveAll();
      expect(component.stage()).toBe('scripts_ready');
      expect(component.globalError()).toBe('Save failed');
    });

    it('falls back to a generic error message on failure without backend message', () => {
      // No `.error.message` / `.message` on the thrown value — this exercises
      // the generic-fallback branch of _extractErrorMessage.
      aiSvc.bulkCreate.and.returnValue(throwError(() => ({})));
      component.saveAll();
      expect(component.globalError()).toBe("Erreur lors de l'enregistrement des scénarios.");
    });
  });

  describe('navigation helpers', () => {
    it('goToScenarios navigates to the project scenarios list', () => {
      component.goToScenarios();
      expect(router.navigate).toHaveBeenCalledWith(['/projects', 'p1', 'scenarios']);
    });

    it('goBackToReview resets the stage to review', () => {
      component.stage.set('scripts_ready');
      component.goBackToReview();
      expect(component.stage()).toBe('review');
    });
  });
});
