import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError, map } from 'rxjs';
import { Router } from '@angular/router';

export type GlobalRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type ProjectRole = 'ADMIN' | 'QA_LEAD' | 'MEMBRE' | 'OBSERVATEUR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
}

export interface ProjectAccess {
  projectId: string;
  projectName: string;
  projectStatus: string;
  role: ProjectRole;
  permissions: string[];
}

export interface Session {
  user: AuthUser;
  projects: ProjectAccess[];
  token?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const STORAGE_KEY = 'aq-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = 'http://localhost:3000/api';

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _projects = signal<ProjectAccess[]>([]);
  private readonly _token = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly projects = this._projects.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isSuperAdmin = computed(() => this._user()?.globalRole === 'SUPER_ADMIN');
  readonly isAdmin = computed(() => this._user()?.globalRole === 'ADMIN' || this.isSuperAdmin());

  constructor(private http: HttpClient, private router: Router) {
    this.restoreFromStorage();
  }

  getToken(): string | null {
    return this._token();
  }

  /** Permissions de l'utilisateur pour un projet donné (résolues côté backend). */
  permissionsFor(projectId: string | null | undefined): string[] {
    if (!projectId) return [];
    return this._projects().find((p) => p.projectId === projectId)?.permissions ?? [];
  }

  hasPermission(projectId: string | null | undefined, code: string): boolean {
    if (this.isSuperAdmin()) return true;
    return this.permissionsFor(projectId).includes(code);
  }

  login(email: string, password: string): Observable<Session> {
    return this.http
      .post<ApiResponse<Session>>(`${this.baseUrl}/auth/login`, { email, password })
      .pipe(
        tap((res) => this.applySession(res.data)),
        map((res) => res.data),
        catchError(this.handleError)
      );
  }

  refreshSession(): Observable<Session> {
    return this.http.get<ApiResponse<Session>>(`${this.baseUrl}/auth/me`).pipe(
      tap((res) => this.applySession(res.data)),
      map((res) => res.data),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    this._user.set(null);
    this._projects.set([]);
    this._token.set(null);
    localStorage.removeItem(STORAGE_KEY);
    this.router.navigate(['/auth/login']);
  }

  /**
   * Applique une session obtenue par un autre endpoint que /auth/login
   * (ex: acceptation d'invitation, qui retourne le même format `Session`).
   */
  applyExternalSession(session: Session): void {
    this.applySession(session);
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  private applySession(session: Session): void {
    this._user.set(session.user);
    this._projects.set(session.projects || []);
    if (session.token) this._token.set(session.token);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: session.user, projects: session.projects, token: this._token() })
    );
  }

  private restoreFromStorage(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      this._user.set(parsed.user ?? null);
      this._projects.set(parsed.projects ?? []);
      this._token.set(parsed.token ?? null);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private handleError(error: HttpErrorResponse) {
    const message =
      error.error?.message ||
      error.error?.errors?.map((e: any) => e.msg).join(', ') ||
      'Une erreur réseau est survenue';
    return throwError(() => new Error(message));
  }
}
