import { Component } from '@angular/core';
import { NgFor,CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgFor,CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  stats = [
    { label: 'Projets actifs', value: '3', sub: '2 en cours d\'analyse', color: 'cyan', valueColor: 'var(--accent)' },
    { label: 'Tests passés', value: '94%', sub: '↑ +3% cette semaine', color: 'green', valueColor: 'var(--success)' },
    { label: 'Scénarios générés', value: '247', sub: 'via IA — 3 frameworks', color: 'purple', valueColor: 'var(--accent2)' },
    { label: 'Vulnérabilités', value: '12', sub: '3 critiques à corriger', color: 'orange', valueColor: 'var(--warning)' },
  ];

  projects = [
    { name: 'E-Commerce Frontend', url: 'shop.example.com', status: 'passed', statusLabel: 'PASSED', dotColor: 'var(--success)', tags: ['React'], route: '/scenarios' },
    { name: 'Admin Dashboard', url: 'admin.myapp.io', status: 'running', statusLabel: 'EN COURS', dotColor: 'var(--accent)', tags: ['Angular'], route: '/execution' },
    { name: 'API Gateway Tests', url: 'api.platform.dev', status: 'failed', statusLabel: '2 ÉCHECS', dotColor: 'var(--warning)', tags: ['Vue'], route: '/projects' },
  ];

  activities = [
    { icon: '🤖', text: 'IA — 23 scénarios générés pour', bold: 'shop.example.com', time: '2m' },
    { icon: '🔐', text: 'Vulnérabilité XSS détectée sur', bold: '/checkout', time: '15m' },
    { icon: '⎇', text: 'Pipeline CI/CD déclenché —', bold: 'merge main', time: '1h' },
    { icon: '📊', text: 'Rapport PDF exporté —', bold: 'Admin Dashboard', time: '3h' },
  ];
}
