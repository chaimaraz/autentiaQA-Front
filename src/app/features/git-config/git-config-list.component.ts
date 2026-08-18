// src/app/features/git-config/git-config-list.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { NgFor, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GitConfigService, GitRepoConfig, GitWebhookEventItem } from '../../services/git-config.service';
import { ProjectApiService } from '../../services/project-api.service';
import { GitConfigFormComponent } from './add-config/git-config-form.component';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';

@Component({
  selector: 'app-git-config-list',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, DatePipe, FormsModule, RouterLink, GitConfigFormComponent, CodeBlockComponent],
  templateUrl: './git-config-list.component.html',
  styleUrl: './git-config-list.component.scss',
})
export class GitConfigListComponent implements OnInit {
  /** Accédé depuis le menu global "Pipeline CI/CD" → pas de projet dans l'URL par défaut. */
  projectId = signal<string | null>(null);
  projects = signal<{ id: string; name: string }[]>([]);
  loadingProjects = signal(false);

  repos = signal<GitRepoConfig[]>([]);
  events = signal<GitWebhookEventItem[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  editingRepo = signal<GitRepoConfig | null>(null);
  expandedRepoId = signal<string | null>(null);

  /**
   * Base publique du backend, utilisée pour construire l'URL de webhook à coller
   * dans GitHub/GitLab. GitHub ne peut PAS atteindre "localhost" : en dev, lancez
   * un tunnel (ex: `ngrok http 3000`) et collez ici l'URL publique qu'il génère
   * (ex: 'https://a1b2-xx-xx.ngrok-free.app'). En production, mettez l'URL réelle
   * de votre backend déployé.
   */
  backendBaseUrl = 'http://localhost:3000'; // ← à remplacer par votre URL ngrok en dev

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gitConfig: GitConfigService,
    private projectApi: ProjectApiService,
  ) {}

  ngOnInit(): void {
    const fromQuery = this.route.snapshot.queryParamMap.get('projectId');
    this._loadProjects(fromQuery);
  }

  private _loadProjects(preselectId: string | null): void {
    this.loadingProjects.set(true);
    this.projectApi.listProjects().subscribe({
      next: (res) => {
        const list = res.data.map((p: any) => ({ id: p.id, name: p.name }));
        this.projects.set(list);
        this.loadingProjects.set(false);
        const initial = preselectId && list.some(p => p.id === preselectId)
          ? preselectId
          : (list[0]?.id ?? null);
        if (initial) this.onProjectChange(initial);
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message);
        this.loadingProjects.set(false);
      },
    });
  }

  onProjectChange(projectId: string): void {
    this.projectId.set(projectId);
    this.editingRepo.set(null);
    this.expandedRepoId.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: { projectId }, queryParamsHandling: 'merge' });
    this.loadRepos();
  }

  loadRepos(): void {
    const pid = this.projectId();
    if (!pid) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.gitConfig.list(pid).subscribe({
      next: (res) => { this.repos.set(res.data); this.loading.set(false); },
      error: (err: Error) => { this.errorMessage.set(err.message); this.loading.set(false); },
    });
  }

  toggleEvents(repo: GitRepoConfig): void {
    const pid = this.projectId();
    if (!pid) return;
    if (this.expandedRepoId() === repo.id) { this.expandedRepoId.set(null); return; }
    this.expandedRepoId.set(repo.id);
    this.gitConfig.getEvents(pid, repo.id).subscribe({
      next: (res) => this.events.set(res.data),
      error: () => this.events.set([]),
    });
  }

  webhookUrl(repo: GitRepoConfig): string {
    return this.gitConfig.buildWebhookUrl(this.backendBaseUrl, repo.id);
  }

  copyToClipboard(text: string): void {
    navigator.clipboard?.writeText(text);
  }

  ciFileName(repo: GitRepoConfig): string {
    return this.gitConfig.buildCiFileName(repo);
  }

  ciFileContent(repo: GitRepoConfig): string {
    return this.gitConfig.buildCiFileContent(repo, this.webhookUrl(repo));
  }

  /** Téléchargement du fichier/extrait CI généré — même pattern Blob que scenario-data.component.ts::exportJson() */
  downloadCiFile(repo: GitRepoConfig): void {
    const blob = new Blob([this.ciFileContent(repo)], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.ciFileName(repo);
    a.click();
    URL.revokeObjectURL(url);
  }

  startEdit(repo: GitRepoConfig): void {
    this.editingRepo.set(repo);
  }

  onFormSaved(): void {
    this.editingRepo.set(null);
    this.loadRepos();
  }
 
  onFormCancelled(): void {
    this.editingRepo.set(null);
  }

  regenerateSecret(repo: GitRepoConfig): void {
    const pid = this.projectId();
    if (!pid) return;
    this.gitConfig.regenerateSecret(pid, repo.id).subscribe({
      next: () => this.loadRepos(),
      error: (err: Error) => this.errorMessage.set(err.message),
    });
  }

  removeRepo(repo: GitRepoConfig): void {
    const pid = this.projectId();
    if (!pid) return;
    if (!confirm(`Supprimer la config du dépôt "${repo.name}" ? Cette action est irréversible.`)) return;
    this.gitConfig.remove(pid, repo.id).subscribe({
      next: () => this.loadRepos(),
      error: (err: Error) => this.errorMessage.set(err.message),
    });
  }

  decisionLabel(decision: string): string {
    return { ACCEPTED: 'Merge recommandé', REJECTED: 'Merge à bloquer',
              PENDING: 'En cours', SKIPPED: 'Ignoré' }[decision] || decision;
  }

  /** Icône FA associée à une décision — cohérente avec decisionLabel() */
  decisionIcon(decision: string): string {
    return { ACCEPTED: 'fa-circle-check', REJECTED: 'fa-ban',
              PENDING: 'fa-spinner fa-spin', SKIPPED: 'fa-circle-info' }[decision] || 'fa-circle-info';
  }

  /** Mappe une décision vers une classe de badge de statut cohérente avec le reste de l'app */
  decisionClass(decision: string): string {
    return { ACCEPTED: 'passed', REJECTED: 'failed', PENDING: 'running', SKIPPED: 'idle' }[decision] || 'idle';
  }

  /** Icône d'affichage par fournisseur — purement cosmétique, aucun impact fonctionnel */
  providerIcon(provider?: string): string {
  return {
    GITHUB: 'fa-brands fa-github',
    GITLAB: 'fa-brands fa-gitlab',
    BITBUCKET: 'fa-brands fa-bitbucket'
  }[provider ?? ''] || 'fa-solid fa-code-branch';
}

  /** Icône d'affichage par type de dépôt — purement cosmétique */
  roleIcon(role: string): string {
    return { FRONTEND: 'fa-solid fa-desktop', BACKEND: 'fa-solid fa-gear', MOBILE: 'fa-solid fa-mobile-screen', INFRA: 'fa-solid fa-toolbox' }[role] || 'fa-solid fa-box';
  }

  /** Couleur d'icône par fournisseur — même palette que les chips du formulaire d'ajout (git-config-form.component.ts) */
  providerColor(provider?: string): string {
    return {
      GITHUB: '#e6edf3',
      GITLAB: '#fc6d26',
      BITBUCKET: '#2684ff',
    }[provider ?? ''] || '#94a3b8';
  }

  /** Fond teinté associé à providerColor() */
  providerBg(provider?: string): string {
    return {
      GITHUB: 'rgba(230,237,243,0.12)',
      GITLAB: 'rgba(252,109,38,0.14)',
      BITBUCKET: 'rgba(38,132,255,0.14)',
    }[provider ?? ''] || 'rgba(148,163,184,0.14)';
  }
}
