import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiFailureAnalysis } from '../../../services/execution.service';

// Rendu de la liste des échecs analysés par l'IA — extrait de execution.component.html
// et history.component.html (le même bloc y était dupliqué presque à l'identique).
@Component({
  selector: 'app-ai-failures-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-failures-list.component.html',
})
export class AiFailuresListComponent {
  @Input() summary = '';
  @Input() failures: AiFailureAnalysis[] = [];
  @Input() showStepIndex = false;

  causeLabelFr(cat: string): string {
    const labels: Record<string, string> = {
      APPLICATION_BUG: 'Bug application',
      SCRIPT_ISSUE: 'Script/sélecteur',
      ENVIRONMENT: 'Environnement',
      TIMING: 'Timing',
      UNKNOWN: 'Indéterminé',
    };
    return labels[cat] || cat;
  }

  causeIconFr(cat: string): string {
    const icons: Record<string, string> = {
      APPLICATION_BUG: 'fa-bug',
      SCRIPT_ISSUE: 'fa-file-code',
      ENVIRONMENT: 'fa-globe',
      TIMING: 'fa-stopwatch',
      UNKNOWN: 'fa-circle-question',
    };
    return icons[cat] || 'fa-circle-question';
  }
}
