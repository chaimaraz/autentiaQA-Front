import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { ProfileComponent } from './profile.component';
import { AuthService, AuthUser, ProjectAccess } from '../../services/auth.service';

class MockAuthService {
  private _user = signal<AuthUser | null>(null);
  private _projects = signal<ProjectAccess[]>([]);
  user = this._user.asReadonly();
  projects = this._projects.asReadonly();

  setUser(u: AuthUser | null) {
    this._user.set(u);
  }
  setProjects(p: ProjectAccess[]) {
    this._projects.set(p);
  }
}

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let httpMock: HttpTestingController;
  let mockAuth: MockAuthService;

  const mockUser: AuthUser = {
    id: 'u1',
    email: 'jane.doe@example.com',
    name: 'Jane Doe',
    globalRole: 'USER',
  };

  beforeEach(async () => {
    localStorage.clear();
    mockAuth = new MockAuthService();
    mockAuth.setUser(mockUser);
    mockAuth.setProjects([{ projectId: 'p1', projectName: 'P1', projectStatus: 'ACTIVE', role: 'MEMBRE', permissions: [] }]);

    await TestBed.configureTestingModule({
      imports: [ProfileComponent, HttpClientTestingModule],
      providers: [{ provide: AuthService, useValue: mockAuth }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create and seed the form from the current user', () => {
    expect(component).toBeTruthy();
    expect(component.form.name).toBe('Jane Doe');
    expect(component.form.email).toBe('jane.doe@example.com');
  });

  describe('initials', () => {
    it('should compute initials from first and last name', () => {
      expect(component.initials()).toBe('JD');
    });

    it('should fall back to "?" when there is no user name', () => {
      mockAuth.setUser({ ...mockUser, name: '' });
      expect(component.initials()).toBe('?');
    });

    it('should handle a single-word name', () => {
      mockAuth.setUser({ ...mockUser, name: 'Madonna' });
      expect(component.initials()).toBe('M');
    });
  });

  it('stats.projectsCount should reflect auth.projects().length', () => {
    expect(component.stats().projectsCount).toBe(1);
    expect(component.stats().scenariosCount).toBe(0);
    expect(component.stats().executionsCount).toBe(0);
  });

  describe('toggleEdit', () => {
    it('should flip editing state and clear messages', () => {
      component.error.set('some error');
      component.success.set('some success');

      component.toggleEdit();

      expect(component.editing()).toBeTrue();
      expect(component.error()).toBe('');
      expect(component.success()).toBe('');
    });

    it('should discard unsaved form changes when leaving edit mode', () => {
      component.toggleEdit(); // enter edit mode
      component.form.name = 'Changed Name';
      component.form.email = 'changed@example.com';

      component.toggleEdit(); // leave edit mode

      expect(component.editing()).toBeFalse();
      expect(component.form.name).toBe('Jane Doe');
      expect(component.form.email).toBe('jane.doe@example.com');
    });
  });

  describe('setTheme', () => {
    it('should update the theme signal, the DOM attribute and localStorage', () => {
      component.setTheme('light');

      expect(component.theme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('aq-theme')).toBe('light');
    });
  });

  describe('saveProfile', () => {
    it('should set an error and not call the backend when the name is blank', () => {
      component.form.name = '   ';
      component.form.email = 'jane@example.com';

      component.saveProfile();

      expect(component.error()).toBe('Le nom est requis.');
      httpMock.expectNone('http://localhost:3000/api/auth/me');
    });

    it('should set an error and not call the backend when the email is invalid', () => {
      component.form.name = 'Jane Doe';
      component.form.email = 'not-an-email';

      component.saveProfile();

      expect(component.error()).toBe('Adresse email invalide.');
      httpMock.expectNone('http://localhost:3000/api/auth/me');
    });

    it('should PATCH /auth/me and update state on success', fakeAsync(() => {
      component.form.name = 'Jane Doe';
      component.form.email = 'jane@example.com';
      component.editing.set(true);

      component.saveProfile();

      expect(component.saving()).toBeTrue();

      const req = httpMock.expectOne('http://localhost:3000/api/auth/me');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'Jane Doe', email: 'jane@example.com' });
      req.flush({ success: true, data: {} });

      expect(component.saving()).toBeFalse();
      expect(component.editing()).toBeFalse();
      expect(component.success()).toBe('Profil mis à jour.');

      tick(3000);
      expect(component.success()).toBe('');
    }));

    it('should set error message from the backend on failure', () => {
      component.form.name = 'Jane Doe';
      component.form.email = 'jane@example.com';

      component.saveProfile();

      const req = httpMock.expectOne('http://localhost:3000/api/auth/me');
      req.flush({ message: 'Server exploded' }, { status: 500, statusText: 'Server Error' });

      expect(component.saving()).toBeFalse();
      expect(component.error()).toBe('Server exploded');
    });

    it('should fall back to a default error message when the backend gives none', () => {
      component.form.name = 'Jane Doe';
      component.form.email = 'jane@example.com';

      component.saveProfile();

      const req = httpMock.expectOne('http://localhost:3000/api/auth/me');
      req.flush({}, { status: 404, statusText: 'Not Found' });

      expect(component.error()).toContain('PATCH /api/auth/me');
    });
  });

  describe('changePassword', () => {
    it('should error out when required fields are missing', () => {
      component.pwForm = { current: '', next: '', confirm: '' };

      component.changePassword();

      expect(component.pwError()).toBe('Tous les champs sont requis.');
      httpMock.expectNone('http://localhost:3000/api/auth/change-password');
    });

    it('should error out when the new password is too short', () => {
      component.pwForm = { current: 'old-pass', next: 'short', confirm: 'short' };

      component.changePassword();

      expect(component.pwError()).toBe('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    });

    it('should error out when confirmation does not match', () => {
      component.pwForm = { current: 'old-pass', next: 'longenough', confirm: 'different' };

      component.changePassword();

      expect(component.pwError()).toBe('La confirmation ne correspond pas.');
    });

    it('should POST /auth/change-password and reset the form on success', () => {
      component.pwForm = { current: 'old-pass', next: 'longenough', confirm: 'longenough' };

      component.changePassword();

      expect(component.pwSaving()).toBeTrue();

      const req = httpMock.expectOne('http://localhost:3000/api/auth/change-password');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ currentPassword: 'old-pass', newPassword: 'longenough' });
      req.flush({ success: true });

      expect(component.pwSaving()).toBeFalse();
      expect(component.pwForm).toEqual({ current: '', next: '', confirm: '' });
    });

    it('should set pwError from the backend on failure', () => {
      component.pwForm = { current: 'old-pass', next: 'longenough', confirm: 'longenough' };

      component.changePassword();

      const req = httpMock.expectOne('http://localhost:3000/api/auth/change-password');
      req.flush({ message: 'Wrong current password' }, { status: 400, statusText: 'Bad Request' });

      expect(component.pwSaving()).toBeFalse();
      expect(component.pwError()).toBe('Wrong current password');
    });
  });
});
