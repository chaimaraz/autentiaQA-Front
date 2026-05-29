import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  OnDestroy,
  inject,                          // FIX 1 : ajout de inject
} from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ScenarioService,
  Scenario,
  ScenarioVariable,                // FIX 2 : import pour typer les callbacks
  CreateScenarioPayload,
} from '../../../services/scenario.service';

// ---- Types front ----
export type ScenarioType = 'pos' | 'neg' | 'sec' | 'perf';
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
  isSecret?: boolean;
}

export interface RecordEvent {
  time: string;
  actionClass: 'click' | 'type' | 'nav' | 'assert';
  actionLabel: string;
  desc: string;
}

// Mapping type front → backend
const TYPE_MAP: Record<ScenarioType, CreateScenarioPayload['type']> = {
  pos:  'POSITIVE',
  neg:  'NEGATIVE',
  sec:  'SECURITY',
  perf: 'PERFORMANCE',
};

@Component({
  selector: 'app-add-scenario-modal',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, FormsModule],
  templateUrl: './add-scenario-modal.component.html',
  styleUrl: './add-scenario-modal.component.scss',
})
export class AddScenarioModalComponent implements OnDestroy {

  @Input({ required: true }) projectId!: string;

  @Output() closed = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<Scenario>();

  // ---- State ----
  isOpen               = signal(false);
  activeMode           = signal<AddMode>('nlp');
  selectedType         = signal<ScenarioType>('pos');
  parsing              = signal(false);
  parsedPreviewVisible = signal(false);
  saving               = signal(false);
  errorMessage         = signal('');

  // NLP fields
  nlpName      = '';
  nlpText      = '';
  parsedSteps  = signal<ParsedStep[]>([]);
  parsedData   = signal<DataField[]>([]);
  parsedScript = signal('');

  // Recording fields
  recName     = '';
  isRecording = signal(false);
  recSec      = signal(0);
  recEvents   = signal<RecordEvent[]>([]);
  recScript   = signal('');
  private recInterval?: ReturnType<typeof setInterval>;
  private evtInterval?: ReturnType<typeof setInterval>;
  private evtIndex = 0;

  // FIX 3 : inject() au lieu de constructor(private ...)
  // Les composants standalone Angular doivent utiliser inject()
  private scenarioSvc = inject(ScenarioService);

  private fakeEvents: RecordEvent[] = [
    { time: '00:00', actionClass: 'nav',    actionLabel: 'NAV',    desc: 'Naviguer vers <b>shop.example.com/login</b>' },
    { time: '00:01', actionClass: 'click',  actionLabel: 'CLICK',  desc: 'Cliquer sur <b>input[name="email"]</b>' },
    { time: '00:02', actionClass: 'type',   actionLabel: 'TYPE',   desc: 'Saisir <b>test.qa+2847@mail.io</b> dans email' },
    { time: '00:03', actionClass: 'click',  actionLabel: 'CLICK',  desc: 'Cliquer sur <b>input[name="password"]</b>' },
    { time: '00:04', actionClass: 'type',   actionLabel: 'TYPE',   desc: 'Saisir <b>••••••••</b> dans password' },
    { time: '00:05', actionClass: 'click',  actionLabel: 'CLICK',  desc: 'Cliquer sur <b>button[type="submit"]</b>' },
    { time: '00:06', actionClass: 'nav',    actionLabel: 'NAV',    desc: 'Navigation vers <b>/dashboard</b>' },
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
      const data  = this.generateDataFromText(this.nlpText);
      this.parsedSteps.set(steps);
      this.parsedData.set(data);
      this.parsedScript.set(this.buildScript(steps, data, this.nlpName));
      this.parsing.set(false);
      this.parsedPreviewVisible.set(true);
    }, 1600);
  }

  // Régénérer les données — remplace les ScenarioVariable en base (DELETE + INSERT)
  regenerateData(scenarioId: string): void {
    const newVariables = this.parsedData().map(d => ({
      key:      d.k,
      value:    d.v,
      isSecret: d.isSecret ?? false,
    }));

    this.scenarioSvc.regenerateVariables(this.projectId, scenarioId, newVariables)
      .subscribe({
        next: (vars: ScenarioVariable[]) => {  // FIX 4 : type explicite, pas de any
          this.parsedData.set(vars.map(v => ({
            k:        v.key,
            v:        v.value,
            isSecret: v.isSecret,
          })));
        },
        error: () => this.errorMessage.set('Erreur lors de la régénération des données.'),
      });
  }

  // Copier les variables depuis un autre scénario (ex: inscription → login)
  copyVariablesFrom(targetScenarioId: string, sourceScenarioId: string): void {
    this.scenarioSvc.copyVariablesFrom(this.projectId, targetScenarioId, sourceScenarioId)
      .subscribe({
        next: (vars: ScenarioVariable[]) => {  // FIX 4 : type explicite
          this.parsedData.set(vars.map(v => ({
            k:        v.key,
            v:        v.value,
            isSecret: v.isSecret,
          })));
        },
        error: () => this.errorMessage.set('Erreur lors de la copie des variables.'),
      });
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
        { num: num++, action: 'Interagir avec le formulaire', selector: 'form',    type: 'fill'   },
        { num: num++, action: 'Vérifier le résultat attendu', selector: '.result', type: 'assert' }
      );
    }
    return steps;
  }

  private generateDataFromText(text: string): DataField[] {
    const t    = text.toLowerCase();
    const data: DataField[] = [];

    if (t.includes('email') || t.includes('identifiant')) {
      data.push({ k: 'email', v: `test.qa+${Math.floor(Math.random() * 9999)}@mail.io`, isSecret: false });
    }
    if (t.includes('mot de passe') || t.includes('password') || t.includes('mdp')) {
      const isNeg = t.includes('vide') || t.includes('incorrect') || t.includes('mauvais');
      data.push({ k: 'password', v: isNeg ? '' : 'S3cur3P@ss!', isSecret: true });
    }
    if (t.includes('admin')) {
      data.push(
        { k: 'target_url',    v: '/admin', isSecret: false },
        { k: 'expected_code', v: '401',    isSecret: false }
      );
    }
    if (t.includes('recherch')) {
      data.push({ k: 'search_query', v: 'test produit', isSecret: false });
    }
    if (!data.length) {
      data.push({ k: 'test_data', v: 'valeur_auto_générée', isSecret: false });
    }
    return data;
  }

  // Script avec placeholders {{key}} — le backend les remplace au moment du run
  private buildScript(steps: ParsedStep[], data: DataField[], name: string): string {
    const lines: string[] = [
      `// Généré par Autentia QA — ${new Date().toLocaleDateString('fr-FR')}`,
      `import { test, expect } from '@playwright/test';`,
      '',
      `test('${name || 'Scénario généré'}', async ({ page }) => {`,
    ];
    data.forEach(d => {
      lines.push(`  const ${d.k} = '{{${d.k}}}';`);
    });
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

    this.recInterval = setInterval(() => this.recSec.update(s => s + 1), 1000);

    this.evtInterval = setInterval(() => {
      if (this.evtIndex >= this.fakeEvents.length) return;
      const evt = this.fakeEvents[this.evtIndex];
      const m   = String(Math.floor(this.recSec() / 60)).padStart(2, '0');
      const s   = String(this.recSec() % 60).padStart(2, '0');
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
      `  const email    = '{{email}}';`,
      `  const password = '{{password}}';`,
      `  await page.goto(process.env['BASE_URL'] + '/login');`,
      `  await page.fill('input[name="email"]',    email);`,
      `  await page.fill('input[name="password"]', password);`,
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
    navigator.clipboard.writeText(text).then(() => alert('📋 Script copié dans le presse-papier !'));
  }

  // ---- SAVE / DRAFT ----
  saveDraft(): void {
    const name = this.activeMode() === 'nlp' ? this.nlpName : this.recName;
    if (!name.trim()) { alert('Veuillez saisir un nom de scénario.'); return; }
    this._callSaveApi(name, 'DRAFT');
  }

  save(): void {
    const name = this.activeMode() === 'nlp' ? this.nlpName : this.recName;
    if (!name.trim()) { alert('Veuillez saisir un nom de scénario.'); return; }
    this._callSaveApi(name, 'ACTIVE');
  }

  private _callSaveApi(name: string, status: 'DRAFT' | 'ACTIVE'): void {
    this.saving.set(true);
    this.errorMessage.set('');

    const isNlp  = this.activeMode() === 'nlp';
    const script = isNlp ? this.parsedScript() : this.recScript();

    const payload: CreateScenarioPayload = {
      name,
      type:           TYPE_MAP[this.selectedType()],
      creationMode:   isNlp ? 'NLP' : 'RECORD',
      nlpText:        isNlp ? this.nlpText : undefined,
      scriptTemplate: script,
      variables: this.parsedData().map(d => ({
        key:      d.k,
        value:    d.v,
        // FIX 5 : parenthèses obligatoires quand on mélange ?? et ||
        isSecret: d.isSecret ?? (d.k.toLowerCase().includes('password') || d.k.toLowerCase().includes('secret')),
      })),
    };

    this.scenarioSvc.create(this.projectId, payload).subscribe({
      next: (scenario: Scenario) => {    // FIX 4 : type explicite
        this.saving.set(false);
        this.saved.emit(scenario);
        if (status === 'ACTIVE') this.close();
        else alert('💾 Brouillon sauvegardé !');
      },
      error: (err: unknown) => {         // FIX 4 : unknown au lieu de any
        this.saving.set(false);
        this.errorMessage.set('Erreur lors de la sauvegarde. Veuillez réessayer.');
        console.error(err);
      },
    });
  }

  // ---- RESET ----
  private reset(): void {
    this.activeMode.set('nlp');
    this.selectedType.set('pos');
    this.parsing.set(false);
    this.parsedPreviewVisible.set(false);
    this.saving.set(false);
    this.errorMessage.set('');
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
