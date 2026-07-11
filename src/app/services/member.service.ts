import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError, map } from 'rxjs';

export type ProjectRole = 'ADMIN' | 'QA_LEAD' | 'MEMBRE' | 'OBSERVATEUR';

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  createdAt: string;
  user: { id: string; email: string; name: string };
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: ProjectRole;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  list(projectId: string): Observable<ProjectMember[]> {
    return this.http
      .get<ApiResponse<ProjectMember[]>>(`${this.baseUrl}/projects/${projectId}/members`)
      .pipe(map((res) => res.data), catchError(this.handleError));
  }

  listInvitations(projectId: string): Observable<PendingInvitation[]> {
    return this.http
      .get<ApiResponse<PendingInvitation[]>>(`${this.baseUrl}/projects/${projectId}/members/invitations`)
      .pipe(map((res) => res.data), catchError(this.handleError));
  }

  invite(projectId: string, email: string, role: ProjectRole): Observable<ApiResponse<any>> {
    return this.http
      .post<ApiResponse<any>>(`${this.baseUrl}/projects/${projectId}/members/invitations`, { email, role })
      .pipe(catchError(this.handleError));
  }

  revokeInvitation(projectId: string, invitationId: string): Observable<ApiResponse<any>> {
    return this.http
      .delete<ApiResponse<any>>(`${this.baseUrl}/projects/${projectId}/members/invitations/${invitationId}`)
      .pipe(catchError(this.handleError));
  }

  updateRole(projectId: string, memberId: string, role: ProjectRole): Observable<ApiResponse<any>> {
    return this.http
      .patch<ApiResponse<any>>(`${this.baseUrl}/projects/${projectId}/members/${memberId}`, { role })
      .pipe(catchError(this.handleError));
  }

  remove(projectId: string, memberId: string): Observable<ApiResponse<any>> {
    return this.http
      .delete<ApiResponse<any>>(`${this.baseUrl}/projects/${projectId}/members/${memberId}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message =
      error.error?.message ||
      error.error?.errors?.map((e: any) => e.msg).join(', ') ||
      'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}
