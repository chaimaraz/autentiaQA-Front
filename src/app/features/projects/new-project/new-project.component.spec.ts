import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { NewProjectComponent } from './new-project.component';
import { ProjectApiService } from '../../../services/project-api.service';
import { AIGenerationService, AIJobObservable, AIJobProgress, AIJobResult } from '../../../services/ai-generation.service';
import { AIReviewStoreService } from '../../../services/ai-review-store.service';

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['x'.repeat(Math.min(sizeBytes, 10))], name, { type });
  // Force the `size` property since File's real size is derived from content,
  // and we need to simulate large files without allocating real memory.
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('NewProjectComponent', () => {
  let component: NewProjectComponent;
  let fixture: ComponentFixture<NewProjectComponent>;
  let projectApiSpy: jasmine.SpyObj<ProjectApiService>;
  let aiSvcSpy: jasmine.SpyObj<AIGenerationService>;
  let aiReviewStoreSpy: jasmine.SpyObj<AIReviewStoreService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let alertSpy: jasmine.Spy;

  function makeJob(): { job: AIJobObservable; progress$: Subject<AIJobProgress>; result$: Subject<AIJobResult>; error$: Subject<string> } {
    const progress$ = new Subject<AIJobProgress>();
    const result$ = new Subject<AIJobResult>();
    const error$ = new Subject<string>();
    return { job: { progress$, result$, error$ }, progress$, result$, error$ };
  }

  beforeEach(async () => {
    projectApiSpy = jasmine.createSpyObj<ProjectApiService>('ProjectApiService', ['createProject']);
    aiSvcSpy = jasmine.createSpyObj<AIGenerationService>('AIGenerationService', [
      'generateFromDocument',
      'generateFromUrl',
    ]);
    aiReviewStoreSpy = jasmine.createSpyObj<AIReviewStoreService>('AIReviewStoreService', ['set']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    alertSpy = spyOn(window, 'alert');

    await TestBed.configureTestingModule({
      imports: [NewProjectComponent],
      providers: [
        { provide: ProjectApiService, useValue: projectApiSpy },
        { provide: AIGenerationService, useValue: aiSvcSpy },
        { provide: AIReviewStoreService, useValue: aiReviewStoreSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewProjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with step 1 active', () => {
    expect(component).toBeTruthy();
    expect(component.currentStep()).toBe(1);
  });

  // ── selectMode ─────────────────────────────────────────────────────────
  describe('selectMode', () => {
    it('should select the given mode and deselect the others', () => {
      const specMode = component.generationModes.find((m) => m.key === 'SPEC_DOCUMENT')!;
      component.selectMode(specMode);

      expect(specMode.selected).toBeTrue();
      expect(component.generationModes.find((m) => m.key === 'URL_CRAWL')!.selected).toBeFalse();
      expect(component.selectedMode).toBe(specMode);
      expect(component.isSpecMode).toBeTrue();
    });

    it('should clear uploaded files when switching back to URL_CRAWL', () => {
      const specMode = component.generationModes.find((m) => m.key === 'SPEC_DOCUMENT')!;
      const urlMode = component.generationModes.find((m) => m.key === 'URL_CRAWL')!;
      component.selectMode(specMode);
      component.uploadedFiles.push({ file: makeFile('a.pdf', 'application/pdf', 100), name: 'a.pdf', sizeLabel: '100 B', mimeType: 'application/pdf' });

      component.selectMode(urlMode);

      expect(component.uploadedFiles.length).toBe(0);
    });
  });

  // ── toggleTestType ─────────────────────────────────────────────────────
  describe('toggleTestType', () => {
    it('should flip the selected flag of the given test type', () => {
      const type = component.testTypes.find((t) => t.key === 'ACCESSIBILITY')!;
      expect(type.selected).toBeFalse();

      component.toggleTestType(type);
      expect(type.selected).toBeTrue();

      component.toggleTestType(type);
      expect(type.selected).toBeFalse();
    });

    it('should not affect other test types', () => {
      const functional = component.testTypes.find((t) => t.key === 'FUNCTIONAL')!;
      const accessibility = component.testTypes.find((t) => t.key === 'ACCESSIBILITY')!;

      component.toggleTestType(accessibility);

      expect(functional.selected).toBeTrue();
    });
  });

  // ── selectFramework ────────────────────────────────────────────────────
  describe('selectFramework', () => {
    it('should select exactly one framework at a time', () => {
      const cypress = component.frameworks.find((f) => f.key === 'CYPRESS')!;
      component.selectFramework(cypress);

      expect(cypress.selected).toBeTrue();
      expect(component.frameworks.filter((f) => f.selected).length).toBe(1);
      expect(component.selectedFramework).toBe(cypress);
    });
  });

  // ── file upload handling ───────────────────────────────────────────────
  describe('file uploads', () => {
    function fileInputEvent(files: File[]): Event {
      const input = document.createElement('input');
      input.type = 'file';
      Object.defineProperty(input, 'files', { value: files });
      return { target: input } as unknown as Event;
    }

    it('should add a valid, supported file', () => {
      const file = makeFile('spec.pdf', 'application/pdf', 2048);
      component.onFilesSelected(fileInputEvent([file]));

      expect(component.uploadedFiles.length).toBe(1);
      expect(component.uploadedFiles[0].name).toBe('spec.pdf');
      expect(component.uploadedFiles[0].sizeLabel).toBe('2.0 KB');
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('should reject an unsupported file type with an alert', () => {
      const file = makeFile('image.png', 'image/png', 1024);
      component.onFilesSelected(fileInputEvent([file]));

      expect(component.uploadedFiles.length).toBe(0);
      expect(alertSpy).toHaveBeenCalledWith('Type non supporté : image.png');
    });

    it('should reject a file bigger than 20MB with an alert', () => {
      const file = makeFile('huge.pdf', 'application/pdf', 21 * 1024 * 1024);
      component.onFilesSelected(fileInputEvent([file]));

      expect(component.uploadedFiles.length).toBe(0);
      expect(alertSpy).toHaveBeenCalledWith('Fichier trop volumineux : huge.pdf');
    });

    it('should ignore an exact duplicate (same name and size)', () => {
      const file1 = makeFile('spec.pdf', 'application/pdf', 2048);
      const file2 = makeFile('spec.pdf', 'application/pdf', 2048);
      component.onFilesSelected(fileInputEvent([file1]));
      component.onFilesSelected(fileInputEvent([file2]));

      expect(component.uploadedFiles.length).toBe(1);
    });

    it('should reset the input value after selection', () => {
      const file = makeFile('spec.pdf', 'application/pdf', 2048);
      const evt = fileInputEvent([file]);
      component.onFilesSelected(evt);

      expect((evt.target as HTMLInputElement).value).toBe('');
    });

    it('onDrop should add files from the drag event and clear isDragOver', () => {
      const file = makeFile('spec.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 512);
      const dropEvent = {
        preventDefault: jasmine.createSpy('preventDefault'),
        dataTransfer: { files: [file] },
      } as unknown as DragEvent;

      component.isDragOver = true;
      component.onDrop(dropEvent);

      expect(dropEvent.preventDefault).toHaveBeenCalled();
      expect(component.isDragOver).toBeFalse();
      expect(component.uploadedFiles.length).toBe(1);
    });

    it('onDragOver should set isDragOver and prevent default', () => {
      const evt = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as DragEvent;
      component.onDragOver(evt);

      expect(evt.preventDefault).toHaveBeenCalled();
      expect(component.isDragOver).toBeTrue();
    });

    it('onDragLeave should clear isDragOver', () => {
      component.isDragOver = true;
      component.onDragLeave();
      expect(component.isDragOver).toBeFalse();
    });

    it('removeFile should remove the file at the given index', () => {
      component.uploadedFiles = [
        { file: makeFile('a.pdf', 'application/pdf', 10), name: 'a.pdf', sizeLabel: '10 B', mimeType: 'application/pdf' },
        { file: makeFile('b.pdf', 'application/pdf', 10), name: 'b.pdf', sizeLabel: '10 B', mimeType: 'application/pdf' },
      ];

      component.removeFile(0);

      expect(component.uploadedFiles.length).toBe(1);
      expect(component.uploadedFiles[0].name).toBe('b.pdf');
    });
  });

  // ── repo management ────────────────────────────────────────────────────
  describe('repo management', () => {
    it('addRepo should push a new draft repo with sane defaults', () => {
      component.addRepo();

      expect(component.repos.length).toBe(1);
      expect(component.repos[0]).toEqual({
        name: '',
        role: 'OTHER',
        repoUrl: '',
        branch: 'main',
        onPush: true,
        onPr: true,
        onTag: false,
        onSchedule: false,
        notifyEmail: true,
        notifySlack: false,
        createJiraBug: false,
        blockMerge: false,
        notifyEmails: '',
      });
    });

    it('removeRepo should remove the repo at the given index', () => {
      component.addRepo();
      component.addRepo();
      component.repos[0].name = 'frontend';
      component.repos[1].name = 'backend';

      component.removeRepo(0);

      expect(component.repos.length).toBe(1);
      expect(component.repos[0].name).toBe('backend');
    });
  });

  // ── wizard navigation & validation ─────────────────────────────────────
  describe('step navigation and validation', () => {
    it('goToStep should only allow navigating to an already-reached step', () => {
      component.goToStep(3);
      expect(component.currentStep()).toBe(1); // step 3 not reachable yet from step 1

      component.currentStep.set(3);
      component.goToStep(2);
      expect(component.currentStep()).toBe(2); // going "back" via goToStep is allowed
    });

    it('getStepState should report done/active/pending correctly', () => {
      component.currentStep.set(2);
      expect(component.getStepState(1)).toBe('done');
      expect(component.getStepState(2)).toBe('active');
      expect(component.getStepState(3)).toBe('pending');
    });

    it('next() should block on step 1 when projectName is missing', () => {
      component.projectName = '';
      component.projectUrl = 'https://x.com';
      component.projectDescription = 'desc';

      component.next();

      expect(alertSpy).toHaveBeenCalledWith('Le nom du projet est requis');
      expect(component.currentStep()).toBe(1);
    });

    it('next() should block on step 1 when projectUrl is missing', () => {
      component.projectName = 'My project';
      component.projectUrl = '   ';
      component.projectDescription = 'desc';

      component.next();

      expect(alertSpy).toHaveBeenCalledWith("L'URL cible est requise");
      expect(component.currentStep()).toBe(1);
    });

    it('next() should block on step 1 when description is missing', () => {
      component.projectName = 'My project';
      component.projectUrl = 'https://x.com';
      component.projectDescription = '';

      component.next();

      expect(alertSpy).toHaveBeenCalledWith('La description est requise');
      expect(component.currentStep()).toBe(1);
    });

    it('next() should advance to step 2 when step 1 fields are all filled', () => {
      component.projectName = 'My project';
      component.projectUrl = 'https://x.com';
      component.projectDescription = 'desc';

      component.next();

      expect(component.currentStep()).toBe(2);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('next() should block on step 2 in SPEC_DOCUMENT mode without an uploaded file', () => {
      component.projectName = 'My project';
      component.projectUrl = 'https://x.com';
      component.projectDescription = 'desc';
      component.next(); // -> step 2

      component.selectMode(component.generationModes.find((m) => m.key === 'SPEC_DOCUMENT')!);

      component.next();

      expect(alertSpy).toHaveBeenCalledWith('Veuillez uploader au moins un document de spécification');
      expect(component.currentStep()).toBe(2);
    });

    it('next() should block on step 2 when no test type is selected', () => {
      component.projectName = 'My project';
      component.projectUrl = 'https://x.com';
      component.projectDescription = 'desc';
      component.next(); // -> step 2
      component.testTypes.forEach((t) => (t.selected = false));

      component.next();

      expect(alertSpy).toHaveBeenCalledWith('Sélectionnez au moins un type de test');
      expect(component.currentStep()).toBe(2);
    });

    it('next() should advance from step 2 to step 3 when valid', () => {
      component.projectName = 'My project';
      component.projectUrl = 'https://x.com';
      component.projectDescription = 'desc';
      component.next(); // -> step 2

      component.next(); // default test types already selected -> step 3

      expect(component.currentStep()).toBe(3);
    });

    it('next() should advance from step 3 to step 4 without extra validation', () => {
      component.currentStep.set(3);
      component.next();
      expect(component.currentStep()).toBe(4);
    });

    it('prev() should decrement the step but never below 1', () => {
      component.currentStep.set(2);
      component.prev();
      expect(component.currentStep()).toBe(1);

      component.prev();
      expect(component.currentStep()).toBe(1);
    });

    it('next() on step 4 should call launch() instead of advancing further', () => {
      spyOn(component, 'launch');
      component.currentStep.set(4);

      component.next();

      expect(component.launch).toHaveBeenCalled();
      expect(component.currentStep()).toBe(4);
    });
  });

  describe('saveDraft', () => {
    it('should alert the user', () => {
      component.saveDraft();
      expect(alertSpy).toHaveBeenCalledWith('Brouillon sauvegardé !');
    });
  });

  describe('cancel', () => {
    it('should navigate back to the projects list', () => {
      component.cancel();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/projects']);
    });
  });

  // ── launch() / _runAiAnalysis() ────────────────────────────────────────
  describe('launch', () => {
    beforeEach(() => {
      component.projectName = 'My project';
      component.projectUrl = 'https://x.com';
      component.projectDescription = 'desc';
    });

    it('should do nothing if already submitting', () => {
      component.isSubmitting.set(true);
      component.launch();
      expect(projectApiSpy.createProject).not.toHaveBeenCalled();
    });

    it('should set submission state and call createProject with the right payload', () => {
      projectApiSpy.createProject.and.returnValue(new Subject<any>()); // never resolves for this assertion
      component.launch();

      expect(component.isSubmitting()).toBeTrue();
      expect(component.submitError()).toBeNull();
      expect(projectApiSpy.createProject).toHaveBeenCalledTimes(1);
      const payload = projectApiSpy.createProject.calls.mostRecent().args[0];
      expect(payload.name).toBe('My project');
      expect(payload.url).toBe('https://x.com');
      expect(payload.generationMode).toBe('URL_CRAWL');
      expect(payload.frameworkName).toBe('PLAYWRIGHT');
    });

    it('should set submitError and stop submitting when createProject fails', () => {
      projectApiSpy.createProject.and.returnValue(throwError(() => new Error('boom')));

      component.launch();

      expect(component.isSubmitting()).toBeFalse();
      expect(component.submitError()).toBe('boom');
      expect(aiSvcSpy.generateFromUrl).not.toHaveBeenCalled();
    });

    it('should run URL-based AI analysis, store proposals, and navigate to ai-review on success', () => {
      projectApiSpy.createProject.and.returnValue(of({ success: true, data: { id: 'p1', name: 'My project' } }));
      const { job, progress$, result$ } = makeJob();
      aiSvcSpy.generateFromUrl.and.returnValue(job);

      component.launch();

      expect(aiSvcSpy.generateFromUrl).toHaveBeenCalledWith('p1', 'https://x.com', { maxPages: 3, maxDepth: 1 });

      progress$.next({ status: 'crawling', message: 'Exploration...' });
      expect(component.aiStatusLabel()).toBe('Exploration...');

      const scenarios = [{ tempId: 't1' }] as any;
      result$.next({ scenarios, pagesExplored: 4 });

      expect(component.aiProgressPct()).toBe(100);
      expect(component.isSubmitting()).toBeFalse();
      expect(aiReviewStoreSpy.set).toHaveBeenCalledWith({
        projectId: 'p1',
        projectName: 'My project',
        source: 'url',
        proposals: scenarios,
        pagesExplored: 4,
      });
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/projects', 'p1', 'ai-review']);
    });

    it('should use generateFromDocument when in SPEC_DOCUMENT mode', () => {
      component.selectMode(component.generationModes.find((m) => m.key === 'SPEC_DOCUMENT')!);
      const specFile = makeFile('spec.pdf', 'application/pdf', 1024);
      component.uploadedFiles = [{ file: specFile, name: 'spec.pdf', sizeLabel: '1.0 KB', mimeType: 'application/pdf' }];

      projectApiSpy.createProject.and.returnValue(of({ success: true, data: { id: 'p2', name: 'My project' } }));
      const { job } = makeJob();
      aiSvcSpy.generateFromDocument.and.returnValue(job);

      component.launch();

      expect(aiSvcSpy.generateFromDocument).toHaveBeenCalledWith('p2', specFile);
    });

    it('should alert and redirect to scenarios when the AI job errors out', () => {
      projectApiSpy.createProject.and.returnValue(of({ success: true, data: { id: 'p3', name: 'My project' } }));
      const { job, error$ } = makeJob();
      aiSvcSpy.generateFromUrl.and.returnValue(job);

      component.launch();
      error$.next('AI service unavailable');

      expect(component.isSubmitting()).toBeFalse();
      expect(component.aiStatusLabel()).toBe('');
      expect(alertSpy).toHaveBeenCalled();
      expect(alertSpy.calls.mostRecent().args[0]).toContain('AI service unavailable');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/projects', 'p3', 'scenarios']);
    });
  });
});
