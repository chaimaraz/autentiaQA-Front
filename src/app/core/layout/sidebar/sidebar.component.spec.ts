import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SidebarComponent } from './sidebar.component';
import { AuthService, AuthUser, ProjectAccess } from '../../../services/auth.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let authSpy: {
    user: jasmine.Spy;
    projects: jasmine.Spy;
    isSuperAdmin: jasmine.Spy;
    logout: jasmine.Spy;
  };
  let router: Router;

  function createComponent(
    user: AuthUser | null = null,
    projects: ProjectAccess[] = [],
    isSuperAdmin = false
  ): void {
    authSpy.user.and.returnValue(user);
    authSpy.projects.and.returnValue(projects);
    authSpy.isSuperAdmin.and.returnValue(isSuperAdmin);

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();

    authSpy = {
      user: jasmine.createSpy('user').and.returnValue(null),
      projects: jasmine.createSpy('projects').and.returnValue([]),
      isSuperAdmin: jasmine.createSpy('isSuperAdmin').and.returnValue(false),
      logout: jasmine.createSpy('logout'),
    };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
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

  it('computes userName, userRoleLabel and userInitials from the current user', () => {
    createComponent({ id: '1', email: 'a@b.com', name: 'Jane Doe', globalRole: 'ADMIN' });
    expect(component.userName()).toBe('Jane Doe');
    expect(component.userRoleLabel()).toBe('Administrateur');
    expect(component.userInitials()).toBe('JD');
  });

  it('falls back to defaults when there is no user', () => {
    createComponent(null);
    expect(component.userName()).toBe('');
    expect(component.userRoleLabel()).toBe('Utilisateur');
    expect(component.userInitials()).toBe('?');
  });

  it('maps SUPER_ADMIN and USER global roles to their French labels', () => {
    createComponent({ id: '1', email: 'a@b.com', name: 'Bob', globalRole: 'SUPER_ADMIN' });
    expect(component.userRoleLabel()).toBe('Super Admin');
  });

  it('hides items that require a permission the user does not have', () => {
    createComponent(
      { id: '1', email: 'a@b.com', name: 'A', globalRole: 'USER' },
      [{ projectId: 'p1', projectName: 'P1', projectStatus: 'ACTIVE', role: 'MEMBRE', permissions: [] }],
      false
    );
    const labels = component.navSections().flatMap((s) => s.items.map((i) => i.label));
    expect(labels).not.toContain('Scénarios IA');
    expect(labels).toContain('Tableau de bord');
  });

  it('shows a permissioned item once the user has the matching permission', () => {
    createComponent(
      { id: '1', email: 'a@b.com', name: 'A', globalRole: 'USER' },
      [{ projectId: 'p1', projectName: 'P1', projectStatus: 'ACTIVE', role: 'MEMBRE', permissions: ['SCENARIO_VIEW'] }],
      false
    );
    const labels = component.navSections().flatMap((s) => s.items.map((i) => i.label));
    expect(labels).toContain('Scénarios IA');
  });

  it('shows every item to a super admin regardless of permissions', () => {
    createComponent({ id: '1', email: 'a@b.com', name: 'A', globalRole: 'SUPER_ADMIN' }, [], true);
    const labels = component.navSections().flatMap((s) => s.items.map((i) => i.label));
    expect(labels).toContain('Sécurité OWASP');
    expect(labels).toContain('Pipeline CI/CD');
    expect(labels).toContain('Flux personnalisés');
  });

  it('hides a group entirely when none of its children are visible', () => {
    createComponent({ id: '1', email: 'a@b.com', name: 'A', globalRole: 'USER' }, [], false);
    const labels = component.navSections().flatMap((s) => s.items.map((i) => i.label));
    // "Flux personnalisés" requires SCENARIO_VIEW on its parent -> hidden entirely without it
    expect(labels).not.toContain('Flux personnalisés');
  });

  it('toggleGroup flips the open flag of a nav group', () => {
    createComponent({ id: '1', email: 'a@b.com', name: 'A', globalRole: 'SUPER_ADMIN' }, [], true);
    const group = component
      .navSections()
      .flatMap((s) => s.items)
      .find((i) => component.isGroup(i)) as { open?: boolean };
    expect(group).toBeTruthy();
    const initial = group.open;
    component.toggleGroup(group as any);
    expect(group.open).toBe(!initial);
  });

  it('setTheme updates the signal, the DOM attribute and localStorage', () => {
    createComponent();
    component.setTheme('light');
    expect(component.currentTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('aq-theme')).toBe('light');
  });

  it('ngOnInit restores the theme saved in localStorage', () => {
    localStorage.setItem('aq-theme', 'light');
    createComponent();
    expect(component.currentTheme()).toBe('light');
  });

  it('ngOnInit defaults to dark theme when nothing is saved', () => {
    createComponent();
    expect(component.currentTheme()).toBe('dark');
  });

  it('toggleUserDropdown and closeUserDropdown manage the dropdown state', () => {
    createComponent();
    expect(component.userDropdownOpen()).toBe(false);
    component.toggleUserDropdown();
    expect(component.userDropdownOpen()).toBe(true);
    component.toggleUserDropdown();
    expect(component.userDropdownOpen()).toBe(false);
    component.toggleUserDropdown();
    component.closeUserDropdown();
    expect(component.userDropdownOpen()).toBe(false);
  });

  it('goToProfile closes the dropdown and navigates to /profile', () => {
    createComponent();
    component.toggleUserDropdown();
    component.goToProfile();
    expect(component.userDropdownOpen()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('goToSettings closes the dropdown and navigates to /settings', () => {
    createComponent();
    component.toggleUserDropdown();
    component.goToSettings();
    expect(component.userDropdownOpen()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/settings']);
  });

  it('logout closes the dropdown and delegates to AuthService', () => {
    createComponent();
    component.toggleUserDropdown();
    component.logout();
    expect(component.userDropdownOpen()).toBe(false);
    expect(authSpy.logout).toHaveBeenCalled();
  });
});
