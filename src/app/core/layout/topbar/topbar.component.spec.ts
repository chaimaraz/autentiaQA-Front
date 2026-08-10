import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { TopbarComponent } from './topbar.component';

describe('TopbarComponent', () => {
  describe('rendering', () => {
    let fixture: ComponentFixture<TopbarComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TopbarComponent],
        providers: [provideRouter([])],
      }).compileComponents();

      fixture = TestBed.createComponent(TopbarComponent);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });
  });

  describe('pageTitle$', () => {
    let component: TopbarComponent;
    let routerEvents: Subject<unknown>;

    beforeEach(() => {
      routerEvents = new Subject<unknown>();

      TestBed.configureTestingModule({
        providers: [{ provide: Router, useValue: { events: routerEvents.asObservable() } }],
      });

      component = TestBed.runInInjectionContext(() => new TopbarComponent());
    });

    it('maps a known route to its French title on NavigationEnd', (done) => {
      component.pageTitle$.subscribe((title) => {
        expect(title).toBe('Exécution en cours');
        done();
      });
      routerEvents.next(new NavigationEnd(1, '/execution', '/execution'));
    });

    it('falls back to "Autentia QA" for an unmapped route', (done) => {
      component.pageTitle$.subscribe((title) => {
        expect(title).toBe('Autentia QA');
        done();
      });
      routerEvents.next(new NavigationEnd(2, '/unknown-route', '/unknown-route'));
    });

    it('uses the redirected URL rather than the originally requested URL', (done) => {
      component.pageTitle$.subscribe((title) => {
        expect(title).toBe('Rapports');
        done();
      });
      routerEvents.next(new NavigationEnd(3, '/old-reports', '/reports'));
    });

    it('ignores router events that are not NavigationEnd', () => {
      const next = jasmine.createSpy('next');
      component.pageTitle$.subscribe(next);
      routerEvents.next({ id: 4 });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
