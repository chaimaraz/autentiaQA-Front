import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { UsersManagementComponent } from './users-management.component';
import { MemberService, ProjectMember, PendingInvitation } from '../../../services/member.service';

describe('UsersManagementComponent', () => {
  let component: UsersManagementComponent;
  let fixture: ComponentFixture<UsersManagementComponent>;
  let memberServiceSpy: jasmine.SpyObj<MemberService>;

  const members: ProjectMember[] = [
    { id: 'm1', userId: 'u1', projectId: 'p1', role: 'ADMIN', createdAt: '2024-01-01', user: { id: 'u1', email: 'alice@x.com', name: 'Alice Smith' } },
    { id: 'm2', userId: 'u2', projectId: 'p1', role: 'MEMBRE', createdAt: '2024-01-02', user: { id: 'u2', email: 'bob@x.com', name: 'Bob' } },
    { id: 'm3', userId: 'u3', projectId: 'p1', role: 'QA_LEAD', createdAt: '2024-01-03', user: { id: 'u3', email: 'carol@x.com', name: 'Carol Danvers' } },
  ];

  const invitations: PendingInvitation[] = [
    { id: 'i1', email: 'dave@x.com', role: 'MEMBRE', status: 'PENDING', expiresAt: '2024-02-01', createdAt: '2024-01-10' },
    { id: 'i2', email: 'erin@x.com', role: 'OBSERVATEUR', status: 'PENDING', expiresAt: '2024-02-02', createdAt: '2024-01-11' },
  ];

  beforeEach(() => {
    memberServiceSpy = jasmine.createSpyObj('MemberService', [
      'list',
      'listInvitations',
      'invite',
      'revokeInvitation',
      'updateRole',
      'remove',
    ]);

    TestBed.configureTestingModule({
      imports: [UsersManagementComponent],
      providers: [{ provide: MemberService, useValue: memberServiceSpy }],
    });

    fixture = TestBed.createComponent(UsersManagementComponent);
    component = fixture.componentInstance;
    component.projectId = 'p1';
  });

  it('should create', () => {
    memberServiceSpy.list.and.returnValue(of([]));
    memberServiceSpy.listInvitations.and.returnValue(of([]));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('rows computed', () => {
    it('merges members then invitations, preserving each source order', () => {
      component.members.set(members);
      component.invitations.set(invitations);

      const rows = component.rows();

      expect(rows.map((r) => r.id)).toEqual(['m1', 'm2', 'm3', 'i1', 'i2']);
      expect(rows.map((r) => r.kind)).toEqual(['member', 'member', 'member', 'invitation', 'invitation']);
    });

    it('maps member fields (name/email/role/date/raw) correctly', () => {
      component.members.set(members);
      component.invitations.set([]);

      const [row] = component.rows();

      expect(row.name).toBe('Alice Smith');
      expect(row.email).toBe('alice@x.com');
      expect(row.role).toBe('ADMIN');
      expect(row.date).toBe('2024-01-01');
      expect(row.raw).toBe(members[0]);
    });

    it('derives invitation name from the email prefix and uses expiresAt as date', () => {
      component.members.set([]);
      component.invitations.set(invitations);

      const [row] = component.rows();

      expect(row.name).toBe('dave');
      expect(row.email).toBe('dave@x.com');
      expect(row.date).toBe('2024-02-01');
      expect(row.raw).toBe(invitations[0]);
    });

    it('computes initials as first+last letter when the name has a space', () => {
      component.members.set(members);
      component.invitations.set([]);

      const rows = component.rows();

      expect(rows[0].initials).toBe('AS'); // Alice Smith
      expect(rows[2].initials).toBe('CD'); // Carol Danvers
    });

    it('computes initials as the first two characters when there is no space', () => {
      component.members.set(members);
      component.invitations.set([]);

      const rows = component.rows();

      expect(rows[1].initials).toBe('BO'); // "Bob" -> first 2 chars uppercased
    });

    it('computes invitation initials from the email prefix (no space)', () => {
      component.members.set([]);
      component.invitations.set(invitations);

      const rows = component.rows();

      expect(rows[0].initials).toBe('DA'); // "dave@x.com" prefix "dave" -> "DA"
    });

    it('cycles avatar gradients by index across the 5-color palette, continuing into invitations', () => {
      const manyMembers: ProjectMember[] = Array.from({ length: 6 }, (_, i) => ({
        id: `m${i}`,
        userId: `u${i}`,
        projectId: 'p1',
        role: 'MEMBRE' as const,
        createdAt: '2024-01-01',
        user: { id: `u${i}`, email: `u${i}@x.com`, name: `User ${i}` },
      }));
      component.members.set(manyMembers);
      component.invitations.set(invitations);

      const rows = component.rows();
      const gradients = rows.map((r) => r.avatarGradient);

      // member index 0 and member index 5 (6th member, 5 % 5 === 0) share the same gradient
      expect(gradients[0]).toBe(gradients[5]);
      // all 5 base gradients are distinct
      const uniqueFirstFive = new Set(gradients.slice(0, 5));
      expect(uniqueFirstFive.size).toBe(5);
      // invitations continue the index sequence: index 6 (6 % 5 = 1) and index 7 (7 % 5 = 2)
      expect(gradients[6]).toBe(gradients[1]);
      expect(gradients[7]).toBe(gradients[2]);
    });

    it('is empty when there are no members and no invitations', () => {
      component.members.set([]);
      component.invitations.set([]);
      expect(component.rows()).toEqual([]);
    });
  });

  describe('ngOnChanges / loadAll', () => {
    it('loads members and invitations when projectId is set', () => {
      memberServiceSpy.list.and.returnValue(of(members));
      memberServiceSpy.listInvitations.and.returnValue(of(invitations));

      component.ngOnChanges();

      expect(memberServiceSpy.list).toHaveBeenCalledWith('p1');
      expect(memberServiceSpy.listInvitations).toHaveBeenCalledWith('p1');
      expect(component.members()).toEqual(members);
      expect(component.invitations()).toEqual(invitations);
      expect(component.loading()).toBeFalse();
    });

    it('does not load when projectId is falsy', () => {
      component.projectId = '' as unknown as string;
      component.ngOnChanges();
      expect(memberServiceSpy.list).not.toHaveBeenCalled();
    });

    it('sets an error when members fail to load', () => {
      memberServiceSpy.list.and.returnValue(throwError(() => new Error('members failed')));
      memberServiceSpy.listInvitations.and.returnValue(of(invitations));

      component.loadAll();

      expect(component.error()).toBe('members failed');
      expect(component.loading()).toBeFalse();
    });

    it('silently ignores invitation load failures (no error set)', () => {
      memberServiceSpy.list.and.returnValue(of(members));
      memberServiceSpy.listInvitations.and.returnValue(throwError(() => new Error('invitations failed')));

      component.loadAll();

      expect(component.error()).toBe('');
      expect(component.members()).toEqual(members);
    });
  });

  describe('sendInvite', () => {
    it('rejects an invalid email without calling the service', () => {
      component.inviteEmail = 'not-an-email';

      component.sendInvite();

      expect(component.inviteError()).toBe('Adresse email invalide.');
      expect(memberServiceSpy.invite).not.toHaveBeenCalled();
    });

    it('sends the invite, resets the form, reloads, and clears the success message after 3s', fakeAsync(() => {
      component.inviteEmail = 'new@x.com';
      component.inviteRole = 'QA_LEAD';
      memberServiceSpy.invite.and.returnValue(of({ success: true, data: null }));
      memberServiceSpy.list.and.returnValue(of(members));
      memberServiceSpy.listInvitations.and.returnValue(of(invitations));

      component.sendInvite();

      expect(memberServiceSpy.invite).toHaveBeenCalledWith('p1', 'new@x.com', 'QA_LEAD');
      expect(component.inviting()).toBeFalse();
      expect(component.inviteSuccess()).toContain('new@x.com');
      expect(component.inviteEmail).toBe('');
      expect(component.inviteRole).toBe('MEMBRE');
      expect(memberServiceSpy.list).toHaveBeenCalled();

      tick(3000);
      expect(component.inviteSuccess()).toBe('');
    }));

    it('sets inviteError on failure', () => {
      component.inviteEmail = 'new@x.com';
      memberServiceSpy.invite.and.returnValue(throwError(() => new Error('invite failed')));

      component.sendInvite();

      expect(component.inviting()).toBeFalse();
      expect(component.inviteError()).toBe('invite failed');
    });
  });

  describe('resendInvite', () => {
    it('re-invites with the same email/role and reloads on success', fakeAsync(() => {
      memberServiceSpy.invite.and.returnValue(of({ success: true, data: null }));
      memberServiceSpy.list.and.returnValue(of(members));
      memberServiceSpy.listInvitations.and.returnValue(of(invitations));
      component.invitations.set(invitations);
      const invRow = component.rows().find((r) => r.kind === 'invitation')!;

      component.resendInvite(invRow);

      expect(memberServiceSpy.invite).toHaveBeenCalledWith('p1', invitations[0].email, invitations[0].role);
      expect(component.inviteSuccess()).toContain(invitations[0].email);
      expect(memberServiceSpy.list).toHaveBeenCalled();

      tick(3000);
      expect(component.inviteSuccess()).toBe('');
    }));

    it('sets error on failure', () => {
      component.invitations.set(invitations);
      const invRow = component.rows().find((r) => r.kind === 'invitation')!;
      memberServiceSpy.invite.and.returnValue(throwError(() => new Error('resend failed')));

      component.resendInvite(invRow);

      expect(component.error()).toBe('resend failed');
    });
  });

  describe('revokeInvitation', () => {
    it('calls revokeInvitation and reloads on success', () => {
      component.invitations.set(invitations);
      const invRow = component.rows().find((r) => r.kind === 'invitation')!;
      memberServiceSpy.revokeInvitation.and.returnValue(of({ success: true, data: null }));
      memberServiceSpy.list.and.returnValue(of(members));
      memberServiceSpy.listInvitations.and.returnValue(of(invitations));

      component.revokeInvitation(invRow);

      expect(memberServiceSpy.revokeInvitation).toHaveBeenCalledWith('p1', invRow.id);
      expect(memberServiceSpy.list).toHaveBeenCalled();
    });

    it('sets error on failure', () => {
      component.invitations.set(invitations);
      const invRow = component.rows().find((r) => r.kind === 'invitation')!;
      memberServiceSpy.revokeInvitation.and.returnValue(throwError(() => new Error('revoke failed')));

      component.revokeInvitation(invRow);

      expect(component.error()).toBe('revoke failed');
    });
  });

  describe('updateRole', () => {
    it('calls updateRole and reloads on success', () => {
      component.members.set(members);
      const memberRow = component.rows()[0];
      memberServiceSpy.updateRole.and.returnValue(of({ success: true, data: null }));
      memberServiceSpy.list.and.returnValue(of(members));
      memberServiceSpy.listInvitations.and.returnValue(of([]));

      component.updateRole(memberRow, 'QA_LEAD');

      expect(memberServiceSpy.updateRole).toHaveBeenCalledWith('p1', memberRow.id, 'QA_LEAD');
      expect(memberServiceSpy.list).toHaveBeenCalled();
    });

    it('sets error on failure', () => {
      component.members.set(members);
      const memberRow = component.rows()[0];
      memberServiceSpy.updateRole.and.returnValue(throwError(() => new Error('update failed')));

      component.updateRole(memberRow, 'QA_LEAD');

      expect(component.error()).toBe('update failed');
    });
  });

  describe('removeMember', () => {
    it('does not call the service when the user cancels the confirm dialog', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.members.set(members);
      const memberRow = component.rows()[0];

      component.removeMember(memberRow);

      expect(window.confirm).toHaveBeenCalled();
      expect(memberServiceSpy.remove).not.toHaveBeenCalled();
    });

    it('calls remove and reloads when the user confirms', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      component.members.set(members);
      const memberRow = component.rows()[0];
      memberServiceSpy.remove.and.returnValue(of({ success: true, data: null }));
      memberServiceSpy.list.and.returnValue(of(members));
      memberServiceSpy.listInvitations.and.returnValue(of([]));

      component.removeMember(memberRow);

      expect(memberServiceSpy.remove).toHaveBeenCalledWith('p1', memberRow.id);
      expect(memberServiceSpy.list).toHaveBeenCalled();
    });

    it('sets error on failure', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      component.members.set(members);
      const memberRow = component.rows()[0];
      memberServiceSpy.remove.and.returnValue(throwError(() => new Error('remove failed')));

      component.removeMember(memberRow);

      expect(component.error()).toBe('remove failed');
    });
  });
});
