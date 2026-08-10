import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    const router = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    // RouterLink needs these to render its href — the spy needs harmless stand-ins.
    (router as any).events = of();
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/');

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('stats', () => {
    it('exposes 4 stat cards with the expected labels', () => {
      expect(component.stats.length).toBe(4);
      expect(component.stats.map(s => s.label)).toEqual([
        'Projets actifs', 'Tests passés', 'Scénarios générés', 'Vulnérabilités',
      ]);
    });

    it('renders one .stat-card element per stat', () => {
      const cards = fixture.nativeElement.querySelectorAll('.stat-card');
      expect(cards.length).toBe(4);
    });
  });

  describe('projects', () => {
    it('exposes 3 recent projects with routes and statuses', () => {
      expect(component.projects.length).toBe(3);
      expect(component.projects[0].route).toBe('/scenarios');
      expect(component.projects[1].route).toBe('/execution');
      expect(component.projects[2].route).toBe('/projects');
      expect(component.projects.map(p => p.status)).toEqual(['passed', 'running', 'failed']);
    });
  });

  describe('activities', () => {
    it('exposes 4 activity entries', () => {
      expect(component.activities.length).toBe(4);
    });

    it('applies the ngClass icon binding on each activity icon element', () => {
      const icons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.activity-icon i'));
      expect(icons.length).toBe(4);
      component.activities.forEach((a, i) => {
        expect(icons[i].classList.contains(a.icon)).toBeTrue();
        // base class from the template is always present alongside the dynamic ngClass icon
        expect(icons[i].classList.contains('fa-solid')).toBeTrue();
      });
    });
  });
});
