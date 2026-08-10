import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { JiraConfigService, JiraConfig, JiraConfigPayload, JiraTestResult } from './jira-config.service';

describe('JiraConfigService', () => {
  let service: JiraConfigService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000/api';
  const projectId = 'proj-1';

  const mockConfig: JiraConfig = {
    id: 'jc1',
    projectId,
    jiraUrl: 'https://example.atlassian.net',
    jiraEmail: 'qa@example.com',
    projectKey: 'QA',
    defaultIssueType: 'Bug',
    autoCreateOnFail: true,
    attachScreenshot: true,
    attachVideo: false,
    attachTrace: false,
    includeErrorStack: true,
    hasApiToken: true,
    lastTestedAt: null,
    lastTestOk: null,
  };

  const mockPayload: JiraConfigPayload = {
    jiraUrl: 'https://example.atlassian.net',
    jiraEmail: 'qa@example.com',
    apiToken: 'secret-token',
    projectKey: 'QA',
    defaultIssueType: 'Bug',
    autoCreateOnFail: true,
    attachScreenshot: true,
    attachVideo: false,
    includeErrorStack: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(JiraConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getConfig', () => {
    it('should GET the config and unwrap data', () => {
      let result: JiraConfig | null | undefined;
      service.getConfig(projectId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/jira`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockConfig });

      expect(result).toEqual(mockConfig);
    });

    it('should resolve to null when no config exists yet', () => {
      let result: JiraConfig | null | undefined;
      service.getConfig(projectId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/jira`);
      req.flush({ success: true, data: null });

      expect(result).toBeNull();
    });

    it('should propagate a formatted error', () => {
      let error: Error | undefined;
      service.getConfig(projectId).subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/jira`);
      req.flush({ message: 'Non autorisé' }, { status: 401, statusText: 'Unauthorized' });

      expect(error!.message).toBe('Non autorisé');
    });
  });

  describe('saveConfig', () => {
    it('should PUT the payload and unwrap data', () => {
      let result: JiraConfig | undefined;
      service.saveConfig(projectId, mockPayload).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/jira`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(mockPayload);
      req.flush({ success: true, data: mockConfig });

      expect(result).toEqual(mockConfig);
    });

    it('should propagate a formatted error on failure', () => {
      let error: Error | undefined;
      service.saveConfig(projectId, mockPayload).subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/jira`);
      req.flush({}, { status: 500, statusText: 'Server Error' });

      expect(error!.message).toBe('Une erreur réseau est survenue');
    });
  });

  describe('testConnection', () => {
    it('should POST the partial payload and unwrap data', () => {
      const testResult: JiraTestResult = {
        accountId: 'acc1',
        displayName: 'QA Bot',
        emailAddress: 'qa@example.com',
      };
      let result: JiraTestResult | undefined;
      service.testConnection(projectId, { apiToken: 'tok' }).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/jira/test`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ apiToken: 'tok' });
      req.flush({ success: true, data: testResult });

      expect(result).toEqual(testResult);
    });

    it('should propagate a formatted error when the connection test fails', () => {
      let error: Error | undefined;
      service.testConnection(projectId, {}).subscribe({ next: () => fail('should error'), error: (e) => (error = e) });

      const req = httpMock.expectOne(`${baseUrl}/projects/${projectId}/jira/test`);
      req.flush({ message: 'Identifiants invalides' }, { status: 400, statusText: 'Bad Request' });

      expect(error!.message).toBe('Identifiants invalides');
    });
  });
});
