import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScalesIcon } from '@phosphor-icons/react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui';
import { i18n } from '@/integrations/i18n/config';
import { cn } from '@/lib/utils';
import { getTextDirection } from '@/utils/common/text-direction';

interface ErrorMessageBlockProps {
  className?: string;
  contentClassName?: string;
  message: string;
}

function ErrorMessageBlock(props: ErrorMessageBlockProps) {
  return (
    <div
      dir={getTextDirection(props.message)}
      className={cn(
        'relative w-full min-w-0 rounded-md bg-background-surface p-3',
        props.className
      )}
    >
      <p
        className={cn(
          'm-0 font-mono text-xs whitespace-pre-wrap wrap-break-word text-text-tertiary',
          props.contentClassName
        )}
      >
        {props.message}
      </p>
    </div>
  );
}

interface ErrorFallbackScreenProps {
  error?: unknown;
  onRetry: () => void;
  actionLabel?: string;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : undefined;
}

function ErrorFallbackScreen(props: ErrorFallbackScreenProps) {
  const { t } = useTranslation();
  const errorMessage = getErrorMessage(props.error);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background-base p-6">
      <Empty className="w-full max-w-xl gap-6">
        <div className="flex flex-col items-center">
          <EmptyMedia variant="icon">
            <ScalesIcon
              weight="duotone"
              className="size-5 text-secondary-foreground"
            />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{t('errors.route.title')}</EmptyTitle>
            <EmptyDescription>{t('errors.route.description')}</EmptyDescription>
            {errorMessage ? (
              <ErrorMessageBlock message={errorMessage} className="mt-3 self-stretch" />
            ) : null}
          </EmptyHeader>
        </div>
        <div className="flex w-full max-w-sm">
          <Button layout="full" onClick={props.onRetry} variant="primary">
            {props.actionLabel ?? t('errors.route.retry')}
          </Button>
        </div>
      </Empty>
    </div>
  );
}

// TanStack Router's defaultErrorComponent: contains route-level render
// failures and offers an in-place retry without tearing down the shell.
export function RouteErrorFallback(props: ErrorComponentProps) {
  return (
    <ErrorFallbackScreen error={props.error} onRetry={props.reset} />
  );
}

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  error: unknown | null;
}

const cleanState: RootErrorBoundaryState = {
  error: null
};

// Last-resort boundary above the router: anything that escapes route
// boundaries lands here instead of a white screen.
export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  override state: RootErrorBoundaryState = cleanState;

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[RootErrorBoundary]', error, info.componentStack);
  }

  resetError = (): void => {
    this.setState(cleanState);
  };

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <ErrorFallbackScreen
          actionLabel={i18n.t('errors.route.reload')}
          error={this.state.error}
          onRetry={() => {
            this.resetError();
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}
