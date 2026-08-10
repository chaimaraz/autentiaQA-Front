import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { FluxListComponent } from './flux-list.component';

describe('FluxListComponent', () => {
  let component: FluxListComponent;
  let fixture: ComponentFixture<FluxListComponent>;

  beforeEach(async () => {
    const router = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    // RouterLink needs these to render its href — the spy needs harmless stand-ins.
    (router as any).events = of();
    router.createUrlTree.and.returnValue({} as any);
    router.serializeUrl.and.returnValue('/');

    await TestBed.configureTestingModule({
      imports: [FluxListComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(FluxListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes 3 flux entries with steps', () => {
    expect(component.fluxList.length).toBe(3);
    expect(component.fluxList[0].statusLabel).toBe('PASSÉ 5/5');
    expect(component.fluxList[0].steps.length).toBe(5);
    expect(component.fluxList[2].status).toBe('idle');
  });

  it('renders one .flux-saved-item element per entry', () => {
    const items = fixture.nativeElement.querySelectorAll('.flux-saved-item');
    expect(items.length).toBe(3);
    expect(component.fluxList.map(f => f.name)).toEqual([
      'Parcours achat complet — Positif',
      'Authentification incorrecte — Négatif',
      'Accès admin sans droits — Sécurité',
    ]);
  });
});
