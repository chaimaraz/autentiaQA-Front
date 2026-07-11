import { Component, computed, inject, signal } from '@angular/core';
import { NgClass, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UsersManagementComponent } from './users/users-management.component';
import { AccessControlComponent } from './access-control/access-control.component';
import { PlatformAdminsComponent } from './platform-admins/platform-admins.component';

type SettingsTab = 'users' | 'access-control' | 'platform-admins';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NgClass,
    NgIf,
    NgFor,
    FormsModule,
    UsersManagementComponent,
    AccessControlComponent,
    PlatformAdminsComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private auth = inject(AuthService);

  activeTab = signal<SettingsTab>('users');

  // Un utilisateur peut administrer plusieurs projets : on choisit celui à gérer.
  adminProjects = computed(() =>
    this.auth.projects().filter((p) => p.role === 'ADMIN' || this.auth.isSuperAdmin())
  );
  selectedProjectId = signal<string>('');

  canManageAccessControl = computed(() => this.auth.isAdmin());
  isSuperAdmin = computed(() => this.auth.isSuperAdmin());

  constructor() {
    const projects = this.adminProjects();
    if (projects.length) this.selectedProjectId.set(projects[0].projectId);
  }

  setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }

  onProjectChange(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }
}
