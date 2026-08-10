import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { MemberService, ProjectMember, PendingInvitation } from './member.service';

describe('MemberService', () => {
  let service: MemberService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000/api';
  const projectId = 'proj-1';

  const mockMember: ProjectMember = {
    id: 'm1',
    userId: 'u1',
    projectId,
    role: 'MEMBRE',
    createdAt: '2026-01-01T00:00:00.000Z',
    user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
  };

  const mockInvitation: PendingInvitation = {
    id: 'inv1',
    email: 'invitee@example.com',
    role: 'OBSERVATEUR',
    status: 'PENDING',
    expiresAt: '2026-02-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(MemberService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should GET members and unwrap data', () => {
    let result: ProjectMember[] | undefined;
    service.list(projectId).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [mockMember] });

    expect(result).toEqual([mockMember]);
  });

  it('list() should propagate a formatted error', () => {
    let error: Error | undefined;
    service.list(projectId).subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members`);
    req.flush({ message: 'Introuvable' }, { status: 404, statusText: 'Not Found' });

    expect(error!.message).toBe('Introuvable');
  });

  it('listInvitations() should GET invitations and unwrap data', () => {
    let result: PendingInvitation[] | undefined;
    service.listInvitations(projectId).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members/invitations`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [mockInvitation] });

    expect(result).toEqual([mockInvitation]);
  });

  it('invite() should POST email/role and return the raw response', () => {
    let result: any;
    service.invite(projectId, 'new@example.com', 'QA_LEAD').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members/invitations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'new@example.com', role: 'QA_LEAD' });
    req.flush({ success: true, data: mockInvitation });

    expect(result).toEqual({ success: true, data: mockInvitation });
  });

  it('revokeInvitation() should DELETE the invitation', () => {
    let result: any;
    service.revokeInvitation(projectId, 'inv1').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members/invitations/inv1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: null });

    expect(result).toEqual({ success: true, data: null });
  });

  it('updateRole() should PATCH the role', () => {
    let result: any;
    service.updateRole(projectId, 'm1', 'ADMIN').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members/m1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'ADMIN' });
    req.flush({ success: true, data: { ...mockMember, role: 'ADMIN' } });

    expect(result.data.role).toBe('ADMIN');
  });

  it('remove() should DELETE the member', () => {
    let result: any;
    service.remove(projectId, 'm1').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members/m1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: null });

    expect(result).toEqual({ success: true, data: null });
  });

  it('remove() should propagate a formatted error joining validation messages', () => {
    let error: Error | undefined;
    service.remove(projectId, 'm1').subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

    const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/members/m1`);
    req.flush({ errors: [{ msg: 'Interdit' }] }, { status: 403, statusText: 'Forbidden' });

    expect(error!.message).toBe('Interdit');
  });
});
