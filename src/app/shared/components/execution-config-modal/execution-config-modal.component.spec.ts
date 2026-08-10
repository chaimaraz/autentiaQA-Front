import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutionConfigModalComponent } from './execution-config-modal.component';

describe('ExecutionConfigModalComponent', () => {
  let component: ExecutionConfigModalComponent;
  let fixture: ComponentFixture<ExecutionConfigModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutionConfigModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutionConfigModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create, closed by default', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen()).toBe(false);
  });

  it('open() in single mode resets modes and opens the modal', () => {
    component.open('Scénario A');

    expect(component.isOpen()).toBe(true);
    expect(component.isBatchMode()).toBe(false);
    expect(component.targetLabel()).toBe('Scénario A');
    expect(component.screenshotMode()).toBe('ON_FAILURE');
    expect(component.videoMode()).toBe('ON_FAILURE');
    expect(component.traceMode()).toBe('ON_FAILURE');
    expect(component.batchScenarios()).toEqual([]);
  });

  it('open() in batch mode defaults video to NEVER and seeds batchScenarios with "keep"', () => {
    component.open('Tous les scénarios', true, [
      { id: 's1', name: 'Scénario 1' },
      { id: 's2', name: 'Scénario 2' },
    ]);

    expect(component.isBatchMode()).toBe(true);
    expect(component.videoMode()).toBe('NEVER');
    expect(component.batchScenarios()).toEqual([
      { id: 's1', name: 'Scénario 1', dataChoice: 'keep' },
      { id: 's2', name: 'Scénario 2', dataChoice: 'keep' },
    ]);
  });

  it('close() hides the modal', () => {
    component.open('X');
    component.close();
    expect(component.isOpen()).toBe(false);
  });

  it('onCancel() closes the modal and emits cancelled', () => {
    const spy = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(spy);
    component.open('X');

    component.onCancel();

    expect(component.isOpen()).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it('setDataChoice() updates a single scenario choice', () => {
    component.open('Tous', true, [{ id: 's1', name: 'S1' }]);
    const scenario = component.batchScenarios()[0];

    component.setDataChoice(scenario, 'regenerate');

    expect(scenario.dataChoice).toBe('regenerate');
  });

  it('setAllDataChoice() updates every scenario in the batch', () => {
    component.open('Tous', true, [
      { id: 's1', name: 'S1' },
      { id: 's2', name: 'S2' },
    ]);

    component.setAllDataChoice('regenerate');

    expect(component.batchScenarios().every((s) => s.dataChoice === 'regenerate')).toBe(true);
  });

  it('onConfirm() in single mode emits the capture config without dataChoices and closes', () => {
    const spy = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(spy);
    component.open('Scénario A');
    component.screenshotMode.set('ALWAYS');
    component.videoMode.set('NEVER');
    component.traceMode.set('ALWAYS');

    component.onConfirm();

    expect(component.isOpen()).toBe(false);
    expect(spy).toHaveBeenCalledWith({
      captureConfig: { screenshotMode: 'ALWAYS', videoMode: 'NEVER', traceMode: 'ALWAYS' },
      isBatch: false,
    });
  });

  it('onConfirm() in batch mode includes a dataChoices map keyed by scenario id', () => {
    const spy = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(spy);
    component.open('Tous', true, [
      { id: 's1', name: 'S1' },
      { id: 's2', name: 'S2' },
    ]);
    component.setDataChoice(component.batchScenarios()[0], 'regenerate');

    component.onConfirm();

    expect(spy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        isBatch: true,
        dataChoices: { s1: 'regenerate', s2: 'keep' },
      })
    );
  });
});
