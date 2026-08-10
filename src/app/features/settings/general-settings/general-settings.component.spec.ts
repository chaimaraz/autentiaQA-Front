import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError, Observable } from 'rxjs';

import { GeneralSettingsComponent } from './general-settings.component';
import { ProjectApiService } from '../../../services/project-api.service';

describe('GeneralSettingsComponent', () => {
  let component: GeneralSettingsComponent;
  let fixture: ComponentFixture<GeneralSettingsComponent>;
  let projectApiSpy: jasmine.SpyObj<ProjectApiService>;

  const projectData = {
    id: 'p1',
    name: 'My Project',
    url: 'https://example.com',
    description: 'desc',
    frameworkName: 'PLAYWRIGHT',
    testTypes: [],
  };

  beforeEach(() => {
    projectApiSpy = jasmine.createSpyObj('ProjectApiService', ['getProject', 'updateProject']);

    TestBed.configureTestingModule({
      imports: [GeneralSettingsComponent],
      providers: [{ provide: ProjectApiService, useValue: projectApiSpy }],
    });

    fixture = TestBed.createComponent(GeneralSettingsComponent);
    component = fixture.componentInstance;
    component.projectId = 'p1';
  });

  it('should create', () => {
    projectApiSpy.getProject.and.returnValue(of({ success: true, data: projectData }));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('ngOnChanges', () => {
    it('triggers load() when projectId is set', () => {
      projectApiSpy.getProject.and.returnValue(of({ success: true, data: projectData }));
      spyOn(component, 'load').and.callThrough();

      component.ngOnChanges();

      expect(component.load).toHaveBeenCalled();
      expect(projectApiSpy.getProject).toHaveBeenCalledWith('p1');
    });

    it('does not call load() when projectId is falsy', () => {
      component.projectId = '' as unknown as string;
      spyOn(component, 'load');

      component.ngOnChanges();

      expect(component.load).not.toHaveBeenCalled();
    });
  });

  describe('load', () => {
    it('populates project/form and clears loading on success', () => {
      projectApiSpy.getProject.and.returnValue(of({ success: true, data: projectData }));

      component.load();

      expect(component.project()).toEqual(projectData as any);
      expect(component.form).toEqual({
        name: 'My Project',
        url: 'https://example.com',
        description: 'desc',
        frameworkName: 'PLAYWRIGHT',
      });
      expect(component.loading()).toBeFalse();
      expect(component.error()).toBe('');
    });

    it('sets the error signal and clears loading on failure', () => {
      projectApiSpy.getProject.and.returnValue(throwError(() => new Error('Network down')));

      component.load();

      expect(component.error()).toBe('Network down');
      expect(component.loading()).toBeFalse();
      expect(component.project()).toBeNull();
    });
  });

  describe('save', () => {
    it('calls updateProject with the form and shows a success message that clears after 3s', fakeAsync(() => {
      projectApiSpy.updateProject.and.returnValue(of({ success: true, data: projectData }));
      component.form = { name: 'New name', url: 'https://x.com', description: 'd', frameworkName: 'PLAYWRIGHT' };

      component.save();

      expect(projectApiSpy.updateProject).toHaveBeenCalledWith('p1', component.form);
      expect(component.saving()).toBeFalse();
      expect(component.success()).toBe('Paramètres du projet mis à jour.');

      tick(3000);
      expect(component.success()).toBe('');
    }));

    it('sets saving true while the request is pending', () => {
      let resolveFn: ((v: any) => void) | undefined;
      projectApiSpy.updateProject.and.returnValue(
        new Observable((subscriber) => {
          resolveFn = (v: any) => {
            subscriber.next(v);
            subscriber.complete();
          };
        })
      );

      component.save();
      expect(component.saving()).toBeTrue();

      resolveFn!({ success: true, data: projectData });
      expect(component.saving()).toBeFalse();
    });

    it('sets the error signal (or fallback message) on failure', () => {
      projectApiSpy.updateProject.and.returnValue(throwError(() => new Error('boom')));

      component.save();

      expect(component.saving()).toBeFalse();
      expect(component.error()).toBe('boom');
    });

    it('falls back to a default error message when err.message is missing', () => {
      projectApiSpy.updateProject.and.returnValue(throwError(() => ({})));

      component.save();

      expect(component.error()).toContain('PATCH /api/projects/:id');
    });
  });
});
