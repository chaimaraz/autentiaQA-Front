import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { NotificationSettingsComponent } from './notification-settings.component';

describe('NotificationSettingsComponent', () => {
  let component: NotificationSettingsComponent;
  let fixture: ComponentFixture<NotificationSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    component.projectId = 'p1';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('save', () => {
    it('sets saving true immediately', () => {
      component.save();
      expect(component.saving()).toBeTrue();
    });

    it('completes the async success path: clears saving, shows then clears the success message', fakeAsync(() => {
      component.save();
      expect(component.saving()).toBeTrue();
      expect(component.success()).toBe('');

      tick(500);
      expect(component.saving()).toBeFalse();
      expect(component.success()).toBe('Préférences de notification sauvegardées.');

      tick(3000);
      expect(component.success()).toBe('');
    }));

    it('supports the async success path via a done() callback', (done) => {
      component.save();
      expect(component.saving()).toBeTrue();

      setTimeout(() => {
        expect(component.saving()).toBeFalse();
        expect(component.success()).toBe('Préférences de notification sauvegardées.');
        done();
      }, 600);
    });
  });
});
