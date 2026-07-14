import { DotIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton
} from '@/components/ui';
import {
  getNavigationPageTitle,
  type NavigationPageKey
} from '@/constants/core/navigation-links';
import { useDocumentTitle } from '@/hooks/core';

interface PlaceholderPageProps {
  titleKey: NavigationPageKey;
  items?: readonly string[];
}

function PlaceholderSkeletons() {
  return (
    <>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </>
  );
}

interface PlaceholderItemsListProps {
  items: readonly string[];
}

function PlaceholderItemsList(props: PlaceholderItemsListProps) {
  return (
    <ul className="flex flex-col">
      {props.items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-x-app-xs border-b border-border-subtle py-app-sm text-sm text-text-primary last:border-b-0"
        >
          <DotIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-primary"
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

// Stand-in for feature pages that exist in navigation but whose modules are
// not implemented yet; keeps every sidebar destination a real, typed route.
export function PlaceholderPage(props: PlaceholderPageProps) {
  const { t } = useTranslation();
  const title = getNavigationPageTitle(t, props.titleKey);
  useDocumentTitle(title);

  return (
    <section
      aria-labelledby="placeholder-page-title"
      className="flex flex-col gap-y-app-lg p-app-lg"
    >
      <h1 className="text-2xl text-text-primary" id="placeholder-page-title">
        {title}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>
            {t('placeholderPage.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-app-sm">
          {props.items && props.items.length > 0 ? (
            <PlaceholderItemsList items={props.items} />
          ) : (
            <PlaceholderSkeletons />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
