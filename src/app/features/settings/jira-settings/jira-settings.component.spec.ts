import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { JiraSettingsComponent } from './jira-settings.component';
import { JiraConfigService, JiraConfig } from '../../../services/jira-config.service';

describe('JiraSettingsComponent', () => {
  let component: JiraSettingsComponent;
  let fixture: ComponentFixture<JiraSettingsComponent>;
  let jiraSvcSpy: jasmine.SpyObj<JiraConfigService>;

  const fullConfig: JiraConfig = {
    id: 'c1',
    projectId: 'p1',
    jiraUrl: 'https://jira.example.com',
    jiraEmail: 'a@b.com',
    projectKey: 'AQ',
    defaultIssueType: 'Bug',
    autoCreateOnFail: true,
    attachScreenshot: true,
    attachVideo: false,
    attachTrace: false,
    includeErrorStack: true,
    hasApiToken: true,
    lastTestedAt: null,
    lastTestOk: true,
  };

  beforeEach(() => {
    jiraSvcSpy = jasmine.createSpyObj('JiraConfigService', ['getConfig', 'testConnection', 'saveConfig']);

    TestBed.configureTestingModule({
      imports: [JiraSettingsComponent],
      providers: [{ provide: JiraConfigService, useValue: jiraSvcSpy }],
    });

    fixture = TestBed.createComponent(JiraSettingsComponent);
    component = fixture.componentInstance;
    component.projectId = 'p1';
  });

  it('should create', () => {
    jiraSvcSpy.getConfig.and.returnValue(of(null));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('ngOnChanges', () => {
    it('does nothing when projectId is falsy', () => {
      component.projectId = '' as unknown as string;
      component.ngOnChanges();
      expect(jiraSvcSpy.getConfig).not.toHaveBeenCalled();
    });

    it('populates the form/state when a config exists', () => {
      jiraSvcSpy.getConfig.and.returnValue(of(fullConfig));

      component.ngOnChanges();

      expect(component.loading()).toBeFalse();
      expect(component.form.jiraUrl).toBe(fullConfig.jiraUrl);
      expect(component.form.projectKey).toBe('AQ');
      expect(component.form.apiToken).toBe('');
      expect(component.hasApiToken()).toBeTrue();
      expect(component.connected()).toBeTrue();
    });

    it('leaves the default form untouched when config is null', () => {
      jiraSvcSpy.getConfig.and.returnValue(of(null));
      const initialForm = { ...component.form };

      component.ngOnChanges();

      expect(component.loading()).toBeFalse();
      expect(component.form).toEqual(initialForm);
    });

    it('sets loading false on error', () => {
      jiraSvcSpy.getConfig.and.returnValue(throwError(() => new Error('fail')));

      component.ngOnChanges();

      expect(component.loading()).toBeFalse();
    });
  });

  describe('testConnection guards', () => {
    it('blocks when jiraUrl/jiraEmail are missing', () => {
      component.form.jiraUrl = '';
      component.form.jiraEmail = '';

      component.testConnection();

      expect(component.error()).toContain('URL et l\'email Jira');
      expect(jiraSvcSpy.testConnection).not.toHaveBeenCalled();
    });

    it('blocks when there is no apiToken and none is stored', () => {
      component.form.jiraUrl = 'https://jira.example.com';
      component.form.jiraEmail = 'a@b.com';
      component.form.apiToken = '';
      component.hasApiToken.set(false);

      component.testConnection();

      expect(component.error()).toContain('API token');
      expect(jiraSvcSpy.testConnection).not.toHaveBeenCalled();
    });

    it('allows the call through when apiToken is missing but one is already stored', () => {
      component.form.jiraUrl = 'https://jira.example.com';
      component.form.jiraEmail = 'a@b.com';
      component.form.apiToken = '';
      component.hasApiToken.set(true);
      jiraSvcSpy.testConnection.and.returnValue(of({ accountId: '1', displayName: 'x', emailAddress: 'a@b.com' }));

      component.testConnection();

      expect(jiraSvcSpy.testConnection).toHaveBeenCalledWith('p1', component.form);
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      component.form.jiraUrl = 'https://jira.example.com';
      component.form.jiraEmail = 'a@b.com';
      component.form.apiToken = 'token123';
    });

    it('sets connected true on success', () => {
      jiraSvcSpy.testConnection.and.returnValue(of({ accountId: '1', displayName: 'x', emailAddress: 'a@b.com' }));

      component.testConnection();

      expect(component.testing()).toBeFalse();
      expect(component.connected()).toBeTrue();
      expect(component.error()).toBe('');
    });

    it('sets connected false and an error message on failure', () => {
      jiraSvcSpy.testConnection.and.returnValue(throwError(() => new Error('Connexion refusée')));

      component.testConnection();

      expect(component.testing()).toBeFalse();
      expect(component.connected()).toBeFalse();
      expect(component.error()).toBe('Connexion refusée');
    });
  });

  describe('saveConfig guards', () => {
    it('blocks when jiraUrl/projectKey/jiraEmail are missing', () => {
      component.form.jiraUrl = '';
      component.form.projectKey = '';
      component.form.jiraEmail = '';

      component.saveConfig();

      expect(component.error()).toContain('requis');
      expect(jiraSvcSpy.saveConfig).not.toHaveBeenCalled();
    });

    it('blocks when apiToken missing and none stored', () => {
      component.form.jiraUrl = 'https://jira.example.com';
      component.form.projectKey = 'AQ';
      component.form.jiraEmail = 'a@b.com';
      component.form.apiToken = '';
      component.hasApiToken.set(false);

      component.saveConfig();

      expect(component.error()).toContain('première configuration');
      expect(jiraSvcSpy.saveConfig).not.toHaveBeenCalled();
    });
  });

  describe('saveConfig', () => {
    beforeEach(() => {
      component.form.jiraUrl = 'https://jira.example.com';
      component.form.projectKey = 'AQ';
      component.form.jiraEmail = 'a@b.com';
      component.form.apiToken = 'token123';
    });

    it('saves, clears apiToken, and shows a success message that clears after 3s', fakeAsync(() => {
      jiraSvcSpy.saveConfig.and.returnValue(of(fullConfig));

      component.saveConfig();

      expect(jiraSvcSpy.saveConfig).toHaveBeenCalled();
      const [, payload] = jiraSvcSpy.saveConfig.calls.mostRecent().args;
      expect((payload as any).apiToken).toBe('token123');
      expect(component.saving()).toBeFalse();
      expect(component.hasApiToken()).toBeTrue();
      expect(component.form.apiToken).toBe('');
      expect(component.success()).toContain('AQ');

      tick(3000);
      expect(component.success()).toBe('');
    }));

    it('omits apiToken from the payload when empty', () => {
      component.form.apiToken = '';
      component.hasApiToken.set(true);
      jiraSvcSpy.saveConfig.and.returnValue(of(fullConfig));

      component.saveConfig();

      const [, payload] = jiraSvcSpy.saveConfig.calls.mostRecent().args;
      expect('apiToken' in (payload as any)).toBeFalse();
    });

    it('sets the error signal on failure', () => {
      jiraSvcSpy.saveConfig.and.returnValue(throwError(() => new Error('Échec réseau')));

      component.saveConfig();

      expect(component.saving()).toBeFalse();
      expect(component.error()).toBe('Échec réseau');
    });
  });
});
