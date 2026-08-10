import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';

import { AddScenarioModalComponent } from './add-scenario-modal.component';
import { ScenarioService, Scenario, ScenarioVariable } from '../../../services/scenario.service';
import { ModalSocketService } from '../../../services/modal-socket.service';
import { AIGenerationService, AIScenarioProposal, AIJobObservable } from '../../../services/ai-generation.service';

describe('AddScenarioModalComponent', () => {
  let component: AddScenarioModalComponent;
  let fixture: ComponentFixture<AddScenarioModalComponent>;
  let scenarioSvc: jasmine.SpyObj<ScenarioService>;
  let aiSvc: jasmine.SpyObj<AIGenerationService>;
  let socketSvc: {
    scriptLine$: Subject<any>;
    recordingEvent$: Subject<any>;
    recordingStarted$: Subject<any>;
    recordingStopped$: Subject<any>;
    recordingError$: Subject<any>;
    agentStatus$: Subject<any>;
    associationOk$: Subject<any>;
    associationError$: Subject<any>;
    connect: jasmine.Spy;
    emit: jasmine.Spy;
    checkAgent: jasmine.Spy;
    associateAgent: jasmine.Spy;
    startRecording: jasmine.Spy;
    stopRecording: jasmine.Spy;
    disconnect: jasmine.Spy;
  };

  const makeProposal = (over: Partial<AIScenarioProposal> = {}): AIScenarioProposal => ({
    tempId: 't1',
    name: 'Proposal 1',
    type: 'POSITIVE',
    steps: [{ action: 'click', selector: '#btn' }],
    expectedResult: 'ok',
    variables: [{ key: 'k', value: 'v', isSecret: false }],
    scriptTemplate: '',
    ...over,
  });

  function makeJob(): AIJobObservable {
    return { progress$: new Subject(), result$: new Subject(), error$: new Subject() };
  }

  const baseScenario: Scenario = {
    id: 'new1',
    projectId: 'p1',
    name: 'New scenario',
    type: 'POSITIVE',
    creationMode: 'NLP',
    scriptTemplate: 'x',
    status: 'DRAFT',
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(async () => {
    scenarioSvc = jasmine.createSpyObj('ScenarioService', [
      'create', 'regenerateVariables', 'copyVariablesFrom',
    ]);
    aiSvc = jasmine.createSpyObj('AIGenerationService', [
      'generateScriptFromNlp', 'generateFromDocument', 'generateFromUrl', 'bulkCreate',
    ]);
    socketSvc = {
      scriptLine$: new Subject(),
      recordingEvent$: new Subject(),
      recordingStarted$: new Subject(),
      recordingStopped$: new Subject(),
      recordingError$: new Subject(),
      agentStatus$: new Subject(),
      associationOk$: new Subject(),
      associationError$: new Subject(),
      connect: jasmine.createSpy('connect'),
      emit: jasmine.createSpy('emit'),
      checkAgent: jasmine.createSpy('checkAgent'),
      associateAgent: jasmine.createSpy('associateAgent'),
      startRecording: jasmine.createSpy('startRecording'),
      stopRecording: jasmine.createSpy('stopRecording'),
      disconnect: jasmine.createSpy('disconnect'),
    };

    await TestBed.configureTestingModule({
      imports: [AddScenarioModalComponent],
      providers: [
        { provide: ScenarioService, useValue: scenarioSvc },
        { provide: AIGenerationService, useValue: aiSvc },
        { provide: ModalSocketService, useValue: socketSvc },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddScenarioModalComponent);
    component = fixture.componentInstance;
    component.projectId = 'p1';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────

  describe('open / close / reset', () => {
    it('open() resets state and sets isOpen true', () => {
      component.nlpName = 'dirty';
      component.open();
      expect(component.isOpen()).toBeTrue();
      expect(component.nlpName).toBe('');
      expect(component.activeMode()).toBe('nlp');
      expect(component.selectedType()).toBe('pos');
    });

    it('close() stops an active recording, disconnects the socket and emits closed', () => {
      component.recStatus.set('recording');
      component.recAgentToken = 'tok';
      spyOn(component.closed, 'emit');
      component.close();
      expect(socketSvc.stopRecording).toHaveBeenCalledWith('tok');
      expect(socketSvc.disconnect).toHaveBeenCalled();
      expect(component.isOpen()).toBeFalse();
      expect(component.closed.emit).toHaveBeenCalled();
    });

    it('close() does not stop recording when not currently recording', () => {
      component.recStatus.set('idle');
      component.close();
      expect(socketSvc.stopRecording).not.toHaveBeenCalled();
      expect(socketSvc.disconnect).toHaveBeenCalled();
    });

    it('ngOnDestroy disconnects socket and clears subs', () => {
      component.ngOnDestroy();
      expect(socketSvc.disconnect).toHaveBeenCalled();
    });
  });

  describe('ngAfterViewChecked', () => {
    it('scrolls the live script element to bottom when a scroll is pending', () => {
      const el = { scrollTop: 0, scrollHeight: 500 } as unknown as HTMLPreElement;
      component.liveScriptEl = { nativeElement: el } as any;
      (component as any).shouldScrollScript = true;
      component.ngAfterViewChecked();
      expect(el.scrollTop).toBe(500);
      expect((component as any).shouldScrollScript).toBeFalse();
    });

    it('does nothing when no scroll is pending', () => {
      const el = { scrollTop: 0, scrollHeight: 500 } as unknown as HTMLPreElement;
      component.liveScriptEl = { nativeElement: el } as any;
      (component as any).shouldScrollScript = false;
      component.ngAfterViewChecked();
      expect(el.scrollTop).toBe(0);
    });
  });

  // ── Mode / Type / Browser ─────────────────────────────────────────────

  describe('setMode / setType / setBrowser', () => {
    it('setMode updates activeMode', () => {
      component.setMode('record');
      expect(component.activeMode()).toBe('record');
    });

    it('setMode stops recording when switching away from record mode while recording', () => {
      component.activeMode.set('record');
      component.recStatus.set('recording');
      component.recAgentToken = 'tok';
      component.setMode('nlp');
      expect(socketSvc.stopRecording).toHaveBeenCalledWith('tok');
    });

    it('setMode does not stop recording when staying on record mode', () => {
      component.recStatus.set('recording');
      component.setMode('record');
      expect(socketSvc.stopRecording).not.toHaveBeenCalled();
    });

    it('setType updates selectedType', () => {
      component.setType('sec');
      expect(component.selectedType()).toBe('sec');
    });

    it('setBrowser updates recBrowser', () => {
      component.setBrowser('firefox');
      expect(component.recBrowser()).toBe('firefox');
    });
  });

  // ── Copy helpers ──────────────────────────────────────────────────────

  describe('copyCode / copyScript', () => {
    beforeEach(() => {
      spyOn(window, 'alert');
    });

    it('copyCode writes the install command to the clipboard and alerts', async () => {
      const writeText = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      component.copyCode();
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('npm install -g autentia-recorder && npx playwright install chromium');
      expect(window.alert).toHaveBeenCalledWith('Commande copiée !');
    });

    it('copyScript copies parsedScript in nlp mode', async () => {
      const writeText = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      component.activeMode.set('nlp');
      component.parsedScript.set('const x = 1;');
      component.copyScript();
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('const x = 1;');
      expect(window.alert).toHaveBeenCalledWith('Script copié !');
    });

    it('copyScript falls back to liveScript when recScript is empty in record mode', async () => {
      const writeText = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      component.activeMode.set('record');
      component.recScript.set('');
      component.recScriptLines.set(['line1', 'line2']);
      component.copyScript();
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('line1\nline2');
    });
  });

  // ── NLP ───────────────────────────────────────────────────────────────

  describe('parseNLP', () => {
    it('does nothing when nlpText is blank', () => {
      component.nlpText = '   ';
      component.parseNLP();
      expect(aiSvc.generateScriptFromNlp).not.toHaveBeenCalled();
    });

    it('parses steps/data/script from the AI response on success', () => {
      component.nlpName = 'My scenario';
      component.nlpText = 'Do something';
      aiSvc.generateScriptFromNlp.and.returnValue(of({
        name: 'My scenario',
        nlpText: 'Do something',
        scriptTemplate: 'script();',
        steps: [
          { action: 'goto', selector: null, value: 'https://x.com', description: 'Go to site' },
          { action: 'fill', selector: '#email', value: 'a@b.com', description: 'Fill email' },
          { action: 'assertVisible', selector: '#ok', value: null, description: 'Assert visible' },
          { action: 'click', selector: '#submit', value: null, description: 'Click submit' },
        ],
        variables: [{ key: 'email', value: 'a@b.com', isSecret: false }],
      }));

      component.parseNLP();

      expect(component.parsing()).toBeFalse();
      expect(component.parsedPreviewVisible()).toBeTrue();
      expect(component.parsedScript()).toBe('script();');
      expect(component.parsedData()).toEqual([{ k: 'email', v: 'a@b.com', isSecret: false }]);

      const steps = component.parsedSteps();
      expect(steps.length).toBe(4);
      expect(steps[0]).toEqual({ num: 1, action: 'Go to site', selector: 'https://x.com', type: 'nav' });
      expect(steps[1].type).toBe('fill');
      expect(steps[2].type).toBe('assert');
      expect(steps[3].type).toBe('click');
    });

    it('sets an error message from the backend on failure', () => {
      component.nlpText = 'Do something';
      aiSvc.generateScriptFromNlp.and.returnValue(throwError(() => ({ error: { message: 'NLP failed' } })));
      component.parseNLP();
      expect(component.parsing()).toBeFalse();
      expect(component.errorMessage()).toBe('NLP failed');
    });

    it('falls back to a generic error message on failure without backend message', () => {
      component.nlpText = 'Do something';
      aiSvc.generateScriptFromNlp.and.returnValue(throwError(() => new Error('boom')));
      component.parseNLP();
      expect(component.errorMessage()).toBe('Erreur lors de la génération IA. Réessaie ou reformule ta description.');
    });
  });

  describe('regenerateData / copyVariablesFrom', () => {
    it('regenerateData updates parsedData on success', () => {
      component.parsedData.set([{ k: 'email', v: 'a@b.com', isSecret: false }]);
      const updated: ScenarioVariable[] = [{ id: 'v1', key: 'email', value: 'new@b.com', isSecret: false }];
      scenarioSvc.regenerateVariables.and.returnValue(of(updated));
      component.regenerateData('sc1');
      expect(scenarioSvc.regenerateVariables).toHaveBeenCalledWith('p1', 'sc1', [{ key: 'email', value: 'a@b.com', isSecret: false }]);
      expect(component.parsedData()).toEqual([{ k: 'email', v: 'new@b.com', isSecret: false }]);
    });

    it('regenerateData sets an error on failure', () => {
      scenarioSvc.regenerateVariables.and.returnValue(throwError(() => new Error('boom')));
      component.regenerateData('sc1');
      expect(component.errorMessage()).toBe('Erreur lors de la régénération.');
    });

    it('copyVariablesFrom updates parsedData on success', () => {
      const copied: ScenarioVariable[] = [{ id: 'v2', key: 'phone', value: '0600', isSecret: false }];
      scenarioSvc.copyVariablesFrom.and.returnValue(of(copied));
      component.copyVariablesFrom('target1', 'source1');
      expect(scenarioSvc.copyVariablesFrom).toHaveBeenCalledWith('p1', 'target1', 'source1');
      expect(component.parsedData()).toEqual([{ k: 'phone', v: '0600', isSecret: false }]);
    });

    it('copyVariablesFrom sets an error on failure', () => {
      scenarioSvc.copyVariablesFrom.and.returnValue(throwError(() => new Error('boom')));
      component.copyVariablesFrom('target1', 'source1');
      expect(component.errorMessage()).toBe('Erreur lors de la copie.');
    });
  });

  // ── Recording ─────────────────────────────────────────────────────────

  describe('checkAgent', () => {
    it('requires a non-blank token', () => {
      component.recAgentToken = '  ';
      component.checkAgent();
      expect(component.recError()).toBe('Token obligatoire.');
      expect(socketSvc.connect).not.toHaveBeenCalled();
    });

    it('connects the socket and requests agent check', () => {
      component.recAgentToken = 'tok123';
      component.checkAgent();
      expect(component.recStatus()).toBe('checking');
      expect(socketSvc.connect).toHaveBeenCalledWith('http://localhost:3000');
      expect(socketSvc.checkAgent).toHaveBeenCalledWith('tok123');
    });

    it('marks agent connected and associates on a positive agentStatus event', () => {
      component.recAgentToken = 'tok123';
      component.checkAgent();
      socketSvc.agentStatus$.next({ connected: true, agentId: 'a1' });
      expect(component.agentConnected()).toBeTrue();
      expect(component.recStatus()).toBe('agent_ok');
      expect(socketSvc.associateAgent).toHaveBeenCalledWith('tok123');
    });

    it('sets no_agent status and an error message on a negative agentStatus event', () => {
      component.recAgentToken = 'tok123';
      component.checkAgent();
      socketSvc.agentStatus$.next({ connected: false, agentId: null });
      expect(component.recStatus()).toBe('no_agent');
      expect(component.recError()).toContain('Agent non trouvé');
    });
  });

  describe('startRecording', () => {
    it('requires a scenario name', () => {
      component.recName = '';
      component.startRecording();
      expect(component.recError()).toBe('Nom du scénario obligatoire.');
      expect(socketSvc.startRecording).not.toHaveBeenCalled();
    });

    it('requires a real start URL', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://';
      component.startRecording();
      expect(component.recError()).toContain('URL de départ obligatoire');
      expect(socketSvc.startRecording).not.toHaveBeenCalled();
    });

    it('emits startRecording on the socket with the right payload', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.recAgentToken = 'tok123';
      component.recBrowser.set('firefox');
      component.startRecording();
      expect(component.recStatus()).toBe('connecting');
      expect(socketSvc.startRecording).toHaveBeenCalledWith({
        agentToken: 'tok123',
        scenarioName: 'Scenario',
        startUrl: 'https://site.com/login',
        browser: 'firefox',
      });
    });

    it('moves to recording status on recordingStarted event', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.startRecording();
      socketSvc.recordingStarted$.next({ message: 'started' });
      expect(component.recStatus()).toBe('recording');
    });

    it('appends script lines on scriptLine events', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.startRecording();
      socketSvc.scriptLine$.next({ line: "await page.click('#a');" });
      expect(component.recScriptLines()).toEqual(["await page.click('#a');"]);
    });

    it('appends recording events on recordingEvent events', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.startRecording();
      const evt = { time: '0:01', actionClass: 'click', actionLabel: 'Click', desc: 'Clicked button' };
      socketSvc.recordingEvent$.next(evt);
      expect(component.recEvents()).toEqual([evt as any]);
    });

    it('templatizes the script and moves to stopped on recordingStopped event', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.startRecording();
      socketSvc.recordingStopped$.next({
        script: ".fill('#password', 'secret123')",
        events: [],
      });
      expect(component.recStatus()).toBe('stopped');
      expect(component.recScript()).toContain('{{password}}');
      expect(component.recDetectedVariables().length).toBe(1);
      expect(component.recDetectedVariables()[0].key).toBe('password');
      expect(component.recDetectedVariables()[0].isSecret).toBeTrue();
    });

    it('uses accumulated script lines when the stopped payload has no script', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.startRecording();
      socketSvc.scriptLine$.next({ line: "await page.click('#a');" });
      socketSvc.recordingStopped$.next({ script: '', events: [] });
      expect(component.recScript()).toContain("await page.click('#a');");
    });

    it('sets recEvents from the payload when none were captured live', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.startRecording();
      const evts = [{ time: '0:01', actionClass: 'click', actionLabel: 'Click', desc: 'x' }];
      socketSvc.recordingStopped$.next({ script: 'x', events: evts });
      expect(component.recEvents()).toEqual(evts as any);
    });

    it('handles recordingError by setting recError and returning to agent_ok', () => {
      component.recName = 'Scenario';
      component.recStartUrl = 'https://site.com/login';
      component.startRecording();
      socketSvc.recordingError$.next({ message: 'Agent disconnected' });
      expect(component.recError()).toBe('Agent disconnected');
      expect(component.recStatus()).toBe('agent_ok');
    });
  });

  describe('stopRecording / clearRecording', () => {
    it('stopRecording calls socket stopRecording with the trimmed token', () => {
      component.recAgentToken = ' tok123 ';
      component.stopRecording();
      expect(socketSvc.stopRecording).toHaveBeenCalledWith('tok123');
    });

    it('clearRecording resets recording state to agent_ok when connected', () => {
      component.agentConnected.set(true);
      component.recEvents.set([{ time: '', actionClass: 'click', actionLabel: '', desc: '' }]);
      component.recSec.set(42);
      component.recScript.set('script');
      component.recScriptLines.set(['a']);
      component.recDetectedVariables.set([{ key: 'x', value: 'y', isSecret: false }]);
      component.recError.set('oops');
      component.clearRecording();
      expect(component.recEvents()).toEqual([]);
      expect(component.recSec()).toBe(0);
      expect(component.recScript()).toBe('');
      expect(component.recScriptLines()).toEqual([]);
      expect(component.recDetectedVariables()).toEqual([]);
      expect(component.recError()).toBe('');
      expect(component.recStatus()).toBe('agent_ok');
    });

    it('clearRecording resets recording state to idle when not connected', () => {
      component.agentConnected.set(false);
      component.clearRecording();
      expect(component.recStatus()).toBe('idle');
    });

    it('clearRecording stops an in-progress recording first', () => {
      component.recStatus.set('recording');
      component.recAgentToken = 'tok';
      component.clearRecording();
      expect(socketSvc.stopRecording).toHaveBeenCalledWith('tok');
    });
  });

  describe('template getters', () => {
    it('recTimerLabel formats seconds as mm:ss', () => {
      component.recSec.set(75);
      expect(component.recTimerLabel).toBe('01:15');
    });

    it('recTimerLabel pads single digits', () => {
      component.recSec.set(5);
      expect(component.recTimerLabel).toBe('00:05');
    });

    it('liveScript joins recorded script lines', () => {
      component.recScriptLines.set(['a', 'b', 'c']);
      expect(component.liveScript).toBe('a\nb\nc');
    });
  });

  // ── Pure private helpers ──────────────────────────────────────────────

  describe('_templatizeScript (pure)', () => {
    it('replaces fill values with a guessed variable name and flags secrets', () => {
      const script = ".fill('#password', 'secret123')";
      const result = (component as any)._templatizeScript(script);
      expect(result.templated).toBe(".fill('#password', '{{password}}')");
      expect(result.variables).toEqual([{ key: 'password', value: 'secret123', isSecret: true }]);
    });

    it('falls back to a generated key name when the selector matches no known pattern', () => {
      const script = ".fill('#randomThing', 'hello')";
      const result = (component as any)._templatizeScript(script);
      expect(result.variables[0].key).toBe('champ1');
      expect(result.variables[0].isSecret).toBeFalse();
    });

    it('leaves fills with empty values untouched', () => {
      const script = ".fill('#name', '')";
      const result = (component as any)._templatizeScript(script);
      expect(result.templated).toBe(script);
      expect(result.variables).toEqual([]);
    });

    it('deduplicates variables sharing the same guessed key', () => {
      const script = ".fill('#email', 'a@b.com')\n.fill('#emailConfirm', 'a@b.com')";
      const result = (component as any)._templatizeScript(script);
      const emailVars = result.variables.filter((v: any) => v.key === 'email');
      expect(emailVars.length).toBe(1);
    });

    it('templatizes multiple distinct fills in one script', () => {
      const script = ".fill('#email', 'a@b.com')\n.fill('#phone', '0600000000')";
      const result = (component as any)._templatizeScript(script);
      expect(result.variables.length).toBe(2);
      expect(result.templated).toContain('{{email}}');
      expect(result.templated).toContain('{{phone}}');
    });
  });

  describe('_guessKeyFromSelector (pure)', () => {
    const cases: [string, string | null][] = [
      ['#password', 'password'],
      ['input[name="pass"]', 'password'],
      ['#e-mail', 'email'],
      ['#email', 'email'],
      ['#phone', 'phone'],
      ['#tel', 'phone'],
      ['#fullname', 'name'],
      ['#comment-box', 'comment'],
      ['#unknownField', null],
    ];

    cases.forEach(([selector, expected]) => {
      it(`maps "${selector}" -> ${expected}`, () => {
        expect((component as any)._guessKeyFromSelector(selector)).toBe(expected);
      });
    });
  });

  describe('_buildRecordSteps / _mapActionClassToAction (pure)', () => {
    it('maps recorded events to business steps', () => {
      component.recEvents.set([
        { time: '', actionClass: 'nav', actionLabel: 'Go', desc: 'Go to <b>home</b>' },
        { time: '', actionClass: 'type', actionLabel: 'Type', desc: 'Type email' },
        { time: '', actionClass: 'assert', actionLabel: 'Assert', desc: 'Assert visible' },
        { time: '', actionClass: 'click', actionLabel: 'Click', desc: 'Click submit' },
      ]);
      const steps = (component as any)._buildRecordSteps();
      expect(steps).toEqual([
        { action: 'goto', selector: null, value: null, description: 'Go to home' },
        { action: 'fill', selector: null, value: null, description: 'Type email' },
        { action: 'assertVisible', selector: null, value: null, description: 'Assert visible' },
        { action: 'click', selector: null, value: null, description: 'Click submit' },
      ]);
    });

    it('falls back to actionLabel when desc is missing', () => {
      component.recEvents.set([{ time: '', actionClass: 'click', actionLabel: 'Click X', desc: undefined as any }]);
      const steps = (component as any)._buildRecordSteps();
      expect(steps[0].description).toBe('Click X');
    });
  });

  describe('typeShort', () => {
    it('maps backend type to the short local code', () => {
      expect(component.typeShort(makeProposal({ type: 'NEGATIVE' }))).toBe('neg');
      expect(component.typeShort(makeProposal({ type: 'SECURITY' }))).toBe('sec');
      expect(component.typeShort(makeProposal({ type: 'PERFORMANCE' }))).toBe('perf');
    });

    it('defaults to pos for an unknown type', () => {
      expect(component.typeShort(makeProposal({ type: 'WEIRD' as any }))).toBe('pos');
    });
  });

  // ── Document flow ─────────────────────────────────────────────────────

  describe('onDocFileSelected / clearDocFile', () => {
    function makeInputEvent(file: File | undefined): Event {
      const input = document.createElement('input');
      input.type = 'file';
      Object.defineProperty(input, 'files', { value: file ? [file] : [], writable: false });
      return { target: input } as unknown as Event;
    }

    it('accepts an allowed document type within size limits', () => {
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      component.onDocFileSelected(makeInputEvent(file));
      expect(component.docFile()).toBe(file);
      expect(component.docError()).toBe('');
    });

    it('rejects a disallowed file type', () => {
      const file = new File(['content'], 'doc.exe', { type: 'application/x-msdownload' });
      const ev = makeInputEvent(file);
      component.onDocFileSelected(ev);
      expect(component.docFile()).toBeNull();
      expect(component.docError()).toContain('Type non supporté');
      expect((ev.target as HTMLInputElement).value).toBe('');
    });

    it('rejects a file over the size limit', () => {
      const big = new File([new Uint8Array(21 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
      component.onDocFileSelected(makeInputEvent(big));
      expect(component.docFile()).toBeNull();
      expect(component.docError()).toContain('trop volumineux');
    });

    it('clearDocFile resets the selected file', () => {
      component.docFile.set(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
      component.clearDocFile();
      expect(component.docFile()).toBeNull();
    });
  });

  describe('generateFromDocument', () => {
    it('requires a selected file', () => {
      component.docFile.set(null);
      component.generateFromDocument();
      expect(component.docError()).toBe('Sélectionnez un document.');
      expect(aiSvc.generateFromDocument).not.toHaveBeenCalled();
    });

    it('sets proposals as selected on job success', () => {
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      component.docFile.set(file);
      const job = makeJob();
      aiSvc.generateFromDocument.and.returnValue(job);
      component.generateFromDocument();
      expect(component.docGenerating()).toBeTrue();

      job.result$.next({ scenarios: [makeProposal()] });
      expect(component.docGenerating()).toBeFalse();
      expect(component.docProposals()[0].selected).toBeTrue();
    });

    it('sets an error message when the AI returns no scenarios', () => {
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      component.docFile.set(file);
      const job = makeJob();
      aiSvc.generateFromDocument.and.returnValue(job);
      component.generateFromDocument();
      job.result$.next({ scenarios: [] });
      expect(component.docError()).toContain("n'a généré aucun scénario");
    });

    it('sets an error on job failure', () => {
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      component.docFile.set(file);
      const job = makeJob();
      aiSvc.generateFromDocument.and.returnValue(job);
      component.generateFromDocument();
      job.error$.next('AI down');
      expect(component.docGenerating()).toBeFalse();
      expect(component.docError()).toBe('AI down');
    });
  });

  describe('doc proposal selection helpers', () => {
    beforeEach(() => {
      component.docProposals.set([makeProposal({ tempId: 'd1', selected: true }), makeProposal({ tempId: 'd2', selected: true })]);
    });

    it('toggleDocSelection flips selection', () => {
      const p = component.docProposals()[0];
      component.toggleDocSelection(p);
      expect(p.selected).toBeFalse();
    });

    it('toggleDocExpanded toggles the expanded id', () => {
      const p = component.docProposals()[0];
      component.toggleDocExpanded(p);
      expect(component.docExpandedId()).toBe('d1');
      component.toggleDocExpanded(p);
      expect(component.docExpandedId()).toBeNull();
    });

    it('removeDocProposal removes the given proposal', () => {
      const p = component.docProposals()[0];
      component.removeDocProposal(p);
      expect(component.docProposals().map(x => x.tempId)).toEqual(['d2']);
    });

    it('docSelectedCount counts selected proposals', () => {
      expect(component.docSelectedCount).toBe(2);
      component.docProposals()[0].selected = false;
      expect(component.docSelectedCount).toBe(1);
    });

    it('selectAllDoc sets all proposals selection', () => {
      component.selectAllDoc(false);
      expect(component.docProposals().every(p => !p.selected)).toBeTrue();
    });
  });

  describe('saveSelectedDocProposals', () => {
    it('requires at least one selected proposal', () => {
      component.docProposals.set([makeProposal({ selected: false })]);
      component.saveSelectedDocProposals();
      expect(component.docError()).toBe('Sélectionnez au moins un scénario.');
      expect(aiSvc.bulkCreate).not.toHaveBeenCalled();
    });

    it('emits saved scenarios and alerts when all succeed with no leftovers', () => {
      spyOn(window, 'alert');
      spyOn(component.saved, 'emit');
      component.docProposals.set([makeProposal({ tempId: 'd1', selected: true })]);
      aiSvc.bulkCreate.and.returnValue(of({ success: true, data: [baseScenario], errors: [] }));

      component.saveSelectedDocProposals();

      expect(component.docSavingSelected()).toBeFalse();
      expect(component.saved.emit).toHaveBeenCalledWith(baseScenario);
      expect(component.docProposals()).toEqual([]);
      expect(window.alert).toHaveBeenCalledWith('1 scénario(s) créé(s) avec succès.');
    });

    it('keeps failed proposals and records errors without alerting', () => {
      spyOn(window, 'alert');
      const failing = makeProposal({ tempId: 'd1', name: 'Bad', selected: true });
      component.docProposals.set([failing]);
      aiSvc.bulkCreate.and.returnValue(of({ success: false, data: [], errors: [{ name: 'Bad', message: 'dup' }] }));

      component.saveSelectedDocProposals();

      expect(component.docSaveErrors()).toEqual([{ name: 'Bad', message: 'dup' }]);
      expect(component.docProposals()).toEqual([failing]);
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('sets an error message on request failure', () => {
      component.docProposals.set([makeProposal({ selected: true })]);
      aiSvc.bulkCreate.and.returnValue(throwError(() => ({ error: { message: 'Save failed' } })));
      component.saveSelectedDocProposals();
      expect(component.docSavingSelected()).toBeFalse();
      expect(component.docError()).toBe('Save failed');
    });
  });

  // ── URL flow ──────────────────────────────────────────────────────────

  describe('generateFromUrl', () => {
    it('requires a non-blank URL', () => {
      component.urlValue = '  ';
      component.generateFromUrl();
      expect(component.urlError()).toBe('Saisissez une URL.');
      expect(aiSvc.generateFromUrl).not.toHaveBeenCalled();
    });

    it('starts a crawl job with maxPages/maxDepth options', () => {
      component.urlValue = 'https://site.com';
      component.urlMaxPages = 5;
      component.urlMaxDepth = 1;
      const job = makeJob();
      aiSvc.generateFromUrl.and.returnValue(job);
      component.generateFromUrl();
      expect(aiSvc.generateFromUrl).toHaveBeenCalledWith('p1', 'https://site.com', { maxPages: 5, maxDepth: 1 });
      expect(component.urlCrawling()).toBeTrue();
    });

    it('reports progress messages while crawling', () => {
      component.urlValue = 'https://site.com';
      const job = makeJob();
      aiSvc.generateFromUrl.and.returnValue(job);
      component.generateFromUrl();
      job.progress$.next({ status: 'crawling', message: 'Crawling page 2...' });
      expect(component.urlError()).toBe('Crawling page 2...');
    });

    it('sets proposals selected and pagesExplored on success', () => {
      component.urlValue = 'https://site.com';
      const job = makeJob();
      aiSvc.generateFromUrl.and.returnValue(job);
      component.generateFromUrl();
      job.result$.next({ scenarios: [makeProposal()], pagesExplored: 4 });
      expect(component.urlCrawling()).toBeFalse();
      expect(component.urlPagesExplored()).toBe(4);
      expect(component.urlProposals()[0].selected).toBeTrue();
      expect(component.urlError()).toBe('');
    });

    it('sets an error message when no scenarios are found', () => {
      component.urlValue = 'https://site.com';
      const job = makeJob();
      aiSvc.generateFromUrl.and.returnValue(job);
      component.generateFromUrl();
      job.result$.next({ scenarios: [] });
      expect(component.urlError()).toContain("n'a généré aucun scénario");
    });

    it('sets an error on job failure', () => {
      component.urlValue = 'https://site.com';
      const job = makeJob();
      aiSvc.generateFromUrl.and.returnValue(job);
      component.generateFromUrl();
      job.error$.next('Crawl failed');
      expect(component.urlCrawling()).toBeFalse();
      expect(component.urlError()).toBe('Crawl failed');
    });
  });

  describe('url proposal selection helpers', () => {
    beforeEach(() => {
      component.urlProposals.set([makeProposal({ tempId: 'u1', selected: true }), makeProposal({ tempId: 'u2', selected: true })]);
    });

    it('toggleUrlSelection flips selection', () => {
      const p = component.urlProposals()[0];
      component.toggleUrlSelection(p);
      expect(p.selected).toBeFalse();
    });

    it('toggleUrlExpanded toggles the expanded id', () => {
      const p = component.urlProposals()[0];
      component.toggleUrlExpanded(p);
      expect(component.urlExpandedId()).toBe('u1');
      component.toggleUrlExpanded(p);
      expect(component.urlExpandedId()).toBeNull();
    });

    it('removeUrlProposal removes the given proposal', () => {
      const p = component.urlProposals()[0];
      component.removeUrlProposal(p);
      expect(component.urlProposals().map(x => x.tempId)).toEqual(['u2']);
    });

    it('urlSelectedCount counts selected proposals', () => {
      expect(component.urlSelectedCount).toBe(2);
      component.urlProposals()[0].selected = false;
      expect(component.urlSelectedCount).toBe(1);
    });

    it('selectAllUrl sets all proposals selection', () => {
      component.selectAllUrl(false);
      expect(component.urlProposals().every(p => !p.selected)).toBeTrue();
    });
  });

  describe('saveSelectedUrlProposals', () => {
    it('requires at least one selected proposal', () => {
      component.urlProposals.set([makeProposal({ selected: false })]);
      component.saveSelectedUrlProposals();
      expect(component.urlError()).toBe('Sélectionnez au moins un scénario.');
      expect(aiSvc.bulkCreate).not.toHaveBeenCalled();
    });

    it('emits saved scenarios and alerts when all succeed with no leftovers', () => {
      spyOn(window, 'alert');
      spyOn(component.saved, 'emit');
      component.urlProposals.set([makeProposal({ tempId: 'u1', selected: true })]);
      aiSvc.bulkCreate.and.returnValue(of({ success: true, data: [baseScenario], errors: [] }));

      component.saveSelectedUrlProposals();

      expect(component.urlSavingSelected()).toBeFalse();
      expect(component.saved.emit).toHaveBeenCalledWith(baseScenario);
      expect(component.urlProposals()).toEqual([]);
      expect(window.alert).toHaveBeenCalledWith('1 scénario(s) créé(s) avec succès.');
    });

    it('keeps failed proposals and records errors without alerting', () => {
      spyOn(window, 'alert');
      const failing = makeProposal({ tempId: 'u1', name: 'Bad', selected: true });
      component.urlProposals.set([failing]);
      aiSvc.bulkCreate.and.returnValue(of({ success: false, data: [], errors: [{ name: 'Bad', message: 'dup' }] }));

      component.saveSelectedUrlProposals();

      expect(component.urlSaveErrors()).toEqual([{ name: 'Bad', message: 'dup' }]);
      expect(component.urlProposals()).toEqual([failing]);
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('sets an error message on request failure', () => {
      component.urlProposals.set([makeProposal({ selected: true })]);
      // No `.error.message` / `.message` on the thrown value — this exercises
      // the generic-fallback branch of _extractErrorMessage (its sibling
      // "doc" test above already covers the specific-message branch).
      aiSvc.bulkCreate.and.returnValue(throwError(() => ({})));
      component.saveSelectedUrlProposals();
      expect(component.urlSavingSelected()).toBeFalse();
      expect(component.urlError()).toBe('Erreur lors de la création des scénarios.');
    });
  });

  // ── Save (NLP / Record) ───────────────────────────────────────────────

  describe('saveDraft / save / _validateAndSave', () => {
    beforeEach(() => {
      spyOn(window, 'alert');
    });

    it('alerts when the name is blank (nlp mode)', () => {
      component.activeMode.set('nlp');
      component.nlpName = '   ';
      component.save();
      expect(window.alert).toHaveBeenCalledWith('Veuillez saisir un nom de scénario.');
      expect(scenarioSvc.create).not.toHaveBeenCalled();
    });

    it('alerts when the name is blank (record mode)', () => {
      component.activeMode.set('record');
      component.recName = '';
      component.save();
      expect(window.alert).toHaveBeenCalledWith('Veuillez saisir un nom de scénario.');
    });

    it('alerts when trying to save while still recording', () => {
      component.activeMode.set('record');
      component.recName = 'Scenario';
      component.recStatus.set('recording');
      component.save();
      expect(window.alert).toHaveBeenCalledWith("Arrêtez d'abord l'enregistrement avant de sauvegarder.");
      expect(scenarioSvc.create).not.toHaveBeenCalled();
    });

    it('alerts when the nlp script has not been generated', () => {
      component.activeMode.set('nlp');
      component.nlpName = 'Scenario';
      component.parsedScript.set('');
      component.save();
      expect(window.alert).toHaveBeenCalledWith("Analysez d'abord le scénario.");
    });

    it('alerts when the record script has not been captured', () => {
      component.activeMode.set('record');
      component.recName = 'Scenario';
      component.recStatus.set('stopped');
      component.recScript.set('');
      component.save();
      expect(window.alert).toHaveBeenCalledWith("Enregistrez d'abord un scénario.");
    });

    it('saveDraft calls the API with status DRAFT', () => {
      component.activeMode.set('nlp');
      component.nlpName = 'Scenario';
      component.parsedScript.set('script();');
      scenarioSvc.create.and.returnValue(of(baseScenario));
      component.saveDraft();
      expect(scenarioSvc.create).toHaveBeenCalledWith('p1', jasmine.objectContaining({ status: 'DRAFT' }));
    });

    it('save calls the API with status ACTIVE and includes NLP payload fields', () => {
      component.activeMode.set('nlp');
      component.nlpName = 'Scenario';
      component.nlpText = 'nlp text';
      component.nlpDescription = 'desc';
      component.parsedScript.set('script();');
      component.parsedData.set([{ k: 'password', v: 'x', isSecret: undefined }]);
      component.parsedSteps.set([{ num: 1, action: 'click', selector: '#a', type: 'click' }]);
      scenarioSvc.create.and.returnValue(of(baseScenario));

      component.save();

      expect(scenarioSvc.create).toHaveBeenCalledWith('p1', {
        name: 'Scenario',
        type: 'POSITIVE',
        creationMode: 'NLP',
        nlpText: 'nlp text',
        description: 'desc',
        etapesScenarios: component.parsedSteps(),
        scriptTemplate: 'script();',
        status: 'ACTIVE',
        variables: [{ key: 'password', value: 'x', isSecret: true }],
      });
    });

    it('save includes RECORD payload fields with detected variables', () => {
      component.activeMode.set('record');
      component.recName = 'Rec scenario';
      component.recDescription = 'rec desc';
      component.recStatus.set('stopped');
      component.recScript.set('script();');
      component.recDetectedVariables.set([{ key: 'email', value: 'a@b.com', isSecret: false }]);
      component.recEvents.set([{ time: '', actionClass: 'click', actionLabel: 'Click', desc: 'Click btn' }]);
      scenarioSvc.create.and.returnValue(of(baseScenario));

      component.save();

      expect(scenarioSvc.create).toHaveBeenCalledWith('p1', jasmine.objectContaining({
        name: 'Rec scenario',
        creationMode: 'RECORD',
        nlpText: undefined,
        description: 'rec desc',
        scriptTemplate: 'script();',
        status: 'ACTIVE',
        variables: [{ key: 'email', value: 'a@b.com', isSecret: false }],
      }));
    });

    it('emits saved and closes the modal on ACTIVE save success', () => {
      spyOn(component.saved, 'emit');
      spyOn(component, 'close');
      component.activeMode.set('nlp');
      component.nlpName = 'Scenario';
      component.parsedScript.set('script();');
      scenarioSvc.create.and.returnValue(of(baseScenario));

      component.save();

      expect(component.saving()).toBeFalse();
      expect(component.saved.emit).toHaveBeenCalledWith(baseScenario);
      expect(component.close).toHaveBeenCalled();
    });

    it('emits saved and alerts (without closing) on DRAFT save success', () => {
      spyOn(component.saved, 'emit');
      spyOn(component, 'close');
      component.activeMode.set('nlp');
      component.nlpName = 'Scenario';
      component.parsedScript.set('script();');
      scenarioSvc.create.and.returnValue(of(baseScenario));

      component.saveDraft();

      expect(component.saved.emit).toHaveBeenCalledWith(baseScenario);
      expect(component.close).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Brouillon sauvegardé !');
    });

    it('sets an error message and does not close on save failure', () => {
      spyOn(component, 'close');
      component.activeMode.set('nlp');
      component.nlpName = 'Scenario';
      component.parsedScript.set('script();');
      scenarioSvc.create.and.returnValue(throwError(() => new Error('boom')));

      component.save();

      expect(component.saving()).toBeFalse();
      expect(component.errorMessage()).toBe('Erreur lors de la sauvegarde. Veuillez réessayer.');
      expect(component.close).not.toHaveBeenCalled();
    });
  });
});
