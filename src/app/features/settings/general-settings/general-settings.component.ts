import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../../services/project-api.service';

interface ProjectView {
  id: string;
  name: string;
  url: string;
  description: string;
  frameworkName: string;
  testTypes: { label: string }[];
}

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './general-settings.component.html',
  styleUrl: './general-settings.component.scss',
})
export class GeneralSettingsComponent implements OnChanges {
  @Input({ required: true }) projectId!: string;

  private projectApi = inject(ProjectApiService);

  project = signal<ProjectView | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  success = signal('');

  form = { name: '', url: '', description: '', frameworkName: 'PLAYWRIGHT' };

  ngOnChanges(): void {
    if (this.projectId) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.projectApi.getProject(this.projectId).subscribe({
      next: (res) => {
        const p = res.data as ProjectView;
        this.project.set(p);
        this.form = {
          name: p.name,
          url: p.url,
          description: p.description,
          frameworkName: p.frameworkName,
        };
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    // NOTE : nécessite un endpoint PATCH /api/projects/:id côté backend
    // (voir project.routes.js / project.controller.js / project.service.js —
    // non présent dans les fichiers fournis). Le service ci-dessous suppose
    // l'ajout de ProjectApiService.updateProject().
    this.projectApi.updateProject(this.projectId, this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Paramètres du projet mis à jour.');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.message || "La sauvegarde nécessite l'endpoint backend PATCH /api/projects/:id.");
      },
    });
  }
}