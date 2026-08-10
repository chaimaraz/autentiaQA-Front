import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AiConfigService,
  AiProviderConfigPayload,
  AiProviderMeta,
} from '../../../services/ai-config.service';

@Component({
  selector: 'app-ai-settings',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './ai-settings.component.html',
  styleUrl: './ai-settings.component.scss',
})
export class AiSettingsComponent implements OnInit {
  private aiConfigSvc = inject(AiConfigService);

  connected = signal(false);
  loading = signal(false);
  testing = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  testMessage = signal('');
  hasApiKey = signal(false);
  lastTestedAt = signal<string | null>(null);
  providers = signal<AiProviderMeta[]>([]);

  form: AiProviderConfigPayload = {
    provider: 'gemini',
    model: '',
    apiKey: '',
    temperature: 0.3,
    maxTokens: 4000,
    maxScenarios: 5,
    crawlMaxPages: 15,
    crawlMaxDepth: 2,
  };

  selectedProviderMeta = computed(
    () => this.providers().find((p) => p.id === this.form.provider) ?? null
  );

  isMock = computed(() => this.form.provider === 'mock');

  ngOnInit(): void {
    this.loading.set(true);
    this.aiConfigSvc.listProviders().subscribe({
      next: (providers) => this.providers.set(providers),
      error: () => {},
    });
    this.aiConfigSvc.getConfig().subscribe({
      next: (config) => {
        this.loading.set(false);
        if (!config) return;
        this.form = {
          provider: config.provider,
          model: config.model,
          apiKey: '',
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          maxScenarios: config.maxScenarios,
          crawlMaxPages: config.crawlMaxPages,
          crawlMaxDepth: config.crawlMaxDepth,
        };
        this.hasApiKey.set(config.hasApiKey);
        this.connected.set(Boolean(config.lastTestOk));
        this.lastTestedAt.set(config.lastTestedAt);
      },
      error: () => this.loading.set(false),
    });
  }

  onProviderChange(): void {
    this.form.apiKey = '';
    this.hasApiKey.set(false);
    this.connected.set(false);
    this.testMessage.set('');
  }

  testConnection(): void {
    if (!this.isMock() && !this.form.model) {
      this.error.set('Veuillez saisir le modèle à utiliser.');
      return;
    }
    if (!this.isMock() && !this.form.apiKey && !this.hasApiKey()) {
      this.error.set("Veuillez saisir la clé API (aucune clé enregistrée pour l'instant).");
      return;
    }
    this.error.set('');
    this.testMessage.set('');
    this.testing.set(true);

    this.aiConfigSvc.testConnection(this.form).subscribe({
      next: (result) => {
        this.testing.set(false);
        this.connected.set(Boolean(result.ok));
        this.testMessage.set(result.message || '');
      },
      error: (err) => {
        this.testing.set(false);
        this.connected.set(false);
        this.error.set(err.message || 'Le test de connexion a échoué.');
      },
    });
  }

  saveConfig(): void {
    this.error.set('');
    this.success.set('');
    if (!this.isMock() && !this.form.model) {
      this.error.set('Veuillez saisir le modèle à utiliser.');
      return;
    }
    if (!this.isMock() && !this.form.apiKey && !this.hasApiKey()) {
      this.error.set("La clé API est requise lors de la première configuration de ce fournisseur.");
      return;
    }
    this.saving.set(true);

    const payload: AiProviderConfigPayload = { ...this.form };
    if (!payload.apiKey) delete (payload as any).apiKey;

    this.aiConfigSvc.saveConfig(payload).subscribe({
      next: (config) => {
        this.saving.set(false);
        this.hasApiKey.set(config.hasApiKey);
        this.form.apiKey = '';
        this.success.set(`Fournisseur IA "${config.provider}" configuré. Le système l'utilisera pour toutes les prochaines générations.`);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.message || 'Échec de la sauvegarde.');
      },
    });
  }
}
