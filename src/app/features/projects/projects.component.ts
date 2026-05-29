import { Component, OnInit } from '@angular/core';
import { NgFor, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectApiService } from '../../services/project-api.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [NgFor, CommonModule, RouterLink],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit {

  projects: any[] = [];
  loading = false;
  errorMessage = '';

  constructor(private projectService: ProjectApiService) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading = true;

    this.projectService.listProjects().subscribe({
      next: (response) => {
        this.projects = response.data.map((project: any) => ({
          id: project.id,
          name: project.name,
          url: `${project.url} · ${project.framework.frameworkName}`,

          // 0 par défaut
          scenarios: project.scenariosCount || 0,

          // couleur par défaut
          dotColor: 'var(--success)',

          // status par défaut
          status: 'passed',
          statusLabel: 'Actif',

          route: `/projects/${project.id}`
        }));

        this.loading = false;
      },

      error: (err) => {
        this.errorMessage = err.message;
        this.loading = false;
      }
    });
  }
}
