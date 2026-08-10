import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService, Session } from '../../../services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authSpy: jasmine.SpyObj<Pick<AuthService, 'login'>>;
  let routerSpy: jasmine.SpyObj<Router>;

  const session: Session = {
    user: { id: '1', email: 'a@b.com', name: 'A', globalRole: 'USER' },
    projects: [],
  };

  function createComponent(): void {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();

    authSpy = jasmine.createSpyObj('AuthService', ['login']);
    authSpy.login.and.returnValue(of(session));
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('initializes the theme from localStorage', () => {
    localStorage.setItem('aq-theme', 'light');
    createComponent();
    expect(component.currentTheme()).toBe('light');
  });

  it('defaults the theme to dark when nothing is saved', () => {
    createComponent();
    expect(component.currentTheme()).toBe('dark');
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
    component.togglePassword();
    expect(component.showPassword()).toBe(false);
  });

  it('handleLogin rejects empty fields without calling AuthService', () => {
    createComponent();
    component.email = '';
    component.password = '';

    component.handleLogin();

    expect(component.error()).toBe('Veuillez remplir tous les champs.');
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('handleLogin rejects an invalid email without calling AuthService', () => {
    createComponent();
    component.email = 'not-an-email';
    component.password = 'secret123';

    component.handleLogin();

    expect(component.error()).toBe('Adresse email invalide.');
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('handleLogin logs in and navigates to /dashboard on success', () => {
    createComponent();
    component.email = 'a@b.com';
    component.password = 'secret123';

    component.handleLogin();

    expect(authSpy.login).toHaveBeenCalledWith('a@b.com', 'secret123');
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('handleLogin surfaces the error message and stops loading on failure', () => {
    authSpy.login.and.returnValue(throwError(() => new Error('Identifiants invalides.')));
    createComponent();
    component.email = 'a@b.com';
    component.password = 'wrong';

    component.handleLogin();

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Identifiants invalides.');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('handleLogin falls back to a generic error message when none is provided', () => {
    authSpy.login.and.returnValue(throwError(() => ({})));
    createComponent();
    component.email = 'a@b.com';
    component.password = 'wrong';

    component.handleLogin();

    expect(component.error()).toBe('Identifiants invalides.');
  });
});
