import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { EditScenarioComponent } from './edit-scenario.component';
import { ScenarioService, Scenario } from '../../../services/scenario.service';

describe('EditScenarioComponent', () => {
  let component: EditScenarioComponent;
  let fixture: ComponentFixture<EditScenarioComponent>;
  let svc: jasmine.SpyObj<ScenarioService>;
  let router: jasmine.SpyObj<Router>;

  const baseScenario: Scenario = {
    id: 'sc1',
    projectId: 'p1',
    name: 'My scenario',
    type: 'POSITIVE',
    creationMode: 'NLP',
    scriptTemplate: 'console.log(1);',
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    description: 'desc',
    nlpText: 'Some steps.\nRésultat attendu : the expected outcome',
    etapesScenarios: [{ action: 'click', selector: '#btn', value: null, description: 'Click button' }],
  };

  beforeEach(async () => {
    svc = jasmine.createSpyObj('ScenarioService', [
      'getFull', 'regenerateScript', 'update', 'updateScript', 'updateMeta',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    svc.getFull.and.returnValue(of(baseScenario));

    await TestBed.configureTestingModule({
      imports: [EditScenarioComponent],
      providers: [
        { provide: ScenarioService, useValue: svc },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { id: 'p1', scenarioId: 'sc1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditScenarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load the scenario on init', () => {
    expect(component).toBeTruthy();
    expect(component.projectId).toBe('p1');
    expect(component.scenarioId).toBe('sc1');
    expect(svc.getFull).toHaveBeenCalledWith('p1', 'sc1');
  });

  describe('load', () => {
    it('populates fields from the loaded scenario, parsing the expected result from nlpText', () => {
      expect(component.name).toBe('My scenario');
      expect(component.description).toBe('desc');
      expect(component.steps()).toEqual(baseScenario.etapesScenarios!);
      expect(component.scriptTemplate()).toBe('console.log(1);');
      expect(component.expectedResult).toBe('the expected outcome');
      expect(component.loading()).toBeFalse();
    });

    it('defaults description and expectedResult when absent', () => {
      svc.getFull.and.returnValue(of({ ...baseScenario, description: undefined, nlpText: undefined }));
      component.load();
      expect(component.description).toBe('');
      expect(component.expectedResult).toBe('');
    });

    it('defaults steps to empty array when absent', () => {
      svc.getFull.and.returnValue(of({ ...baseScenario, etapesScenarios: undefined }));
      component.load();
      expect(component.steps()).toEqual([]);
    });

    it('sets an error and stops loading on failure', () => {
      svc.getFull.and.returnValue(throwError(() => new Error('boom')));
      component.load();
      expect(component.error()).toBe('Impossible de charger le scénario.');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('addStep / removeStep', () => {
    it('addStep appends a default step', () => {
      const before = component.steps().length;
      component.addStep();
      expect(component.steps().length).toBe(before + 1);
      const added = component.steps()[component.steps().length - 1];
      expect(added).toEqual({ action: 'click', selector: null, value: null, description: '' });
    });

    it('removeStep removes the given step instance', () => {
      const step = component.steps()[0];
      component.removeStep(step);
      expect(component.steps()).not.toContain(step);
    });
  });

  describe('regenerateScript', () => {
    it('updates scriptTemplate and steps on success', () => {
      const updated: Scenario = {
        ...baseScenario,
        scriptTemplate: 'new script',
        etapesScenarios: [{ action: 'fill', selector: '#input', value: 'x', description: 'Fill input' }],
      };
      svc.regenerateScript.and.returnValue(of(updated));
      component.regenerateScript();
      expect(svc.regenerateScript).toHaveBeenCalledWith('p1', 'sc1', {
        description: component.description,
        steps: jasmine.any(Array),
        expectedResult: component.expectedResult,
      });
      expect(component.scriptTemplate()).toBe('new script');
      expect(component.steps()).toEqual(updated.etapesScenarios!);
      expect(component.regenerating()).toBeFalse();
    });

    it('keeps current steps when regenerated scenario has none', () => {
      const currentSteps = component.steps();
      svc.regenerateScript.and.returnValue(of({ ...baseScenario, etapesScenarios: undefined, scriptTemplate: 'x' }));
      component.regenerateScript();
      expect(component.steps()).toEqual(currentSteps);
    });

    it('sets error message from backend on failure', () => {
      svc.regenerateScript.and.returnValue(throwError(() => ({ error: { message: 'AI failure' } })));
      component.regenerateScript();
      expect(component.regenerating()).toBeFalse();
      expect(component.error()).toBe('AI failure');
    });

    it('falls back to a generic error message when backend gives none', () => {
      svc.regenerateScript.and.returnValue(throwError(() => new Error('boom')));
      component.regenerateScript();
      expect(component.error()).toBe('Erreur lors de la régénération du script.');
    });
  });

  describe('save (three sequential HTTP calls)', () => {
    it('runs full success chain: update -> updateScript -> updateMeta, setting saveOk true then false after timeout', fakeAsync(() => {
      svc.update.and.returnValue(of(baseScenario));
      svc.updateScript.and.returnValue(of(baseScenario));
      svc.updateMeta.and.returnValue(of(baseScenario));

      component.save();

      expect(svc.update).toHaveBeenCalledWith('p1', 'sc1', { name: component.name });
      expect(svc.updateScript).toHaveBeenCalledWith('p1', 'sc1', component.scriptTemplate());
      expect(svc.updateMeta).toHaveBeenCalledWith('p1', 'sc1', {
        description: component.description,
        etapesScenarios: component.steps(),
      });
      expect(component.saving()).toBeFalse();
      expect(component.saveOk()).toBeTrue();

      tick(2500);
      expect(component.saveOk()).toBeFalse();
    }));

    it('fails at the name update step and does not call updateScript/updateMeta', () => {
      svc.update.and.returnValue(throwError(() => new Error('boom')));

      component.save();

      expect(svc.updateScript).not.toHaveBeenCalled();
      expect(svc.updateMeta).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
      expect(component.error()).toBe('Erreur lors de la sauvegarde du nom.');
    });

    it('fails at the script update step and does not call updateMeta', () => {
      svc.update.and.returnValue(of(baseScenario));
      svc.updateScript.and.returnValue(throwError(() => new Error('boom')));

      component.save();

      expect(svc.updateMeta).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
      expect(component.error()).toBe('Erreur lors de la sauvegarde du script.');
    });

    it('fails at the meta update step but keeps the earlier successes, with a partial-failure message', () => {
      svc.update.and.returnValue(of(baseScenario));
      svc.updateScript.and.returnValue(of(baseScenario));
      svc.updateMeta.and.returnValue(throwError(() => new Error('boom')));

      component.save();

      expect(component.saving()).toBeFalse();
      expect(component.saveOk()).toBeFalse();
      expect(component.error()).toBe("Script enregistré, mais la description/étapes n'a pas pu être synchronisée.");
    });
  });

  describe('goBack', () => {
    it('navigates back to the scenarios list of the project', () => {
      component.goBack();
      expect(router.navigate).toHaveBeenCalledWith(['/projects', 'p1', 'scenarios']);
    });
  });
});
