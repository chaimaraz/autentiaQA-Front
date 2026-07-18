import { Component, computed, inject, signal } from '@angular/core';
import { NgClass, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UsersManagementComponent } from './users/users-management.component';
import { AccessControlComponent } from './access-control/access-control.component';
import { PlatformAdminsComponent } from './platform-admins/platform-admins.component';
import { GeneralSettingsComponent } from './general-settings/general-settings.component';
import { JiraSettingsComponent } from './jira-settings/jira-settings.component';
import { NotificationSettingsComponent } from './notification-settings/notification-settings.component';

type SettingsTab = 'general' | 'users' | 'access-control' | 'jira' | 'notifications' | 'platform-admins';

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
    GeneralSettingsComponent,
    JiraSettingsComponent,
    NotificationSettingsComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private auth = inject(AuthService);

  // Onglet "Général" par défaut, comme dans le template de référence.
  activeTab = signal<SettingsTab>('general');

  // Un utilisateur peut administrer plusieurs projets : on choisit celui à gérer.
  // Logique inchangée pour éviter toute régression sur les droits existants.
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