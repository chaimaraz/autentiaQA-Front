import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutionConfigModalComponent } from './execution-config-modal.component';

describe('ExecutionConfigModalComponent', () => {
  let component: ExecutionConfigModalComponent;
  let fixture: ComponentFixture<ExecutionConfigModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutionConfigModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExecutionConfigModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
