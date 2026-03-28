import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { inject } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private router = inject(Router);

  email = 'chaima.razgui@autentia.io';
  password = 'password123';
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
    this.showPassword.update(v => !v);
  }

  async handleLogin(): Promise<void> {
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
    await new Promise(r => setTimeout(r, 1200));
    this.loading.set(false);
    this.router.navigate(['/dashboard']);
  }

  handleSocialLogin(provider: string): void {
    setTimeout(() => this.router.navigate(['/dashboard']), 1000);
  }
}
