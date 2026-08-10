import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AccessControlComponent } from './access-control.component';
import { PermissionService, PermissionCatalogue, PermissionMatrix } from '../../../services/permission.service';

describe('AccessControlComponent', () => {
  let component: AccessControlComponent;
  let fixture: ComponentFixture<AccessControlComponent>;
  let permissionServiceSpy: jasmine.SpyObj<PermissionService>;

  const catalogue: PermissionCatalogue = {
    Projets: [{ id: '1', code: 'PROJECT_VIEW', label: 'Voir', category: 'Projets' }],
  };

  const matrix: PermissionMatrix = {
    ADMIN: ['PROJECT_VIEW', 'PROJECT_EDIT'],
    QA_LEAD: ['PROJECT_VIEW'],
    MEMBRE: [],
    OBSERVATEUR: [],
  };

  beforeEach(() => {
    permissionServiceSpy = jasmine.createSpyObj('PermissionService', [
      'listCatalogue',
      'getMatrix',
      'setRolePermissions',
    ]);

    TestBed.configureTestingModule({
      imports: [AccessControlComponent],
      providers: [{ provide: PermissionService, useValue: permissionServiceSpy }],
    });

    fixture = TestBed.createComponent(AccessControlComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    permissionServiceSpy.listCatalogue.and.returnValue(of(catalogue));
    permissionServiceSpy.getMatrix.and.returnValue(of(matrix));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('loads catalogue then matrix, populating draft from the matrix', () => {
      permissionServiceSpy.listCatalogue.and.returnValue(of(catalogue));
      permissionServiceSpy.getMatrix.and.returnValue(of(matrix));

      component.ngOnInit();

      expect(component.catalogue()).toEqual(catalogue);
      expect(component.categories()).toEqual(['Projets']);
      expect(component.matrix()).toEqual(matrix);
      expect(component.draft.ADMIN.has('PROJECT_VIEW')).toBeTrue();
      expect(component.draft.ADMIN.has('PROJECT_EDIT')).toBeTrue();
      expect(component.draft.MEMBRE.size).toBe(0);
      expect(component.loading()).toBeFalse();
    });

    it('sets an error and does not call getMatrix when listCatalogue fails', () => {
      permissionServiceSpy.listCatalogue.and.returnValue(throwError(() => new Error('cat failed')));
      permissionServiceSpy.getMatrix.and.returnValue(of(matrix));

      component.ngOnInit();

      expect(component.error()).toBe('cat failed');
      expect(component.loading()).toBeFalse();
      expect(permissionServiceSpy.getMatrix).not.toHaveBeenCalled();
    });

    it('sets an error when getMatrix fails', () => {
      permissionServiceSpy.listCatalogue.and.returnValue(of(catalogue));
      permissionServiceSpy.getMatrix.and.returnValue(throwError(() => new Error('matrix failed')));

      component.ngOnInit();

      expect(component.error()).toBe('matrix failed');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('isChecked', () => {
    beforeEach(() => {
      permissionServiceSpy.listCatalogue.and.returnValue(of(catalogue));
      permissionServiceSpy.getMatrix.and.returnValue(of(matrix));
      component.ngOnInit();
    });

    it('returns true when the code is in the draft set for the role', () => {
      expect(component.isChecked('ADMIN', 'PROJECT_VIEW')).toBeTrue();
    });

    it('returns false when the code is not in the draft set for the role', () => {
      expect(component.isChecked('MEMBRE', 'PROJECT_VIEW')).toBeFalse();
    });
  });

  describe('toggle', () => {
    beforeEach(() => {
      permissionServiceSpy.listCatalogue.and.returnValue(of(catalogue));
      permissionServiceSpy.getMatrix.and.returnValue(of(matrix));
      component.ngOnInit();
    });

    it('is a no-op for the ADMIN role', () => {
      const before = new Set(component.draft.ADMIN);

      component.toggle('ADMIN', 'PROJECT_VIEW'); // already present
      component.toggle('ADMIN', 'SOME_NEW_CODE'); // not present

      expect(component.draft.ADMIN).toEqual(before);
    });

    it('adds the code for non-ADMIN roles when absent', () => {
      expect(component.draft.MEMBRE.has('PROJECT_VIEW')).toBeFalse();

      component.toggle('MEMBRE', 'PROJECT_VIEW');

      expect(component.draft.MEMBRE.has('PROJECT_VIEW')).toBeTrue();
    });

    it('removes the code for non-ADMIN roles when present', () => {
      component.draft.QA_LEAD.add('PROJECT_VIEW');

      component.toggle('QA_LEAD', 'PROJECT_VIEW');

      expect(component.draft.QA_LEAD.has('PROJECT_VIEW')).toBeFalse();
    });
  });

  describe('hasChanges', () => {
    beforeEach(() => {
      permissionServiceSpy.listCatalogue.and.returnValue(of(catalogue));
      permissionServiceSpy.getMatrix.and.returnValue(of(matrix));
      component.ngOnInit();
    });

    it('is false when the draft matches the original matrix', () => {
      expect(component.hasChanges('ADMIN')).toBeFalse();
    });

    it('is true when a code was added', () => {
      component.draft.MEMBRE.add('PROJECT_VIEW');
      expect(component.hasChanges('MEMBRE')).toBeTrue();
    });

    it('is true when a code was removed', () => {
      component.draft.ADMIN.delete('PROJECT_EDIT');
      expect(component.hasChanges('ADMIN')).toBeTrue();
    });

    it('is true when the set size differs even if overlapping', () => {
      component.draft.QA_LEAD.add('PROJECT_EDIT');
      expect(component.hasChanges('QA_LEAD')).toBeTrue();
    });
  });

  describe('save', () => {
    beforeEach(() => {
      permissionServiceSpy.listCatalogue.and.returnValue(of(catalogue));
      permissionServiceSpy.getMatrix.and.returnValue(of(matrix));
      component.ngOnInit();
    });

    it('persists the draft, updates matrix, and clears savedRole after 2.5s', fakeAsync(() => {
      permissionServiceSpy.setRolePermissions.and.returnValue(of({ success: true, data: null }));
      component.draft.MEMBRE.add('PROJECT_VIEW');

      component.save('MEMBRE');

      expect(permissionServiceSpy.setRolePermissions).toHaveBeenCalledWith('MEMBRE', ['PROJECT_VIEW']);
      expect(component.saving()).toBeNull();
      expect(component.savedRole()).toBe('MEMBRE');
      expect(component.matrix().MEMBRE).toEqual(['PROJECT_VIEW']);

      tick(2500);
      expect(component.savedRole()).toBeNull();
    }));

    it('sets an error and clears saving on failure', () => {
      permissionServiceSpy.setRolePermissions.and.returnValue(throwError(() => new Error('save failed')));

      component.save('ADMIN');

      expect(component.saving()).toBeNull();
      expect(component.error()).toBe('save failed');
      expect(component.savedRole()).toBeNull();
    });
  });
});
