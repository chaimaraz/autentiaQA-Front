import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PlatformAdminsComponent } from './platform-admins.component';
import { AdminService, PlatformUser } from '../../../services/admin.service';

describe('PlatformAdminsComponent', () => {
  let component: PlatformAdminsComponent;
  let fixture: ComponentFixture<PlatformAdminsComponent>;
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  const users: PlatformUser[] = [
    { id: 'u1', email: 'a@b.com', name: 'A B', globalRole: 'ADMIN', createdAt: '2024-01-01' },
  ];

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['listUsers', 'createAdmin', 'setGlobalRole']);

    TestBed.configureTestingModule({
      imports: [PlatformAdminsComponent],
      providers: [{ provide: AdminService, useValue: adminServiceSpy }],
    });

    fixture = TestBed.createComponent(PlatformAdminsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    adminServiceSpy.listUsers.and.returnValue(of(users));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit / loadUsers', () => {
    it('populates users and clears loading on success', () => {
      adminServiceSpy.listUsers.and.returnValue(of(users));

      component.ngOnInit();

      expect(component.users()).toEqual(users);
      expect(component.loading()).toBeFalse();
    });

    it('sets an error and clears loading on failure', () => {
      adminServiceSpy.listUsers.and.returnValue(throwError(() => new Error('list failed')));

      component.ngOnInit();

      expect(component.error()).toBe('list failed');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('toggleCreateForm', () => {
    it('toggles showCreateForm and resets create messages', () => {
      adminServiceSpy.listUsers.and.returnValue(of(users));
      component.ngOnInit();
      component.createError.set('oops');
      component.createSuccess.set('yay');

      expect(component.showCreateForm()).toBeFalse();
      component.toggleCreateForm();
      expect(component.showCreateForm()).toBeTrue();
      expect(component.createError()).toBe('');
      expect(component.createSuccess()).toBe('');

      component.toggleCreateForm();
      expect(component.showCreateForm()).toBeFalse();
    });
  });

  describe('createAdmin validation guards', () => {
    it('rejects an invalid email without calling the service', () => {
      component.newEmail = 'not-an-email';
      component.newName = 'Valid Name';
      component.newPassword = 'longenough';

      component.createAdmin();

      expect(component.createError()).toBe('Adresse email invalide.');
      expect(adminServiceSpy.createAdmin).not.toHaveBeenCalled();
    });

    it('rejects an empty/blank name without calling the service', () => {
      component.newEmail = 'valid@example.com';
      component.newName = '   ';
      component.newPassword = 'longenough';

      component.createAdmin();

      expect(component.createError()).toBe('Le nom est requis.');
      expect(adminServiceSpy.createAdmin).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 8 characters without calling the service', () => {
      component.newEmail = 'valid@example.com';
      component.newName = 'Valid Name';
      component.newPassword = 'short';

      component.createAdmin();

      expect(component.createError()).toBe('Mot de passe trop court (min. 8 caractères).');
      expect(adminServiceSpy.createAdmin).not.toHaveBeenCalled();
    });
  });

  describe('createAdmin', () => {
    beforeEach(() => {
      component.newEmail = 'valid@example.com';
      component.newName = 'Valid Name';
      component.newPassword = 'longenough';
    });

    it('creates the admin, resets the form, and reloads users on success', () => {
      adminServiceSpy.createAdmin.and.returnValue(of({ success: true, data: users[0] }));
      adminServiceSpy.listUsers.and.returnValue(of(users));

      component.createAdmin();

      expect(adminServiceSpy.createAdmin).toHaveBeenCalledWith('valid@example.com', 'Valid Name', 'longenough');
      expect(component.creating()).toBeFalse();
      expect(component.createSuccess()).toContain('valid@example.com');
      expect(component.newEmail).toBe('');
      expect(component.newName).toBe('');
      expect(component.newPassword).toBe('');
      expect(adminServiceSpy.listUsers).toHaveBeenCalled();
    });

    it('sets creating false and createError on failure', () => {
      adminServiceSpy.createAdmin.and.returnValue(throwError(() => new Error('create failed')));

      component.createAdmin();

      expect(component.creating()).toBeFalse();
      expect(component.createError()).toBe('create failed');
    });
  });
});
