import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ProjectApiService, CreateProjectPayload, UpdateProjectPayload } from './project-api.service';

describe('ProjectApiService', () => {
  let service: ProjectApiService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ProjectApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createProject', () => {
    const basePayload: CreateProjectPayload = {
      name: 'My Project',
      url: 'https://example.com',
      description: 'A test project',
      generationMode: 'URL_CRAWL',
      testTypes: ['FUNCTIONAL', 'E2E'],
      frameworkName: 'PLAYWRIGHT',
    };

    it('should POST a FormData body with the basic fields', () => {
      let result: any;
      service.createProject(basePayload).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();

      const fd = req.request.body as FormData;
      expect(fd.get('name')).toBe('My Project');
      expect(fd.get('url')).toBe('https://example.com');
      expect(fd.get('description')).toBe('A test project');
      expect(fd.get('generationMode')).toBe('URL_CRAWL');
      expect(fd.get('testTypes')).toBe(JSON.stringify(['FUNCTIONAL', 'E2E']));
      expect(fd.get('frameworkName')).toBe('PLAYWRIGHT');
      expect(fd.get('repos')).toBeNull();

      req.flush({ success: true, data: { id: 'proj-1' } });

      expect(result).toEqual({ success: true, data: { id: 'proj-1' } });
    });

    it('should include repos, optional CI/CD fields and files when provided', () => {
      const file = new File(['content'], 'spec.pdf', { type: 'application/pdf' });
      const payload: CreateProjectPayload = {
        ...basePayload,
        repos: [{ name: 'Frontend', role: 'FRONTEND', repoUrl: 'https://github.com/org/repo' }],
        repoUrl: 'https://github.com/org/legacy',
        branch: 'main',
        onPush: true,
        onPr: false,
        onTag: true,
        onSchedule: false,
        notifyEmail: true,
        notifySlack: false,
        createJiraBug: true,
        blockMerge: false,
        files: [file],
      };

      service.createProject(payload).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/projects`);
      const fd = req.request.body as FormData;

      expect(fd.get('repos')).toBe(JSON.stringify(payload.repos));
      expect(fd.get('repoUrl')).toBe('https://github.com/org/legacy');
      expect(fd.get('branch')).toBe('main');
      expect(fd.get('onPush')).toBe('true');
      expect(fd.get('onPr')).toBe('false');
      expect(fd.get('onTag')).toBe('true');
      expect(fd.get('onSchedule')).toBe('false');
      expect(fd.get('notifyEmail')).toBe('true');
      expect(fd.get('notifySlack')).toBe('false');
      expect(fd.get('createJiraBug')).toBe('true');
      expect(fd.get('blockMerge')).toBe('false');
      expect(fd.get('documents')).toBeTruthy();
      expect((fd.get('documents') as File).name).toBe('spec.pdf');

      req.flush({ success: true, data: { id: 'proj-2' } });
    });

    it('should propagate a formatted error joining validation messages', () => {
      let error: Error | undefined;
      service.createProject(basePayload).subscribe({
        next: () => fail('should have errored'),
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(`${baseUrl}/projects`);
      req.flush(
        { errors: [{ msg: 'Nom requis' }, { msg: 'URL invalide' }] },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(error!.message).toBe('Nom requis, URL invalide');
    });
  });

  describe('listProjects', () => {
    it('should GET the project list', () => {
      let result: any;
      service.listProjects().subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [{ id: 'p1' }] });

      expect(result).toEqual({ success: true, data: [{ id: 'p1' }] });
    });

    it('should propagate a formatted error', () => {
      let error: Error | undefined;
      service.listProjects().subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

      const req = httpMock.expectOne(`${baseUrl}/projects`);
      req.flush({ message: 'Erreur réseau' }, { status: 500, statusText: 'Server Error' });

      expect(error!.message).toBe('Erreur réseau');
    });
  });

  describe('getProject', () => {
    it('should GET a single project by id', () => {
      let result: any;
      service.getProject('p1').subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/p1`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: { id: 'p1' } });

      expect(result).toEqual({ success: true, data: { id: 'p1' } });
    });
  });

  describe('updateProject', () => {
    it('should PATCH the updated fields', () => {
      const payload: UpdateProjectPayload = { name: 'Renamed', description: 'New desc' };
      let result: any;
      service.updateProject('p1', payload).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/p1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: { id: 'p1', name: 'Renamed' } });

      expect(result.data.name).toBe('Renamed');
    });

    it('should propagate a formatted error when the endpoint does not exist yet', () => {
      let error: Error | undefined;
      service.updateProject('p1', { name: 'X' }).subscribe({
        next: () => fail('should have errored'),
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(`${baseUrl}/projects/p1`);
      req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });

      expect(error!.message).toBe('Not Found');
    });
  });
});
