import { createFileRoute } from '@tanstack/react-router';
import { CasesPage } from '@/components/pages/_app';

export const Route = createFileRoute('/_app/cases')({
  component: CasesPage
});
