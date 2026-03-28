import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { inject } from '@angular/core';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass, NgIf],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private router = inject(Router);

  currentStep = signal(1);
  currentTheme = signal<'dark' | 'light'>(
    (localStorage.getItem('aq-theme') as 'dark' | 'light') ?? 'dark'
  );

  // Step 1
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  showPassword = signal(false);
  pwStrength = signal(0);
  pwLabel = signal('—');

  // Step 2
  company = '';
  role = '';
  teamSize = signal('');

  // Step 3
  acceptCgu = false;
  acceptNewsletter = true;

  loading = signal(false);
  error = signal('');
  success = signal(false);

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aq-theme', theme);
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
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

  selectTeamSize(size: string): void {
    this.teamSize.set(size);
  }

  nextStep(from: number): void {
    this.error.set('');
    if (from === 1) {
      if (!this.firstName || !this.lastName || !this.email || !this.password) {
        this.error.set('Veuillez remplir tous les champs.');
        return;
      }
      if (!this.email.includes('@')) {
        this.error.set('Email invalide.');
        return;
      }
      if (this.password.length < 8) {
        this.error.set('Mot de passe trop court (min. 8 caractères).');
        return;
      }
    }
    if (from === 2 && (!this.company || !this.role)) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }
    this.currentStep.set(from + 1);
  }

  prevStep(from: number): void {
    this.currentStep.set(from - 1);
  }

  async handleRegister(): Promise<void> {
    if (!this.acceptCgu) {
      this.error.set('Vous devez accepter les CGU.');
      return;
    }
    this.loading.set(true);
    this.success.set(true);
    await new Promise(r => setTimeout(r, 1800));
    this.loading.set(false);
    this.router.navigate(['/dashboard']);
  }
}
