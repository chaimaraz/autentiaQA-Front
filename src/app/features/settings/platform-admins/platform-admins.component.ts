import { Component, OnInit, inject, signal } from '@angular/core';
import { NgClass, NgIf, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, PlatformUser } from '../../../services/admin.service';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrateur',
  USER: 'Utilisateur',
};

@Component({
  selector: 'app-platform-admins',
  standalone: true,
  imports: [NgClass, NgIf, NgFor, FormsModule, DatePipe],
  templateUrl: './platform-admins.component.html',
  styleUrl: './platform-admins.component.scss',
})
export class PlatformAdminsComponent implements OnInit {
  private adminService = inject(AdminService);

  roleLabels = ROLE_LABELS;

  users = signal<PlatformUser[]>([]);
  loading = signal(true);
  error = signal('');

  showCreateForm = signal(false);
  newEmail = '';
  newName = '';
  newPassword = '';
  creating = signal(false);
  createError = signal('');
  createSuccess = signal('');

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.adminService.listUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    this.createError.set('');
    this.createSuccess.set('');
  }

  createAdmin(): void {
    this.createError.set('');
    this.createSuccess.set('');

    if (!this.newEmail || !this.newEmail.includes('@')) {
      this.createError.set('Adresse email invalide.');
      return;
    }
    if (!this.newName.trim()) {
      this.createError.set('Le nom est requis.');
      return;
    }
    if (this.newPassword.length < 8) {
      this.createError.set('Mot de passe trop court (min. 8 caractères).');
      return;
    }

    this.creating.set(true);
    this.adminService.createAdmin(this.newEmail, this.newName, this.newPassword).subscribe({
      next: () => {
        this.creating.set(false);
        this.createSuccess.set(`Compte Administrateur créé pour ${this.newEmail}.`);
        this.newEmail = '';
        this.newName = '';
        this.newPassword = '';
        this.loadUsers();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(err.message);
      },
    });
  }
}