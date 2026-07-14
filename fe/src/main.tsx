import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import './styles.css';
import { RootProviders } from '@/components/core';
import { whenI18nReady } from '@/integrations/i18n/config';
import { router } from '@/lib/routing/app-router';
import { hydrateStoredPrimaryColor } from '@/utils/common/apply-preferences';

hydrateStoredPrimaryColor();

const rootElement = document.querySelector<HTMLDivElement>('#root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

async function mountApp() {
  await whenI18nReady();

  createRoot(rootElement!).render(
    <StrictMode>
      <RootProviders>
        <RouterProvider router={router} />
      </RootProviders>
    </StrictMode>
  );
}

void mountApp();
