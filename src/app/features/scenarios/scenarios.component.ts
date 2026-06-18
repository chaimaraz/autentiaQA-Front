// src/app/features/scenarios/scenarios.component.ts
import {
  Component, signal, ViewChild, inject, OnInit, OnDestroy,
} from '@angular/core';
import { NgFor, NgClass, NgIf }       from '@angular/common';
import { FormsModule }                from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { AddScenarioModalComponent }  from './add-scenario-modal/add-scenario-modal.component';
import {
  ExecutionConfigModalComponent,
  ExecutionConfigResult,
} from '../../shared/components/execution-config-modal/execution-config-modal.component';
import {
  ScenarioService,
  Scenario as BackendScenario,
} from '../../services/scenario.service';

// ─── Interfaces locales ────────────────────────────────────────────────────────

export interface ScenarioData {
  k: string;
  v: string;
}

export interface ScenarioDisplay {
  id:        string;
  type:      'pos' | 'neg' | 'sec' | 'perf';
  typeLabel: string;
  typeClass: string;
  name:      string;
  status:    'DRAFT' | 'ACTIVE';
  mode:      'NLP' | 'RECORD';
  createdAt: string;
  page:      string;
  data:      ScenarioData[];
  dataOpen:  boolean;
  execCount: number;
}

const TYPE_LABEL: Record<string, string> = {
  POSITIVE: 'POSITIF', NEGATIVE: 'NÉGATIF', SECURITY: 'SÉCURITÉ', PERFORMANCE: 'PERF',
};
const TYPE_CLASS: Record<string, string> = {
  POSITIVE: 'positive', NEGATIVE: 'negative', SECURITY: 'security', PERFORMANCE: 'perf',
};
const TYPE_SHORT: Record<string, 'pos' | 'neg' | 'sec' | 'perf'> = {
  POSITIVE: 'pos', NEGATIVE: 'neg', SECURITY: 'sec', PERFORMANCE: 'perf',
};
const TYPE_BACKEND: Record<string, string> = {
  all: '', pos: 'POSITIVE', neg: 'NEGATIVE', sec: 'SECURITY', perf: 'PERFORMANCE',
};

@Component({
  selector:    'app-scenarios',
  standalone:  true,
  imports:     [NgFor, NgClass, NgIf, FormsModule, RouterLink, AddScenarioModalComponent, ExecutionConfigModalComponent],
  templateUrl: './scenarios.component.html',
  styleUrl:    './scenarios.component.scss',
})
export class ScenariosComponent implements OnInit, OnDestroy {

  projectId!: string;

  private route    = inject(ActivatedRoute);
  private svc      = inject(ScenarioService);
  private router   = inject(Router);
  private destroy$ = new Subject<void>();
  private search$  = new Subject<string>();

  @ViewChild(AddScenarioModalComponent) addModal!: AddScenarioModalComponent;
  @ViewChild(ExecutionConfigModalComponent) execConfigModal!: ExecutionConfigModalComponent;

  // Mémorise le scénario ciblé tant que la popup de config est ouverte
  private pendingScenario: ScenarioDisplay | null = null;

  scenarios:  ScenarioDisplay[] = [];
  loading     = false;
  deleteError = '';
  searchQuery = '';

  activeTab = signal<'all' | 'pos' | 'neg' | 'sec' | 'perf'>('all');

  currentPage  = 1;
  totalPages   = 1;
  total        = 0;
  pageSizeOptions = [5, 10, 25, 50];
  pageSize     = signal<number>(10);

  filtersOpen    = false;
  filterStatus   = signal<'' | 'DRAFT' | 'ACTIVE'>('');
  filterMode     = signal<'' | 'NLP' | 'RECORD'>('');
  filterDateFrom = '';
  filterDateTo   = '';

  executingAll = signal(false);
  executingOne = signal<string | null>(null); // id du scénario en cours de lancement

  ngOnInit(): void {
    this.projectId = this.route.snapshot.params['id'];

    this.search$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadScenarios();
    });

    this.loadScenarios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadScenarios(): void {
    this.loading     = true;
    this.deleteError = '';

    this.svc.getAll(this.projectId, {
      page:     this.currentPage,
      limit:    this.pageSize(),
      search:   this.searchQuery,
      type:     TYPE_BACKEND[this.activeTab()],
      status:   this.filterStatus(),
      mode:     this.filterMode(),
      dateFrom: this.filterDateFrom,
      dateTo:   this.filterDateTo,
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: res => {
        this.scenarios  = res.data.map(s => this.toDisplay(s));
        this.total      = res.total;
        this.totalPages = res.totalPages;
        this.loading    = false;
      },
      error: () => { this.loading = false; },
    });
  }

  private toDisplay(s: BackendScenario): ScenarioDisplay {
    const date = new Date(s.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return {
      id:        s.id,
      type:      TYPE_SHORT[s.type] ?? 'pos',
      typeLabel: TYPE_LABEL[s.type] ?? s.type,
      typeClass: TYPE_CLASS[s.type] ?? 'positive',
      name:      s.name,
      status:    s.status as 'DRAFT' | 'ACTIVE',
      mode:      s.creationMode,
      createdAt: date,
      page:      `${s.creationMode === 'NLP' ? '🤖 NLP' : '⏺ RECORD'} · ${date}`,
      dataOpen:  false,
      data:      (s.variables ?? []).map(v => ({ k: v.key, v: v.value })),
      execCount: s._count?.executions ?? 0,
    };
  }

  // ── Tabs / Recherche / Pagination / Filtres (inchangés) ────────────────────

  setTab(tab: 'all' | 'pos' | 'neg' | 'sec' | 'perf'): void {
    this.activeTab.set(tab);
    this.currentPage = 1;
    this.loadScenarios();
  }

  onSearch(value: string): void {
    this.searchQuery = value;
    this.search$.next(value);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadScenarios();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadScenarios();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage = 1;
    this.loadScenarios();
  }

  get pageEnd(): number { return Math.min(this.currentPage * this.pageSize(), this.total); }
  get pageStart(): number { return this.total === 0 ? 0 : (this.currentPage - 1) * this.pageSize() + 1; }

  get pages(): (number | '...')[] {
    const total = this.totalPages, cur = this.currentPage, delta = 1;
    const result: (number | '...')[] = [];
    const range = new Set<number>([1, total]);
    for (let i = Math.max(2, cur - delta); i <= Math.min(total - 1, cur + delta); i++) range.add(i);
    let prev = 0;
    for (const p of Array.from(range).sort((a, b) => a - b)) {
      if (p - prev > 1) result.push('...');
      result.push(p);
      prev = p;
    }
    return result;
  }

  toggleFilters(): void { this.filtersOpen = !this.filtersOpen; }
  applyFilters(): void { this.currentPage = 1; this.loadScenarios(); }

  resetFilters(): void {
    this.filterStatus.set('');
    this.filterMode.set('');
    this.filterDateFrom = '';
    this.filterDateTo   = '';
    this.searchQuery    = '';
    this.currentPage    = 1;
    this.loadScenarios();
  }

  get activeFiltersCount(): number {
    return [
      this.filterStatus()  !== '',
      this.filterMode()    !== '',
      this.filterDateFrom  !== '',
      this.filterDateTo    !== '',
      this.searchQuery     !== '',
    ].filter(Boolean).length;
  }

  toggleData(s: ScenarioDisplay): void { s.dataOpen = !s.dataOpen; }

  openAddModal(): void { this.addModal.open(); }

  onScenarioSaved(_scenario: BackendScenario): void {
    this.currentPage = 1;
    this.loadScenarios();
  }

  // ── Exécution — ouverture de la popup de config ────────────────────────────

  /** Bouton "Exécuter" sur une ligne de scénario */
  executeScenario(s: ScenarioDisplay): void {
    this.pendingScenario = s;
    this.execConfigModal.open(s.name, false);
  }

  /** Bouton "Exécuter tous" */
  executeAllScenarios(): void {
    this.pendingScenario = null;
    this.execConfigModal.open('Tous les scénarios actifs', true);
  }

  /** Callback unique de la modal, qu'il s'agisse d'un run simple ou batch */
  onExecutionConfigConfirmed(res: ExecutionConfigResult): void {
    if (res.isBatch) {
      this._launchBatch(res);
    } else if (this.pendingScenario) {
      this._launchSingle(this.pendingScenario, res);
    }
  }

  private _launchSingle(s: ScenarioDisplay, res: ExecutionConfigResult): void {
    this.executingOne.set(s.id);
    this.svc.execute(this.projectId, s.id, res.captureConfig).subscribe({
      next: (exec) => {
        this.executingOne.set(null);
        this.router.navigate(['/execution'], {
          queryParams: {
            executionId:  exec.id,
            scenarioName: s.name,
            projectId:    this.projectId,
          },
        });
      },
      error: () => {
        this.executingOne.set(null);
        alert("Erreur lors du lancement de l'exécution.");
      },
    });
  }

  private _launchBatch(res: ExecutionConfigResult): void {
    this.executingAll.set(true);
    this.svc.executeAll(this.projectId, res.captureConfig).subscribe({
      next: (batch) => {
        this.executingAll.set(false);
        this.router.navigate(['/execution'], {
          queryParams: { batchId: batch.id, projectId: this.projectId },
        });
      },
      error: () => {
        this.executingAll.set(false);
        alert("Erreur lors de l'exécution groupée.");
      },
    });
  }

  deleteScenario(s: ScenarioDisplay): void {
    if (!confirm(`Supprimer le scénario "${s.name}" ?\nCette action est irréversible.`)) return;

    this.svc.remove(this.projectId, s.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.scenarios.length === 1 && this.currentPage > 1) this.currentPage--;
          this.loadScenarios();
        },
        error: () => {
          this.deleteError = `Impossible de supprimer "${s.name}". Veuillez réessayer.`;
        },
      });
  }

  isEllipsis(p: number | '...'): p is '...' { return p === '...'; }
}