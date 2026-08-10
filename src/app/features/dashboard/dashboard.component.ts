import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService, ProjectRole } from '../../services/auth.service';
import {
  ActivityItem,
  DashboardProjectRow,
  DashboardService,
  DashboardSummary,
  ExecutionResultKey,
} from '../../services/dashboard.service';

const ROLE_LABELS: Record<ProjectRole, string> = {
  ADMIN: 'Administrateur',
  QA_LEAD: 'QA Lead',
  MEMBRE: 'Membre',
  OBSERVATEUR: 'Observateur',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'Actif',
  ARCHIVED: 'Archivé',
};

const RESULT_LABELS: Record<ExecutionResultKey, string> = {
  PASS: 'Réussi',
  FAIL: 'Échec',
  ERROR: 'Erreur',
  TIMEOUT: 'Timeout',
  RUNNING: 'En cours',
};

const RESULT_ICONS: Record<ExecutionResultKey, string> = {
  PASS: 'fa-circle-check',
  FAIL: 'fa-circle-xmark',
  ERROR: 'fa-triangle-exclamation',
  TIMEOUT: 'fa-clock',
  RUNNING: 'fa-spinner',
};

interface StatCard {
  label: string;
  value: string;
  sub: string;
  subClass: 'up' | 'down' | '';
}

interface ActivityRow extends ActivityItem {
  resultLabel: string;
  icon: string;
  timeAgo: string;
}

/** Lit un token de couleur du thème actif (voir src/styles/_variables.scss) pour que les graphiques suivent le thème clair/sombre. */
function themeColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}j`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  readonly auth = inject(AuthService);

  readonly roleLabels = ROLE_LABELS;
  readonly statusLabels = STATUS_LABELS;

  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly isPlatform = computed(() => this.summary()?.scope === 'platform');

  readonly subtitle = computed(() =>
    this.isPlatform()
      ? "Vue plateforme — tous les projets et utilisateurs"
      : 'Vos projets et leurs dernières exécutions'
  );

  readonly statCards = computed<StatCard[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const delta = s.kpis.passRateDeltaPct;
    const deltaLabel = delta === 0 ? 'stable sur 7 jours' : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}% sur 7 jours`;

    const cards: StatCard[] = [
      {
        label: this.isPlatform() ? 'Projets (plateforme)' : 'Projets actifs',
        value: this.isPlatform() ? String(s.kpis.totalProjects) : String(s.kpis.activeProjects),
        sub: `${s.kpis.totalProjects} au total`,
        subClass: '',
      },
      {
        label: 'Taux de réussite',
        value: `${s.kpis.passRate}%`,
        sub: deltaLabel,
        subClass: delta > 0 ? 'up' : delta < 0 ? 'down' : '',
      },
      {
        label: 'Scénarios',
        value: String(s.kpis.totalScenarios),
        sub: `${s.kpis.totalExecutions} exécutions (90j)`,
        subClass: '',
      },
      {
        label: 'Échecs à traiter',
        value: String(s.kpis.openFailures),
        sub: '7 derniers jours',
        subClass: s.kpis.openFailures > 0 ? 'down' : '',
      },
    ];

    if (this.isPlatform() && s.kpis.totalUsers !== undefined) {
      cards.push({ label: 'Utilisateurs', value: String(s.kpis.totalUsers), sub: 'tous rôles confondus', subClass: '' });
    }

    return cards;
  });

  readonly projects = computed<DashboardProjectRow[]>(() => this.summary()?.projects ?? []);
  readonly topFailingProjects = computed<DashboardProjectRow[]>(() => this.summary()?.topFailingProjects ?? []);

  readonly recentActivity = computed<ActivityRow[]>(() =>
    (this.summary()?.recentActivity ?? []).map((a) => ({
      ...a,
      resultLabel: RESULT_LABELS[a.result],
      icon: RESULT_ICONS[a.result],
      timeAgo: timeAgo(a.occurredAt),
    }))
  );

  readonly usersByRoleEntries = computed(() => {
    const roles = this.summary()?.usersByRole;
    if (!roles) return [];
    return [
      { label: 'Super Admins', value: roles.SUPER_ADMIN },
      { label: 'Admins', value: roles.ADMIN },
      { label: 'Utilisateurs', value: roles.USER },
    ];
  });

  // ── Graphique : tendance du taux de réussite (14 derniers jours) ──────────
  readonly trendChartData = computed<ChartData<'line'>>(() => {
    const trend = this.summary()?.trend ?? [];
    const accent = themeColor('--accent', '#00e5ff');
    return {
      labels: trend.map((t) => t.date.slice(5)),
      datasets: [
        {
          label: 'Taux de réussite (%)',
          data: trend.map((t) => t.passRate),
          borderColor: accent,
          backgroundColor: 'rgba(0, 229, 255, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    };
  });

  readonly trendChartOptions = computed<ChartOptions<'line'>>(() => {
    const text3 = themeColor('--text3', '#525d75');
    const border = themeColor('--border', '#1e2330');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { color: text3, callback: (v) => `${v}%` }, grid: { color: border } },
        x: { ticks: { color: text3 }, grid: { display: false } },
      },
    };
  });

  // ── Graphique : répartition des résultats d'exécution ─────────────────────
  readonly resultChartData = computed<ChartData<'doughnut'>>(() => {
    const breakdown = this.summary()?.resultBreakdown ?? [];
    const colors: Record<ExecutionResultKey, string> = {
      PASS: themeColor('--success', '#10b981'),
      FAIL: themeColor('--danger', '#ef4444'),
      ERROR: themeColor('--warning', '#f59e0b'),
      TIMEOUT: themeColor('--accent2', '#7c3aed'),
      RUNNING: themeColor('--accent', '#00e5ff'),
    };
    return {
      labels: breakdown.map((b) => RESULT_LABELS[b.result]),
      datasets: [
        {
          data: breakdown.map((b) => b.count),
          backgroundColor: breakdown.map((b) => colors[b.result]),
          borderWidth: 0,
        },
      ],
    };
  });

  readonly resultChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { position: 'bottom', labels: { color: themeColor('--text2', '#8891a8'), boxWidth: 10, padding: 12 } } },
  }));

  // ── Graphique (plateforme) : projets par statut ────────────────────────────
  readonly statusChartData = computed<ChartData<'bar'>>(() => {
    const byStatus = this.summary()?.projectsByStatus;
    if (!byStatus) return { labels: [], datasets: [] };
    return {
      labels: ['Brouillon', 'Actif', 'Archivé'],
      datasets: [
        {
          data: [byStatus.DRAFT, byStatus.ACTIVE, byStatus.ARCHIVED],
          backgroundColor: [themeColor('--text3', '#525d75'), themeColor('--success', '#10b981'), themeColor('--border2', '#252c3d')],
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    };
  });

  // ── Graphique (plateforme) : utilisateurs par rôle ─────────────────────────
  readonly roleChartData = computed<ChartData<'bar'>>(() => {
    const byRole = this.summary()?.usersByRole;
    if (!byRole) return { labels: [], datasets: [] };
    return {
      labels: ['Super Admin', 'Admin', 'Utilisateur'],
      datasets: [
        {
          data: [byRole.SUPER_ADMIN, byRole.ADMIN, byRole.USER],
          backgroundColor: [themeColor('--accent2', '#7c3aed'), themeColor('--accent', '#00e5ff'), themeColor('--text3', '#525d75')],
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    };
  });

  readonly barChartOptions = computed<ChartOptions<'bar'>>(() => {
    const text3 = themeColor('--text3', '#525d75');
    const border = themeColor('--border', '#1e2330');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: text3, precision: 0 }, grid: { color: border } },
        x: { ticks: { color: text3 }, grid: { display: false } },
      },
    };
  });

  constructor() {
    this.dashboardService.getSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Impossible de charger le dashboard.');
        this.loading.set(false);
      },
    });
  }

  statusBadgeClass(status: string): string {
    if (status === 'ACTIVE') return 'passed';
    if (status === 'ARCHIVED') return 'idle';
    return 'pending';
  }

  resultBadgeClass(result: ExecutionResultKey): string {
    if (result === 'PASS') return 'passed';
    if (result === 'RUNNING') return 'running';
    return 'failed';
  }
}
