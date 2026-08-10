import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PermissionService, PermissionCatalogue, PermissionMatrix } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000/api';

  const mockCatalogue: PermissionCatalogue = {
    SCENARIOS: [{ id: 'p1', code: 'scenario.create', label: 'Créer un scénario', category: 'SCENARIOS' }],
  };

  const mockMatrix: PermissionMatrix = {
    ADMIN: ['scenario.create'],
    QA_LEAD: ['scenario.create'],
    MEMBRE: [],
    OBSERVATEUR: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(PermissionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('listCatalogue() should GET the catalogue and unwrap data', () => {
    let result: PermissionCatalogue | undefined;
    service.listCatalogue().subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/permissions`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockCatalogue });

    expect(result).toEqual(mockCatalogue);
  });

  it('listCatalogue() should propagate a formatted error', () => {
    let error: Error | undefined;
    service.listCatalogue().subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

    const req = httpMock.expectOne(`${baseUrl}/permissions`);
    req.flush({ message: 'Erreur serveur' }, { status: 500, statusText: 'Server Error' });

    expect(error!.message).toBe('Erreur serveur');
  });

  it('getMatrix() should GET the matrix and unwrap data', () => {
    let result: PermissionMatrix | undefined;
    service.getMatrix().subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/permissions/matrix`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockMatrix });

    expect(result).toEqual(mockMatrix);
  });

  it('setRolePermissions() should PUT the permission codes for a role', () => {
    let result: any;
    service.setRolePermissions('QA_LEAD', ['scenario.create', 'scenario.delete']).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/permissions/roles/QA_LEAD`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ permissionCodes: ['scenario.create', 'scenario.delete'] });
    req.flush({ success: true, data: null });

    expect(result).toEqual({ success: true, data: null });
  });

  it('setRolePermissions() should propagate a formatted error', () => {
    let error: Error | undefined;
    service.setRolePermissions('QA_LEAD', []).subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

    const req = httpMock.expectOne(`${baseUrl}/permissions/roles/QA_LEAD`);
    req.flush({}, { status: 500, statusText: 'Server Error' });

    expect(error!.message).toBe('Une erreur réseau est survenue');
  });
});
