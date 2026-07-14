import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SettingsPage, type SettingsTab } from '@/components/pages/_app';

const settingsSearchSchema = z.object({
  tab: z.enum(['profile', 'appearance']).optional()
});

export const Route = createFileRoute('/_app/settings')({
  component: SettingsRoute,
  validateSearch: settingsSearchSchema
});

function SettingsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = search.tab ?? 'profile';

  const handleTabChange = (tab: SettingsTab) => {
    void navigate({
      to: '/settings',
      search: { tab: tab === 'profile' ? undefined : tab }
    });
  };

  return <SettingsPage activeTab={activeTab} onTabChange={handleTabChange} />;
}
