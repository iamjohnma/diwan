import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui';

export function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="full-center flex min-h-dvh bg-background-base p-app-lg">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>{t('errors.notFoundPage.title')}</CardTitle>
          <CardDescription>
            {t('errors.notFoundPage.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            className="text-sm font-medium text-primary hover:underline"
            to="/"
          >
            {t('errors.notFoundPage.backHome')}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
