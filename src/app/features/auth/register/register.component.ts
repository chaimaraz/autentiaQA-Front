import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

interface InvitationPreview {
  email: string;
  role: 'ADMIN' | 'QA_LEAD' | 'MEMBRE' | 'OBSERVATEUR';
  projectName: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  QA_LEAD: 'QA Lead',
  MEMBRE: 'Membre',
  OBSERVATEUR: 'Observateur',
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf, NgClass],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly baseUrl = 'http://localhost:3000/api';

  currentTheme = signal<'dark' | 'light'>(
    (localStorage.getItem('aq-theme') as 'dark' | 'light') ?? 'dark'
  );

  // État de la validation du lien d'invitation
  checkingToken = signal(true);
  tokenValid = signal(false);
  invitation = signal<InvitationPreview | null>(null);
  roleLabel = signal('');

  private token = '';

  // Formulaire
  name = '';
  password = '';
  confirmPassword = '';
  showPassword = signal(false);
  pwStrength = signal(0);
  pwLabel = signal('—');

  loading = signal(false);
  error = signal('');
  success = signal(false);

  ngOnInit(): void {
    this.setTheme(this.currentTheme());
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

    if (!this.token) {
      this.checkingToken.set(false);
      this.tokenValid.set(false);
      return;
    }

    this.http
      .get<{ success: boolean; data: InvitationPreview }>(`${this.baseUrl}/auth/invitations/${this.token}`)
      .subscribe({
        next: (res) => {
          this.invitation.set(res.data);
          this.roleLabel.set(ROLE_LABELS[res.data.role] ?? res.data.role);
          this.tokenValid.set(true);
          this.checkingToken.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.message || "Ce lien d'invitation est invalide ou a expiré.");
          this.tokenValid.set(false);
          this.checkingToken.set(false);
        },
      });
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aq-theme', theme);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  checkPasswordStrength(pw: string): void {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    this.pwStrength.set(score);
    const labels = ['—', 'Faible', 'Moyen', 'Fort', 'Très fort'];
    this.pwLabel.set(labels[score] ?? '—');
  }

  handleRegister(): void {
    this.error.set('');

    if (!this.name.trim()) {
      this.error.set('Veuillez indiquer votre nom.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Mot de passe trop court (min. 8 caractères).');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading.set(true);
    this.http
      .post<{ success: boolean; data: any }>(`${this.baseUrl}/auth/invitations/${this.token}/accept`, {
        name: this.name,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.success.set(true);
          // Réutilise la session retournée par le backend (même format que /auth/login)
          this.auth.applyExternalSession(res.data);
          setTimeout(() => this.router.navigate(['/dashboard']), 1200);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.message || 'Impossible de créer le compte. Réessayez.');
        },
      });
  }
} 