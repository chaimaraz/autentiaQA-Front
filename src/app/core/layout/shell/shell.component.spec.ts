import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { ShellComponent } from './shell.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { AuthService } from '../../../services/auth.service';

describe('ShellComponent', () => {
  let component: ShellComponent;
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(async () => {
    const authSpy = {
      user: jasmine.createSpy('user').and.returnValue(null),
      projects: jasmine.createSpy('projects').and.returnValue([]),
      isSuperAdmin: jasmine.createSpy('isSuperAdmin').and.returnValue(false),
      logout: jasmine.createSpy('logout'),
    };

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the sidebar and topbar as its layout shell', () => {
    expect(fixture.debugElement.query(By.directive(SidebarComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TopbarComponent))).toBeTruthy();
  });
});
