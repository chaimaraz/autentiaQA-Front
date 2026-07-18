// add-scenario-modal.component.ts — v3.1
// Ajout des onglets "Document" et "URL" (module IA), branchés sur
// AIGenerationService. Ajout description + etapesScenarios + templatize
// des données en mode Record.
import {
  Component, EventEmitter, Input, Output, signal,
  OnDestroy, inject, ViewChild, ElementRef, AfterViewChecked,
} from '@angular/core';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { Subscription }         from 'rxjs';
import {
  ScenarioService, Scenario, ScenarioVariable, CreateScenarioPayload,
} from '../../../services/scenario.service';
import { ModalSocketService } from '../../../services/modal-socket.service';
import {
  AIGenerationService, AIScenarioProposal,
} from '../../../services/ai-generation.service';

export type ScenarioType = 'pos' | 'neg' | 'sec' | 'perf';
export type AddMode      = 'nlp' | 'record' | 'document' | 'url';
export type RecStatus    = 'idle' | 'no_agent' | 'checking' | 'agent_ok' | 'connecting' | 'recording' | 'stopped';
export type BrowserType  = 'chromium' | 'firefox' | 'webkit';

export interface ParsedStep  { num: number; action: string; selector: string; type: 'click'|'fill'|'assert'|'nav'; }
export interface DataField   { k: string; v: string; isSecret?: boolean; }
export interface RecordEvent { time: string; actionClass: 'click'|'type'|'nav'|'assert'; actionLabel: string; desc: string; }

const TYPE_MAP: Record<ScenarioType, CreateScenarioPayload['type']> = {
  pos:'POSITIVE', neg:'NEGATIVE', sec:'SECURITY', perf:'PERFORMANCE',
};

const TYPE_TO_SHORT: Record<string, ScenarioType> = {
  POSITIVE: 'pos', NEGATIVE: 'neg', SECURITY: 'sec', PERFORMANCE: 'perf',
};

const BROWSER_LABELS: Record<BrowserType, string> = {
  chromium:'🟡 Chromium', firefox:'🦊 Firefox', webkit:'🍎 Safari (WebKit)',
};

// ── Types de documents acceptés pour le flux #2 (Document).
const ALLOWED_DOC_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOC',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/csv': 'CSV',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
};

@Component({
  selector:    'app-add-scenario-modal',
  standalone:  true,
  imports:     [NgFor, NgClass, NgIf, FormsModule],
  templateUrl: './add-scenario-modal.component.html',
  styleUrl:    './add-scenario-modal.component.scss',
})
export class AddScenarioModalComponent implements OnDestroy, AfterViewChecked {

  @Input({ required: true }) projectId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<Scenario>();

  @ViewChild('liveScriptEl') liveScriptEl?: ElementRef<HTMLPreElement>;

  // ── State général ─────────────────────────────────────────────────────────
  isOpen               = signal(false);
  activeMode           = signal<AddMode>('nlp');
  selectedType         = signal<ScenarioType>('pos');
  parsing              = signal(false);
  parsedPreviewVisible = signal(false);
  saving               = signal(false);
  errorMessage         = signal('');

  // ── NLP ───────────────────────────────────────────────────────────────────
  nlpName = ''; nlpText = ''; nlpDescription = '';
  parsedSteps  = signal<ParsedStep[]>([]);
  parsedData   = signal<DataField[]>([]);
  parsedScript = signal('');

  // ── Recording ─────────────────────────────────────────────────────────────
  recName        = '';
  recDescription = '';
  recStartUrl    = 'https://';
  recBrowser     = signal<BrowserType>('chromium');
  recAgentToken  = '';
  recStatus      = signal<RecStatus>('idle');
  recSec         = signal(0);
  recEvents      = signal<RecordEvent[]>([]);
  recScriptLines = signal<string[]>([]);
  recScript      = signal('');
  recError       = signal('');
  agentConnected = signal(false);
  recDetectedVariables = signal<{ key: string; value: string; isSecret: boolean }[]>([]);

  readonly browserOptions: BrowserType[] = ['chromium', 'firefox', 'webkit'];
  readonly browserLabels = BROWSER_LABELS;

  private recTimerInterval?: ReturnType<typeof setInterval>;
  private subs               = new Subscription();
  private shouldScrollScript = false;

  private readonly scenarioSvc = inject(ScenarioService);
  private readonly socketSvc   = inject(ModalSocketService);
  private readonly aiSvc       = inject(AIGenerationService);

  // ── Document (module IA — besoin #2) ───────────────────────────────────────
  docFile           = signal<File | null>(null);
  docGenerating     = signal(false);
  docError          = signal('');
  docProposals      = signal<AIScenarioProposal[]>([]);
  docExpandedId     = signal<string | null>(null);
  docSavingSelected = signal(false);
  docSaveErrors     = signal<{ name: string; message: string }[]>([]);

  // ── URL (module IA — besoin #3) ────────────────────────────────────────────
  urlValue          = '';
  urlMaxPages        = 15;
  urlMaxDepth         = 2;
  urlCrawling        = signal(false);
  urlError           = signal('');
  urlProposals       = signal<AIScenarioProposal[]>([]);
  urlPagesExplored   = signal<number | null>(null);
  urlExpandedId      = signal<string | null>(null);
  urlSavingSelected  = signal(false);
  urlSaveErrors      = signal<{ name: string; message: string }[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  open(): void { this.reset(); this.isOpen.set(true); }

  close(): void {
    if (this.recStatus() === 'recording') this._stopRecording();
    this.socketSvc.disconnect();
    this._clearSubs();
    this.isOpen.set(false);
    this.closed.emit();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollScript && this.liveScriptEl) {
      const el = this.liveScriptEl.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollScript = false;
    }
  }

  ngOnDestroy(): void {
    this._stopTimer();
    this.socketSvc.disconnect();
    this._clearSubs();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mode / Type / Browser
  // ─────────────────────────────────────────────────────────────────────────
  setMode(mode: AddMode): void {
    this.activeMode.set(mode);
    if (mode !== 'record' && this.recStatus() === 'recording') this._stopRecording();
  }

  setType(t: ScenarioType): void   { this.selectedType.set(t); }
  setBrowser(b: BrowserType): void { this.recBrowser.set(b); }

  // ─────────────────────────────────────────────────────────────────────────
  // Copy helpers
  // ─────────────────────────────────────────────────────────────────────────
  copyCode(): void {
    const cmd = 'npm install -g autentia-recorder && npx playwright install chromium';
    navigator.clipboard.writeText(cmd).then(() => alert('📋 Commande copiée !'));
  }

  copyScript(): void {
    const text = this.activeMode() === 'nlp'
      ? this.parsedScript()
      : (this.recScript() || this.liveScript);
    navigator.clipboard.writeText(text).then(() => alert('📋 Script copié !'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NLP
  // ─────────────────────────────────────────────────────────────────────────
  parseNLP(): void {
    if (!this.nlpText.trim()) return;
    this.parsing.set(true);
    this.parsedPreviewVisible.set(false);
    this.errorMessage.set('');

    this.aiSvc.generateScriptFromNlp(this.projectId, {
      title: this.nlpName || 'Scénario généré',
      description: this.nlpText,
      steps: '',
      expectedResult: '',
    }).subscribe({
      next: (result) => {
        const steps: ParsedStep[] = (result.steps ?? []).map((s, i) => ({
          num: i + 1,
          action: s.description || s.action,
          selector: s.selector ?? s.value ?? '',
          type: this._mapActionToParsedType(s.action),
        }));
        const data: DataField[] = (result.variables ?? []).map(v => ({
          k: v.key,
          v: v.value,
          isSecret: v.isSecret,
        }));

        this.parsedSteps.set(steps);
        this.parsedData.set(data);
        this.parsedScript.set(result.scriptTemplate);
        this.parsing.set(false);
        this.parsedPreviewVisible.set(true);
      },
      error: (err) => {
        this.parsing.set(false);
        this.errorMessage.set(
          err?.error?.message || 'Erreur lors de la génération IA. Réessaie ou reformule ta description.'
        );
      },
    });
  }

  /** Traduit l'action ScenarioDTO vers le type visuel existant du template */
  private _mapActionToParsedType(action: string): 'click' | 'fill' | 'assert' | 'nav' {
    if (action === 'goto') return 'nav';
    if (action.startsWith('assert')) return 'assert';
    if (['fill', 'press', 'selectOption', 'check', 'uncheck'].includes(action)) return 'fill';
    return 'click';
  }

  regenerateData(scenarioId: string): void {
    const vars = this.parsedData().map(d => ({ key: d.k, value: d.v, isSecret: d.isSecret ?? false }));
    this.scenarioSvc.regenerateVariables(this.projectId, scenarioId, vars).subscribe({
      next: (v: ScenarioVariable[]) =>
        this.parsedData.set(v.map(x => ({ k: x.key, v: x.value, isSecret: x.isSecret }))),
      error: () => this.errorMessage.set('Erreur lors de la régénération.'),
    });
  }

  copyVariablesFrom(targetId: string, sourceId: string): void {
    this.scenarioSvc.copyVariablesFrom(this.projectId, targetId, sourceId).subscribe({
      next: (v: ScenarioVariable[]) =>
        this.parsedData.set(v.map(x => ({ k: x.key, v: x.value, isSecret: x.isSecret }))),
      error: () => this.errorMessage.set('Erreur lors de la copie.'),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recording — Étape 1 : vérifier l'agent
  // ─────────────────────────────────────────────────────────────────────────
  checkAgent(): void {
    if (!this.recAgentToken.trim()) { this.recError.set('Token obligatoire.'); return; }
    this.recError.set('');
    this.recStatus.set('checking');
    this.agentConnected.set(false);

    this.socketSvc.connect('http://localhost:3000');

    this._sub(this.socketSvc.agentStatus$, (status) => {
      if (status.connected) {
        this.agentConnected.set(true);
        this.recStatus.set('agent_ok');
        this.socketSvc.associateAgent(this.recAgentToken.trim());
      } else {
        this.recStatus.set('no_agent');
        this.recError.set(
          'Agent non trouvé. Lancez : autentia-recorder start --token ' + this.recAgentToken.trim()
        );
      }
    });

    this.socketSvc.checkAgent(this.recAgentToken.trim());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recording — Étape 2 : démarrer
  // ─────────────────────────────────────────────────────────────────────────
  startRecording(): void {
    if (!this.recName.trim()) { this.recError.set('Nom du scénario obligatoire.'); return; }
    if (!this.recStartUrl.trim() || this.recStartUrl === 'https://') {
      this.recError.set("URL de départ obligatoire (ex: https://mon-app.com/login).");
      return;
    }
    this._clearSubs();
    this.recError.set('');
    this.recStatus.set('connecting');
    this.recEvents.set([]);
    this.recScriptLines.set([]);
    this.recScript.set('');
    this.recSec.set(0);

    this._sub(this.socketSvc.recordingStarted$, () => {
      this.recStatus.set('recording');
      this._startTimer();
    });

    this._sub(this.socketSvc.scriptLine$, (d) => {
      this.recScriptLines.update(lines => [...lines, d.line]);
      this.shouldScrollScript = true;
    });

    this._sub(this.socketSvc.recordingEvent$, (evt) => {
      this.recEvents.update(evts => [...evts, evt]);
    });

    this._sub(this.socketSvc.recordingStopped$, (result) => {
      this._stopTimer();

      const rawScript = result.script?.trim()
        ? result.script
        : this.recScriptLines().join('\n');

      if (result.events?.length > 0 && this.recEvents().length === 0) {
        this.recEvents.set(result.events);
      }

      // ── Templatise le script à partir des events capturés
      const { templated, variables } = this._templatizeScript(rawScript);
      this.recScript.set(templated);
      this.recDetectedVariables.set(variables);
      this.recStatus.set('stopped');
    });

    this._sub(this.socketSvc.recordingError$, (err) => {
      this.recError.set(err.message);
      this.recStatus.set('agent_ok');
      this._stopTimer();
    });

    this.socketSvc.startRecording({
      agentToken:   this.recAgentToken.trim(),
      scenarioName: this.recName,
      startUrl:     this.recStartUrl,
      browser:      this.recBrowser(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recording — Étape 3 : arrêter (depuis la modale)
  // ─────────────────────────────────────────────────────────────────────────
  stopRecording(): void {
    this._stopRecording();
    setTimeout(() => {
      if (this.recStatus() === 'recording' || this.recStatus() === 'connecting') {
        this._stopTimer();
        const finalScript = this.recScriptLines().join('\n');
        this.recScript.set(finalScript);
        this.recStatus.set('stopped');
      }
    }, 5000);
  }

  private _stopRecording(): void {
    this.socketSvc.stopRecording(this.recAgentToken.trim());
  }

  clearRecording(): void {
    if (this.recStatus() === 'recording') this._stopRecording();
    this.recEvents.set([]);
    this.recSec.set(0);
    this.recScript.set('');
    this.recScriptLines.set([]);
    this.recDetectedVariables.set([]);
    this.recStatus.set(this.agentConnected() ? 'agent_ok' : 'idle');
    this.recError.set('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Getters template
  // ─────────────────────────────────────────────────────────────────────────
  get recTimerLabel(): string {
    const s = this.recSec();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  get liveScript(): string {
    return this.recScriptLines().join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Templatisation du script enregistré (mode Record)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Remplace les valeurs saisies dans un .fill('selector', 'valeur') par
   * {{cle}}, en devinant la clé depuis le nom du champ (selector) — même
   * heuristique que dataGenerator.inferType côté backend, appliquée ici
   * juste pour NOMMER la variable (le typage réel est fait par le backend
   * au moment du syncFromTemplate()).
   */
  private _templatizeScript(script: string): { templated: string; variables: { key: string; value: string; isSecret: boolean }[] } {
    const variables: { key: string; value: string; isSecret: boolean }[] = [];
    let counter = 0;

    const templated = script.replace(
      /\.fill\((['"])(.*?)\1,\s*(['"])(.*?)\3\)/g,
      (full, q1, selector, _q3, value) => {
        if (!value) return full; // valeur vide, rien à templatiser
        const key = this._guessKeyFromSelector(selector) || `champ${++counter}`;
        const isSecret = /pass|secret|token|pin\b/i.test(key);
        if (!variables.find(v => v.key === key)) variables.push({ key, value, isSecret });
        return `.fill(${q1}${selector}${q1}, '{{${key}}}')`;
      }
    );

    return { templated, variables };
  }

  private _guessKeyFromSelector(selector: string): string | null {
    const patterns: [RegExp, string][] = [
      [/pass(word)?/i, 'password'], [/e[-_]?mail/i, 'email'],
      [/phone|tel/i, 'phone'], [/name/i, 'name'], [/comment/i, 'comment'],
    ];
    for (const [re, key] of patterns) if (re.test(selector)) return key;
    return null;
  }

  /** Construit les étapes métier pour le mode Record depuis les events capturés */
  private _buildRecordSteps(): { action: string; selector: string | null; value: string | null; description: string }[] {
    return this.recEvents().map(evt => ({
      action: this._mapActionClassToAction(evt.actionClass),
      selector: null,
      value: null,
      description: evt.desc?.replace(/<[^>]+>/g, '') ?? evt.actionLabel,
    }));
  }

  private _mapActionClassToAction(cls: RecordEvent['actionClass']): string {
    switch (cls) {
      case 'nav': return 'goto';
      case 'type': return 'fill';
      case 'assert': return 'assertVisible';
      default: return 'click';
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ══ DOCUMENT (module IA — besoin #2) ════════════════════════════════════
  // ═════════════════════════════════════════════════════════════════════════

  onDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.docError.set('');
    if (file) {
      if (!ALLOWED_DOC_TYPES[file.type]) {
        const extensions = [...new Set(Object.values(ALLOWED_DOC_TYPES))].join(', ');
        this.docError.set(`Type non supporté (${extensions} uniquement).`);
        input.value = '';
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        this.docError.set('Fichier trop volumineux (max 20 MB).');
        input.value = '';
        return;
      }
    }
    this.docFile.set(file);
  }

  clearDocFile(): void {
    this.docFile.set(null);
  }

  generateFromDocument(): void {
    const file = this.docFile();
    if (!file) { this.docError.set('Sélectionnez un document.'); return; }

    this.docGenerating.set(true);
    this.docError.set('');
    this.docProposals.set([]);
    this.docSaveErrors.set([]);

    const job = this.aiSvc.generateFromDocument(this.projectId, file);

    job.progress$.subscribe(() => this.docError.set(''));

    job.result$.subscribe(({ scenarios }) => {
      this.docGenerating.set(false);
      this.docProposals.set(scenarios.map(s => ({ ...s, selected: true })));
      if (!scenarios.length) {
        this.docError.set("L'IA n'a généré aucun scénario à partir de ce document.");
      }
    });

    job.error$.subscribe(message => {
      this.docGenerating.set(false);
      this.docError.set(message || 'Erreur lors de la génération depuis le document.');
    });
  }

  toggleDocSelection(p: AIScenarioProposal): void {
    p.selected = !p.selected;
  }

  toggleDocExpanded(p: AIScenarioProposal): void {
    this.docExpandedId.update(v => v === p.tempId ? null : p.tempId);
  }

  removeDocProposal(p: AIScenarioProposal): void {
    this.docProposals.update(list => list.filter(x => x.tempId !== p.tempId));
  }

  get docSelectedCount(): number {
    return this.docProposals().filter(p => p.selected).length;
  }

  selectAllDoc(state: boolean): void {
    this.docProposals.update(list => list.map(p => ({ ...p, selected: state })));
  }

  saveSelectedDocProposals(): void {
    const selected = this.docProposals().filter(p => p.selected);
    if (!selected.length) { this.docError.set('Sélectionnez au moins un scénario.'); return; }

    this.docSavingSelected.set(true);
    this.docSaveErrors.set([]);

    this.aiSvc.bulkCreate(this.projectId, selected).subscribe({
      next: (res) => {
        this.docSavingSelected.set(false);
        this.docSaveErrors.set(res.errors || []);

        const failedNames = new Set((res.errors || []).map(e => e.name));
        this.docProposals.update(list => list.filter(p => !p.selected || failedNames.has(p.name)));

        (res.data || []).forEach((scenario: Scenario) => this.saved.emit(scenario));

        if (!this.docProposals().length && !res.errors?.length) {
          alert(`✅ ${res.data.length} scénario(s) créé(s) avec succès.`);
        }
      },
      error: (err: unknown) => {
        this.docSavingSelected.set(false);
        this.docError.set(this._extractErrorMessage(err, 'Erreur lors de la création des scénarios.'));
      },
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ══ URL (module IA — besoin #3) ═════════════════════════════════════════
  // ═════════════════════════════════════════════════════════════════════════

  generateFromUrl(): void {
    if (!this.urlValue.trim()) { this.urlError.set('Saisissez une URL.'); return; }

    this.urlCrawling.set(true);
    this.urlError.set('');
    this.urlProposals.set([]);
    this.urlPagesExplored.set(null);
    this.urlSaveErrors.set([]);

    const job = this.aiSvc.generateFromUrl(this.projectId, this.urlValue.trim(), {
      maxPages: this.urlMaxPages,
      maxDepth: this.urlMaxDepth,
    });

    job.progress$.subscribe(p => this.urlError.set('ℹ️ ' + p.message));

    job.result$.subscribe(({ scenarios, pagesExplored }) => {
      this.urlCrawling.set(false);
      this.urlPagesExplored.set(pagesExplored ?? null);
      this.urlProposals.set(scenarios.map(s => ({ ...s, selected: true })));
      this.urlError.set('');
      if (!scenarios.length) {
        this.urlError.set("L'IA n'a généré aucun scénario à partir de cette exploration.");
      }
    });

    job.error$.subscribe(message => {
      this.urlCrawling.set(false);
      this.urlError.set(message || "Erreur lors de l'exploration de l'URL.");
    });
  }

  toggleUrlSelection(p: AIScenarioProposal): void {
    p.selected = !p.selected;
  }

  toggleUrlExpanded(p: AIScenarioProposal): void {
    this.urlExpandedId.update(v => v === p.tempId ? null : p.tempId);
  }

  removeUrlProposal(p: AIScenarioProposal): void {
    this.urlProposals.update(list => list.filter(x => x.tempId !== p.tempId));
  }

  get urlSelectedCount(): number {
    return this.urlProposals().filter(p => p.selected).length;
  }

  selectAllUrl(state: boolean): void {
    this.urlProposals.update(list => list.map(p => ({ ...p, selected: state })));
  }

  saveSelectedUrlProposals(): void {
    const selected = this.urlProposals().filter(p => p.selected);
    if (!selected.length) { this.urlError.set('Sélectionnez au moins un scénario.'); return; }

    this.urlSavingSelected.set(true);
    this.urlSaveErrors.set([]);

    this.aiSvc.bulkCreate(this.projectId, selected).subscribe({
      next: (res) => {
        this.urlSavingSelected.set(false);
        this.urlSaveErrors.set(res.errors || []);

        const failedNames = new Set((res.errors || []).map(e => e.name));
        this.urlProposals.update(list => list.filter(p => !p.selected || failedNames.has(p.name)));

        (res.data || []).forEach((scenario: Scenario) => this.saved.emit(scenario));

        if (!this.urlProposals().length && !res.errors?.length) {
          alert(`✅ ${res.data.length} scénario(s) créé(s) avec succès.`);
        }
      },
      error: (err: unknown) => {
        this.urlSavingSelected.set(false);
        this.urlError.set(this._extractErrorMessage(err, 'Erreur lors de la création des scénarios.'));
      },
    });
  }

  // Helper partagé pour afficher le badge de type sur une proposition IA
  typeShort(p: AIScenarioProposal): ScenarioType {
    return TYPE_TO_SHORT[p.type] ?? 'pos';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Save (NLP / Record)
  // ─────────────────────────────────────────────────────────────────────────
  saveDraft(): void { this._validateAndSave('DRAFT'); }
  save(): void      { this._validateAndSave('ACTIVE'); }

  private _validateAndSave(status: 'DRAFT' | 'ACTIVE'): void {
    const isNlp = this.activeMode() === 'nlp';
    const name  = isNlp ? this.nlpName : this.recName;

    if (!name.trim()) { alert('Veuillez saisir un nom de scénario.'); return; }

    if (!isNlp && this.recStatus() === 'recording') {
      alert("Arrêtez d'abord l'enregistrement avant de sauvegarder.");
      return;
    }

    const script = isNlp ? this.parsedScript() : this.recScript();
    if (!script.trim()) {
      alert(isNlp ? "Analysez d'abord le scénario." : "Enregistrez d'abord un scénario.");
      return;
    }

    this._callSaveApi(name, status, script, isNlp);
  }

  private _callSaveApi(name: string, status: 'DRAFT' | 'ACTIVE', script: string, isNlp: boolean): void {
    this.saving.set(true);
    this.errorMessage.set('');

    // ── En mode record, les variables viennent de recDetectedVariables (templatisées), pas parsedData
    const variablesSource = isNlp
      ? this.parsedData().map(d => ({
          key: d.k,
          value: d.v,
          isSecret: d.isSecret ?? (
            d.k.toLowerCase().includes('password') ||
            d.k.toLowerCase().includes('secret')
          ),
        }))
      : this.recDetectedVariables();

    const payload: CreateScenarioPayload = {
      name,
      type: TYPE_MAP[this.selectedType()],
      creationMode: isNlp ? 'NLP' : 'RECORD',
      nlpText: isNlp ? this.nlpText : undefined,
      description: isNlp ? this.nlpDescription : this.recDescription,
      etapesScenarios: isNlp ? this.parsedSteps() : this._buildRecordSteps(),
      scriptTemplate: script,
      status,
      variables: variablesSource,
    };

    this.scenarioSvc.create(this.projectId, payload).subscribe({
      next: (scenario: Scenario) => {
        this.saving.set(false);
        this.saved.emit(scenario);
        if (status === 'ACTIVE') this.close();
        else alert('💾 Brouillon sauvegardé !');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.errorMessage.set('Erreur lors de la sauvegarde. Veuillez réessayer.');
        console.error(err);
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers privés
  // ─────────────────────────────────────────────────────────────────────────
  private _startTimer(): void {
    this.recTimerInterval = setInterval(() => this.recSec.update(s => s + 1), 1000);
  }

  private _stopTimer(): void {
    clearInterval(this.recTimerInterval);
  }

  private _sub<T>(
    subject: { subscribe: (fn: (v: T) => void) => any },
    fn: (v: T) => void,
  ): void {
    this.subs.add(subject.subscribe(fn));
  }

  private _clearSubs(): void {
    this.subs.unsubscribe();
    this.subs = new Subscription();
  }

  private _extractErrorMessage(err: unknown, fallback: string): string {
    const httpErr = err as { error?: { message?: string }; message?: string };
    return httpErr?.error?.message || httpErr?.message || fallback;
  }

  private reset(): void {
    this.activeMode.set('nlp');
    this.selectedType.set('pos');
    this.parsing.set(false);
    this.parsedPreviewVisible.set(false);
    this.saving.set(false);
    this.errorMessage.set('');
    this.nlpName = ''; this.nlpText = ''; this.nlpDescription = '';
    this.parsedSteps.set([]); this.parsedData.set([]); this.parsedScript.set('');
    this.recName = ''; this.recDescription = ''; this.recStartUrl = 'https://';
    this.recBrowser.set('chromium'); this.recAgentToken = '';
    this.recStatus.set('idle'); this.recSec.set(0);
    this.recEvents.set([]); this.recScriptLines.set([]);
    this.recScript.set(''); this.recError.set('');
    this.recDetectedVariables.set([]);
    this.agentConnected.set(false);
    this._stopTimer();
    this._clearSubs();

    // Reset Document
    this.docFile.set(null);
    this.docGenerating.set(false);
    this.docError.set('');
    this.docProposals.set([]);
    this.docExpandedId.set(null);
    this.docSavingSelected.set(false);
    this.docSaveErrors.set([]);

    // Reset URL
    this.urlValue = '';
    this.urlMaxPages = 15;
    this.urlMaxDepth = 2;
    this.urlCrawling.set(false);
    this.urlError.set('');
    this.urlProposals.set([]);
    this.urlPagesExplored.set(null);
    this.urlExpandedId.set(null);
    this.urlSavingSelected.set(false);
    this.urlSaveErrors.set([]);
  }
}