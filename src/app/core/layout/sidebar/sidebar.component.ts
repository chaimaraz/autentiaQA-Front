import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgFor, NgClass, NgIf } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
  badgeClass?: string;
  /** Code de permission requis pour afficher cet item (omis = visible par tous les membres). */
  permission?: string;
}

interface NavGroup {
  label: string;
  icon: string;
  badge?: string;
  badgeClass?: string;
  children: NavItem[];
  open?: boolean;
  permission?: string;
}

interface NavSection {
  label: string;
  items: (NavItem | NavGroup)[];
}

function isGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'children' in item;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrateur',
  USER: 'Utilisateur',
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgFor, NgClass, NgIf],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);

  isGroup = isGroup;
  userDropdownOpen = signal(false);
  currentTheme = signal<'dark' | 'light'>('dark');

  userName = computed(() => this.auth.user()?.name ?? '');
  userRoleLabel = computed(() => ROLE_LABELS[this.auth.user()?.globalRole ?? 'USER'] ?? 'Utilisateur');
  userInitials = computed(() =>
    (this.auth.user()?.name ?? '')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );

  private allNavSections: NavSection[] = [
    {
      label: 'Général',
      items: [
        { label: 'Tableau de bord', icon: '⬡', route: '/dashboard' },
        { label: 'Projets', icon: '◫', route: '/projects', badge: '3', badgeClass: 'green' },
      ],
    },
    {
      label: 'Workflow Test',
      items: [
        { label: 'Nouveau projet', icon: '✦', route: '/projects/new' },
        { label: 'Scénarios IA', icon: '≡', route: '/scenarios', badge: '47', permission: 'SCENARIO_VIEW' },
        {
          label: 'Flux personnalisés',
          icon: '⟶',
          badge: '3',
          badgeClass: 'green',
          open: false,
          permission: 'SCENARIO_VIEW',
          children: [
            { label: 'Liste des flux', icon: '☰', route: '/flux/list' },
            { label: 'Créer un flux', icon: '+', route: '/flux/new', permission: 'SCENARIO_CREATE' },
          ],
        } as NavGroup,
        {
          label: 'Exécution',
          icon: '▷',
          badge: '1',
          badgeClass: 'orange',
          open: true,
          permission: 'EXECUTION_VIEW',
          children: [
            { label: 'En cours', icon: '▷', route: '/execution' },
            { label: 'Historique', icon: '📜', route: '/history', permission: 'REPORT_VIEW' },
          ],
        } as NavGroup,
      ],
    },
    {
      label: 'Tests Avancés',
      items: [
        { label: 'Performance', icon: '◈', route: '/performance', permission: 'PERFORMANCE_VIEW' },
        { label: 'Sécurité OWASP', icon: '⬡', route: '/security', permission: 'SECURITY_VIEW' },
      ],
    },
    {
      label: 'Intégration',
      items: [
        {
          label: 'Pipeline CI/CD',
          icon: '⎇',
          open: false,
          permission: 'GIT_CONFIG_MANAGE',
          children: [
            { label: 'Configuration Git', icon: '🔗', route: '/git-config' },
            { label: 'Ajouter un dépôt', icon: '+', route: '/git-config/add-config' },
          ],
        } as NavGroup,
        { label: 'Rapports', icon: '▦', route: '/reports', permission: 'REPORT_VIEW' },
        { label: 'Paramètres', icon: '◎', route: '/settings' },
      ],
    },
  ];

  /**
   * Sections filtrées selon les permissions de l'utilisateur (agrégées sur
   * l'ensemble de ses projets — un SUPER_ADMIN voit toujours tout).
   * Un item sans `permission` définie reste visible pour tout membre connecté.
   */
  navSections = computed<NavSection[]>(() => {
    const isSuperAdmin = this.auth.isSuperAdmin();
    const allPermissions = new Set(this.auth.projects().flatMap((p) => p.permissions));

    const isVisible = (perm?: string) => !perm || isSuperAdmin || allPermissions.has(perm);

    return this.allNavSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => isVisible(item.permission))
          .map((item) =>
            isGroup(item)
              ? { ...item, children: item.children.filter((c) => isVisible(c.permission)) }
              : item
          )
          // Un groupe sans enfant visible est masqué entièrement
          .filter((item) => !isGroup(item) || item.children.length > 0),
      }))
      .filter((section) => section.items.length > 0);
  });

  ngOnInit(): void {
    const saved = localStorage.getItem('aq-theme') as 'dark' | 'light' | null;
    this.setTheme(saved ?? 'dark');
  }

  toggleGroup(group: NavGroup): void {
    group.open = !group.open;
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aq-theme', theme);
  }

  toggleUserDropdown(): void {
    this.userDropdownOpen.update((v) => !v);
  }

  closeUserDropdown(): void {
    this.userDropdownOpen.set(false);
  }

  goToProfile(): void {
    this.closeUserDropdown();
    this.router.navigate(['/profile']);
  }

  goToSettings(): void {
    this.closeUserDropdown();
    this.router.navigate(['/settings']);
  }

  logout(): void {
    this.closeUserDropdown();
    this.auth.logout();
  }
}
