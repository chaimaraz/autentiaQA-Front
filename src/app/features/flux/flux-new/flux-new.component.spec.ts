import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FluxNewComponent } from './flux-new.component';

describe('FluxNewComponent', () => {
  let component: FluxNewComponent;
  let fixture: ComponentFixture<FluxNewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FluxNewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FluxNewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
