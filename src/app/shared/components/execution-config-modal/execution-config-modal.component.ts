// src/app/shared/components/execution-config-modal/execution-config-modal.component.ts
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { CaptureMode, TraceMode, ExecutionCaptureConfig } from '../../../services/execution.service';
import { FormsModule } from '@angular/forms';

interface ModeOption<T extends string> {
  value: T;
  label: string;
}

export interface BatchScenarioChoice {
  id: string;
  name: string;
  dataChoice: 'regenerate' | 'keep';
}

const CAPTURE_OPTIONS: ModeOption<CaptureMode>[] = [
  { value: 'NEVER',       label: 'Jamais' },
  { value: 'ON_FAILURE',  label: 'Si échec' },
  { value: 'ON_SUCCESS',  label: 'Si succès' },
  { value: 'ALWAYS',      label: 'Toujours' },
];

const TRACE_OPTIONS: ModeOption<TraceMode>[] = [
  { value: 'NEVER',      label: 'Jamais' },
  { value: 'ON_FAILURE', label: 'Si échec' },
  { value: 'ALWAYS',     label: 'Toujours' },
];

export interface ExecutionConfigResult {
  captureConfig: ExecutionCaptureConfig;
  /** true si lancé pour "Exécuter tous" (contexte d'affichage uniquement) */
  isBatch: boolean;
  dataChoices?: Record<string, 'regenerate' | 'keep'>;
}

@Component({
  selector: 'app-execution-config-modal',
  standalone: true,
  imports: [NgClass, NgFor ,NgIf , FormsModule],
  templateUrl: './execution-config-modal.component.html',
  styleUrl: './execution-config-modal.component.scss',
})
export class ExecutionConfigModalComponent {

  @Output() confirmed = new EventEmitter<ExecutionConfigResult>();
  @Output() cancelled = new EventEmitter<void>();

  readonly captureOptions = CAPTURE_OPTIONS;
  readonly traceOptions   = TRACE_OPTIONS;

  isOpen      = signal(false);
  isBatchMode = signal(false);
  targetLabel = signal('');

  screenshotMode = signal<CaptureMode>('ON_FAILURE');
  videoMode      = signal<CaptureMode>('ON_FAILURE');
  traceMode      = signal<TraceMode>('ON_FAILURE');

  // ── NOUVEAU : liste des scénarios pour le choix régénérer/conserver
  batchScenarios = signal<BatchScenarioChoice[]>([]);

  // MODIFIÉ : ajout du 3ème paramètre optionnel
  open(label: string, isBatch = false, scenariosList: { id: string; name: string }[] = []): void {
    this.targetLabel.set(label);
    this.isBatchMode.set(isBatch);
    this.screenshotMode.set('ON_FAILURE');
    this.videoMode.set(isBatch ? 'NEVER' : 'ON_FAILURE');
    this.traceMode.set('ON_FAILURE');
    // ── NOUVEAU : par défaut, on conserve les données existantes
    this.batchScenarios.set(scenariosList.map(s => ({ ...s, dataChoice: 'keep' as const })));
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onCancel(): void {
    this.close();
    this.cancelled.emit();
  }

  // ── NOUVEAU : méthodes pour la section batch
  setDataChoice(scenario: BatchScenarioChoice, choice: 'regenerate' | 'keep'): void {
    scenario.dataChoice = choice;
  }

  setAllDataChoice(choice: 'regenerate' | 'keep'): void {
    this.batchScenarios.update(list => list.map(s => ({ ...s, dataChoice: choice })));
  }

  // MODIFIÉ : ajout de dataChoices dans le résultat
  onConfirm(): void {
    const result: ExecutionConfigResult = {
      captureConfig: {
        screenshotMode: this.screenshotMode(),
        videoMode:      this.videoMode(),
        traceMode:      this.traceMode(),
      },
      isBatch: this.isBatchMode(),
    };

    if (this.isBatchMode()) {
      const dataChoices: Record<string, 'regenerate' | 'keep'> = {};
      for (const s of this.batchScenarios()) dataChoices[s.id] = s.dataChoice;
      result.dataChoices = dataChoices;
    }

    this.close();
    this.confirmed.emit(result);
  }
}