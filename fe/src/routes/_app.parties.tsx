import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/components/pages/_app';
import { MOCK_PAGE_ITEMS } from '@/constants/pages/_app/mock-items';

export const Route = createFileRoute('/_app/parties')({
  component: () => (
    <PlaceholderPage titleKey="parties" items={MOCK_PAGE_ITEMS.parties} />
  )
});
