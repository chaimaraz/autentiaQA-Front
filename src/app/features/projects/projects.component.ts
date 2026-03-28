import { Component } from '@angular/core';
import { NgFor, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [NgFor,CommonModule, RouterLink],
  template: `
<div class="section-title">Tous les projets</div>
<div class="section-sub">3 projets actifs</div>
<div class="card">
  <div class="card-header">
    <div class="card-title">Projets de test</div>
    <a [routerLink]="'/projects'" class="btn btn-primary btn-sm">+ Nouveau</a>
  </div>
  <div class="card-body">
    <div class="project-item" *ngFor="let p of projects" [routerLink]="p.route">
      <div class="project-dot" [style.background]="p.dotColor"></div>
      <div class="project-info">
        <div class="project-name">{{ p.name }}</div>
        <div class="project-url">{{ p.url }}</div>
      </div>
      <div class="project-meta">
        <span class="tag cyan">{{ p.scenarios }} scénarios</span>
        <span class="status-badge" [ngClass]="p.status">{{ p.statusLabel }}</span>
        <button class="btn btn-ghost btn-sm">⟶</button>
      </div>
    </div>
  </div>
</div>`,
  styles: [`
.project-item { display:flex; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid var(--border); cursor:pointer; transition:all 0.15s; &:last-child{border-bottom:none} &:hover{padding-left:6px} }
.project-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.project-info { flex:1; min-width:0; }
.project-name { font-size:13px; font-weight:600; margin-bottom:2px; }
.project-url { font-size:11px; color:var(--text3); font-family:'Space Mono',monospace; }
.project-meta { display:flex; align-items:center; gap:8px; }
  `],
})
export class ProjectsComponent {
  projects = [
    { name: 'E-Commerce Frontend', url: 'shop.example.com · React 18 · Playwright', dotColor: 'var(--success)', scenarios: 47, status: 'passed', statusLabel: '94% passé', route: '/scenarios' },
    { name: 'Admin Dashboard', url: 'admin.myapp.io · Angular 17 · Playwright', dotColor: 'var(--accent)', scenarios: 23, status: 'running', statusLabel: 'En cours', route: '/execution' },
    { name: 'API Gateway Tests', url: 'api.platform.dev · Vue 3 · Cypress', dotColor: 'var(--warning)', scenarios: 31, status: 'failed', statusLabel: '2 échecs', route: '/history' },
  ];
}
