import { Component, OnInit, inject, signal } from '@angular/core';
import { NgClass, NgIf, NgFor } from '@angular/common';
import {
  PermissionService,
  PermissionCatalogue,
  PermissionMatrix,
} from '../../../services/permission.service';
import { ProjectRole } from '../../../services/member.service';

const ROLE_LABELS: Record<ProjectRole, string> = {
  ADMIN: 'Administrateur',
  QA_LEAD: 'QA Lead',
  MEMBRE: 'Membre',
  OBSERVATEUR: 'Observateur',
};

@Component({
  selector: 'app-access-control',
  standalone: true,
  imports: [NgClass, NgIf, NgFor],
  templateUrl: './access-control.component.html',
  styleUrl: './access-control.component.scss',
})
export class AccessControlComponent implements OnInit {
  private permissionService = inject(PermissionService);

  roles: ProjectRole[] = ['ADMIN', 'QA_LEAD', 'MEMBRE', 'OBSERVATEUR'];
  roleLabels = ROLE_LABELS;

  catalogue = signal<PermissionCatalogue>({});
  matrix = signal<PermissionMatrix>({ ADMIN: [], QA_LEAD: [], MEMBRE: [], OBSERVATEUR: [] });
  categories = signal<string[]>([]);

  loading = signal(true);
  error = signal('');
  saving = signal<ProjectRole | null>(null);
  savedRole = signal<ProjectRole | null>(null);

  // Copie de travail (permet d'annuler avant sauvegarde)
  draft: Record<ProjectRole, Set<string>> = { ADMIN: new Set(), QA_LEAD: new Set(), MEMBRE: new Set(), OBSERVATEUR: new Set() };

  ngOnInit(): void {
    this.permissionService.listCatalogue().subscribe({
      next: (catalogue) => {
        this.catalogue.set(catalogue);
        this.categories.set(Object.keys(catalogue));
        this.loadMatrix();
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  private loadMatrix(): void {
    this.permissionService.getMatrix().subscribe({
      next: (matrix) => {
        this.matrix.set(matrix);
        for (const role of this.roles) {
          this.draft[role] = new Set(matrix[role] || []);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  isChecked(role: ProjectRole, code: string): boolean {
    return this.draft[role].has(code);
  }

  toggle(role: ProjectRole, code: string): void {
    // ADMIN garde toujours accès complet — cohérent avec le rôle de
    // propriétaire de projet (voir project.service.js à la création).
    if (role === 'ADMIN') return;

    const set = this.draft[role];
    if (set.has(code)) set.delete(code);
    else set.add(code);
  }

  hasChanges(role: ProjectRole): boolean {
    const original = new Set(this.matrix()[role] || []);
    const current = this.draft[role];
    if (original.size !== current.size) return true;
    for (const code of current) if (!original.has(code)) return true;
    return false;
  }

  save(role: ProjectRole): void {
    this.saving.set(role);
    this.savedRole.set(null);
    this.permissionService.setRolePermissions(role, Array.from(this.draft[role])).subscribe({
      next: () => {
        this.saving.set(null);
        this.savedRole.set(role);
        this.matrix.update((m) => ({ ...m, [role]: Array.from(this.draft[role]) }));
        setTimeout(() => this.savedRole.set(null), 2500);
      },
      error: (err) => {
        this.saving.set(null);
        this.error.set(err.message);
      },
    });
  }
}