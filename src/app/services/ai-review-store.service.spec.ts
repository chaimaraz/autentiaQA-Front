import { TestBed } from '@angular/core/testing';

import { AIReviewStoreService, AIReviewPayload } from './ai-review-store.service';
import { AIScenarioProposal } from './ai-generation.service';

describe('AIReviewStoreService', () => {
  let service: AIReviewStoreService;

  const proposal: AIScenarioProposal = {
    tempId: 't1',
    name: 'Scenario 1',
    type: 'POSITIVE',
    steps: [],
    expectedResult: 'It works',
    variables: [],
    scriptTemplate: '// script',
  };

  const payload: AIReviewPayload = {
    projectId: 'p1',
    projectName: 'Project 1',
    source: 'document',
    proposals: [proposal],
    pagesExplored: 3,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AIReviewStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null from peek() when nothing has been set', () => {
    expect(service.peek()).toBeNull();
  });

  it('should return null from consume() when nothing has been set', () => {
    expect(service.consume()).toBeNull();
  });

  it('should store a payload via set() and expose it via peek() without clearing it', () => {
    service.set(payload);

    expect(service.peek()).toEqual(payload);
    expect(service.peek()).toEqual(payload); // peek does not consume
  });

  it('should return and clear the payload via consume()', () => {
    service.set(payload);

    const consumed = service.consume();

    expect(consumed).toEqual(payload);
    expect(service.peek()).toBeNull();
    expect(service.consume()).toBeNull();
  });

  it('should overwrite a previously set payload with a new set() call', () => {
    service.set(payload);

    const secondPayload: AIReviewPayload = { ...payload, projectId: 'p2', proposals: [] };
    service.set(secondPayload);

    expect(service.peek()).toEqual(secondPayload);
  });
});
