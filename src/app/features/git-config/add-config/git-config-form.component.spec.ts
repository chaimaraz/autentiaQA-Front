import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { GitConfigFormComponent } from './git-config-form.component';
import { GitConfigService, GitRepoConfig } from '../../../services/git-config.service';
import { ProjectApiService, ApiResponse } from '../../../services/project-api.service';

describe('GitConfigFormComponent', () => {
  let component: GitConfigFormComponent;
  let fixture: ComponentFixture<GitConfigFormComponent>;
  let gitConfig: jasmine.SpyObj<GitConfigService>;
  let projectApi: jasmine.SpyObj<ProjectApiService>;
  let router: jasmine.SpyObj<Router>;

  const makeRepo = (over: Partial<GitRepoConfig> = {}): GitRepoConfig => ({
    id: 'repo1',
    projectId: 'p1',
    name: 'Frontend repo',
    role: 'FRONTEND',
    provider: 'GITHUB',
    repoUrl: 'https://github.com/org/repo',
    branch: 'main',
    onPush: true,
    onPr: true,
    onTag: false,
    onSchedule: false,
    notifyEmail: true,
    notifySlack: false,
    createJiraBug: false,
    blockMerge: false,
    notifyEmails: 'a@b.com',
    webhookSecret: 'secret123',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...over,
  });

  function configure(queryProjectId: string | null = null) {
    gitConfig = jasmine.createSpyObj<GitConfigService>('GitConfigService', ['create', 'update']);
    projectApi = jasmine.createSpyObj<ProjectApiService>('ProjectApiService', ['listProjects']);
    router = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    // RouterLink needs these to render its href — the spy needs harmless stand-ins.
    (router as any).events = of();
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/');

    projectApi.listProjects.and.returnValue(of({ success: true, data: [{ id: 'p1', name: 'P1' }] } as ApiResponse<any[]>));

    TestBed.configureTestingModule({
      imports: [GitConfigFormComponent],
      providers: [
        { provide: GitConfigService, useValue: gitConfig },
        { provide: ProjectApiService, useValue: projectApi },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'projectId' ? queryProjectId : null) } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GitConfigFormComponent);
    component = fixture.componentInstance;
  }

  describe('ngOnInit', () => {
    it('keeps the @Input projectId when already provided and skips loading the project list', () => {
      configure();
      component.projectId = 'p1';
      fixture.detectChanges();
      expect(component.projectId).toBe('p1');
      expect(projectApi.listProjects).not.toHaveBeenCalled();
    });

    it('falls back to the ?projectId query param without loading the project list', () => {
      // A resolved projectId (Input or query param) means the picker is
      // unnecessary — _loadProjects() only runs when projectId stays unknown.
      configure('p2');
      fixture.detectChanges();
      expect(component.projectId).toBe('p2');
      expect(projectApi.listProjects).not.toHaveBeenCalled();
    });

    it('loads the project list when neither the @Input nor the query param provide a projectId', () => {
      configure(null);
      fixture.detectChanges();
      expect(component.projectId).toBeNull();
      expect(projectApi.listProjects).toHaveBeenCalled();
      expect(component.projects()).toEqual([{ id: 'p1', name: 'P1' }]);
      expect(component.loadingProjects()).toBeFalse();
    });

    it('sets loadingProjects false on project list load failure', () => {
      configure();
      projectApi.listProjects.and.returnValue(throwError(() => new Error('boom')));
      fixture.detectChanges();
      expect(component.loadingProjects()).toBeFalse();
    });

    it('prefills the form from an existing repo config', () => {
      configure();
      component.projectId = 'p1';
      component.existing = makeRepo({ name: 'Existing repo', branch: 'develop' });
      fixture.detectChanges();
      expect(component.form.name).toBe('Existing repo');
      expect(component.form.branch).toBe('develop');
      expect(component.form.provider).toBe('GITHUB');
    });

    it('starts from an empty form when there is no existing repo config', () => {
      configure();
      component.projectId = 'p1';
      fixture.detectChanges();
      expect(component.form).toEqual({
        name: '', role: 'OTHER', provider: 'OTHER', repoUrl: '', branch: 'main',
        onPush: true, onPr: true, onTag: false, onSchedule: false,
        notifyEmail: true, notifySlack: false, createJiraBug: false, blockMerge: false,
        notifyEmails: '',
      });
    });
  });

  describe('isStandalonePage', () => {
    it('is true by default (not embedded)', () => {
      configure();
      component.projectId = 'p1';
      fixture.detectChanges();
      expect(component.isStandalonePage).toBeTrue();
    });

    it('is false when embedded', () => {
      configure();
      component.projectId = 'p1';
      component.embedded = true;
      fixture.detectChanges();
      expect(component.isStandalonePage).toBeFalse();
    });
  });

  describe('submit — validation', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('sets an error and does not call the service when no project is selected', () => {
      component.projectId = null;
      component.form.name = 'x';
      component.submit();
      expect(component.errorMessage()).toBe('Sélectionnez le projet auquel rattacher ce dépôt.');
      expect(gitConfig.create).not.toHaveBeenCalled();
    });

    it('sets an error when neither name nor repoUrl is filled in', () => {
      component.projectId = 'p1';
      component.form.name = '   ';
      component.form.repoUrl = '   ';
      component.submit();
      expect(component.errorMessage()).toBe('Renseignez au moins un nom ou une URL de dépôt.');
      expect(gitConfig.create).not.toHaveBeenCalled();
    });

    it('does nothing while already saving (re-entrancy guard)', () => {
      component.projectId = 'p1';
      component.form.name = 'x';
      component.isSaving.set(true);
      component.submit();
      expect(gitConfig.create).not.toHaveBeenCalled();
    });

    it('accepts a form with only a repoUrl (no name)', () => {
      component.projectId = 'p1';
      component.form.name = '';
      component.form.repoUrl = 'https://github.com/org/repo';
      gitConfig.create.and.returnValue(of({ success: true, data: makeRepo() } as ApiResponse<GitRepoConfig>));
      component.submit();
      expect(gitConfig.create).toHaveBeenCalled();
    });
  });

  describe('submit — create flow', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); component.projectId = 'p1'; component.form.name = 'New repo'; });

    it('calls create() with the form payload and emits saved on success', () => {
      const created = makeRepo({ id: 'new1' });
      gitConfig.create.and.returnValue(of({ success: true, data: created } as ApiResponse<GitRepoConfig>));
      const savedSpy = jasmine.createSpy('saved');
      component.saved.subscribe(savedSpy);

      component.submit();

      expect(gitConfig.create).toHaveBeenCalledWith('p1', component.form);
      expect(component.isSaving()).toBeFalse();
      expect(savedSpy).toHaveBeenCalledWith(created);
    });

    it('navigates back to the git-config list when used as a standalone page', () => {
      gitConfig.create.and.returnValue(of({ success: true, data: makeRepo() } as ApiResponse<GitRepoConfig>));
      component.submit();
      expect(router.navigate).toHaveBeenCalledWith(['/git-config'], { queryParams: { projectId: 'p1' } });
    });

    it('does not navigate when embedded', () => {
      component.embedded = true;
      gitConfig.create.and.returnValue(of({ success: true, data: makeRepo() } as ApiResponse<GitRepoConfig>));
      component.submit();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('sets errorMessage and stops saving on failure', () => {
      gitConfig.create.and.returnValue(throwError(() => new Error('create failed')));
      component.submit();
      expect(component.isSaving()).toBeFalse();
      expect(component.errorMessage()).toBe('create failed');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('submit — update flow', () => {
    it('calls update() with the existing repo id when editing', () => {
      configure();
      component.projectId = 'p1';
      const existing = makeRepo({ id: 'repo9' });
      component.existing = existing;
      fixture.detectChanges();
      gitConfig.update.and.returnValue(of({ success: true, data: existing } as ApiResponse<GitRepoConfig>));

      component.submit();

      expect(gitConfig.update).toHaveBeenCalledWith('p1', 'repo9', component.form);
      expect(gitConfig.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('emits cancelled and navigates to the list when standalone', () => {
      configure();
      component.projectId = 'p1';
      fixture.detectChanges();
      const cancelledSpy = jasmine.createSpy('cancelled');
      component.cancelled.subscribe(cancelledSpy);

      component.cancel();

      expect(cancelledSpy).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/git-config']);
    });

    it('emits cancelled without navigating when embedded', () => {
      configure();
      component.projectId = 'p1';
      component.embedded = true;
      fixture.detectChanges();
      const cancelledSpy = jasmine.createSpy('cancelled');
      component.cancelled.subscribe(cancelledSpy);

      component.cancel();

      expect(cancelledSpy).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('role/provider chip selection (template)', () => {
    beforeEach(() => { configure(); component.projectId = 'p1'; fixture.detectChanges(); });

    it('exposes the expected role and provider chip options', () => {
      expect(component.roleOptions.map(r => r.key)).toEqual(['FRONTEND', 'BACKEND', 'MOBILE', 'INFRA', 'OTHER']);
      expect(component.providerOptions.map(p => p.key)).toEqual(['GITHUB', 'GITLAB', 'BITBUCKET', 'OTHER']);
    });

    it('clicking a role chip in the template updates form.role', () => {
      const chips: HTMLElement[] = fixture.nativeElement.querySelectorAll('.gcf-chip');
      // the first 5 chips are role options, in the same order as roleOptions
      const backendChipIndex = component.roleOptions.findIndex(r => r.key === 'BACKEND');
      chips[backendChipIndex].click();
      fixture.detectChanges();
      expect(component.form.role).toBe('BACKEND');
    });

    it('clicking a provider chip in the template updates form.provider', () => {
      const chips: HTMLElement[] = fixture.nativeElement.querySelectorAll('.gcf-chip');
      const providerChipStart = component.roleOptions.length;
      const gitlabIndex = component.providerOptions.findIndex(p => p.key === 'GITLAB');
      chips[providerChipStart + gitlabIndex].click();
      fixture.detectChanges();
      expect(component.form.provider).toBe('GITLAB');
    });
  });
});
