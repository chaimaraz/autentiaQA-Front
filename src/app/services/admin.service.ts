import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError, map } from 'rxjs';
import { GlobalRole } from './auth.service';

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  listUsers(): Observable<PlatformUser[]> {
    return this.http
      .get<ApiResponse<PlatformUser[]>>(`${this.baseUrl}/admin/users`)
      .pipe(map((res) => res.data), catchError(this.handleError));
  }

  createAdmin(email: string, name: string, password: string): Observable<ApiResponse<PlatformUser>> {
    return this.http
      .post<ApiResponse<PlatformUser>>(`${this.baseUrl}/admin/admins`, { email, name, password })
      .pipe(catchError(this.handleError));
  }

  setGlobalRole(userId: string, globalRole: GlobalRole): Observable<ApiResponse<PlatformUser>> {
    return this.http
      .patch<ApiResponse<PlatformUser>>(`${this.baseUrl}/admin/users/${userId}/role`, { globalRole })
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
