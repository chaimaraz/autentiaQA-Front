// src/app/features/projects/new-project/new-project.component.ts
import { Component, signal, computed } from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { ProjectApiService, CreateProjectPayload } from '../../../services/project-api.service';

export type GenerationModeKey = 'URL_CRAWL' | 'SPEC_DOCUMENT';
export type TestTypeKey = 'FUNCTIONAL' | 'NEGATIVE' | 'PERFORMANCE' | 'SECURITY' | 'E2E' | 'ACCESSIBILITY';
export type FrameworkKey = 'PLAYWRIGHT' | 'CYPRESS' | 'SELENIUM';

export interface TestType {
  key: TestTypeKey;
  label: string;
  selected: boolean;
}

export interface Framework {
  key: FrameworkKey;
  name: string;
  desc: string;
  selected: boolean;
}

export interface GenerationMode {
  key: GenerationModeKey;
  icon: string;
  title: string;
  desc: string;
  colorClass: string;
  selected: boolean;
}

export interface UploadedFileItem {
  file: File;
  name: string;
  sizeLabel: string;
  mimeType: string;
}

@Component({
  selector: 'app-new-project',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule, RouterLink],
  templateUrl: './new-project.component.html',
  styleUrl: './new-project.component.scss',
})
export class NewProjectComponent {
  private router = inject(Router);
  private projectApi = inject(ProjectApiService);

  currentStep = signal(1);

  projectName = '';
  projectUrl = '';
  projectDescription = '';
  detectedTags = ['Angular 17', 'SPA', 'JWT Auth', 'REST API', 'Lazy Loading'];
  generationModes: GenerationMode[] = [
    {
      key: 'URL_CRAWL',
      icon: '🕸️',
      title: 'Analyse automatique URL',
      desc: "Le crawler parcourt l'ensemble du site et détecte tous les formulaires et composants.",
      colorClass: 'cyan',
      selected: true,
    },
    {
      key: 'SPEC_DOCUMENT',
      icon: '📄',
      title: 'Spécifications métier',
      desc: "Importez un PDF ou Word. L'IA extrait les règles métier et génère des scénarios alignés.",
      colorClass: 'purple',
      selected: false,
    },
  ];
  uploadedFiles: UploadedFileItem[] = [];
  isDragOver = false;

  testTypes: TestType[] = [
    { key: 'FUNCTIONAL',    label: 'Tests fonctionnels',     selected: true },
    { key: 'NEGATIVE',      label: 'Scénarios négatifs',     selected: true },
    { key: 'PERFORMANCE',   label: 'Tests de performance',   selected: true },
    { key: 'SECURITY',      label: 'Tests de sécurité',      selected: true },
    { key: 'E2E',           label: 'Tests E2E (flux)',        selected: true },
    { key: 'ACCESSIBILITY', label: "Tests d'accessibilité",  selected: false },
  ];

  frameworks: Framework[] = [
    { key: 'PLAYWRIGHT', name: 'Playwright', desc: 'Multi-navigateur, SPA-ready', selected: true },
    { key: 'CYPRESS',    name: 'Cypress',    desc: 'Idéal React/Vue',             selected: false },
    { key: 'SELENIUM',   name: 'Selenium',   desc: 'Compatibilité maximale',      selected: false },
  ];

  repoUrl = '';
  branch = 'main';
  onPush = true;
  onPr = true;
  onTag = false;
  onSchedule = false;
  notifyEmail = true;
  notifySlack = true;
  createJiraBug = true;
  blockMerge = false;

  isSubmitting = signal(false);
  submitError = signal<string | null>(null);

  steps = [
    { num: 1, label: 'Configuration' },
    { num: 2, label: 'Mode & Types' },
    { num: 3, label: 'Intégration' },
    { num: 4, label: 'Lancement' },
  ];

  get selectedFramework(): Framework | undefined {
    return this.frameworks.find((f) => f.selected);
  }

  get selectedMode(): GenerationMode | undefined {
    return this.generationModes.find((m) => m.selected);
  }

  get selectedTestTypes(): TestType[] {
    return this.testTypes.filter((t) => t.selected);
  }

  get isSpecMode(): boolean {
    return this.selectedMode?.key === 'SPEC_DOCUMENT';
  }

  getStepState(stepNum: number): 'done' | 'active' | 'pending' {
    const current = this.currentStep();
    if (stepNum < current) return 'done';
    if (stepNum === current) return 'active';
    return 'pending';
  }

  goToStep(step: number): void {
    if (step <= this.currentStep()) this.currentStep.set(step);
  }

  selectMode(mode: GenerationMode): void {
    this.generationModes.forEach((m) => (m.selected = false));
    mode.selected = true;
    if (mode.key === 'URL_CRAWL') this.uploadedFiles = [];
  }

  toggleTestType(type: TestType): void {
    type.selected = !type.selected;
  }

  selectFramework(fw: Framework): void {
    this.frameworks.forEach((f) => (f.selected = false));
    fw.selected = true;
  }

 onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
  }

  private addFiles(rawFiles: File[]): void {
    const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const MAX_SIZE = 20 * 1024 * 1024;

    rawFiles.forEach((file) => {
      if (!ALLOWED.includes(file.type)) {
        alert(`❌ Type non supporté : ${file.name} (PDF ou DOCX uniquement)`);
        return;
      }
      if (file.size > MAX_SIZE) {
        alert(`❌ Fichier trop volumineux : ${file.name} (max 20 MB)`);
        return;
      }
      if (this.uploadedFiles.find((f) => f.name === file.name && f.file.size === file.size)) return;

      this.uploadedFiles.push({
        file,
        name: file.name,
        sizeLabel: this.formatBytes(file.size),
        mimeType: file.type,
      });
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  next(): void {
    if (!this.validateCurrentStep()) return;
    const current = this.currentStep();
    if (current < 4) this.currentStep.set(current + 1);
    else this.launch();
  }

  prev(): void {
    const current = this.currentStep();
    if (current > 1) this.currentStep.set(current - 1);
  }

  private validateCurrentStep(): boolean {
    const step = this.currentStep();
    if (step === 1) {
      if (!this.projectName.trim()) { alert('Le nom du projet est requis'); return false; }
      if (!this.projectUrl.trim()) { alert("L'URL cible est requise"); return false; }
      if (!this.projectDescription.trim()) { alert('La description est requise'); return false; }
    }
    if (step === 2) {
      if (this.isSpecMode && this.uploadedFiles.length === 0) {
        alert('Veuillez uploader au moins un document de spécification'); return false;
      }
      if (this.selectedTestTypes.length === 0) {
        alert('Sélectionnez au moins un type de test'); return false;
      }
    }
    return true;
  }

  saveDraft(): void {
    alert('💾 Brouillon sauvegardé !');
  }

   launch(): void {
    if (this.isSubmitting()) return;
    this.submitError.set(null);
    this.isSubmitting.set(true);

    const payload: CreateProjectPayload = {
      name: this.projectName,
      url: this.projectUrl,
      description: this.projectDescription,
      generationMode: this.selectedMode!.key,
      testTypes: this.selectedTestTypes.map((t) => t.key),
      frameworkName: this.selectedFramework!.key,
      repoUrl: this.repoUrl || undefined,
      branch: this.branch,
      onPush: this.onPush,
      onPr: this.onPr,
      onTag: this.onTag,
      onSchedule: this.onSchedule,
      notifyEmail: this.notifyEmail,
      notifySlack: this.notifySlack,
      createJiraBug: this.createJiraBug,
      blockMerge: this.blockMerge,
      files: this.isSpecMode ? this.uploadedFiles.map((f) => f.file) : [],
    };

    this.projectApi.createProject(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/projects', res.data.id, 'execution']);
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this.submitError.set(err.message);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/projects']);
  }
}
