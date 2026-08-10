import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AdminService, PlatformUser } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000/api';

  const mockUser: PlatformUser = {
    id: 'u1',
    email: 'user@example.com',
    name: 'User One',
    globalRole: 'ADMIN',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listUsers', () => {
    it('should GET the users list and unwrap data', () => {
      let result: PlatformUser[] | undefined;
      service.listUsers().subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/admin/users`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockUser] });

      expect(result).toEqual([mockUser]);
    });

    it('should propagate a formatted error on failure', () => {
      let error: Error | undefined;
      service.listUsers().subscribe({
        next: () => fail('should have errored'),
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/users`);
      req.flush({ message: 'Accès refusé' }, { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error!.message).toBe('Accès refusé');
    });
  });

  describe('createAdmin', () => {
    it('should POST the new admin payload and return the response as-is', () => {
      let result: any;
      service.createAdmin('a@b.com', 'Admin', 'pass1234').subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/admin/admins`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'a@b.com', name: 'Admin', password: 'pass1234' });
      req.flush({ success: true, data: mockUser });

      expect(result).toEqual({ success: true, data: mockUser });
    });

    it('should propagate a formatted error joining validation messages', () => {
      let error: Error | undefined;
      service.createAdmin('a@b.com', 'Admin', 'pass1234').subscribe({
        next: () => fail('should have errored'),
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/admins`);
      req.flush(
        { errors: [{ msg: 'Email invalide' }, { msg: 'Mot de passe trop court' }] },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(error!.message).toBe('Email invalide, Mot de passe trop court');
    });
  });

  describe('setGlobalRole', () => {
    it('should PATCH the role and return the response as-is', () => {
      let result: any;
      service.setGlobalRole('u1', 'SUPER_ADMIN').subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/admin/users/u1/role`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ globalRole: 'SUPER_ADMIN' });
      req.flush({ success: true, data: { ...mockUser, globalRole: 'SUPER_ADMIN' } });

      expect(result.data.globalRole).toBe('SUPER_ADMIN');
    });

    it('should fall back to a generic error message when none is provided', () => {
      let error: Error | undefined;
      service.setGlobalRole('u1', 'SUPER_ADMIN').subscribe({
        next: () => fail('should have errored'),
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(`${baseUrl}/admin/users/u1/role`);
      req.flush({}, { status: 500, statusText: 'Server Error' });

      expect(error!.message).toBe('Une erreur réseau est survenue');
    });
  });
});
