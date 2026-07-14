import type { ReactNode } from 'react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { HotkeysProvider } from '@tanstack/react-hotkeys';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppMotionProvider } from '@/components/core/app-motion-provider';
import { RootErrorBoundary } from '@/components/core/error-fallbacks';
import { DialogLayerToaster, Toaster, TooltipProvider } from '@/components/ui';
import { useDialogSubmitHotkey, useOnlineStatusSync } from '@/hooks/core';
import { Provider as I18nProvider } from '@/integrations/i18n/root-provider';
import { convexClient, queryClient } from '@/lib/convex/client';

function GlobalBehaviors() {
  useOnlineStatusSync();
  useDialogSubmitHotkey();

  return null;
}

interface RootProvidersProps {
  children: ReactNode;
}

export function RootProviders(props: RootProvidersProps) {
  return (
    <RootErrorBoundary>
      <AppMotionProvider>
        <I18nProvider>
          <HotkeysProvider
            defaultOptions={{
              hotkey: {
                eventType: 'keydown',
                enabled: true,
                preventDefault: false,
                stopPropagation: false,
                requireReset: true,
                ignoreInputs: true,
                conflictBehavior: 'warn'
              }
            }}
          >
            <TooltipProvider delay={0}>
              <ConvexAuthProvider client={convexClient}>
                <QueryClientProvider client={queryClient}>
                  <GlobalBehaviors />
                  <Toaster />
                  <DialogLayerToaster />
                  {props.children}
                </QueryClientProvider>
              </ConvexAuthProvider>
            </TooltipProvider>
          </HotkeysProvider>
        </I18nProvider>
      </AppMotionProvider>
    </RootErrorBoundary>
  );
}
