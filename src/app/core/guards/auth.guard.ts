import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, GlobalRole } from '../../services/auth.service';

/** Bloque l'accès aux routes du shell si l'utilisateur n'est pas connecté. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  router.navigate(['/auth/login']);
  return false;
};

/** Fabrique un guard restreignant l'accès à certains rôles globaux (ex: SUPER_ADMIN). */
export function requireGlobalRoleGuard(...roles: GlobalRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.user() && roles.includes(auth.user()!.globalRole)) return true;

    router.navigate(['/dashboard']);
    return false;
  };
}
