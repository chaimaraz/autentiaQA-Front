import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgFor, NgClass, NgIf } from '@angular/common';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
  badgeClass?: string;
}

interface NavGroup {
  label: string;
  icon: string;
  badge?: string;
  badgeClass?: string;
  children: NavItem[];
  open?: boolean;
}

interface NavSection {
  label: string;
  items: (NavItem | NavGroup)[];
}

function isGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'children' in item;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgFor, NgClass, NgIf],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);

  isGroup = isGroup;
  userDropdownOpen = signal(false);
  currentTheme = signal<'dark' | 'light'>('dark');

  navSections: NavSection[] = [
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
        { label: 'Scénarios IA', icon: '≡', route: '/scenarios', badge: '47' },
        {
          label: 'Flux personnalisés',
          icon: '⟶',
          badge: '3',
          badgeClass: 'green',
          open: false,
          children: [
            { label: 'Liste des flux', icon: '☰', route: '/flux/list' },
            { label: 'Créer un flux', icon: '+', route: '/flux/new' },
          ],
        } as NavGroup,
        {
          label: 'Exécution',
          icon: '▷',
          badge: '1',
          badgeClass: 'orange',
          open: true,
          children: [
            { label: 'En cours', icon: '▷', route: '/execution' },
            { label: 'Historique', icon: '📜', route: '/history' },
          ],
        } as NavGroup,
      ],
    },
    {
      label: 'Tests Avancés',
      items: [
        { label: 'Performance', icon: '◈', route: '/performance' },
        { label: 'Sécurité OWASP', icon: '⬡', route: '/security' },
      ],
    },
    {
      label: 'Intégration',
      items: [
        {
          label: 'Pipeline CI/CD',
          icon: '⎇',
          open: false,
          children: [
            { label: 'Vue d\'ensemble', icon: '◎', route: '/reports' },
            { label: 'Configurer CI/CD', icon: '⚙', route: '/settings' },
          ],
        } as NavGroup,
        { label: 'Rapports', icon: '▦', route: '/reports' },
        { label: 'Paramètres', icon: '◎', route: '/settings' },
      ],
    },
  ];

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
    this.userDropdownOpen.update(v => !v);
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
    this.router.navigate(['/auth/login']);
  }
}
