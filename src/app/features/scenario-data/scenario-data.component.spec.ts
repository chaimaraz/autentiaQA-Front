import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ScenarioDataComponent } from './scenario-data.component';
import { ScenarioService, ScenarioVariable } from '../../services/scenario.service';

describe('ScenarioDataComponent', () => {
  let component: ScenarioDataComponent;
  let fixture: ComponentFixture<ScenarioDataComponent>;
  let svc: jasmine.SpyObj<ScenarioService>;

  const variable = (over: Partial<ScenarioVariable> = {}): ScenarioVariable => ({
    id: 'v1',
    key: 'email',
    value: 'a@b.com',
    isSecret: false,
    generator: 'FAKER',
    locked: false,
    ...over,
  });

  beforeEach(async () => {
    svc = jasmine.createSpyObj('ScenarioService', [
      'getVariables', 'syncVariables', 'saveVariables', 'regenerateOneVariable',
      'regenerateAllVariablesServerSide', 'setVariableLock',
    ]);
    svc.getVariables.and.returnValue(of([variable()]));

    await TestBed.configureTestingModule({
      imports: [ScenarioDataComponent],
      providers: [{ provide: ScenarioService, useValue: svc }],
    }).compileComponents();

    fixture = TestBed.createComponent(ScenarioDataComponent);
    component = fixture.componentInstance;
    component.projectId = 'p1';
    component.scenarioId = 'sc1';
    fixture.detectChanges();
  });

  it('should create and load variables on init', () => {
    expect(component).toBeTruthy();
    expect(svc.getVariables).toHaveBeenCalledWith('p1', 'sc1');
    expect(component.variables()).toEqual([variable()]);
    expect(component.loading()).toBeFalse();
  });

  describe('load', () => {
    it('sets an error and stops loading on failure', () => {
      svc.getVariables.and.returnValue(throwError(() => new Error('boom')));
      component.load();
      expect(component.error()).toBe('Impossible de charger les variables.');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('sync', () => {
    it('updates variables from the sync response', () => {
      svc.syncVariables.and.returnValue(of({
        variables: [variable({ id: 'v2', key: 'phone' })],
        created: ['phone'],
        removed: [],
        needsValue: [],
      }));
      component.sync();
      expect(component.variables()).toEqual([variable({ id: 'v2', key: 'phone' })]);
      expect(component.loading()).toBeFalse();
    });

    it('sets an error on failure', () => {
      svc.syncVariables.and.returnValue(throwError(() => new Error('boom')));
      component.sync();
      expect(component.error()).toBe('Erreur lors de la synchronisation.');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('save', () => {
    it('persists variables and updates state on success', () => {
      const saved = [variable({ value: 'updated' })];
      const before = component.variables(); // snapshot pre-save — save() mutates the signal synchronously
      svc.saveVariables.and.returnValue(of(saved));
      component.save();
      expect(svc.saveVariables).toHaveBeenCalledWith('p1', 'sc1', before);
      expect(component.variables()).toEqual(saved);
      expect(component.saving()).toBeFalse();
    });

    it('sets an error on failure', () => {
      svc.saveVariables.and.returnValue(throwError(() => new Error('boom')));
      component.save();
      expect(component.error()).toBe("Erreur lors de l'enregistrement.");
      expect(component.saving()).toBeFalse();
    });
  });

  describe('regenerateOne', () => {
    it('does nothing for MANUAL generator variables', () => {
      const v = variable({ generator: 'MANUAL' });
      component.regenerateOne(v);
      expect(svc.regenerateOneVariable).not.toHaveBeenCalled();
    });

    it('replaces the matching variable on success', () => {
      const v = variable();
      const updated = variable({ value: 'new@b.com' });
      svc.regenerateOneVariable.and.returnValue(of(updated));
      component.regenerateOne(v);
      expect(component.variables()).toEqual([updated]);
      expect(component.regeneratingId()).toBeNull();
    });

    it('sets an error with the variable key on failure', () => {
      const v = variable();
      svc.regenerateOneVariable.and.returnValue(throwError(() => new Error('boom')));
      component.regenerateOne(v);
      expect(component.error()).toBe(`Erreur lors de la régénération de "${v.key}".`);
      expect(component.regeneratingId()).toBeNull();
    });
  });

  describe('regenerateAll', () => {
    it('replaces all variables on success', () => {
      const vars = [variable({ id: 'v3' })];
      svc.regenerateAllVariablesServerSide.and.returnValue(of(vars));
      component.regenerateAll();
      expect(component.variables()).toEqual(vars);
      expect(component.loading()).toBeFalse();
    });

    it('sets an error on failure', () => {
      svc.regenerateAllVariablesServerSide.and.returnValue(throwError(() => new Error('boom')));
      component.regenerateAll();
      expect(component.error()).toBe('Erreur lors de la régénération globale.');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('toggleSecretVisibility / isSecretVisible', () => {
    it('toggles visibility state per id', () => {
      expect(component.isSecretVisible('v1')).toBeFalse();
      component.toggleSecretVisibility('v1');
      expect(component.isSecretVisible('v1')).toBeTrue();
      component.toggleSecretVisibility('v1');
      expect(component.isSecretVisible('v1')).toBeFalse();
    });
  });

  describe('generatorLabel / generatorIcon', () => {
    it('maps known generator codes to labels and icons', () => {
      expect(component.generatorLabel('FAKER')).toBe('Faker');
      expect(component.generatorLabel('AI')).toBe('IA');
      expect(component.generatorIcon('FAKER')).toBe('fa-dice');
      expect(component.generatorIcon('AI')).toBe('fa-robot');
    });

    it('defaults to MANUAL label/icon when generator is undefined', () => {
      expect(component.generatorLabel(undefined)).toBe('Manuel');
      expect(component.generatorIcon(undefined)).toBe('fa-pen');
    });

    it('falls back to the raw value / unknown icon for an unrecognized generator', () => {
      expect(component.generatorLabel('WEIRD')).toBe('WEIRD');
      expect(component.generatorIcon('WEIRD')).toBe('fa-circle-question');
    });
  });

  describe('toggleLock', () => {
    it('flips lock via the service and updates the matching variable', () => {
      const v = component.variables()[0];
      svc.setVariableLock.and.returnValue(of(variable({ locked: true })));
      component.toggleLock(v);
      expect(svc.setVariableLock).toHaveBeenCalledWith('p1', 'sc1', 'v1', true);
      expect(component.variables()[0].locked).toBeTrue();
    });

    it('sets an error on failure', () => {
      const v = component.variables()[0];
      svc.setVariableLock.and.returnValue(throwError(() => new Error('boom')));
      component.toggleLock(v);
      expect(component.error()).toBe('Erreur lors du verrouillage.');
    });
  });

  describe('exportJson', () => {
    it('creates a Blob, an object URL, triggers a download and revokes the URL', () => {
      const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
      const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
      const clickSpy = jasmine.createSpy('click');
      const fakeAnchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
      spyOn(document, 'createElement').and.returnValue(fakeAnchor);

      component.exportJson();

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(fakeAnchor.download).toBe('variables-sc1.json');
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('importJson', () => {
    function fireFileEvent(fileContent: string | null): { input: HTMLInputElement } {
      const file = fileContent !== null ? new File([fileContent], 'vars.json', { type: 'application/json' }) : undefined;
      const input = document.createElement('input');
      input.type = 'file';
      Object.defineProperty(input, 'files', { value: file ? [file] : [], writable: false });
      return { input };
    }

    it('does nothing when no file is selected', () => {
      const { input } = fireFileEvent(null);
      component.importJson({ target: input } as unknown as Event);
      // no exception, variables unchanged
      expect(component.variables().length).toBe(1);
    });

    it('merges imported entries into existing variables by key and clears the input value', (done) => {
      const { input } = fireFileEvent(JSON.stringify([{ key: 'email', value: 'new@b.com', isSecret: true }]));

      component.importJson({ target: input } as unknown as Event);

      setTimeout(() => {
        const updated = component.variables().find(v => v.key === 'email');
        expect(updated?.value).toBe('new@b.com');
        expect(updated?.isSecret).toBeTrue();
        expect(component.error()).toBeNull();
        expect(input.value).toBe('');
        done();
      }, 50);
    });

    it('adds a new tmp variable for keys not already present', (done) => {
      const { input } = fireFileEvent(JSON.stringify([{ key: 'newKey', value: 'val' }]));

      component.importJson({ target: input } as unknown as Event);

      setTimeout(() => {
        const added = component.variables().find(v => v.key === 'newKey');
        expect(added).toBeTruthy();
        expect(added?.generator).toBe('MANUAL');
        expect(added?.isSecret).toBeFalse();
        done();
      }, 50);
    });

    it('sets an error for invalid JSON content', (done) => {
      const { input } = fireFileEvent('not valid json{{{');

      component.importJson({ target: input } as unknown as Event);

      setTimeout(() => {
        expect(component.error()).toBe('Fichier JSON invalide.');
        done();
      }, 50);
    });

    it('sets an error when the parsed JSON is not an array', (done) => {
      const { input } = fireFileEvent(JSON.stringify({ key: 'x', value: 'y' }));

      component.importJson({ target: input } as unknown as Event);

      setTimeout(() => {
        expect(component.error()).toBe('Fichier JSON invalide.');
        done();
      }, 50);
    });
  });
});
