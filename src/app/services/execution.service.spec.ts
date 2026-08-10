import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { ExecutionService } from './execution.service';

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(ExecutionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
