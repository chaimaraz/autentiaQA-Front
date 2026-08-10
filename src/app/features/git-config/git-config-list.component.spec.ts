import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { GitConfigListComponent } from './git-config-list.component';
import { GitConfigService, GitRepoConfig, GitWebhookEventItem } from '../../services/git-config.service';
import { ProjectApiService, ApiResponse } from '../../services/project-api.service';

describe('GitConfigListComponent', () => {
  let component: GitConfigListComponent;
  let fixture: ComponentFixture<GitConfigListComponent>;
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
    notifyEmails: '',
    webhookSecret: 'secret123',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...over,
  });

  function configure(opts: {
    queryProjectId?: string | null;
    projects?: { id: string; name: string }[];
    repos?: GitRepoConfig[];
  } = {}) {
    gitConfig = jasmine.createSpyObj<GitConfigService>('GitConfigService', [
      'list', 'getEvents', 'buildWebhookUrl', 'buildCiFileName', 'buildCiFileContent',
      'regenerateSecret', 'remove',
    ]);
    projectApi = jasmine.createSpyObj<ProjectApiService>('ProjectApiService', ['listProjects']);
    router = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    // RouterLink needs these to render its href — the spy needs harmless stand-ins.
    (router as any).events = of();
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/');

    const projects = opts.projects ?? [{ id: 'p1', name: 'Project One' }, { id: 'p2', name: 'Project Two' }];
    projectApi.listProjects.and.returnValue(of({ success: true, data: projects } as ApiResponse<any[]>));

    gitConfig.list.and.returnValue(of({ success: true, data: opts.repos ?? [] } as ApiResponse<GitRepoConfig[]>));
    gitConfig.getEvents.and.returnValue(of({ success: true, data: [] as GitWebhookEventItem[], total: 0, totalPages: 0 }));
    gitConfig.buildWebhookUrl.and.callFake((base: string, repoId: string) => `${base}/api/webhooks/git/${repoId}`);
    gitConfig.buildCiFileName.and.returnValue('autentiaqa.yml');
    gitConfig.buildCiFileContent.and.returnValue('# ci file');
    gitConfig.regenerateSecret.and.returnValue(of({ success: true, data: makeRepo() } as ApiResponse<GitRepoConfig>));
    gitConfig.remove.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [GitConfigListComponent],
      providers: [
        { provide: GitConfigService, useValue: gitConfig },
        { provide: ProjectApiService, useValue: projectApi },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'projectId' ? (opts.queryProjectId ?? null) : null) } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GitConfigListComponent);
    component = fixture.componentInstance;
  }

  describe('ngOnInit', () => {
    it('loads projects, preselects the query param project and loads its repos', () => {
      configure({ queryProjectId: 'p2', repos: [makeRepo()] });
      fixture.detectChanges();

      expect(component).toBeTruthy();
      expect(projectApi.listProjects).toHaveBeenCalled();
      expect(component.projects().map(p => p.id)).toEqual(['p1', 'p2']);
      expect(component.projectId()).toBe('p2');
      expect(gitConfig.list).toHaveBeenCalledWith('p2');
      expect(component.repos().length).toBe(1);
      expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
        queryParams: { projectId: 'p2' },
      }));
    });

    it('falls back to the first project when the query param project is unknown', () => {
      configure({ queryProjectId: 'does-not-exist' });
      fixture.detectChanges();
      expect(component.projectId()).toBe('p1');
    });

    it('falls back to the first project when no query param is given', () => {
      configure();
      fixture.detectChanges();
      expect(component.projectId()).toBe('p1');
    });

    it('leaves projectId null when there are no projects at all', () => {
      configure({ projects: [] });
      fixture.detectChanges();
      expect(component.projectId()).toBeNull();
      expect(gitConfig.list).not.toHaveBeenCalled();
    });

    it('sets errorMessage and stops loadingProjects on failure', () => {
      configure();
      projectApi.listProjects.and.returnValue(throwError(() => new Error('boom')));
      fixture.detectChanges();
      expect(component.errorMessage()).toBe('boom');
      expect(component.loadingProjects()).toBeFalse();
    });
  });

  describe('loadRepos', () => {
    beforeEach(() => { configure({ queryProjectId: 'p1' }); fixture.detectChanges(); });

    it('does nothing when there is no selected project', () => {
      component.projectId.set(null);
      gitConfig.list.calls.reset();
      component.loadRepos();
      expect(gitConfig.list).not.toHaveBeenCalled();
    });

    it('sets errorMessage and stops loading on failure', () => {
      gitConfig.list.and.returnValue(throwError(() => new Error('list failed')));
      component.loadRepos();
      expect(component.errorMessage()).toBe('list failed');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('onProjectChange', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('switches project, clears edit/expand state, updates the route and reloads repos', () => {
      component.editingRepo.set(makeRepo());
      component.expandedRepoId.set('repo1');
      gitConfig.list.calls.reset();

      component.onProjectChange('p2');

      expect(component.projectId()).toBe('p2');
      expect(component.editingRepo()).toBeNull();
      expect(component.expandedRepoId()).toBeNull();
      expect(gitConfig.list).toHaveBeenCalledWith('p2');
    });
  });

  describe('toggleEvents', () => {
    beforeEach(() => { configure({ queryProjectId: 'p1' }); fixture.detectChanges(); });

    it('does nothing without a selected project', () => {
      component.projectId.set(null);
      component.toggleEvents(makeRepo());
      expect(gitConfig.getEvents).not.toHaveBeenCalled();
    });

    it('collapses when toggling the already-expanded repo', () => {
      component.expandedRepoId.set('repo1');
      component.toggleEvents(makeRepo({ id: 'repo1' }));
      expect(component.expandedRepoId()).toBeNull();
      expect(gitConfig.getEvents).not.toHaveBeenCalled();
    });

    it('expands and loads events for a different repo', () => {
      const events = [{ id: 'e1' } as GitWebhookEventItem];
      gitConfig.getEvents.and.returnValue(of({ success: true, data: events, total: 1, totalPages: 1 }));
      component.toggleEvents(makeRepo({ id: 'repo2' }));
      expect(component.expandedRepoId()).toBe('repo2');
      expect(gitConfig.getEvents).toHaveBeenCalledWith('p1', 'repo2');
      expect(component.events()).toEqual(events);
    });

    it('resets events to empty array on load error', () => {
      gitConfig.getEvents.and.returnValue(throwError(() => new Error('boom')));
      component.toggleEvents(makeRepo({ id: 'repo2' }));
      expect(component.events()).toEqual([]);
    });
  });

  describe('webhookUrl / ciFileName / ciFileContent', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('delegates to GitConfigService with the configured backend base url', () => {
      const repo = makeRepo();
      expect(component.webhookUrl(repo)).toBe(`${component.backendBaseUrl}/api/webhooks/git/${repo.id}`);
      expect(component.ciFileName(repo)).toBe('autentiaqa.yml');
      expect(component.ciFileContent(repo)).toBe('# ci file');
      expect(gitConfig.buildCiFileContent).toHaveBeenCalledWith(repo, component.webhookUrl(repo));
    });
  });

  describe('copyToClipboard', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('writes the given text to the clipboard when available', () => {
      const writeSpy = jasmine.createSpy('writeText');
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeSpy }, configurable: true });
      component.copyToClipboard('hello');
      expect(writeSpy).toHaveBeenCalledWith('hello');
    });
  });

  describe('downloadCiFile', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('builds a Blob from the CI content and triggers a download', () => {
      spyOn(URL, 'createObjectURL').and.returnValue('blob:fake-url');
      spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      component.downloadCiFile(makeRepo());

      expect(gitConfig.buildCiFileContent).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    });
  });

  describe('startEdit / onFormSaved / onFormCancelled', () => {
    beforeEach(() => { configure({ queryProjectId: 'p1' }); fixture.detectChanges(); });

    it('startEdit sets the editing repo', () => {
      const repo = makeRepo();
      component.startEdit(repo);
      expect(component.editingRepo()).toBe(repo);
    });

    it('onFormSaved clears the editing repo and reloads', () => {
      component.editingRepo.set(makeRepo());
      gitConfig.list.calls.reset();
      component.onFormSaved();
      expect(component.editingRepo()).toBeNull();
      expect(gitConfig.list).toHaveBeenCalled();
    });

    it('onFormCancelled clears the editing repo without reloading', () => {
      component.editingRepo.set(makeRepo());
      gitConfig.list.calls.reset();
      component.onFormCancelled();
      expect(component.editingRepo()).toBeNull();
      expect(gitConfig.list).not.toHaveBeenCalled();
    });
  });

  describe('regenerateSecret', () => {
    beforeEach(() => { configure({ queryProjectId: 'p1' }); fixture.detectChanges(); });

    it('does nothing without a selected project', () => {
      component.projectId.set(null);
      component.regenerateSecret(makeRepo());
      expect(gitConfig.regenerateSecret).not.toHaveBeenCalled();
    });

    it('reloads the repo list on success', () => {
      gitConfig.list.calls.reset();
      component.regenerateSecret(makeRepo());
      expect(gitConfig.regenerateSecret).toHaveBeenCalledWith('p1', 'repo1');
      expect(gitConfig.list).toHaveBeenCalled();
    });

    it('sets errorMessage on failure', () => {
      gitConfig.regenerateSecret.and.returnValue(throwError(() => new Error('regen failed')));
      component.regenerateSecret(makeRepo());
      expect(component.errorMessage()).toBe('regen failed');
    });
  });

  describe('removeRepo', () => {
    beforeEach(() => { configure({ queryProjectId: 'p1' }); fixture.detectChanges(); });

    it('does nothing when the confirm dialog is declined', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.removeRepo(makeRepo());
      expect(gitConfig.remove).not.toHaveBeenCalled();
    });

    it('does nothing without a selected project, even if confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      component.projectId.set(null);
      component.removeRepo(makeRepo());
      expect(gitConfig.remove).not.toHaveBeenCalled();
    });

    it('removes the repo and reloads the list when confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      gitConfig.list.calls.reset();
      const repo = makeRepo();
      component.removeRepo(repo);
      expect(window.confirm).toHaveBeenCalledWith(jasmine.stringMatching(repo.name));
      expect(gitConfig.remove).toHaveBeenCalledWith('p1', 'repo1');
      expect(gitConfig.list).toHaveBeenCalled();
    });

    it('sets errorMessage on failure', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      gitConfig.remove.and.returnValue(throwError(() => new Error('remove failed')));
      component.removeRepo(makeRepo());
      expect(component.errorMessage()).toBe('remove failed');
    });
  });

  describe('pure display-mapping helpers', () => {
    beforeEach(() => { configure(); fixture.detectChanges(); });

    it('decisionLabel maps every known decision, with a fallback to the raw value', () => {
      expect(component.decisionLabel('ACCEPTED')).toBe('Merge recommandé');
      expect(component.decisionLabel('REJECTED')).toBe('Merge à bloquer');
      expect(component.decisionLabel('PENDING')).toBe('En cours');
      expect(component.decisionLabel('SKIPPED')).toBe('Ignoré');
      expect(component.decisionLabel('WEIRD')).toBe('WEIRD');
    });

    it('decisionIcon maps every known decision, with a fallback', () => {
      expect(component.decisionIcon('ACCEPTED')).toBe('fa-circle-check');
      expect(component.decisionIcon('REJECTED')).toBe('fa-ban');
      expect(component.decisionIcon('PENDING')).toBe('fa-spinner fa-spin');
      expect(component.decisionIcon('SKIPPED')).toBe('fa-circle-info');
      expect(component.decisionIcon('WEIRD')).toBe('fa-circle-info');
    });

    it('decisionClass maps every known decision, with a fallback to idle', () => {
      expect(component.decisionClass('ACCEPTED')).toBe('passed');
      expect(component.decisionClass('REJECTED')).toBe('failed');
      expect(component.decisionClass('PENDING')).toBe('running');
      expect(component.decisionClass('SKIPPED')).toBe('idle');
      expect(component.decisionClass('WEIRD')).toBe('idle');
    });

    it('providerIcon maps every known provider, with a fallback for unknown/undefined', () => {
      expect(component.providerIcon('GITHUB')).toBe('fa-brands fa-github');
      expect(component.providerIcon('GITLAB')).toBe('fa-brands fa-gitlab');
      expect(component.providerIcon('BITBUCKET')).toBe('fa-brands fa-bitbucket');
      expect(component.providerIcon('OTHER')).toBe('fa-solid fa-code-branch');
      expect(component.providerIcon(undefined)).toBe('fa-solid fa-code-branch');
    });

    it('roleIcon maps every known role, with a fallback', () => {
      expect(component.roleIcon('FRONTEND')).toBe('fa-solid fa-desktop');
      expect(component.roleIcon('BACKEND')).toBe('fa-solid fa-gear');
      expect(component.roleIcon('MOBILE')).toBe('fa-solid fa-mobile-screen');
      expect(component.roleIcon('INFRA')).toBe('fa-solid fa-toolbox');
      expect(component.roleIcon('OTHER')).toBe('fa-solid fa-box');
    });
  });
});
