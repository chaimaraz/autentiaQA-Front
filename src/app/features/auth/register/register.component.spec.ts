import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { RegisterComponent } from './register.component';
import { AuthService } from '../../../services/auth.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let httpSpy: jasmine.SpyObj<Pick<HttpClient, 'get' | 'post'>>;
  let authSpy: jasmine.SpyObj<Pick<AuthService, 'applyExternalSession'>>;
  let router: Router;
  let queryToken: string | null;

  const invitationResponse = {
    success: true,
    data: { email: 'invitee@b.com', role: 'QA_LEAD' as const, projectName: 'Projet X' },
  };

  function createComponent(): void {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    queryToken = null;

    httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    httpSpy.get.and.returnValue(of(invitationResponse));
    authSpy = jasmine.createSpyObj('AuthService', ['applyExternalSession']);

    const activatedRouteStub = {
      snapshot: { queryParamMap: { get: (_key: string) => queryToken } },
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: httpSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('ngOnInit skips the HTTP check and marks the token invalid when no token is present', () => {
    queryToken = null;
    createComponent();

    expect(httpSpy.get).not.toHaveBeenCalled();
    expect(component.checkingToken()).toBe(false);
    expect(component.tokenValid()).toBe(false);
  });

  it('ngOnInit validates the invitation token and populates the preview on success', () => {
    queryToken = 'valid-token';
    createComponent();

    expect(httpSpy.get).toHaveBeenCalledWith(jasmine.stringMatching(/invitations\/valid-token$/));
    expect(component.checkingToken()).toBe(false);
    expect(component.tokenValid()).toBe(true);
    expect(component.invitation()).toEqual(invitationResponse.data);
    expect(component.roleLabel()).toBe('QA Lead');
  });

  it('ngOnInit marks the token invalid and surfaces the error on failure', () => {
    httpSpy.get.and.returnValue(throwError(() => ({ error: { message: 'Lien expiré' } })));
    queryToken = 'expired-token';
    createComponent();

    expect(component.checkingToken()).toBe(false);
    expect(component.tokenValid()).toBe(false);
    expect(component.error()).toBe('Lien expiré');
  });

  it('ngOnInit falls back to a generic error message on failure without one', () => {
    httpSpy.get.and.returnValue(throwError(() => ({})));
    queryToken = 'expired-token';
    createComponent();

    expect(component.error()).toBe("Ce lien d'invitation est invalide ou a expiré.");
  });

  it('setTheme updates the signal, the DOM attribute and localStorage', () => {
    createComponent();
    component.setTheme('light');
    expect(component.currentTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('aq-theme')).toBe('light');
  });

  it('togglePassword flips the showPassword signal', () => {
    createComponent();
    expect(component.showPassword()).toBe(false);
    component.togglePassword();
    expect(component.showPassword()).toBe(true);
  });

  describe('checkPasswordStrength', () => {
    beforeEach(() => createComponent());

    it('scores an empty password as 0 / "—"', () => {
      component.checkPasswordStrength('');
      expect(component.pwStrength()).toBe(0);
      expect(component.pwLabel()).toBe('—');
    });

    it('scores a password of length >= 8 (only) as 1 / "Faible"', () => {
      component.checkPasswordStrength('abcdefgh');
      expect(component.pwStrength()).toBe(1);
      expect(component.pwLabel()).toBe('Faible');
    });

    it('scores a long lowercase-only password as 2 / "Moyen"', () => {
      component.checkPasswordStrength('abcdefghijkl');
      expect(component.pwStrength()).toBe(2);
      expect(component.pwLabel()).toBe('Moyen');
    });

    it('scores a long password with upper+digit (no special char) as 3 / "Fort"', () => {
      component.checkPasswordStrength('Password1234');
      expect(component.pwStrength()).toBe(3);
      expect(component.pwLabel()).toBe('Fort');
    });

    it('scores a long password with upper+digit+special char as 4 / "Très fort"', () => {
      component.checkPasswordStrength('Password123!');
      expect(component.pwStrength()).toBe(4);
      expect(component.pwLabel()).toBe('Très fort');
    });
  });

  describe('handleRegister', () => {
    beforeEach(() => createComponent());

    it('rejects a missing name without calling the API', () => {
      component.name = '   ';
      component.password = 'password1';
      component.confirmPassword = 'password1';

      component.handleRegister();

      expect(component.error()).toBe('Veuillez indiquer votre nom.');
      expect(httpSpy.post).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 8 characters', () => {
      component.name = 'Jane';
      component.password = 'short';
      component.confirmPassword = 'short';

      component.handleRegister();

      expect(component.error()).toBe('Mot de passe trop court (min. 8 caractères).');
      expect(httpSpy.post).not.toHaveBeenCalled();
    });

    it('rejects mismatched password confirmation', () => {
      component.name = 'Jane';
      component.password = 'password1';
      component.confirmPassword = 'password2';

      component.handleRegister();

      expect(component.error()).toBe('Les mots de passe ne correspondent pas.');
      expect(httpSpy.post).not.toHaveBeenCalled();
    });

    it('registers successfully, applies the session and navigates after the redirect delay', fakeAsync(() => {
      const apiResult = { success: true, data: { user: {}, projects: [] } };
      httpSpy.post.and.returnValue(of(apiResult));
      component.name = 'Jane';
      component.password = 'password1';
      component.confirmPassword = 'password1';

      component.handleRegister();

      expect(component.loading()).toBe(false);
      expect(component.success()).toBe(true);
      expect(authSpy.applyExternalSession).toHaveBeenCalledWith(apiResult.data as any);
      expect(router.navigate).not.toHaveBeenCalled();

      tick(1200);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    }));

    it('surfaces the backend error message and stops loading on failure', () => {
      httpSpy.post.and.returnValue(throwError(() => ({ error: { message: 'Compte déjà créé' } })));
      component.name = 'Jane';
      component.password = 'password1';
      component.confirmPassword = 'password1';

      component.handleRegister();

      expect(component.loading()).toBe(false);
      expect(component.error()).toBe('Compte déjà créé');
      expect(authSpy.applyExternalSession).not.toHaveBeenCalled();
    });

    it('falls back to a generic error message when creation fails without one', () => {
      httpSpy.post.and.returnValue(throwError(() => ({})));
      component.name = 'Jane';
      component.password = 'password1';
      component.confirmPassword = 'password1';

      component.handleRegister();

      expect(component.error()).toBe('Impossible de créer le compte. Réessayez.');
    });
  });
});
