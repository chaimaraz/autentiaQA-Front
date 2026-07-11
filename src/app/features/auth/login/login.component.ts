import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { inject } from '@angular/core';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private router = inject(Router);
  private auth = inject(AuthService);

  email = '';
  password = '';
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');
  currentTheme = signal<'dark' | 'light'>(
    (localStorage.getItem('aq-theme') as 'dark' | 'light') ?? 'dark'
  );

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aq-theme', theme);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  handleLogin(): void {
    this.error.set('');
    if (!this.email || !this.password) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }
    if (!this.email.includes('@')) {
      this.error.set('Adresse email invalide.');
      return;
    }

    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.message || 'Identifiants invalides.');
      },
    });
  }
}
