// src/app/features/projects/new-project/new-project.component.ts — v3.0
// Utilise le nouveau service async (Socket.IO) pour l'analyse IA.
// Le wizard lui-même (étapes 1-4, validation, CI/CD) est inchangé.
import { Component, signal } from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { ProjectApiService, CreateProjectPayload } from '../../../services/project-api.service';
import { AIGenerationService } from '../../../services/ai-generation.service';
import { AIReviewStoreService } from '../../../services/ai-review-store.service';

export type GenerationModeKey = 'URL_CRAWL' | 'SPEC_DOCUMENT';
export type TestTypeKey = 'FUNCTIONAL' | 'NEGATIVE' | 'PERFORMANCE' | 'SECURITY' | 'E2E' | 'ACCESSIBILITY';
export type FrameworkKey = 'PLAYWRIGHT' | 'CYPRESS' | 'SELENIUM';

export interface TestType   { key: TestTypeKey;  label: string; selected: boolean; }
export interface Framework  { key: FrameworkKey; name: string;  desc: string;  selected: boolean; }
export interface GenerationMode { key: GenerationModeKey; icon: string; title: string; desc: string; colorClass: string; selected: boolean; }
export interface UploadedFileItem { file: File; name: string; sizeLabel: string; mimeType: string; }

// ── NOUVEAU : un projet peut avoir plusieurs dépôts Git (frontend, backend,
// microservice1, microservice2...). Tous les champs de config sont optionnels
// à part name/repoUrl qui sont juste des chaînes vides par défaut — un dépôt
// "vide" est simplement ignoré côté backend, pas d'obligation de remplir.
export type RepoRoleKey = 'FRONTEND' | 'BACKEND' | 'MOBILE' | 'INFRA' | 'OTHER';
export interface GitRepoDraft {
  name: string;
  role: RepoRoleKey;
  repoUrl: string;
  branch: string;
  onPush: boolean;
  onPr: boolean;
  onTag: boolean;
  onSchedule: boolean;
  notifyEmail: boolean;
  notifySlack: boolean;
  createJiraBug: boolean;
  blockMerge: boolean;
  notifyEmails: string; // emails séparés par des virgules
}

@Component({
  selector: 'app-new-project',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule],
  templateUrl: './new-project.component.html',
  styleUrl: './new-project.component.scss',
})
export class NewProjectComponent {
  private router        = inject(Router);
  private projectApi    = inject(ProjectApiService);
  private aiSvc         = inject(AIGenerationService);
  private aiReviewStore = inject(AIReviewStoreService);

  currentStep = signal(1);

  projectName = ''; projectUrl = ''; projectDescription = '';
  detectedTags = ['Angular 17', 'SPA', 'JWT Auth', 'REST API', 'Lazy Loading'];

  generationModes: GenerationMode[] = [
    { key: 'URL_CRAWL',      icon: '🕸️', title: 'Analyse automatique URL',
      desc: "Le crawler parcourt l'ensemble du site et détecte tous les formulaires.",
      colorClass: 'cyan',   selected: true  },
    { key: 'SPEC_DOCUMENT',  icon: '📄', title: 'Spécifications métier',
      desc: "Importez un PDF ou Word. L'IA extrait les règles métier.",
      colorClass: 'purple', selected: false },
  ];

  uploadedFiles: UploadedFileItem[] = [];
  isDragOver = false;

  testTypes: TestType[] = [
    { key: 'FUNCTIONAL',    label: 'Tests fonctionnels',   selected: true  },
    { key: 'NEGATIVE',      label: 'Scénarios négatifs',   selected: true  },
    { key: 'PERFORMANCE',   label: 'Tests de performance', selected: true  },
    { key: 'SECURITY',      label: 'Tests de sécurité',    selected: true  },
    { key: 'E2E',           label: 'Tests E2E (flux)',      selected: true  },
    { key: 'ACCESSIBILITY', label: "Tests d'accessibilité", selected: false },
  ];

  frameworks: Framework[] = [
    { key: 'PLAYWRIGHT', name: 'Playwright', desc: 'Multi-navigateur, SPA-ready', selected: true  },
    { key: 'CYPRESS',    name: 'Cypress',    desc: 'Idéal React/Vue',             selected: false },
    { key: 'SELENIUM',   name: 'Selenium',   desc: 'Compatibilité maximale',      selected: false },
  ];

  // ── NOUVEAU : liste de dépôts (remplace les anciens champs repoUrl/branch/...
  // uniques). Vide par défaut → ajouter un dépôt reste entièrement optionnel.
  repoRoleOptions: { key: RepoRoleKey; label: string }[] = [
    { key: 'FRONTEND', label: 'Frontend' },
    { key: 'BACKEND',  label: 'Backend / Microservice' },
    { key: 'MOBILE',   label: 'Mobile' },
    { key: 'INFRA',    label: 'Infra' },
    { key: 'OTHER',    label: 'Autre' },
  ];
  repos: GitRepoDraft[] = [];

  // Réglages transverses au projet (indépendants des dépôts), inchangés.
  notifyEmail = true; notifySlack = true; createJiraBug = true; blockMerge = false;

  isSubmitting   = signal(false);
  submitError    = signal<string | null>(null);
  aiStatusLabel  = signal('');
  aiProgressPct  = signal(0);

  steps = [
    { num: 1, label: 'Configuration' }, { num: 2, label: 'Mode & Types' },
    { num: 3, label: 'Intégration'  }, { num: 4, label: 'Lancement'    },
  ];

  get selectedFramework() { return this.frameworks.find(f => f.selected); }
  get selectedMode()      { return this.generationModes.find(m => m.selected); }
  get selectedTestTypes() { return this.testTypes.filter(t => t.selected); }
  get isSpecMode()        { return this.selectedMode?.key === 'SPEC_DOCUMENT'; }

  getStepState(n: number): 'done' | 'active' | 'pending' {
    const c = this.currentStep();
    return n < c ? 'done' : n === c ? 'active' : 'pending';
  }

  goToStep(step: number): void { if (step <= this.currentStep()) this.currentStep.set(step); }

  selectMode(mode: GenerationMode): void {
    this.generationModes.forEach(m => m.selected = false);
    mode.selected = true;
    if (mode.key === 'URL_CRAWL') this.uploadedFiles = [];
  }

  toggleTestType(type: TestType):  void { type.selected = !type.selected; }
  selectFramework(fw: Framework):  void { this.frameworks.forEach(f => f.selected = false); fw.selected = true; }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }
  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragOver = true; }
  onDragLeave():             void { this.isDragOver = false; }
  onDrop(e: DragEvent):      void {
    e.preventDefault(); this.isDragOver = false;
    if (e.dataTransfer?.files) this.addFiles(Array.from(e.dataTransfer.files));
  }
  removeFile(i: number): void { this.uploadedFiles.splice(i, 1); }

  private static readonly ALLOWED_SPEC_TYPES: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/csv': 'CSV',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  };
 
  private addFiles(rawFiles: File[]): void {
    const MAX = 20 * 1024 * 1024;
    rawFiles.forEach(file => {
      if (!NewProjectComponent.ALLOWED_SPEC_TYPES[file.type]) {
        alert(`❌ Type non supporté : ${file.name}`); return;
      }
      if (file.size > MAX) { alert(`❌ Fichier trop volumineux : ${file.name}`); return; }
      if (this.uploadedFiles.find(f => f.name === file.name && f.file.size === file.size)) return;
      this.uploadedFiles.push({ file, name: file.name,
        sizeLabel: this.formatBytes(file.size), mimeType: file.type });
    });
  }

  private formatBytes(b: number): string {
    return b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(1)} MB`;
  }

  // ── NOUVEAU : gestion de la liste dynamique de dépôts (facultative) ────────
  addRepo(): void {
    this.repos.push({
      name: '', role: 'OTHER', repoUrl: '', branch: 'main',
      onPush: true, onPr: true, onTag: false, onSchedule: false,
      notifyEmail: true, notifySlack: false, createJiraBug: false, blockMerge: false,
      notifyEmails: '',
    });
  }
  removeRepo(i: number): void { this.repos.splice(i, 1); }

  next(): void {
    if (!this.validateCurrentStep()) return;
    const c = this.currentStep();
    if (c < 4) this.currentStep.set(c + 1); else this.launch();
  }
  prev(): void { const c = this.currentStep(); if (c > 1) this.currentStep.set(c - 1); }

  private validateCurrentStep(): boolean {
    const s = this.currentStep();
    if (s === 1) {
      if (!this.projectName.trim())       { alert('Le nom du projet est requis'); return false; }
      if (!this.projectUrl.trim())        { alert("L'URL cible est requise");    return false; }
      if (!this.projectDescription.trim()){ alert('La description est requise'); return false; }
    }
    if (s === 2) {
      if (this.isSpecMode && !this.uploadedFiles.length) {
        alert('Veuillez uploader au moins un document de spécification'); return false;
      }
      if (!this.selectedTestTypes.length) {
        alert('Sélectionnez au moins un type de test'); return false;
      }
    }
    return true;
  }

  saveDraft(): void { alert('💾 Brouillon sauvegardé !'); }

  launch(): void {
    if (this.isSubmitting()) return;
    this.submitError.set(null);
    this.isSubmitting.set(true);
    this.aiStatusLabel.set('Création du projet...');
    this.aiProgressPct.set(10);

    const payload: CreateProjectPayload = {
      name: this.projectName, url: this.projectUrl,
      description: this.projectDescription,
      generationMode: this.selectedMode!.key,
      testTypes: this.selectedTestTypes.map(t => t.key),
      frameworkName: this.selectedFramework!.key,
      // ── NOUVEAU : plusieurs dépôts, tous optionnels (tableau vide accepté) ──
      repos: this.repos.filter(r => r.name.trim() || r.repoUrl.trim()),
      notifyEmail: this.notifyEmail, notifySlack: this.notifySlack,
      createJiraBug: this.createJiraBug, blockMerge: this.blockMerge,
      files: this.isSpecMode ? this.uploadedFiles.map(f => f.file) : [],
    };

    this.projectApi.createProject(payload).subscribe({
      next: (res) => {
        this.aiProgressPct.set(25);
        this.aiStatusLabel.set("Projet créé — lancement de l'analyse IA...");
        this._runAiAnalysis(res.data);
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this.aiStatusLabel.set('');
        this.submitError.set(err.message);
      },
    });
  }

  private _runAiAnalysis(project: { id: string; name: string }): void {
    const mode = this.selectedMode!.key;

     const job = mode === 'SPEC_DOCUMENT'
      ? this.aiSvc.generateFromDocument(project.id, this.uploadedFiles[0].file)
      : this.aiSvc.generateFromUrl(project.id, this.projectUrl, { maxPages: 3, maxDepth: 1 });
 

    // Progression en temps réel via Socket.IO
    job.progress$.subscribe(p => {
      this.aiStatusLabel.set(p.message);
      this.aiProgressPct.update(v => Math.min(v + 15, 85));
    });

    // Résultat final
    job.result$.subscribe(({ scenarios, pagesExplored }) => {
      this.aiProgressPct.set(100);
      this.aiStatusLabel.set('Analyse terminée !');
      this.isSubmitting.set(false);

      this.aiReviewStore.set({
        projectId: project.id,
        projectName: project.name,
        source: mode === 'SPEC_DOCUMENT' ? 'document' : 'url',
        proposals: scenarios,
        pagesExplored,
      });
      this.router.navigate(['/projects', project.id, 'ai-review']);
    });

    // Erreur IA (le projet est déjà créé → on redirige vers scénarios)
    job.error$.subscribe(message => {
      this.isSubmitting.set(false);
      this.aiStatusLabel.set('');
      alert(
        `⚠️ Le projet a bien été créé, mais l'analyse IA a échoué :\n${message}\n\n` +
        `Vous pouvez réessayer depuis l'écran Scénarios.`
      );
      this.router.navigate(['/projects', project.id, 'scenarios']);
    });
  }

  cancel(): void { this.router.navigate(['/projects']); }
}
