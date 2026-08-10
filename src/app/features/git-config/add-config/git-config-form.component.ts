// src/app/features/git-config/add-config/git-config-form.component.ts
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GitConfigService, GitRepoConfig } from '../../../services/git-config.service';
import { ProjectApiService, GitRepoPayload } from '../../../services/project-api.service';

type RepoRoleKey = 'FRONTEND' | 'BACKEND' | 'MOBILE' | 'INFRA' | 'OTHER';
type ProviderKey = 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'OTHER';

@Component({
  selector: 'app-git-config-form',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, RouterLink],
  templateUrl: './git-config-form.component.html',
  styleUrl: './git-config-form.component.scss',
})
export class GitConfigFormComponent implements OnInit {
  /**
   * Optionnel : si le composant est utilisé depuis une page projet qui connaît
   * déjà l'id (ex: ancien usage dans project-detail), on peut le passer en Input.
   * Depuis le menu global "Pipeline CI/CD", il n'est pas fourni → on lit
   * ?projectId=... dans l'URL, et à défaut on affiche un sélecteur de projet.
   */
  @Input() projectId: string | null = null;
  @Input() existing: GitRepoConfig | null = null;

  @Output() saved = new EventEmitter<GitRepoConfig>();
  @Output() cancelled = new EventEmitter<void>();

  /** true si utilisé en composant embarqué (ex: futur écran project-detail) qui gère lui-même la navigation */
  @Input() embedded = false;

  constructor(
    private gitConfig: GitConfigService,
    private projectApi: ProjectApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  roleOptions: { key: RepoRoleKey; label: string; icon: string }[] = [
    { key: 'FRONTEND', label: 'Frontend', icon: 'fa-solid fa-desktop' },
    { key: 'BACKEND',  label: 'Backend / Microservice', icon: 'fa-solid fa-gear' },
    { key: 'MOBILE',   label: 'Mobile', icon: 'fa-solid fa-mobile-screen' },
    { key: 'INFRA',    label: 'Infra', icon: 'fa-solid fa-toolbox' },
    { key: 'OTHER',    label: 'Autre', icon: 'fa-solid fa-box' },
  ];
  providerOptions: { key: ProviderKey; label: string; icon: string }[] = [
    { key: 'GITHUB',    label: 'GitHub', icon: 'fa-brands fa-github' },
    { key: 'GITLAB',    label: 'GitLab', icon: 'fa-brands fa-gitlab' },
    { key: 'BITBUCKET', label: 'Bitbucket', icon: 'fa-brands fa-bitbucket' },
    { key: 'OTHER',     label: 'Autre', icon: 'fa-solid fa-code-branch' },
  ];

  // ── Sélecteur de projet (utilisé uniquement si projectId n'est pas déjà connu) ──
  projects = signal<{ id: string; name: string }[]>([]);
  loadingProjects = signal(false);

  form: GitRepoPayload = this._emptyForm();

  isSaving = signal(false);
  errorMessage = signal<string | null>(null);

  /** true si on est arrivé depuis le menu global (route autonome, pas un <app-git-config-form> embarqué) */
  get isStandalonePage(): boolean {
    return !this.embedded;
  }

  ngOnInit(): void {
    // 1) Input explicite (usage embarqué)
    // 2) sinon query param ?projectId=
    this.projectId = this.projectId || this.route.snapshot.queryParamMap.get('projectId');

    if (!this.projectId) this._loadProjects();

    if (this.existing) this._prefillFromExisting(this.existing);
  }

  private _loadProjects(): void {
    this.loadingProjects.set(true);
    this.projectApi.listProjects().subscribe({
      next: (res) => {
        this.projects.set(res.data.map((p: any) => ({ id: p.id, name: p.name })));
        this.loadingProjects.set(false);
      },
      error: () => this.loadingProjects.set(false),
    });
  }

  private _prefillFromExisting(existing: GitRepoConfig): void {
    const { name, role, provider, repoUrl, branch, onPush, onPr, onTag, onSchedule,
            notifyEmail, notifySlack, createJiraBug, blockMerge, notifyEmails } = existing;
    this.form = { name, role, provider, repoUrl, branch, onPush, onPr, onTag, onSchedule,
                  notifyEmail, notifySlack, createJiraBug, blockMerge, notifyEmails };
  }

  private _emptyForm(): GitRepoPayload {
    return {
      name: '', role: 'OTHER', provider: 'OTHER', repoUrl: '', branch: 'main',
      onPush: true, onPr: true, onTag: false, onSchedule: false,
      notifyEmail: true, notifySlack: false, createJiraBug: false, blockMerge: false,
      notifyEmails: '',
    };
  }

  submit(): void {
    if (this.isSaving()) return;
    this.errorMessage.set(null);

    if (!this.projectId) {
      this.errorMessage.set('Sélectionnez le projet auquel rattacher ce dépôt.');
      return;
    }
    // Champs de config non obligatoires — seule une intention minimale est attendue
    // (au moins un nom OU une URL) pour éviter d'enregistrer une ligne totalement vide.
    if (!this.form.name.trim() && !this.form.repoUrl.trim()) {
      this.errorMessage.set('Renseignez au moins un nom ou une URL de dépôt.');
      return;
    }

    this.isSaving.set(true);
    const req$ = this.existing
      ? this.gitConfig.update(this.projectId, this.existing.id, this.form)
      : this.gitConfig.create(this.projectId, this.form);

    req$.subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.saved.emit(res.data);
        // Usage en page autonome (depuis le menu) : on retourne vers la liste
        if (this.isStandalonePage) {
          this.router.navigate(['/git-config'], { queryParams: { projectId: this.projectId } });
        }
      },
      error: (err: Error) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.message);
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
    if (this.isStandalonePage) this.router.navigate(['/git-config']);
  }
}
