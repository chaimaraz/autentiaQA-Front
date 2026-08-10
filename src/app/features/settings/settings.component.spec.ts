import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsComponent } from './settings.component';
import { AuthService, ProjectAccess } from '../../services/auth.service';

function makeProject(overrides: Partial<ProjectAccess> = {}): ProjectAccess {
  return {
    projectId: 'p1',
    projectName: 'Project 1',
    projectStatus: 'ACTIVE',
    role: 'MEMBRE',
    permissions: [],
    ...overrides,
  };
}

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  function configure(projects: ProjectAccess[], isSuperAdmin = false, isAdmin = false): void {
    authServiceSpy = {
      projects: jasmine.createSpy('projects').and.returnValue(projects),
      isSuperAdmin: jasmine.createSpy('isSuperAdmin').and.returnValue(isSuperAdmin),
      isAdmin: jasmine.createSpy('isAdmin').and.returnValue(isAdmin),
    } as unknown as jasmine.SpyObj<AuthService>;

    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [{ provide: AuthService, useValue: authServiceSpy }],
    });

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  }

  it('should create', () => {
    configure([]);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('adminProjects', () => {
    it('keeps only projects where the user is ADMIN when not superadmin', () => {
      const projects = [
        makeProject({ projectId: 'a', role: 'ADMIN' }),
        makeProject({ projectId: 'b', role: 'MEMBRE' }),
        makeProject({ projectId: 'c', role: 'OBSERVATEUR' }),
      ];
      configure(projects, false);
      expect(component.adminProjects().map((p) => p.projectId)).toEqual(['a']);
    });

    it('returns every project when the user is superadmin, regardless of role', () => {
      const projects = [
        makeProject({ projectId: 'a', role: 'MEMBRE' }),
        makeProject({ projectId: 'b', role: 'OBSERVATEUR' }),
      ];
      configure(projects, true);
      expect(component.adminProjects().map((p) => p.projectId)).toEqual(['a', 'b']);
    });

    it('is empty when the user has no projects', () => {
      configure([], false);
      expect(component.adminProjects()).toEqual([]);
    });
  });

  describe('canManageAccessControl / isSuperAdmin', () => {
    it('canManageAccessControl reflects auth.isAdmin()', () => {
      configure([], false, true);
      expect(component.canManageAccessControl()).toBeTrue();
    });

    it('canManageAccessControl is false when auth.isAdmin() is false', () => {
      configure([], false, false);
      expect(component.canManageAccessControl()).toBeFalse();
    });

    it('isSuperAdmin reflects auth.isSuperAdmin()', () => {
      configure([], true, false);
      expect(component.isSuperAdmin()).toBeTrue();
    });
  });

  describe('constructor project selection', () => {
    it('selects the first admin project id automatically', () => {
      const projects = [makeProject({ projectId: 'first', role: 'ADMIN' }), makeProject({ projectId: 'second', role: 'ADMIN' })];
      configure(projects, false);
      expect(component.selectedProjectId()).toBe('first');
    });

    it('leaves selectedProjectId empty when there are no admin projects', () => {
      configure([makeProject({ projectId: 'x', role: 'MEMBRE' })], false);
      expect(component.selectedProjectId()).toBe('');
    });
  });

  describe('setTab', () => {
    it('updates the active tab', () => {
      configure([], false);
      expect(component.activeTab()).toBe('general');
      component.setTab('jira');
      expect(component.activeTab()).toBe('jira');
      component.setTab('platform-admins');
      expect(component.activeTab()).toBe('platform-admins');
    });
  });

  describe('onProjectChange', () => {
    it('updates selectedProjectId', () => {
      configure([makeProject({ projectId: 'a', role: 'ADMIN' })], false);
      expect(component.selectedProjectId()).toBe('a');
      component.onProjectChange('other-project');
      expect(component.selectedProjectId()).toBe('other-project');
    });
  });
});
