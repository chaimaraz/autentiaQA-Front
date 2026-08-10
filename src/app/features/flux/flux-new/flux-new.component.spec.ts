import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { FluxNewComponent } from './flux-new.component';

describe('FluxNewComponent', () => {
  let component: FluxNewComponent;
  let fixture: ComponentFixture<FluxNewComponent>;
  let router: jasmine.SpyObj<Router>;

  const scenarioA = { name: 'Inscription avec données valides', type: 'pos' as const, desc: '/register → 201 Created' };
  const scenarioB = { name: 'Login mot de passe incorrect', type: 'neg' as const, desc: '/login → erreur attendue' };

  beforeEach(async () => {
    router = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    // RouterLink needs these to render its href — the spy needs harmless stand-ins.
    (router as any).events = of();
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/');

    await TestBed.configureTestingModule({
      imports: [FluxNewComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(FluxNewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with an empty steps list', () => {
    expect(component).toBeTruthy();
    expect(component.steps()).toEqual([]);
  });

  it('exposes 10 available scenarios to pick from', () => {
    expect(component.availableScenarios.length).toBe(10);
  });

  describe('addStep', () => {
    it('appends a scenario as a new step', () => {
      component.addStep(scenarioA);
      expect(component.steps().length).toBe(1);
      expect(component.steps()[0]).toEqual({ name: scenarioA.name, type: scenarioA.type, desc: scenarioA.desc });
    });

    it('appends multiple steps in order, allowing duplicates', () => {
      component.addStep(scenarioA);
      component.addStep(scenarioB);
      component.addStep(scenarioA);
      expect(component.steps().length).toBe(3);
      expect(component.steps().map(s => s.name)).toEqual([scenarioA.name, scenarioB.name, scenarioA.name]);
    });
  });

  describe('removeStep', () => {
    it('removes the step at the given index', () => {
      component.addStep(scenarioA);
      component.addStep(scenarioB);
      component.removeStep(0);
      expect(component.steps().length).toBe(1);
      expect(component.steps()[0].name).toBe(scenarioB.name);
    });

    it('does nothing harmful when called with an out-of-range index', () => {
      component.addStep(scenarioA);
      component.removeStep(5);
      expect(component.steps().length).toBe(1);
    });
  });

  describe('clearSteps', () => {
    it('empties the steps list', () => {
      component.addStep(scenarioA);
      component.addStep(scenarioB);
      component.clearSteps();
      expect(component.steps()).toEqual([]);
    });
  });

  describe('saveFlux', () => {
    it('alerts a confirmation and navigates to the flux list', () => {
      spyOn(window, 'alert');
      component.fluxName = 'My flux';
      component.saveFlux();
      expect(window.alert).toHaveBeenCalledWith(jasmine.stringMatching(/My flux/));
      expect(router.navigate).toHaveBeenCalledWith(['/flux/list']);
    });
  });

  describe('getStepClass', () => {
    it('maps "pos" to "pos"', () => {
      expect(component.getStepClass('pos')).toBe('pos');
    });

    it('maps "neg" to "neg"', () => {
      expect(component.getStepClass('neg')).toBe('neg');
    });

    it('maps anything else (e.g. "sec") to "sec"', () => {
      expect(component.getStepClass('sec')).toBe('sec');
      expect(component.getStepClass('unknown')).toBe('sec');
    });
  });
});
