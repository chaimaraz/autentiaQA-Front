import {
  Component,
  EventEmitter,
  Output,
  signal,
  OnDestroy,
} from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type ScenarioType  = 'pos' | 'neg' | 'sec' | 'perf';
export type AddMode = 'nlp' | 'record';

export interface ParsedStep {
  num: number;
  action: string;
  selector: string;
  type: 'click' | 'fill' | 'assert' | 'nav';
}

export interface DataField {
  k: string;
  v: string;
}

export interface RecordEvent {
  time: string;
  actionClass: 'click' | 'type' | 'nav' | 'assert';
  actionLabel: string;
  desc: string;
}

export interface NewScenario {
  name: string;
  type: ScenarioType;
  nlpText: string;
  steps: ParsedStep[];
  data: DataField[];
}

@Component({
  selector: 'app-add-scenario-modal',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule],
  templateUrl: './add-scenario-modal.component.html',
  styleUrl: './add-scenario-modal.component.scss',
})
export class AddScenarioModalComponent implements OnDestroy {
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<NewScenario>();

  // ---- State ----
  isOpen = signal(false);
  activeMode = signal<AddMode>('nlp');
  selectedType = signal<ScenarioType>('pos');
  parsing = signal(false);
  parsedPreviewVisible = signal(false);

  // NLP fields
  nlpName = '';
  nlpText = '';
  parsedSteps = signal<ParsedStep[]>([]);
  parsedData = signal<DataField[]>([]);
  parsedScript = signal('');

  // Recording fields
  recName = '';
  isRecording = signal(false);
  recSec = signal(0);
  recEvents = signal<RecordEvent[]>([]);
  recScript = signal('');
  private recInterval?: ReturnType<typeof setInterval>;
  private evtInterval?: ReturnType<typeof setInterval>;
  private evtIndex = 0;

  private fakeEvents: RecordEvent[] = [
    { time: '00:00', actionClass: 'nav', actionLabel: 'NAV', desc: 'Naviguer vers <b>shop.example.com/login</b>' },
    { time: '00:01', actionClass: 'click', actionLabel: 'CLICK', desc: 'Cliquer sur <b>input[name="email"]</b>' },
    { time: '00:02', actionClass: 'type', actionLabel: 'TYPE', desc: 'Saisir <b>test.qa+2847@mail.io</b> dans email' },
    { time: '00:03', actionClass: 'click', actionLabel: 'CLICK', desc: 'Cliquer sur <b>input[name="password"]</b>' },
    { time: '00:04', actionClass: 'type', actionLabel: 'TYPE', desc: 'Saisir <b>••••••••</b> dans password' },
    { time: '00:05', actionClass: 'click', actionLabel: 'CLICK', desc: 'Cliquer sur <b>button[type="submit"]</b>' },
    { time: '00:06', actionClass: 'nav', actionLabel: 'NAV', desc: 'Navigation vers <b>/dashboard</b>' },
    { time: '00:07', actionClass: 'assert', actionLabel: 'ASSERT', desc: 'Texte <b>"Tableau de bord"</b> visible dans h1' },
  ];

  // ---- Public API ----
  open(): void {
    this.reset();
    this.isOpen.set(true);
  }

  close(): void {
    this.stopRecordingInternal();
    this.isOpen.set(false);
    this.closed.emit();
  }

  // ---- Mode ----
  setMode(mode: AddMode): void {
    this.activeMode.set(mode);
    if (mode === 'nlp') this.stopRecordingInternal();
  }

  // ---- Type ----
  setType(t: ScenarioType): void {
    this.selectedType.set(t);
  }

  // ---- NLP PARSING ----
  parseNLP(): void {
    if (!this.nlpText.trim()) return;
    this.parsing.set(true);
    this.parsedPreviewVisible.set(false);

    setTimeout(() => {
      const steps = this.generateStepsFromText(this.nlpText);
      const data = this.generateDataFromText(this.nlpText);
      this.parsedSteps.set(steps);
      this.parsedData.set(data);
      this.parsedScript.set(this.buildScript(steps, data, this.nlpName));
      this.parsing.set(false);
      this.parsedPreviewVisible.set(true);
    }, 1600);
  }

  private generateStepsFromText(text: string): ParsedStep[] {
    const t = text.toLowerCase();
    const steps: ParsedStep[] = [];
    let num = 1;

    if (t.includes('navigu') || t.includes('va sur') || t.includes('accède') || t.includes('ouvre')) {
      const url = text.match(/\/[\w/-]+/)?.[0] ?? '/login';
      steps.push({ num: num++, action: `Naviguer vers ${url}`, selector: url, type: 'nav' });
    } else {
      steps.push({ num: num++, action: 'Naviguer vers la page cible', selector: '/page', type: 'nav' });
    }

    if (t.includes('email') || t.includes('identifiant') || t.includes('utilisateur')) {
      steps.push({ num: num++, action: 'Remplir le champ email', selector: 'input[name="email"]', type: 'fill' });
    }

    if (t.includes('mot de passe') || t.includes('password') || t.includes('mdp')) {
      steps.push({ num: num++, action: 'Remplir le champ mot de passe', selector: 'input[name="password"]', type: 'fill' });
    }

    if (t.includes('clique') || t.includes('submit') || t.includes('connecter') || t.includes('valide') || t.includes('soumet')) {
      steps.push({ num: num++, action: 'Cliquer sur le bouton de soumission', selector: 'button[type="submit"]', type: 'click' });
    }

    if (t.includes('vérifie') || t.includes('redirig') || t.includes('dashboard') || t.includes('message') || t.includes('erreur') || t.includes('attendu')) {
      const expected = t.includes('dashboard') ? '/dashboard' : t.includes('erreur') ? '.error-message' : '.result';
      steps.push({ num: num++, action: `Vérifier ${expected.startsWith('/') ? 'URL = ' + expected : expected + ' visible'}`, selector: expected, type: 'assert' });
    }

    if (steps.length < 2) {
      steps.push(
        { num: num++, action: 'Interagir avec le formulaire', selector: 'form', type: 'fill' },
        { num: num++, action: 'Vérifier le résultat attendu', selector: '.result', type: 'assert' }
      );
    }

    return steps;
  }

  private generateDataFromText(text: string): DataField[] {
    const t = text.toLowerCase();
    const data: DataField[] = [];

    if (t.includes('email') || t.includes('identifiant')) {
      data.push({ k: 'email', v: `test.qa+${Math.floor(Math.random() * 9999)}@mail.io` });
    }
    if (t.includes('mot de passe') || t.includes('password') || t.includes('mdp')) {
      const isNeg = t.includes('vide') || t.includes('incorrect') || t.includes('mauvais');
      data.push({ k: 'password', v: isNeg ? '' : 'S3cur3P@ss!' });
    }
    if (t.includes('admin')) {
      data.push({ k: 'target_url', v: '/admin' }, { k: 'expected_code', v: '401' });
    }
    if (t.includes('recherch')) {
      data.push({ k: 'search_query', v: 'test produit' });
    }
    if (!data.length) {
      data.push({ k: 'test_data', v: 'valeur_auto_générée' });
    }
    return data;
  }

  private buildScript(steps: ParsedStep[], data: DataField[], name: string): string {
    const lines: string[] = [
      `// Généré par Autentia QA — ${new Date().toLocaleDateString('fr-FR')}`,
      `import { test, expect } from '@playwright/test';`,
      '',
      `test('${name || 'Scénario généré'}', async ({ page }) => {`,
    ];
    data.forEach(d => { if (d.v) lines.push(`  const ${d.k} = '${d.v}';`); });
    if (data.length) lines.push('');
    steps.forEach(s => {
      if (s.type === 'nav')    lines.push(`  await page.goto('${s.selector}');`);
      if (s.type === 'fill')   lines.push(`  await page.fill('${s.selector}', ${data[0]?.k ?? 'data'});`);
      if (s.type === 'click')  lines.push(`  await page.click('${s.selector}');`);
      if (s.type === 'assert') lines.push(`  await expect(page).toHaveURL('${s.selector}');`);
    });
    lines.push(`});`);
    return lines.join('\n');
  }

  // ---- RECORDING ----
  startRecording(): void {
    this.isRecording.set(true);
    this.recSec.set(0);
    this.recEvents.set([]);
    this.evtIndex = 0;

    this.recInterval = setInterval(() => {
      this.recSec.update(s => s + 1);
    }, 1000);

    this.evtInterval = setInterval(() => {
      if (this.evtIndex >= this.fakeEvents.length) return;
      const evt = this.fakeEvents[this.evtIndex];
      const m = String(Math.floor(this.recSec() / 60)).padStart(2, '0');
      const s = String(this.recSec() % 60).padStart(2, '0');
      this.recEvents.update(evts => [...evts, { ...evt, time: `${m}:${s}` }]);
      this.evtIndex++;
    }, 800);
  }

  stopRecording(): void {
    this.stopRecordingInternal();
    this.recScript.set(this.buildRecScript());
  }

  private stopRecordingInternal(): void {
    this.isRecording.set(false);
    clearInterval(this.recInterval);
    clearInterval(this.evtInterval);
  }

  clearRecording(): void {
    this.stopRecordingInternal();
    this.recEvents.set([]);
    this.recSec.set(0);
    this.evtIndex = 0;
    this.recScript.set('');
  }

  private buildRecScript(): string {
    return [
      `// Script enregistré — Autentia QA`,
      `import { test, expect } from '@playwright/test';`,
      '',
      `test('${this.recName || 'Scénario enregistré'}', async ({ page }) => {`,
      `  await page.goto('https://shop.example.com/login');`,
      `  await page.fill('input[name="email"]', 'test.qa+2847@mail.io');`,
      `  await page.fill('input[name="password"]', 'S3cur3P@ss!');`,
      `  await page.click('button[type="submit"]');`,
      `  await expect(page).toHaveURL('/dashboard');`,
      `  await expect(page.locator('h1')).toContainText('Tableau de bord');`,
      `});`,
    ].join('\n');
  }

  get recTimerLabel(): string {
    const s = this.recSec();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---- COPY SCRIPT ----
  copyScript(): void {
    const text = this.activeMode() === 'nlp' ? this.parsedScript() : this.recScript();
    navigator.clipboard.writeText(text).then(() => {
      alert('📋 Script copié dans le presse-papier !');
    });
  }

  // ---- SAVE / DRAFT ----
  saveDraft(): void {
    alert('💾 Brouillon sauvegardé !');
  }

  save(): void {
    const name = this.activeMode() === 'nlp' ? this.nlpName : this.recName;
    if (!name.trim()) {
      alert('Veuillez saisir un nom de scénario.');
      return;
    }
    const scenario: NewScenario = {
      name,
      type: this.selectedType(),
      nlpText: this.nlpText,
      steps: this.parsedSteps(),
      data: this.parsedData(),
    };
    this.saved.emit(scenario);
    this.close();
  }

  // ---- RESET ----
  private reset(): void {
    this.activeMode.set('nlp');
    this.selectedType.set('pos');
    this.parsing.set(false);
    this.parsedPreviewVisible.set(false);
    this.nlpName = '';
    this.nlpText = '';
    this.parsedSteps.set([]);
    this.parsedData.set([]);
    this.parsedScript.set('');
    this.clearRecording();
    this.recName = '';
  }

  ngOnDestroy(): void {
    this.stopRecordingInternal();
  }
}
