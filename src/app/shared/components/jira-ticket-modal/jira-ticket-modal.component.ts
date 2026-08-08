// src/app/shared/components/jira-ticket-modal/jira-ticket-modal.component.ts
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExecutionService, JiraPreview, JiraTicketResult } from '../../../services/execution.service';

@Component({
  selector: 'app-jira-ticket-modal',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './jira-ticket-modal.component.html',
  styleUrl: './jira-ticket-modal.component.scss',
})
export class JiraTicketModalComponent {
  @Output() created = new EventEmitter<JiraTicketResult>();
  @Output() cancelled = new EventEmitter<void>();

  private execSvc = inject(ExecutionService);

  isOpen  = signal(false);
  loading = signal(false);
  creating = signal(false);
  error   = signal('');

  preview = signal<JiraPreview | null>(null);
  title   = signal('');
  description = signal('');

  private executionId = '';

  open(executionId: string): void {
    this.executionId = executionId;
    this.isOpen.set(true);
    this.loading.set(true);
    this.error.set('');
    this.preview.set(null);

    this.execSvc.getJiraPreview(executionId).subscribe({
      next: (preview) => {
        this.loading.set(false);
        this.preview.set(preview);
        this.title.set(preview.title);
        this.description.set(preview.description);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.message || "Impossible de générer l'aperçu du ticket.");
      },
    });
  }

  close(): void {
    this.isOpen.set(false);
  }

  onCancel(): void {
    this.close();
    this.cancelled.emit();
  }

  onConfirm(): void {
    if (!this.title().trim() || !this.description().trim()) {
      this.error.set('Titre et description sont requis.');
      return;
    }
    this.creating.set(true);
    this.error.set('');

    this.execSvc.createJiraTicket(this.executionId, {
      title: this.title(),
      description: this.description(),
    }).subscribe({
      next: (result) => {
        this.creating.set(false);
        this.close();
        this.created.emit(result);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err.message || 'Échec de la création du ticket Jira.');
      },
    });
  }

  causeLabelFr(cat: string): string {
    const labels: Record<string, string> = {
      APPLICATION_BUG: '🐛 Bug application',
      SCRIPT_ISSUE: '📝 Script/sélecteur',
      ENVIRONMENT: '🌐 Environnement',
      TIMING: '⏱ Timing',
      UNKNOWN: '❓ Indéterminé',
    };
    return labels[cat] || cat;
  }
}
