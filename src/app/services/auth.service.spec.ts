import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService, Session } from './auth.service';

describe('AuthService', () => {
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  const baseUrl = 'http://localhost:3000/api';
  const STORAGE_KEY = 'aq-auth';

  const mockSession: Session = {
    user: { id: 'u1', email: 'user@example.com', name: 'User One', globalRole: 'USER' },
    projects: [
      {
        projectId: 'p1',
        projectName: 'Project 1',
        projectStatus: 'ACTIVE',
        role: 'QA_LEAD',
        permissions: ['scenario.create'],
      },
    ],
    token: 'tok-123',
  };

  function createService(): AuthService {
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: Router, useValue: routerSpy }],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('should be created with no session when storage is empty', () => {
    const service = createService();
    expect(service).toBeTruthy();
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('should restore the session from localStorage on construction', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: mockSession.user, projects: mockSession.projects, token: mockSession.token })
    );

    const service = createService();

    expect(service.user()).toEqual(mockSession.user);
    expect(service.projects()).toEqual(mockSession.projects);
    expect(service.getToken()).toBe('tok-123');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('should clear corrupted localStorage content without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');

    const service = createService();

    expect(service.user()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  describe('login', () => {
    it('should POST credentials, apply the session and return it', () => {
      const service = createService();
      let result: Session | undefined;
      service.login('user@example.com', 'pass1234').subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com', password: 'pass1234' });
      req.flush({ success: true, data: mockSession });

      expect(result).toEqual(mockSession);
      expect(service.user()).toEqual(mockSession.user);
      expect(service.projects()).toEqual(mockSession.projects);
      expect(service.getToken()).toBe('tok-123');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.user).toEqual(mockSession.user);
      expect(stored.token).toBe('tok-123');
    });

    it('should propagate a formatted error on failed login', () => {
      const service = createService();
      let error: Error | undefined;
      service.login('user@example.com', 'wrong').subscribe({
        next: () => fail('should have errored'),
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(`${baseUrl}/auth/login`);
      req.flush({ message: 'Identifiants invalides' }, { status: 401, statusText: 'Unauthorized' });

      expect(error!.message).toBe('Identifiants invalides');
      expect(service.user()).toBeNull();
    });
  });

  describe('refreshSession', () => {
    it('should GET the current session and apply it', () => {
      const service = createService();
      let result: Session | undefined;
      service.refreshSession().subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/auth/me`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockSession });

      expect(result).toEqual(mockSession);
      expect(service.user()).toEqual(mockSession.user);
    });

    it('should log out and rethrow the original error on failure', () => {
      const service = createService();
      service.applyExternalSession(mockSession); // seed an existing session to verify it gets cleared

      let error: any;
      service.refreshSession().subscribe({
        next: () => fail('should have errored'),
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(`${baseUrl}/auth/me`);
      req.flush({ message: 'Session expirée' }, { status: 401, statusText: 'Unauthorized' });

      expect(service.user()).toBeNull();
      expect(service.projects()).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
      expect(error).toBeTruthy();
      expect(error.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('should clear the session, storage and navigate to login', () => {
      const service = createService();
      service.applyExternalSession(mockSession);

      service.logout();

      expect(service.user()).toBeNull();
      expect(service.projects()).toEqual([]);
      expect(service.getToken()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('applyExternalSession', () => {
    it('should apply a session obtained from another endpoint (e.g. invitation acceptance)', () => {
      const service = createService();

      service.applyExternalSession(mockSession);

      expect(service.user()).toEqual(mockSession.user);
      expect(service.projects()).toEqual(mockSession.projects);
      expect(service.getToken()).toBe('tok-123');
    });
  });

  describe('permissions and roles', () => {
    it('permissionsFor() should return [] when no projectId is given', () => {
      const service = createService();
      expect(service.permissionsFor(null)).toEqual([]);
      expect(service.permissionsFor(undefined)).toEqual([]);
    });

    it('permissionsFor() should return the permissions for a known project and [] for an unknown one', () => {
      const service = createService();
      service.applyExternalSession(mockSession);
      expect(service.permissionsFor('p1')).toEqual(['scenario.create']);
      expect(service.permissionsFor('unknown')).toEqual([]);
    });

    it('hasPermission() should check the permission code for the given project', () => {
      const service = createService();
      service.applyExternalSession(mockSession);
      expect(service.hasPermission('p1', 'scenario.create')).toBeTrue();
      expect(service.hasPermission('p1', 'scenario.delete')).toBeFalse();
    });

    it('hasPermission() should always be true for a super admin regardless of project permissions', () => {
      const service = createService();
      service.applyExternalSession({
        ...mockSession,
        user: { ...mockSession.user, globalRole: 'SUPER_ADMIN' },
      });

      expect(service.isSuperAdmin()).toBeTrue();
      expect(service.hasPermission('p1', 'anything.random')).toBeTrue();
    });

    it('isAdmin() should be true for ADMIN and SUPER_ADMIN roles, false for USER', () => {
      const service = createService();
      service.applyExternalSession({ ...mockSession, user: { ...mockSession.user, globalRole: 'ADMIN' } });
      expect(service.isAdmin()).toBeTrue();

      service.applyExternalSession({ ...mockSession, user: { ...mockSession.user, globalRole: 'USER' } });
      expect(service.isAdmin()).toBeFalse();
    });
  });
});
