import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/components/pages/_app';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage
});
