import { createFileRoute } from '@tanstack/react-router';
import { KanbanPage } from '@/components/pages/_app';

export const Route = createFileRoute('/_app/kanban')({
  component: KanbanPage
});
