import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AIGenerationService, AIScenarioProposal, AIJobProgress, AIJobResult } from './ai-generation.service';
import { __setSocketFactoryForTests, __resetSocketFactory } from '../shared/utils/socket-factory';

describe('AIGenerationService', () => {
  let service: AIGenerationService;
  let httpMock: HttpTestingController;
  const base = 'http://localhost:3000/api/ai/projects';
  const SERVER = 'http://localhost:3000';
  const projectId = 'proj-1';

  let mockSocket: any;
  let socketHandlers: Record<string, (...args: any[]) => void>;
  let ioSpy: jasmine.Spy;

  beforeEach(() => {
    // Mock socket.io-client's io() so no real socket connection is attempted.
    socketHandlers = {};
    mockSocket = {
      on: jasmine.createSpy('on').and.callFake((event: string, cb: (...args: any[]) => void) => {
        socketHandlers[event] = cb;
      }),
      emit: jasmine.createSpy('emit'),
      disconnect: jasmine.createSpy('disconnect'),
    };
    // `import * as X` namespace objects are non-configurable per the ES
    // module spec, so spyOn(X, 'io') can never work here — the service
    // routes socket creation through an overridable factory instead.
    ioSpy = jasmine.createSpy('io').and.returnValue(mockSocket as any);
    __setSocketFactoryForTests(ioSpy);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(AIGenerationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    __resetSocketFactory();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateFromDocument', () => {
    it('should POST a FormData with the document, then connect a socket and forward progress/result events', () => {
      const file = new File(['content'], 'spec.pdf', { type: 'application/pdf' });
      const job = service.generateFromDocument(projectId, file);

      const progressEvents: AIJobProgress[] = [];
      const resultEvents: AIJobResult[] = [];
      job.progress$.subscribe((p) => progressEvents.push(p));
      job.result$.subscribe((r) => resultEvents.push(r));

      const req = httpMock.expectOne(`${base}/${projectId}/generate-from-document`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect((req.request.body as FormData).get('document')).toBeTruthy();

      req.flush({ data: { jobId: 'job-1' } });

      expect(ioSpy).toHaveBeenCalledWith(
        `${SERVER}/ai`,
        jasmine.objectContaining({ query: { jobId: 'job-1' } })
      );

      // simulate the 'connect' event -> should subscribe to the job room
      socketHandlers['connect']();
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { jobId: 'job-1' });

      // simulate a progress event pushed by the server
      const progress: AIJobProgress = { status: 'extracting', message: 'Extraction en cours' };
      socketHandlers['ai_progress'](progress);
      expect(progressEvents).toEqual([progress]);

      // simulate the final result event
      const result: AIJobResult = { scenarios: [], pagesExplored: 2 };
      socketHandlers['ai_result'](result);
      expect(resultEvents).toEqual([result]);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should push an error and disconnect when the server emits ai_error', () => {
      const file = new File(['content'], 'spec.pdf', { type: 'application/pdf' });
      const job = service.generateFromDocument(projectId, file);

      const errors: string[] = [];
      job.error$.subscribe((e) => errors.push(e));

      const req = httpMock.expectOne(`${base}/${projectId}/generate-from-document`);
      req.flush({ data: { jobId: 'job-2' } });

      socketHandlers['ai_error']({ message: 'Échec de génération' });

      expect(errors).toEqual(['Échec de génération']);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should push a generic error when the socket cannot connect', () => {
      const file = new File(['content'], 'spec.pdf', { type: 'application/pdf' });
      const job = service.generateFromDocument(projectId, file);

      const errors: string[] = [];
      job.error$.subscribe((e) => errors.push(e));

      const req = httpMock.expectOne(`${base}/${projectId}/generate-from-document`);
      req.flush({ data: { jobId: 'job-3' } });

      socketHandlers['connect_error']();

      expect(errors).toEqual(['Impossible de se connecter au serveur pour recevoir les résultats IA.']);
    });

    it('should push an error when the initial HTTP request to start the job fails', () => {
      const file = new File(['content'], 'spec.pdf', { type: 'application/pdf' });
      const job = service.generateFromDocument(projectId, file);

      const errors: string[] = [];
      job.error$.subscribe((e) => errors.push(e));

      const req = httpMock.expectOne(`${base}/${projectId}/generate-from-document`);
      req.flush({ message: 'Fichier invalide' }, { status: 400, statusText: 'Bad Request' });

      expect(errors).toEqual(['Fichier invalide']);
      expect(ioSpy).not.toHaveBeenCalled();
    });
  });

  describe('generateFromUrl', () => {
    it('should POST the url/options and start a socket job', () => {
      const job = service.generateFromUrl(projectId, 'https://example.com', { maxPages: 5, maxDepth: 2 });
      const results: AIJobResult[] = [];
      job.result$.subscribe((r) => results.push(r));

      const req = httpMock.expectOne(`${base}/${projectId}/generate-from-url`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ url: 'https://example.com', maxPages: 5, maxDepth: 2 });
      req.flush({ data: { jobId: 'job-url' } });

      expect(ioSpy).toHaveBeenCalledWith(
        `${SERVER}/ai`,
        jasmine.objectContaining({ query: { jobId: 'job-url' } })
      );

      socketHandlers['ai_result']({ scenarios: [] });
      expect(results.length).toBe(1);
    });
  });

  describe('generateScripts', () => {
    it('should POST the mapped scenarios payload and start a socket job', () => {
      const proposal: AIScenarioProposal = {
        tempId: 't1',
        name: 'Scenario 1',
        type: 'POSITIVE',
        steps: [],
        expectedResult: 'OK',
        variables: [],
        scriptTemplate: '',
      };
      service.generateScripts(projectId, [proposal]);

      const req = httpMock.expectOne(`${base}/${projectId}/generate-scripts`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        scenarios: [
          {
            tempId: 't1',
            name: 'Scenario 1',
            type: 'POSITIVE',
            steps: [],
            expectedResult: 'OK',
            variables: [],
          },
        ],
      });
      req.flush({ data: { jobId: 'job-scripts' } });

      expect(ioSpy).toHaveBeenCalled();
    });
  });

  describe('generateScriptFromNlp', () => {
    it('should POST the NLP payload and unwrap data without touching the socket', () => {
      const payload = { title: 'Login', description: 'desc', steps: 'step1', expectedResult: 'ok' };
      let result: any;
      service.generateScriptFromNlp(projectId, payload).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/${projectId}/generate-script-from-nlp`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ data: { name: 'Login', nlpText: 'desc', scriptTemplate: '// script' } });

      expect(result).toEqual({ name: 'Login', nlpText: 'desc', scriptTemplate: '// script' });
      expect(ioSpy).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreate', () => {
    it('should POST the mapped scenarios payload and return the raw response', () => {
      const proposal: AIScenarioProposal = {
        tempId: 't1',
        name: 'Scenario 1',
        type: 'POSITIVE',
        steps: [],
        expectedResult: 'OK',
        variables: [],
        scriptTemplate: '// script',
        nlpText: 'nlp text',
      };
      let result: any;
      service.bulkCreate(projectId, [proposal]).subscribe((res) => (result = res));

      const req = httpMock.expectOne(`${base}/${projectId}/scenarios/bulk-create`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        scenarios: [
          {
            name: 'Scenario 1',
            type: 'POSITIVE',
            nlpText: 'nlp text',
            scriptTemplate: '// script',
            variables: [],
          },
        ],
      });
      req.flush({ success: true, data: [], errors: [] });

      expect(result).toEqual({ success: true, data: [], errors: [] });
      expect(ioSpy).not.toHaveBeenCalled();
    });
  });
});
