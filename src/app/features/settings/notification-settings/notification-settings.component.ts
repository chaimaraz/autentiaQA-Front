import { Component, Input, signal } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Le schéma Prisma expose déjà ProjectConfig.notifyEmail / notifySlack
 * (booléens globaux, définis à la création du projet). Les conditions
 * détaillées ci-dessous (résumé quotidien, seuil de taux de succès...)
 * nécessitent d'étendre ce modèle + un endpoint PATCH dédié — non présent
 * dans les fichiers fournis. Ce composant est prêt à être branché.
 */
@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './notification-settings.component.html',
  styleUrl: './notification-settings.component.scss',
})
export class NotificationSettingsComponent {
  @Input({ required: true }) projectId!: string;

  saving = signal(false);
  success = signal('');

  form = { emails: '', slackWebhook: '' };

  conditions = [
    { key: 'onFailure', label: 'Notifier si au moins 1 test échoue', enabled: true },
    { key: 'onSuccess', label: 'Notifier à chaque exécution réussie', enabled: false },
    { key: 'dailySummary', label: 'Résumé quotidien', sub: 'Envoyé chaque matin à 8h00', enabled: true },
    { key: 'lowRateAlert', label: 'Alerte si taux de succès < 80%', enabled: true },
  ];

  // TODO backend : GET /api/projects/:projectId (globalConfig) pour précharger le formulaire

  save(): void {
    this.saving.set(true);
    // TODO backend : PATCH /api/projects/:projectId/config { notifyEmail, notifySlack, ... }
    setTimeout(() => {
      this.saving.set(false);
      this.success.set('Préférences de notification sauvegardées.');
      setTimeout(() => this.success.set(''), 3000);
    }, 500);
  }
}