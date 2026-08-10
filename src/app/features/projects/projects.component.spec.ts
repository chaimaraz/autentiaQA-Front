import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { ProjectsComponent } from './projects.component';
import { ProjectApiService } from '../../services/project-api.service';

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let fixture: ComponentFixture<ProjectsComponent>;
  let projectApiSpy: jasmine.SpyObj<ProjectApiService>;

  beforeEach(async () => {
    projectApiSpy = jasmine.createSpyObj<ProjectApiService>('ProjectApiService', ['listProjects']);
    projectApiSpy.listProjects.and.returnValue(of({ success: true, data: [] }));

    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [
        { provide: ProjectApiService, useValue: projectApiSpy },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should call loadProjects on init', () => {
    spyOn(component, 'loadProjects').and.callThrough();
    fixture.detectChanges();
    expect(component.loadProjects).toHaveBeenCalled();
  });

  it('should set loading=true while the request is in flight', () => {
    const subject = new Subject<any>();
    projectApiSpy.listProjects.and.returnValue(subject.asObservable());

    fixture.detectChanges();

    expect(component.loading).toBeTrue();
    subject.next({ success: true, data: [] });
    expect(component.loading).toBeFalse();
  });

  it('should map the API response into display-ready project rows on success', () => {
    const mockProjects = [
      {
        id: '1',
        name: 'Projet Un',
        url: 'https://one.example.com',
        frameworkName: 'PLAYWRIGHT',
        _count: { scenarios: 5 },
      },
      {
        id: '2',
        name: 'Projet Deux',
        url: 'https://two.example.com',
        frameworkName: 'CYPRESS',
        // no _count → should default to 0 scenarios
      },
    ];
    projectApiSpy.listProjects.and.returnValue(of({ success: true, data: mockProjects }));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('');
    expect(component.projects.length).toBe(2);
    expect(component.projects[0]).toEqual({
      id: '1',
      name: 'Projet Un',
      url: 'https://one.example.com · PLAYWRIGHT',
      scenarios: 5,
      dotColor: 'var(--success)',
      status: 'passed',
      statusLabel: 'Actif',
      route: '/projects/1',
    });
    expect(component.projects[1].scenarios).toBe(0);
    expect(component.projects[1].route).toBe('/projects/2');
  });

  it('should set errorMessage and clear loading on failure', () => {
    projectApiSpy.listProjects.and.returnValue(throwError(() => new Error('Network is down')));

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Network is down');
    expect(component.projects.length).toBe(0);
  });
});
