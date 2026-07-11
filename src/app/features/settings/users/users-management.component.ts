import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { NgClass, NgIf, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberService, ProjectMember, PendingInvitation, ProjectRole } from '../../../services/member.service';

const ROLE_LABELS: Record<ProjectRole, string> = {
  ADMIN: 'Administrateur',
  QA_LEAD: 'QA Lead',
  MEMBRE: 'Membre',
  OBSERVATEUR: 'Observateur',
};

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
  showInviteForm = signal(false);
  inviteEmail = '';
  inviteRole: ProjectRole = 'MEMBRE';
  inviting = signal(false);
  inviteError = signal('');
  inviteSuccess = signal('');

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
      error: () => {}, // non bloquant
    });
  }

  toggleInviteForm(): void {
    this.showInviteForm.update((v) => !v);
    this.inviteError.set('');
    this.inviteSuccess.set('');
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
      },
      error: (err) => {
        this.inviting.set(false);
        this.inviteError.set(err.message);
      },
    });
  }

  revokeInvitation(invitationId: string): void {
    this.memberService.revokeInvitation(this.projectId, invitationId).subscribe({
      next: () => this.loadAll(),
      error: (err) => this.error.set(err.message),
    });
  }

  updateRole(member: ProjectMember, role: ProjectRole): void {
    this.memberService.updateRole(this.projectId, member.id, role).subscribe({
      next: () => this.loadAll(),
      error: (err) => this.error.set(err.message),
    });
  }

  removeMember(member: ProjectMember): void {
    if (!confirm(`Retirer ${member.user.name} du projet ?`)) return;
    this.memberService.remove(this.projectId, member.id).subscribe({
      next: () => this.loadAll(),
      error: (err) => this.error.set(err.message),
    });
  }
}
