import { Component, computed, inject, signal } from '@angular/core';
import { NgClass, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService, GlobalRole } from '../../services/auth.service';

const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrateur',
  USER: 'QA Engineer',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgClass, NgIf, NgFor, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api';

  user = computed(() => this.auth.user());
  roleLabel = computed(() => (this.user() ? GLOBAL_ROLE_LABELS[this.user()!.globalRole] : ''));

  initials = computed(() => {
    const name = this.user()?.name?.trim() || '';
    if (!name) return '?';
    const parts = name.split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  });

  // Statistiques réelles disponibles pour l'instant : nombre de projets
  // accessibles à l'utilisateur (via AuthService.projects()). Les compteurs
  // scénarios/exécutions nécessitent un endpoint d'agrégation dédié côté
  // backend (ex: GET /api/auth/me/stats) — non présent dans les fichiers
  // fournis. Affichés à 0 en attendant, sans casser l'UI du template.
  stats = computed(() => ({
    projectsCount: this.auth.projects().length,
    scenariosCount: 0,
    executionsCount: 0,
  }));

  editing = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');

  form = { name: '', email: '', language: 'fr', defaultFramework: 'PLAYWRIGHT' };

  pwForm = { current: '', next: '', confirm: '' };
  pwSaving = signal(false);
  pwError = signal('');

  theme = signal<'dark' | 'light'>((localStorage.getItem('aq-theme') as 'dark' | 'light') || 'dark');

  constructor() {
    const u = this.user();
    if (u) {
      this.form.name = u.name;
      this.form.email = u.email;
    }
  }

  toggleEdit(): void {
    this.editing.update((v) => !v);
    this.error.set('');
    this.success.set('');
    if (!this.editing()) {
      const u = this.user();
      if (u) {
        this.form.name = u.name;
        this.form.email = u.email;
      }
    }
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aq-theme', theme);
  }

  saveProfile(): void {
    this.error.set('');
    this.success.set('');

    if (!this.form.name.trim()) {
      this.error.set('Le nom est requis.');
      return;
    }
    if (!this.form.email.includes('@')) {
      this.error.set('Adresse email invalide.');
      return;
    }

    this.saving.set(true);
    // NOTE : nécessite un endpoint PATCH /api/auth/me côté backend
    // (user.controller / user.service à créer, non présent dans les
    // fichiers fournis). Le formulaire reste fonctionnel côté UI.
    this.http.patch<{ success: boolean; data: any }>(`${this.baseUrl}/auth/me`, {
      name: this.form.name,
      email: this.form.email,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.success.set('Profil mis à jour.');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || "La sauvegarde nécessite l'endpoint backend PATCH /api/auth/me.");
      },
    });
  }

  changePassword(): void {
    this.pwError.set('');

    if (!this.pwForm.current || !this.pwForm.next) {
      this.pwError.set('Tous les champs sont requis.');
      return;
    }
    if (this.pwForm.next.length < 8) {
      this.pwError.set('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (this.pwForm.next !== this.pwForm.confirm) {
      this.pwError.set('La confirmation ne correspond pas.');
      return;
    }

    this.pwSaving.set(true);
    // NOTE : nécessite un endpoint POST /api/auth/change-password côté backend.
    this.http.post<{ success: boolean }>(`${this.baseUrl}/auth/change-password`, {
      currentPassword: this.pwForm.current,
      newPassword: this.pwForm.next,
    }).subscribe({
      next: () => {
        this.pwSaving.set(false);
        this.pwForm = { current: '', next: '', confirm: '' };
      },
      error: (err) => {
        this.pwSaving.set(false);
        this.pwError.set(err?.error?.message || "Nécessite l'endpoint backend POST /api/auth/change-password.");
      },
    });
  }

  // Heatmap purement visuelle (comme dans le template) — 52 semaines * 7 jours.
  heatmapCells: string[] = Array.from({ length: 52 * 7 }, () => {
    const r = Math.random();
    return r < 0.4 ? '' : r < 0.6 ? 'l1' : r < 0.75 ? 'l2' : r < 0.9 ? 'l3' : 'l4';
  });
}