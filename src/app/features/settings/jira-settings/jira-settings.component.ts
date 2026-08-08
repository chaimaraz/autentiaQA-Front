import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraConfigService, JiraConfigPayload } from '../../../services/jira-config.service';

@Component({
  selector: 'app-jira-settings',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './jira-settings.component.html',
  styleUrl: './jira-settings.component.scss',
})
export class JiraSettingsComponent implements OnChanges {
  @Input({ required: true }) projectId!: string;

  private jiraSvc = inject(JiraConfigService);

  connected = signal(false);
  loading = signal(false);
  testing = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  hasApiToken = signal(false);

  form = {
    jiraUrl: '',
    jiraEmail: '',
    apiToken: '',
    projectKey: '',
    defaultIssueType: 'Bug',
    autoCreateOnFail: false,
    attachScreenshot: true,
    attachVideo: false,
    includeErrorStack: true,
  };

  // ── Mapping des sévérités : non implémenté (nécessiterait d'interroger le
  // schéma de champs de l'instance Jira via /rest/api/3/issue/createmeta).
  // Conservé en lecture seule pour prévisualiser le concept, hors périmètre actuel.
  severityMapping = [
    { sourceLabel: 'CRITIQUE', sourceType: 'Sécurité', badgeClass: 'critical', target: 'Bug · Priorité : Blocker', options: ['Bug · Priorité : Blocker', 'Bug · Priorité : Critical', 'Task · Priorité : Major'] },
    { sourceLabel: 'ÉCHEC', sourceType: 'Fonctionnel', badgeClass: 'medium', target: 'Bug · Priorité : Critical', options: ['Bug · Priorité : Critical', 'Bug · Priorité : Major', 'Task · Priorité : Minor'] },
    { sourceLabel: 'PERF', sourceType: 'Performance', badgeClass: 'low', target: 'Bug · Priorité : Major', options: ['Bug · Priorité : Major', 'Task · Priorité : Minor', 'Improvement · Priorité : Minor'] },
    { sourceLabel: 'SÉLECT.', sourceType: 'Css/UI', badgeClass: 'info', target: 'Bug · Priorité : Minor', options: ['Bug · Priorité : Minor', 'Task · Priorité : Minor'] },
  ];

  ngOnChanges(): void {
    if (!this.projectId) return;
    this.loading.set(true);
    this.jiraSvc.getConfig(this.projectId).subscribe({
      next: (config) => {
        this.loading.set(false);
        if (!config) return;
        this.form = {
          jiraUrl: config.jiraUrl,
          jiraEmail: config.jiraEmail,
          apiToken: '',
          projectKey: config.projectKey,
          defaultIssueType: config.defaultIssueType,
          autoCreateOnFail: config.autoCreateOnFail,
          attachScreenshot: config.attachScreenshot,
          attachVideo: config.attachVideo,
          includeErrorStack: config.includeErrorStack,
        };
        this.hasApiToken.set(config.hasApiToken);
        this.connected.set(Boolean(config.lastTestOk));
      },
      error: () => this.loading.set(false),
    });
  }

  testConnection(): void {
    if (!this.form.jiraUrl || !this.form.jiraEmail) {
      this.error.set('Veuillez saisir au moins l\'URL et l\'email Jira.');
      return;
    }
    if (!this.form.apiToken && !this.hasApiToken()) {
      this.error.set("Veuillez saisir l'API token (aucun token enregistré pour l'instant).");
      return;
    }
    this.error.set('');
    this.testing.set(true);
    this.jiraSvc.testConnection(this.projectId, this.form).subscribe({
      next: () => {
        this.testing.set(false);
        this.connected.set(true);
      },
      error: (err) => {
        this.testing.set(false);
        this.connected.set(false);
        this.error.set(err.message || 'Connexion Jira échouée.');
      },
    });
  }

  saveConfig(): void {
    this.error.set('');
    this.success.set('');
    if (!this.form.jiraUrl || !this.form.projectKey || !this.form.jiraEmail) {
      this.error.set('URL Jira, email et clé de projet sont requis.');
      return;
    }
    if (!this.form.apiToken && !this.hasApiToken()) {
      this.error.set("L'API token Jira est requis lors de la première configuration.");
      return;
    }
    this.saving.set(true);

    const payload: JiraConfigPayload = { ...this.form };
    if (!payload.apiToken) delete (payload as any).apiToken;

    this.jiraSvc.saveConfig(this.projectId, payload).subscribe({
      next: (config) => {
        this.saving.set(false);
        this.hasApiToken.set(config.hasApiToken);
        this.form.apiToken = '';
        this.success.set(`Configuration Jira sauvegardée pour le projet ${config.projectKey}.`);
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.message || 'Échec de la sauvegarde.');
      },
    });
  }
}
