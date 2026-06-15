import { TestBed } from '@angular/core/testing';

import { ModalSocketService } from './modal-socket.service';

describe('ModalSocketService', () => {
  let service: ModalSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModalSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
