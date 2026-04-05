import { Component } from '@angular/core';
import { NgFor, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [NgFor,CommonModule, RouterLink],
  templateUrl: './projects.component.html',
  styleUrl:'./projects.component.scss',
})
export class ProjectsComponent {
  projects = [
    { name: 'E-Commerce Frontend', url: 'shop.example.com · React 18 · Playwright', dotColor: 'var(--success)', scenarios: 47, status: 'passed', statusLabel: '94% passé', route: '/scenarios' },
    { name: 'Admin Dashboard', url: 'admin.myapp.io · Angular 17 · Playwright', dotColor: 'var(--accent)', scenarios: 23, status: 'running', statusLabel: 'En cours', route: '/execution' },
    { name: 'API Gateway Tests', url: 'api.platform.dev · Vue 3 · Cypress', dotColor: 'var(--warning)', scenarios: 31, status: 'failed', statusLabel: '2 échecs', route: '/history' },
  ];
}
