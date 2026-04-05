import { Component, signal, ViewChild } from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AddScenarioModalComponent, NewScenario } from './add-scenario-modal/add-scenario-modal.component';

export interface ScenarioData { k: string; v: string; }
export interface Scenario {
  id: string;
  type: 'pos' | 'neg' | 'sec' | 'perf';
  typeLabel: string;
  typeClass: string;
  name: string;
  page: string;
  data: ScenarioData[];
  dataOpen: boolean;
}

@Component({
  selector: 'app-scenarios',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule, RouterLink, AddScenarioModalComponent],
  templateUrl: './scenarios.component.html',
  styleUrl: './scenarios.component.scss',
})
export class ScenariosComponent {
  @ViewChild(AddScenarioModalComponent) addModal!: AddScenarioModalComponent;

  activeTab = signal<'all' | 'pos' | 'neg' | 'sec' | 'perf'>('all');

  scenarios: Scenario[] = [
    {
      id: '1', type: 'pos', typeLabel: 'POSITIF', typeClass: 'positive',
      name: 'Connexion avec identifiants valides',
      page: '/login → /dashboard · TC-001',
      dataOpen: false,
      data: [
        { k: 'email', v: 'test.qa+2847@mail.io' },
        { k: 'password', v: 'S3cur3P@ss!' },
        { k: 'expected_url', v: '/dashboard' },
      ],
    },
    {
      id: '2', type: 'neg', typeLabel: 'NÉGATIF', typeClass: 'negative',
      name: 'Tentative login avec mot de passe vide',
      page: "/login → message d'erreur attendu · TC-002",
      dataOpen: false,
      data: [
        { k: 'email', v: 'test.qa+2847@mail.io' },
        { k: 'password', v: '' },
        { k: 'expected_error', v: 'Le mot de passe est requis' },
      ],
    },
    {
      id: '3', type: 'pos', typeLabel: 'POSITIF', typeClass: 'positive',
      name: 'Ajout produit au panier et validation commande',
      page: '/products → /cart → /checkout → /confirmation · TC-003',
      dataOpen: false,
      data: [
        { k: 'product_id', v: '42' },
        { k: 'quantity', v: '2' },
        { k: 'card_number', v: '4111111111111111' },
        { k: 'card_expiry', v: '12/28' },
        { k: 'card_cvv', v: '123' },
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
        { k: 'expected', v: '400 ou message sécurisé' },
      ],
    },
    {
      id: '5', type: 'neg', typeLabel: 'NÉGATIF', typeClass: 'negative',
      name: 'Accès page admin sans authentification',
      page: '/admin → redirection /login attendue (401) · TC-005',
      dataOpen: false,
      data: [
        { k: 'target_url', v: '/admin' },
        { k: 'expected_redirect', v: '/login' },
        { k: 'expected_code', v: '401' },
      ],
    },
    {
      id: '6', type: 'perf', typeLabel: 'PERF', typeClass: 'perf',
      name: 'Charge 200 utilisateurs simultanés',
      page: '/home — ramp-up 60s, seuil: <2s réponse · TC-006',
      dataOpen: false,
      data: [
        { k: 'virtual_users', v: '200' },
        { k: 'ramp_up_sec', v: '60' },
        { k: 'duration', v: '300s' },
        { k: 'p95_threshold', v: '2000ms' },
      ],
    },
  ];

  get filtered(): Scenario[] {
    const t = this.activeTab();
    return t === 'all' ? this.scenarios : this.scenarios.filter(s => s.type === t);
  }

  setTab(tab: 'all' | 'pos' | 'neg' | 'sec' | 'perf'): void {
    this.activeTab.set(tab);
  }

  toggleData(s: Scenario): void {
    s.dataOpen = !s.dataOpen;
  }

  openAddModal(): void {
    this.addModal.open();
  }

  onScenarioSaved(scenario: NewScenario): void {
    const typeLabels: Record<string, string> = { pos: 'POSITIF', neg: 'NÉGATIF', sec: 'SÉCURITÉ', perf: 'PERF' };
    const typeClasses: Record<string, string> = { pos: 'positive', neg: 'negative', sec: 'security', perf: 'perf' };

    this.scenarios.unshift({
      id: String(Date.now()),
      type: scenario.type,
      typeLabel: typeLabels[scenario.type],
      typeClass: typeClasses[scenario.type],
      name: scenario.name,
      page: `Nouveau scénario · TC-${String(this.scenarios.length + 1).padStart(3, '0')}`,
      dataOpen: false,
      data: scenario.data,
    });
  }

  counts = {
    all:  () => this.scenarios.length,
    pos:  () => this.scenarios.filter(s => s.type === 'pos').length,
    neg:  () => this.scenarios.filter(s => s.type === 'neg').length,
    sec:  () => this.scenarios.filter(s => s.type === 'sec').length,
    perf: () => this.scenarios.filter(s => s.type === 'perf').length,
  };
}
