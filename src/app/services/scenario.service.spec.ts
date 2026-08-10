import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import {
  ScenarioService,
  Scenario,
  ScenarioVariable,
  PaginatedScenarios,
  ProjectEnvVar,
} from './scenario.service';
import { ExecutionCaptureConfig } from './execution.service';

describe('ScenarioService', () => {
  let service: ScenarioService;
  let httpMock: HttpTestingController;
  const base = 'http://localhost:3000/api';
  const projectId = 'proj-1';
  const scenarioId = 'scen-1';

  const mockScenario: Scenario = {
    id: scenarioId,
    projectId,
    name: 'Login scenario',
    type: 'POSITIVE',
    creationMode: 'NLP',
    scriptTemplate: '// script',
    status: 'DRAFT',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockVariable: ScenarioVariable = {
    id: 'var-1',
    key: 'USERNAME',
    value: 'john',
    isSecret: false,
  };

  const mockPaginated: PaginatedScenarios = {
    success: true,
    data: [mockScenario],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockEnvVar: ProjectEnvVar = {
    id: 'env-1',
    key: 'BASE_URL',
    value: 'https://example.com',
    isSecret: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const captureConfig: ExecutionCaptureConfig = {
    screenshotMode: 'ON_FAILURE',
    videoMode: 'NEVER',
    traceMode: 'NEVER',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ScenarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAll', () => {
    it('should GET with default query params when none are provided', () => {
      let result: PaginatedScenarios | undefined;
      service.getAll(projectId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(
        `${base}/projects/${projectId}/scenarios?page=1&limit=10&search=&type=&status=&mode=&dateFrom=&dateTo=`
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPaginated);

      expect(result).toEqual(mockPaginated);
    });

    it('should GET with custom query params when provided', () => {
      service
        .getAll(projectId, { page: 2, limit: 5, search: 'login', type: 'POSITIVE', status: 'ACTIVE', mode: 'NLP' })
        .subscribe();

      const req = httpMock.expectOne(
        `${base}/projects/${projectId}/scenarios?page=2&limit=5&search=login&type=POSITIVE&status=ACTIVE&mode=NLP&dateFrom=&dateTo=`
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPaginated);
    });
  });

  describe('getOne / getFull', () => {
    it('getOne() should GET a scenario and unwrap data', () => {
      let result: Scenario | undefined;
      service.getOne(projectId, scenarioId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: mockScenario });

      expect(result).toEqual(mockScenario);
    });

    it('getFull() should delegate to the same endpoint as getOne()', () => {
      let result: Scenario | undefined;
      service.getFull(projectId, scenarioId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: mockScenario });

      expect(result).toEqual(mockScenario);
    });
  });

  it('create() should POST the payload and unwrap data', () => {
    const payload = {
      name: 'New scenario',
      type: 'POSITIVE' as const,
      creationMode: 'NLP' as const,
      scriptTemplate: '// script',
    };
    let result: Scenario | undefined;
    service.create(projectId, payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: mockScenario });

    expect(result).toEqual(mockScenario);
  });

  it('update() should PUT the partial payload and unwrap data', () => {
    let result: Scenario | undefined;
    service.update(projectId, scenarioId, { name: 'Renamed' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Renamed' });
    req.flush({ data: { ...mockScenario, name: 'Renamed' } });

    expect(result!.name).toBe('Renamed');
  });

  it('remove() should DELETE the scenario', () => {
    let completed = false;
    service.remove(projectId, scenarioId).subscribe(() => (completed = true));

    const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBeTrue();
  });

  it('regenerateScript() should POST the description/steps/expectedResult and unwrap data', () => {
    const payload = { description: 'Do X', expectedResult: 'Y happens' };
    let result: Scenario | undefined;
    service.regenerateScript(projectId, scenarioId, payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/regenerate-script`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: mockScenario });

    expect(result).toEqual(mockScenario);
  });

  it('updateMeta() should PATCH description/etapesScenarios and unwrap data', () => {
    const payload = { description: 'Updated description' };
    let result: Scenario | undefined;
    service.updateMeta(projectId, scenarioId, payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/meta`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: mockScenario });

    expect(result).toEqual(mockScenario);
  });

  describe('variables', () => {
    it('getVariables() should GET the variables and unwrap data', () => {
      let result: ScenarioVariable[] | undefined;
      service.getVariables(projectId, scenarioId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/variables`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [mockVariable] });

      expect(result).toEqual([mockVariable]);
    });

    it('setVariableLock() should PATCH the lock state and unwrap data', () => {
      let result: ScenarioVariable | undefined;
      service.setVariableLock(projectId, scenarioId, 'var-1', true).subscribe((res) => (result = res));

      const req = httpMock.expectOne(
        `${base}/projects/${projectId}/scenarios/${scenarioId}/variables/var-1/lock`
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ locked: true });
      req.flush({ data: { ...mockVariable, locked: true } });

      expect(result!.locked).toBeTrue();
    });

    it('regenerateVariables() should PUT the variables array and unwrap data', () => {
      const variables = [{ key: 'USERNAME', value: 'john', isSecret: false }];
      let result: ScenarioVariable[] | undefined;
      service.regenerateVariables(projectId, scenarioId, variables).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/variables`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ variables });
      req.flush({ data: [mockVariable] });

      expect(result).toEqual([mockVariable]);
    });

    it('saveVariables() should delegate to the same PUT endpoint as regenerateVariables()', () => {
      const variables = [{ key: 'USERNAME', value: 'john', isSecret: false }];
      let result: ScenarioVariable[] | undefined;
      service.saveVariables(projectId, scenarioId, variables).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/variables`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ variables });
      req.flush({ data: [mockVariable] });

      expect(result).toEqual([mockVariable]);
    });

    it('copyVariablesFrom() should POST the source scenario id and unwrap data', () => {
      let result: ScenarioVariable[] | undefined;
      service.copyVariablesFrom(projectId, scenarioId, 'source-scen').subscribe((res) => (result = res));

      const req = httpMock.expectOne(
        `${base}/projects/${projectId}/scenarios/${scenarioId}/copy-variables`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ sourceScenarioId: 'source-scen' });
      req.flush({ data: [mockVariable] });

      expect(result).toEqual([mockVariable]);
    });

    it('syncVariables() should POST an empty body and unwrap data', () => {
      const syncResult: { variables: ScenarioVariable[]; created: string[]; removed: string[]; needsValue: string[] } = {
        variables: [mockVariable],
        created: ['USERNAME'],
        removed: [],
        needsValue: [],
      };
      let result: typeof syncResult | undefined;
      service.syncVariables(projectId, scenarioId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(
        `${base}/projects/${projectId}/scenarios/${scenarioId}/variables/sync`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ data: syncResult });

      expect(result).toEqual(syncResult);
    });

    it('regenerateOneVariable() should POST to the per-variable regenerate endpoint', () => {
      let result: ScenarioVariable | undefined;
      service.regenerateOneVariable(projectId, scenarioId, 'var-1').subscribe((res) => (result = res));

      const req = httpMock.expectOne(
        `${base}/projects/${projectId}/scenarios/${scenarioId}/variables/var-1/regenerate`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ data: mockVariable });

      expect(result).toEqual(mockVariable);
    });

    it('regenerateAllVariablesServerSide() should POST to the regenerate-all endpoint', () => {
      let result: ScenarioVariable[] | undefined;
      service.regenerateAllVariablesServerSide(projectId, scenarioId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(
        `${base}/projects/${projectId}/scenarios/${scenarioId}/variables/regenerate-all`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ data: [mockVariable] });

      expect(result).toEqual([mockVariable]);
    });
  });

  it('updateScript() should PUT the scriptTemplate and unwrap data', () => {
    let result: Scenario | undefined;
    service.updateScript(projectId, scenarioId, '// new script').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/script`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ scriptTemplate: '// new script' });
    req.flush({ data: { ...mockScenario, scriptTemplate: '// new script' } });

    expect(result!.scriptTemplate).toBe('// new script');
  });

  describe('executions', () => {
    it('execute() should POST the captureConfig and unwrap data', () => {
      let result: any;
      service.execute(projectId, scenarioId, captureConfig).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/executions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ captureConfig });
      req.flush({ data: { id: 'exec-1', scenarioId, result: 'RUNNING', startedAt: '2026-01-01T00:00:00.000Z' } });

      expect(result.id).toBe('exec-1');
    });

    it('executeAll() should default dataChoices to {} when omitted', () => {
      let result: any;
      service.executeAll(projectId, captureConfig).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/execute-all`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ captureConfig, dataChoices: {} });
      req.flush({ data: { id: 'batch-1', projectId, status: 'RUNNING', totalCount: 3 } });

      expect(result.id).toBe('batch-1');
    });

    it('executeAll() should forward explicit dataChoices when provided', () => {
      service.executeAll(projectId, captureConfig, { 'var-1': 'regenerate' }).subscribe();

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/execute-all`);
      expect(req.request.body).toEqual({ captureConfig, dataChoices: { 'var-1': 'regenerate' } });
      req.flush({ data: { id: 'batch-2', projectId, status: 'RUNNING', totalCount: 1 } });
    });

    it('getExecutions() should GET the executions list and unwrap data', () => {
      let result: any;
      service.getExecutions(projectId, scenarioId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/scenarios/${scenarioId}/executions`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [{ id: 'exec-1', scenarioId, result: 'PASS', startedAt: '2026-01-01T00:00:00.000Z' }] });

      expect(result.length).toBe(1);
    });
  });

  describe('environment variables', () => {
    it('getEnvVars() should GET the env vars and unwrap data', () => {
      let result: ProjectEnvVar[] | undefined;
      service.getEnvVars(projectId).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/env-vars`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [mockEnvVar] });

      expect(result).toEqual([mockEnvVar]);
    });

    it('createEnvVar() should POST the payload and unwrap data', () => {
      const payload = { key: 'BASE_URL', value: 'https://example.com', isSecret: false };
      let result: ProjectEnvVar | undefined;
      service.createEnvVar(projectId, payload).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/env-vars`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ data: mockEnvVar });

      expect(result).toEqual(mockEnvVar);
    });

    it('updateEnvVar() should PUT the partial payload and unwrap data', () => {
      let result: ProjectEnvVar | undefined;
      service.updateEnvVar(projectId, 'env-1', { value: 'https://staging.example.com' }).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/env-vars/env-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ value: 'https://staging.example.com' });
      req.flush({ data: { ...mockEnvVar, value: 'https://staging.example.com' } });

      expect(result!.value).toBe('https://staging.example.com');
    });

    it('removeEnvVar() should DELETE the env var', () => {
      let completed = false;
      service.removeEnvVar(projectId, 'env-1').subscribe(() => (completed = true));

      const req = httpMock.expectOne(`${base}/projects/${projectId}/env-vars/env-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBeTrue();
    });
  });
});
