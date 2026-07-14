import type { Icon } from '@phosphor-icons/react';
import type { AppRoute } from '@/constants/core/navigation-links';

export type CommandPaletteScope = 'root' | 'cases' | 'parties' | 'documents';

export interface CommandPaletteItem {
  id: string;
  icon: Icon;
  label: string;
  keywords: readonly string[];
  href: AppRoute;
  onOpenSubLevel?: () => void;
}

export interface CommandPaletteGroup {
  id: string;
  label: string;
  items: CommandPaletteItem[];
}
