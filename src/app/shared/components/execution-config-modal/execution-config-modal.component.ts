// src/app/shared/components/execution-config-modal/execution-config-modal.component.ts
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { CaptureMode, TraceMode, ExecutionCaptureConfig } from '../../../services/execution.service';

interface ModeOption<T extends string> {
  value: T;
  label: string;
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
}

@Component({
  selector: 'app-execution-config-modal',
  standalone: true,
  imports: [NgClass, NgFor ,NgIf],
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
  targetLabel = signal(''); // nom du scénario, ou "tous les scénarios actifs"

  screenshotMode = signal<CaptureMode>('ON_FAILURE');
  videoMode      = signal<CaptureMode>('ON_FAILURE');
  traceMode      = signal<TraceMode>('ON_FAILURE');

  open(label: string, isBatch = false): void {
    this.targetLabel.set(label);
    this.isBatchMode.set(isBatch);
    // Reset aux valeurs par défaut à chaque ouverture
    this.screenshotMode.set('ON_FAILURE');
    this.videoMode.set(isBatch ? 'NEVER' : 'ON_FAILURE'); // vidéo désactivée par défaut en batch (perf)
    this.traceMode.set('ON_FAILURE');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onCancel(): void {
    this.close();
    this.cancelled.emit();
  }

  onConfirm(): void {
    const result: ExecutionConfigResult = {
      captureConfig: {
        screenshotMode: this.screenshotMode(),
        videoMode:      this.videoMode(),
        traceMode:      this.traceMode(),
      },
      isBatch: this.isBatchMode(),
    };
    this.close();
    this.confirmed.emit(result);
  }
}