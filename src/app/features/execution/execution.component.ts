import { Component } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-execution',
  standalone: true,
  imports: [NgFor, NgClass, RouterLink],
  templateUrl: './execution.component.html',
  styleUrl: './execution.component.scss',
})
export class ExecutionComponent {
  stages = [
    { icon: '🕸️', label: 'Crawl\nDOM', state: 'done' },
    { icon: '🧠', label: 'Analyse\nIA', state: 'done' },
    { icon: '✦', label: 'Scénarios\ngénérés', state: 'done' },
    { icon: '▷', label: 'Exécution\ntests', state: 'running' },
    { icon: '📊', label: 'Rapport\nIA', state: 'pending' },
  ];

  stats = [
    { value: 18, label: 'Passés', color: 'var(--success)' },
    { value: 3, label: 'Échoués', color: 'var(--danger)' },
    { value: 2, label: 'En cours', color: 'var(--accent)' },
    { value: 0, label: 'Ignorés', color: 'var(--text3)' },
  ];

  logs = [
    { time: '09:42:11', level: 'info', msg: 'Initialisation Playwright Chromium' },
    { time: '09:42:13', level: 'ai', msg: 'Chargement données test: user.email=test.qa+2847@mail.io' },
    { time: '09:42:14', level: 'pass', msg: 'TC-001 Connexion valide → redirect /dashboard ✓ (1.2s)' },
    { time: '09:42:16', level: 'pass', msg: 'TC-002 Menu navigation → 8 liens détectés ✓ (0.4s)' },
    { time: '09:42:21', level: 'fail', msg: 'TC-004 Validation email invalide → sélecteur introuvable ✗' },
    { time: '09:42:21', level: 'ai', msg: 'Suggestion IA: .mat-error:first-child' },
    { time: '09:42:28', level: 'pass', msg: 'TC-006 Chargement tableau de bord → retry OK (2.1s) ✓' },
    { time: '09:42:31', level: 'info', msg: 'TC-022 en cours: Suppression rôle administrateur...' },
  ];

  progress = Math.round((18 + 3 + 2) / 23 * 100);
}
