import { Component, signal } from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface Run {
  id: string; project: string; framework: string;
  trigger: string; triggerLabel: string; branch: string; commit: string;
  status: string; pass: number; fail: number; blocked: number; skip: number; total: number;
  dur: string; date: string; rate: number;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, RouterLink],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  activeTab = signal<'runs' | 'flux'>('runs');

  globalStats = [
    { label: 'Total Runs', value: '143', sub: '+12 cette semaine', color: 'cyan', valueColor: 'var(--accent)' },
    { label: 'Taux moyen', value: '91%', sub: '↑ +3% vs mois dernier', color: 'green', valueColor: 'var(--success)' },
    { label: 'Runs avec échecs', value: '18', sub: '↑ 3 cette semaine', color: 'red', valueColor: 'var(--danger)' },
    { label: 'Durée moyenne', value: '1m 12s', sub: '↓ -8s vs mois dernier', color: 'orange', valueColor: 'var(--warning)' },
    { label: 'Bugs Jira créés', value: '41', sub: 'depuis le début', color: 'purple', valueColor: 'var(--accent2)' },
  ];

  runs: Run[] = [
    { id: '#143', project: 'E-Commerce Frontend', framework: 'Playwright', trigger: 'push', triggerLabel: 'Push main', branch: 'main', commit: 'feat/checkout-v2', status: 'passed', pass: 22, fail: 1, blocked: 0, skip: 0, total: 23, dur: '1m 05s', date: '28 févr. 10:32', rate: 96 },
    { id: '#142', project: 'E-Commerce Frontend', framework: 'Playwright', trigger: 'pr', triggerLabel: 'Merge PR #89', branch: 'feat/checkout', commit: 'feat/checkout-redesign', status: 'passed', pass: 23, fail: 0, blocked: 0, skip: 0, total: 23, dur: '0m 58s', date: '28 févr. 14:32', rate: 100 },
    { id: '#141', project: 'Admin Dashboard', framework: 'Playwright', trigger: 'push', triggerLabel: 'Push main', branch: 'hotfix/auth', commit: 'hotfix/auth-fix', status: 'failed', pass: 18, fail: 3, blocked: 2, skip: 0, total: 23, dur: '0m 48s', date: '27 févr. 18:10', rate: 78 },
    { id: '#140', project: 'API Gateway Tests', framework: 'Cypress', trigger: 'cron', triggerLabel: 'Cron 02:00', branch: 'main', commit: 'main', status: 'passed', pass: 28, fail: 0, blocked: 0, skip: 3, total: 31, dur: '2m 14s', date: '27 févr. 02:00', rate: 90 },
    { id: '#139', project: 'E-Commerce Frontend', framework: 'Playwright', trigger: 'manual', triggerLabel: 'Manuel', branch: 'develop', commit: 'develop', status: 'failed', pass: 19, fail: 4, blocked: 0, skip: 0, total: 23, dur: '1m 32s', date: '26 févr. 16:45', rate: 83 },
    { id: '#138', project: 'Admin Dashboard', framework: 'Playwright', trigger: 'push', triggerLabel: 'Push main', branch: 'main', commit: 'refactor/ui-angular17', status: 'passed', pass: 21, fail: 0, blocked: 0, skip: 2, total: 23, dur: '0m 52s', date: '25 févr. 11:20', rate: 91 },
  ];

  fluxRuns = [
    { id: '#F-32', name: 'Parcours achat complet — Positif', project: 'E-Commerce Frontend', status: 'passed', stepsPass: 5, stepsTotal: 5, date: '28 févr. 14:40', dur: '4m 54s', trigger: 'Merge PR' },
    { id: '#F-31', name: 'Authentification incorrecte — Négatif', project: 'E-Commerce Frontend', status: 'passed', stepsPass: 3, stepsTotal: 3, date: '27 févr. 18:15', dur: '2m 18s', trigger: 'Push main' },
    { id: '#F-30', name: 'Accès admin sans droits — Sécurité', project: 'E-Commerce Frontend', status: 'failed', stepsPass: 2, stepsTotal: 4, date: '26 févr. 09:00', dur: '1m 42s', trigger: 'Manuel' },
  ];

  expandedRun = signal<string | null>(null);

  toggleRun(id: string): void {
    this.expandedRun.update(v => v === id ? null : id);
  }

  getTriggerClass(t: string): string {
    return { push: 'push', pr: 'pr', manual: 'manual', cron: 'cron' }[t] ?? 'manual';
  }

  getPassWidth(r: Run): number { return Math.round(r.pass / r.total * 100); }
  getFailWidth(r: Run): number { return Math.round(r.fail / r.total * 100); }
  getBlockWidth(r: Run): number { return Math.round(r.blocked / r.total * 100); }
}
