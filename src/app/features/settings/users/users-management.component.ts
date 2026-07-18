import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { NgClass, NgIf, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberService, ProjectMember, PendingInvitation, ProjectRole } from '../../../services/member.service';

const ROLE_LABELS: Record<ProjectRole, string> = {
  ADMIN: 'Administrateur',
  QA_LEAD: 'QA Lead',
  MEMBRE: 'Membre',
  OBSERVATEUR: 'Observateur',
};

const ROLE_BADGE_CLASS: Record<ProjectRole, string> = {
  ADMIN: 'admin',
  QA_LEAD: 'lead',
  MEMBRE: 'member',
  OBSERVATEUR: 'viewer',
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#00e5ff)',
  'linear-gradient(135deg,#059669,#10b981)',
  'linear-gradient(135deg,#d97706,#f59e0b)',
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#ec4899,#f43f5e)',
];

/** Ligne unifiée du tableau : soit un membre actif, soit une invitation en attente. */
interface UserRow {
  kind: 'member' | 'invitation';
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
  date: string;
  initials: string;
  avatarGradient: string;
  raw: ProjectMember | PendingInvitation;
}

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [NgClass, NgIf, NgFor, FormsModule, DatePipe],
  templateUrl: './users-management.component.html',
  styleUrl: './users-management.component.scss',
})
export class UsersManagementComponent implements OnChanges {
  @Input({ required: true }) projectId!: string;

  private memberService = inject(MemberService);

  roles: ProjectRole[] = ['ADMIN', 'QA_LEAD', 'MEMBRE', 'OBSERVATEUR'];
  roleLabels = ROLE_LABELS;

  members = signal<ProjectMember[]>([]);
  invitations = signal<PendingInvitation[]>([]);
  loading = signal(true);
  error = signal('');

  // Formulaire d'invitation
  inviteEmail = '';
  inviteRole: ProjectRole = 'MEMBRE';
  inviting = signal(false);
  inviteError = signal('');
  inviteSuccess = signal('');

  /** Vue fusionnée membres actifs + invitations en attente, triée par nom/email. */
  rows = computed<UserRow[]>(() => {
    const memberRows: UserRow[] = this.members().map((m, i) => ({
      kind: 'member',
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      date: m.createdAt,
      initials: this.initialsOf(m.user.name),
      avatarGradient: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
      raw: m,
    }));

    const invitationRows: UserRow[] = this.invitations().map((inv, i) => ({
      kind: 'invitation',
      id: inv.id,
      name: inv.email.split('@')[0],
      email: inv.email,
      role: inv.role,
      date: inv.expiresAt,
      initials: this.initialsOf(inv.email),
      avatarGradient: AVATAR_GRADIENTS[(memberRows.length + i) % AVATAR_GRADIENTS.length],
      raw: inv,
    }));

    return [...memberRows, ...invitationRows];
  });

  ngOnChanges(): void {
    if (this.projectId) this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set('');

    this.memberService.list(this.projectId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });

    this.memberService.listInvitations(this.projectId).subscribe({
      next: (invitations) => this.invitations.set(invitations),
      error: () => {}, // non bloquant, comme avant
    });
  }

  sendInvite(): void {
    this.inviteError.set('');
    this.inviteSuccess.set('');

    if (!this.inviteEmail || !this.inviteEmail.includes('@')) {
      this.inviteError.set('Adresse email invalide.');
      return;
    }

    this.inviting.set(true);
    this.memberService.invite(this.projectId, this.inviteEmail, this.inviteRole).subscribe({
      next: () => {
        this.inviting.set(false);
        this.inviteSuccess.set(`Invitation envoyée à ${this.inviteEmail}.`);
        this.inviteEmail = '';
        this.inviteRole = 'MEMBRE';
        this.loadAll();
        setTimeout(() => this.inviteSuccess.set(''), 3000);
      },
      error: (err) => {
        this.inviting.set(false);
        this.inviteError.set(err.message);
      },
    });
  }

  /** Renvoie une invitation : recrée une invitation identique (le backend révoque l'ancienne). */
  resendInvite(row: UserRow): void {
    const inv = row.raw as PendingInvitation;
    this.memberService.invite(this.projectId, inv.email, inv.role).subscribe({
      next: () => {
        this.inviteSuccess.set(`Invitation renvoyée à ${inv.email}.`);
        this.loadAll();
        setTimeout(() => this.inviteSuccess.set(''), 3000);
      },
      error: (err) => this.error.set(err.message),
    });
  }

  revokeInvitation(row: UserRow): void {
    this.memberService.revokeInvitation(this.projectId, row.id).subscribe({
      next: () => this.loadAll(),
      error: (err) => this.error.set(err.message),
    });
  }

  updateRole(row: UserRow, role: ProjectRole): void {
    this.memberService.updateRole(this.projectId, row.id, role).subscribe({
      next: () => this.loadAll(),
      error: (err) => this.error.set(err.message),
    });
  }

  removeMember(row: UserRow): void {
    if (!confirm(`Retirer ${row.name} du projet ?`)) return;
    this.memberService.remove(this.projectId, row.id).subscribe({
      next: () => this.loadAll(),
      error: (err) => this.error.set(err.message),
    });
  }

  roleBadgeClass(role: ProjectRole): string {
    return ROLE_BADGE_CLASS[role];
  }

  private initialsOf(text: string): string {
    const clean = text.trim();
    if (clean.includes(' ')) {
      const [a, b] = clean.split(' ');
      return (a[0] + (b?.[0] || '')).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }
}