import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError, map } from 'rxjs';
import { ProjectRole } from './member.service';

export interface PermissionItem {
  id: string;
  code: string;
  label: string;
  category: string;
  description?: string;
}

export type PermissionCatalogue = Record<string, PermissionItem[]>; // groupé par catégorie
export type PermissionMatrix = Record<ProjectRole, string[]>;

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  listCatalogue(): Observable<PermissionCatalogue> {
    return this.http
      .get<ApiResponse<PermissionCatalogue>>(`${this.baseUrl}/permissions`)
      .pipe(map((res) => res.data), catchError(this.handleError));
  }

  getMatrix(): Observable<PermissionMatrix> {
    return this.http
      .get<ApiResponse<PermissionMatrix>>(`${this.baseUrl}/permissions/matrix`)
      .pipe(map((res) => res.data), catchError(this.handleError));
  }

  setRolePermissions(role: ProjectRole, permissionCodes: string[]): Observable<ApiResponse<any>> {
    return this.http
      .put<ApiResponse<any>>(`${this.baseUrl}/permissions/roles/${role}`, { permissionCodes })
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
