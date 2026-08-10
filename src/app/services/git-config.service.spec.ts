import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { GitConfigService, GitRepoConfig } from './git-config.service';
import { GitRepoPayload } from './project-api.service';

describe('GitConfigService', () => {
  let service: GitConfigService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000/api';
  const projectId = 'proj-1';
  const repoId = 'repo-1';

  const mockPayload: GitRepoPayload = {
    name: 'Frontend',
    role: 'FRONTEND',
    provider: 'GITHUB',
    repoUrl: 'https://github.com/org/repo',
    branch: 'main',
  };

  const mockRepo: GitRepoConfig = {
    ...mockPayload,
    id: repoId,
    projectId,
    webhookSecret: 'secret123',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(GitConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('HTTP methods', () => {
    it('list() should GET the repos for a project', () => {
      let result: any;
      service.list(projectId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockRepo] });

      expect(result).toEqual({ success: true, data: [mockRepo] });
    });

    it('list() should propagate a formatted error', () => {
      let error: Error | undefined;
      service.list(projectId).subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos`);
      req.flush({ message: 'Erreur' }, { status: 500, statusText: 'Server Error' });

      expect(error!.message).toBe('Erreur');
    });

    it('getOne() should GET a single repo', () => {
      let result: any;
      service.getOne(projectId, repoId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos/${repoId}`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockRepo });

      expect(result).toEqual({ success: true, data: mockRepo });
    });

    it('create() should POST the repo payload', () => {
      let result: any;
      service.create(projectId, mockPayload).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockPayload);
      req.flush({ success: true, data: mockRepo });

      expect(result).toEqual({ success: true, data: mockRepo });
    });

    it('update() should PUT the partial repo payload', () => {
      let result: any;
      service.update(projectId, repoId, { branch: 'develop' }).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos/${repoId}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ branch: 'develop' });
      req.flush({ success: true, data: { ...mockRepo, branch: 'develop' } });

      expect(result.data.branch).toBe('develop');
    });

    it('remove() should DELETE the repo', () => {
      let result: any;
      service.remove(projectId, repoId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos/${repoId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(result).toBeNull();
    });

    it('regenerateSecret() should POST to the regenerate-secret endpoint', () => {
      let result: any;
      service.regenerateSecret(projectId, repoId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos/${repoId}/regenerate-secret`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ success: true, data: { ...mockRepo, webhookSecret: 'newsecret' } });

      expect(result.data.webhookSecret).toBe('newsecret');
    });

    it('getEvents() should GET events for a specific repo with pagination params', () => {
      let result: any;
      service.getEvents(projectId, repoId, 2, 5).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos/${repoId}/events?page=2&limit=5`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [], total: 0, totalPages: 0 });

      expect(result.total).toBe(0);
    });

    it('getEvents() should GET events for all repos of a project when repoId is omitted', () => {
      let result: any;
      service.getEvents(projectId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/repos/events?page=1&limit=20`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [], total: 0, totalPages: 0 });

      expect(result).toBeTruthy();
    });
  });

  describe('buildWebhookUrl', () => {
    it('should build a webhook URL, stripping a trailing slash from the base URL', () => {
      expect(service.buildWebhookUrl('http://localhost:3000/', repoId)).toBe(
        `http://localhost:3000/api/webhooks/git/${repoId}`
      );
    });

    it('should build a webhook URL when the base URL has no trailing slash', () => {
      expect(service.buildWebhookUrl('http://localhost:3000', repoId)).toBe(
        `http://localhost:3000/api/webhooks/git/${repoId}`
      );
    });
  });

  describe('buildCiFileName', () => {
    it('should return the GitHub workflow filename for GITHUB provider', () => {
      expect(service.buildCiFileName({ ...mockRepo, provider: 'GITHUB' })).toBe('autentiaqa.yml');
    });

    it('should return the GitLab snippet filename for GITLAB provider', () => {
      expect(service.buildCiFileName({ ...mockRepo, provider: 'GITLAB' })).toBe('autentiaqa-gitlab-snippet.yml');
    });

    it('should return the Bitbucket snippet filename for BITBUCKET provider', () => {
      expect(service.buildCiFileName({ ...mockRepo, provider: 'BITBUCKET' })).toBe('autentiaqa-bitbucket-snippet.yml');
    });

    it('should return the generic example filename for OTHER provider', () => {
      expect(service.buildCiFileName({ ...mockRepo, provider: 'OTHER' })).toBe('autentiaqa-ci-example.sh');
    });
  });

  describe('buildCiFileContent', () => {
    const webhookUrl = 'http://localhost:3000/api/webhooks/git/repo-1';

    it('should build a GitHub Actions workflow referencing the webhook URL and secret', () => {
      const content = service.buildCiFileContent({ ...mockRepo, provider: 'GITHUB' }, webhookUrl);
      expect(content).toContain(webhookUrl);
      expect(content).toContain('AUTENTIAQA_WEBHOOK_SECRET');
      expect(content).toContain('name: Autentia QA');
    });

    it('should include a branch filter in the GitHub workflow when the repo has a branch', () => {
      const content = service.buildCiFileContent({ ...mockRepo, provider: 'GITHUB', branch: 'main' }, webhookUrl);
      expect(content).toContain('branches: [ "main" ]');
    });

    it('should build a GitLab CI snippet referencing the webhook URL', () => {
      const content = service.buildCiFileContent({ ...mockRepo, provider: 'GITLAB' }, webhookUrl);
      expect(content).toContain(webhookUrl);
      expect(content).toContain('notify-autentiaqa:');
    });

    it('should build a Bitbucket pipelines snippet referencing the webhook URL', () => {
      const content = service.buildCiFileContent({ ...mockRepo, provider: 'BITBUCKET' }, webhookUrl);
      expect(content).toContain(webhookUrl);
      expect(content).toContain('pipelines:');
    });

    it('should build a generic bash example for OTHER provider', () => {
      const content = service.buildCiFileContent({ ...mockRepo, provider: 'OTHER' }, webhookUrl);
      expect(content).toContain('#!/usr/bin/env bash');
      expect(content).toContain(webhookUrl);
    });
  });
});
