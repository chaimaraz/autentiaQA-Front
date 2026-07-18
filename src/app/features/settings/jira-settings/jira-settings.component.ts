import { Component, Input, OnChanges, signal } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * ⚠️ Aucun backend Jira n'existe encore dans les fichiers fournis
 * (pas de modèle Prisma JiraConfig, pas de route /api/projects/:id/jira).
 * Ce composant est un shell UI fidèle au template, prêt à être branché :
 * remplacez testConnection()/saveConfig() par de vrais appels HTTP dès que
 * l'endpoint backend existe, sans changer le template.
 */
@Component({
  selector: 'app-jira-settings',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './jira-settings.component.html',
  styleUrl: './jira-settings.component.scss',
})
export class JiraSettingsComponent implements OnChanges {
  @Input({ required: true }) projectId!: string;

  connected = signal(false);
  testing = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');

  form = { jiraUrl: '', jiraEmail: '', apiToken: '', projectKey: '' };

  severityMapping = [
    { sourceLabel: 'CRITIQUE', sourceType: 'Sécurité', badgeClass: 'critical', target: 'Bug · Priorité : Blocker', options: ['Bug · Priorité : Blocker', 'Bug · Priorité : Critical', 'Task · Priorité : Major'] },
    { sourceLabel: 'ÉCHEC', sourceType: 'Fonctionnel', badgeClass: 'medium', target: 'Bug · Priorité : Critical', options: ['Bug · Priorité : Critical', 'Bug · Priorité : Major', 'Task · Priorité : Minor'] },
    { sourceLabel: 'PERF', sourceType: 'Performance', badgeClass: 'low', target: 'Bug · Priorité : Major', options: ['Bug · Priorité : Major', 'Task · Priorité : Minor', 'Improvement · Priorité : Minor'] },
    { sourceLabel: 'SÉLECT.', sourceType: 'Css/UI', badgeClass: 'info', target: 'Bug · Priorité : Minor', options: ['Bug · Priorité : Minor', 'Task · Priorité : Minor'] },
  ];

  advancedOptions = [
    { label: 'Créer bug automatiquement si test échoue', sub: 'Chaque test en échec génère un ticket Jira', enabled: true },
    { label: "Ajouter une capture d'écran au ticket", sub: 'Playwright prend un screenshot à l\'échec', enabled: true },
    { label: "Ajouter le log d'erreur complet", sub: 'Stack trace et sélecteur en cause inclus', enabled: true },
    { label: 'Éviter les doublons (déduplification)', sub: "Vérifie si un ticket identique existe déjà avant d'en créer un", enabled: true },
    { label: 'Assigner automatiquement', sub: 'Assigne au dernier committer sur la ligne de code concernée', enabled: false },
  ];

  ngOnChanges(): void {
    // TODO backend : GET /api/projects/:projectId/jira pour précharger this.form
  }

  testConnection(): void {
    if (!this.form.jiraUrl) {
      this.error.set('Veuillez saisir l\'URL Jira.');
      return;
    }
    this.error.set('');
    this.testing.set(true);
    // TODO backend : POST /api/projects/:projectId/jira/test
    setTimeout(() => {
      this.testing.set(false);
      this.connected.set(true);
    }, 800);
  }

  saveConfig(): void {
    this.error.set('');
    this.success.set('');
    if (!this.form.jiraUrl || !this.form.projectKey) {
      this.error.set('URL Jira et clé de projet sont requises.');
      return;
    }
    this.saving.set(true);
    // TODO backend : PUT /api/projects/:projectId/jira
    setTimeout(() => {
      this.saving.set(false);
      this.connected.set(true);
      this.success.set(`Configuration Jira sauvegardée pour le projet ${this.form.projectKey}.`);
      setTimeout(() => this.success.set(''), 3000);
    }, 600);
  }
}