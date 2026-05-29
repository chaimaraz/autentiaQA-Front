import { Component, signal, ViewChild, Input, inject } from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink , ActivatedRoute } from '@angular/router';
import { AddScenarioModalComponent } from './add-scenario-modal/add-scenario-modal.component';
// FIX 1 : NewScenario supprimé — on importe Scenario depuis le service backend
import { Scenario as BackendScenario } from '../../services/scenario.service';

// --- Types locaux pour l'affichage (liste des scénarios) ---
export interface ScenarioData { k: string; v: string; }
export interface ScenarioDisplay {
  id: string;
  type: 'pos' | 'neg' | 'sec' | 'perf';
  typeLabel: string;
  typeClass: string;
  name: string;
  page: string;
  data: ScenarioData[];
  dataOpen: boolean;
}

// Mapping backend → front pour affichage
const TYPE_LABEL: Record<string, string> = {
  POSITIVE: 'POSITIF', NEGATIVE: 'NÉGATIF', SECURITY: 'SÉCURITÉ', PERFORMANCE: 'PERF'
};
const TYPE_CLASS: Record<string, string> = {
  POSITIVE: 'positive', NEGATIVE: 'negative', SECURITY: 'security', PERFORMANCE: 'perf'
};
const TYPE_SHORT: Record<string, 'pos' | 'neg' | 'sec' | 'perf'> = {
  POSITIVE: 'pos', NEGATIVE: 'neg', SECURITY: 'sec', PERFORMANCE: 'perf'
};

@Component({
  selector: 'app-scenarios',
  standalone: true,
  // FIX 2 : NgIf retiré (plus utilisé), RouterLink conservé pour les liens
  imports: [NgFor, NgClass, FormsModule, RouterLink, AddScenarioModalComponent],
  templateUrl: './scenarios.component.html',
  styleUrl: './scenarios.component.scss',
})
export class ScenariosComponent {
  projectId!: string;
  private route = inject(ActivatedRoute);

  @ViewChild(AddScenarioModalComponent) addModal!: AddScenarioModalComponent;

  activeTab = signal<'all' | 'pos' | 'neg' | 'sec' | 'perf'>('all');

  scenarios: ScenarioDisplay[] = [
    {
      id: '1', type: 'pos', typeLabel: 'POSITIF', typeClass: 'positive',
      name: 'Connexion avec identifiants valides',
      page: '/login → /dashboard · TC-001',
      dataOpen: false,
      data: [
        { k: 'email',        v: 'test.qa+2847@mail.io' },
        { k: 'password',     v: 'S3cur3P@ss!' },
        { k: 'expected_url', v: '/dashboard' },
      ],
    },
    {
      id: '2', type: 'neg', typeLabel: 'NÉGATIF', typeClass: 'negative',
      name: 'Tentative login avec mot de passe vide',
      page: "/login → message d'erreur attendu · TC-002",
      dataOpen: false,
      data: [
        { k: 'email',          v: 'test.qa+2847@mail.io' },
        { k: 'password',       v: '' },
        { k: 'expected_error', v: 'Le mot de passe est requis' },
      ],
    },
    {
      id: '3', type: 'pos', typeLabel: 'POSITIF', typeClass: 'positive',
      name: 'Ajout produit au panier et validation commande',
      page: '/products → /cart → /checkout → /confirmation · TC-003',
      dataOpen: false,
      data: [
        { k: 'product_id',     v: '42' },
        { k: 'quantity',       v: '2' },
        { k: 'card_number',    v: '4111111111111111' },
        { k: 'card_expiry',    v: '12/28' },
        { k: 'card_cvv',       v: '123' },
        { k: 'expected_total', v: '59.98€' },
      ],
    },
    {
      id: '4', type: 'sec', typeLabel: 'SÉCURITÉ', typeClass: 'security',
      name: 'Injection SQL sur champ de recherche',
      page: "/search — payload: ' OR 1=1 -- · TC-004",
      dataOpen: false,
      data: [
        { k: 'payload_1', v: "' OR 1=1 --" },
        { k: 'payload_2', v: "'; DROP TABLE users; --" },
        { k: 'expected',  v: '400 ou message sécurisé' },
      ],
    },
    {
      id: '5', type: 'neg', typeLabel: 'NÉGATIF', typeClass: 'negative',
      name: 'Accès page admin sans authentification',
      page: '/admin → redirection /login attendue (401) · TC-005',
      dataOpen: false,
      data: [
        { k: 'target_url',       v: '/admin' },
        { k: 'expected_redirect', v: '/login' },
        { k: 'expected_code',    v: '401' },
      ],
    },
    {
      id: '6', type: 'perf', typeLabel: 'PERF', typeClass: 'perf',
      name: 'Charge 200 utilisateurs simultanés',
      page: '/home — ramp-up 60s, seuil: <2s réponse · TC-006',
      dataOpen: false,
      data: [
        { k: 'virtual_users', v: '200' },
        { k: 'ramp_up_sec',   v: '60' },
        { k: 'duration',      v: '300s' },
        { k: 'p95_threshold', v: '2000ms' },
      ],
    },
  ];

   ngOnInit(): void {
    this.projectId = this.route.snapshot.params['id'];
  }

  get filtered(): ScenarioDisplay[] {
    const t = this.activeTab();
    return t === 'all' ? this.scenarios : this.scenarios.filter(s => s.type === t);
  }

  setTab(tab: 'all' | 'pos' | 'neg' | 'sec' | 'perf'): void {
    this.activeTab.set(tab);
  }

  toggleData(s: ScenarioDisplay): void {
    s.dataOpen = !s.dataOpen;
  }

  openAddModal(): void {
    this.addModal.open();
  }

  // FIX 4 : reçoit BackendScenario (réponse réelle du backend) au lieu de NewScenario
  onScenarioSaved(scenario: BackendScenario): void {
    const typeShort = TYPE_SHORT[scenario.type] ?? 'pos';

    const display: ScenarioDisplay = {
      id:        scenario.id,
      type:      typeShort,
      typeLabel: TYPE_LABEL[scenario.type] ?? scenario.type,
      typeClass: TYPE_CLASS[scenario.type] ?? 'positive',
      name:      scenario.name,
      page:      `Nouveau scénario · TC-${String(this.scenarios.length + 1).padStart(3, '0')}`,
      dataOpen:  false,
      // Convertit les ScenarioVariable backend → ScenarioData affichage
      data: (scenario.variables ?? []).map(v => ({ k: v.key, v: v.value })),
    };

    this.scenarios.unshift(display);
  }

  counts = {
    all:  () => this.scenarios.length,
    pos:  () => this.scenarios.filter(s => s.type === 'pos').length,
    neg:  () => this.scenarios.filter(s => s.type === 'neg').length,
    sec:  () => this.scenarios.filter(s => s.type === 'sec').length,
    perf: () => this.scenarios.filter(s => s.type === 'perf').length,
  };
}
