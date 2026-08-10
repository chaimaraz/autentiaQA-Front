import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { JiraTicketModalComponent } from './jira-ticket-modal.component';
import { ExecutionService, JiraPreview, JiraTicketResult } from '../../../services/execution.service';

describe('JiraTicketModalComponent', () => {
  let component: JiraTicketModalComponent;
  let fixture: ComponentFixture<JiraTicketModalComponent>;
  let execSpy: jasmine.SpyObj<Pick<ExecutionService, 'getJiraPreview' | 'createJiraTicket'>>;

  const preview: JiraPreview = {
    execution: { id: 'e1', scenarioName: 'Login', result: 'FAIL', startedAt: '', finishedAt: null },
    title: 'Bug: login fails',
    description: 'Steps to reproduce...',
    failedSteps: [],
    aiAnalysis: { summary: '', failures: [] } as any,
    artifacts: [],
    existingTicket: null,
  };

  const ticketResult: JiraTicketResult = { key: 'QA-1', url: 'https://jira/QA-1', alreadyExisted: false };

  beforeEach(async () => {
    execSpy = jasmine.createSpyObj('ExecutionService', ['getJiraPreview', 'createJiraTicket']);
    execSpy.getJiraPreview.and.returnValue(of(preview));
    execSpy.createJiraTicket.and.returnValue(of(ticketResult));

    await TestBed.configureTestingModule({
      imports: [JiraTicketModalComponent],
      providers: [{ provide: ExecutionService, useValue: execSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(JiraTicketModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create, closed by default', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen()).toBe(false);
  });

  it('open() requests the preview and populates title/description on success', () => {
    component.open('exec-1');

    expect(execSpy.getJiraPreview).toHaveBeenCalledWith('exec-1');
    expect(component.isOpen()).toBe(true);
    expect(component.loading()).toBe(false);
    expect(component.preview()).toEqual(preview);
    expect(component.title()).toBe('Bug: login fails');
    expect(component.description()).toBe('Steps to reproduce...');
    expect(component.error()).toBe('');
  });

  it('open() is in a loading state until the preview resolves', () => {
    const subject = new Subject<JiraPreview>();
    execSpy.getJiraPreview.and.returnValue(subject.asObservable());

    component.open('exec-2');
    expect(component.loading()).toBe(true);

    subject.next(preview);
    expect(component.loading()).toBe(false);
  });

  it('open() surfaces the backend error message on failure', () => {
    execSpy.getJiraPreview.and.returnValue(throwError(() => new Error('Preview indisponible')));

    component.open('exec-3');

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Preview indisponible');
    expect(component.preview()).toBeNull();
  });

  it('open() falls back to a generic error message when none is provided', () => {
    execSpy.getJiraPreview.and.returnValue(throwError(() => ({})));

    component.open('exec-4');

    expect(component.error()).toBe("Impossible de générer l'aperçu du ticket.");
  });

  it('close() hides the modal', () => {
    component.open('exec-1');
    component.close();
    expect(component.isOpen()).toBe(false);
  });

  it('onCancel() closes the modal and emits cancelled', () => {
    const spy = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(spy);
    component.open('exec-1');

    component.onCancel();

    expect(component.isOpen()).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it('onConfirm() rejects an empty title or description without calling the service', () => {
    component.open('exec-1');
    component.title.set('   ');
    component.description.set('   ');

    component.onConfirm();

    expect(component.error()).toBe('Titre et description sont requis.');
    expect(execSpy.createJiraTicket).not.toHaveBeenCalled();
  });

  it('onConfirm() creates the ticket, closes the modal and emits the result', () => {
    const spy = jasmine.createSpy('created');
    component.created.subscribe(spy);
    component.open('exec-1');
    component.title.set('Bug title');
    component.description.set('Bug description');

    component.onConfirm();

    expect(execSpy.createJiraTicket).toHaveBeenCalledWith('exec-1', {
      title: 'Bug title',
      description: 'Bug description',
    });
    expect(component.creating()).toBe(false);
    expect(component.isOpen()).toBe(false);
    expect(spy).toHaveBeenCalledWith(ticketResult);
  });

  it('onConfirm() surfaces an error and keeps the modal open on failure', () => {
    execSpy.createJiraTicket.and.returnValue(throwError(() => new Error('Échec Jira')));
    const spy = jasmine.createSpy('created');
    component.created.subscribe(spy);
    component.open('exec-1');
    component.title.set('Bug title');
    component.description.set('Bug description');

    component.onConfirm();

    expect(component.creating()).toBe(false);
    expect(component.error()).toBe('Échec Jira');
    expect(component.isOpen()).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('onConfirm() falls back to a generic error message when creation fails without one', () => {
    execSpy.createJiraTicket.and.returnValue(throwError(() => ({})));
    component.open('exec-1');
    component.title.set('Bug title');
    component.description.set('Bug description');

    component.onConfirm();

    expect(component.error()).toBe('Échec de la création du ticket Jira.');
  });

  describe('causeLabelFr', () => {
    it('translates every known cause category', () => {
      expect(component.causeLabelFr('APPLICATION_BUG')).toBe('Bug application');
      expect(component.causeLabelFr('SCRIPT_ISSUE')).toBe('Script/sélecteur');
      expect(component.causeLabelFr('ENVIRONMENT')).toBe('Environnement');
      expect(component.causeLabelFr('TIMING')).toBe('Timing');
      expect(component.causeLabelFr('UNKNOWN')).toBe('Indéterminé');
    });

    it('returns the raw category when it is not recognized', () => {
      expect(component.causeLabelFr('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
    });
  });
});
