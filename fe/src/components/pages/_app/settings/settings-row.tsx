import { type MouseEvent, type ReactNode, useRef } from 'react';
import { TruncateText } from '@/components/common/truncate-text';
import { cn } from '@/lib/utils';
import {
  SETTINGS_ROW_INTERACTIVE_CLASS,
  activateRowControl,
  isInteractiveClickTarget
} from '@/utils/common/settings-row-activation';

interface RowActivationProps {
  onActivate?: () => void;
  interactiveRow?: boolean;
}

interface SettingsDescriptionRowProps extends RowActivationProps {
  title: string;
  description?: string;
  children?: ReactNode;
  bordered?: boolean;
  compact?: boolean;
}

export function SettingsDescriptionRow(props: SettingsDescriptionRowProps) {
  const controlRef = useRef<HTMLDivElement>(null);
  const isRowInteractive =
    (props.interactiveRow ?? true) &&
    (!!props.onActivate || props.children !== undefined);
  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isInteractiveClickTarget(event.target)) return;

    if (props.onActivate) {
      props.onActivate();

      return;
    }

    activateRowControl(controlRef.current);
  };

  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-3 overflow-hidden sm:gap-4',
        props.bordered
          ? 'border-b border-border-default py-3 last:border-b-0 md:py-4'
          : props.compact
            ? 'py-2 md:py-3'
            : 'py-2.5 md:py-5',
        isRowInteractive && SETTINGS_ROW_INTERACTIVE_CLASS
      )}
      onClick={isRowInteractive ? handleRowClick : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-y-0.5 overflow-hidden">
        <TruncateText className="text-xs font-medium text-text-primary md:text-sm">
          {props.title}
        </TruncateText>
        {props.description ? (
          <TruncateText className="text-xs text-text-secondary md:text-sm">
            {props.description}
          </TruncateText>
        ) : null}
      </div>
      {props.children ? (
        <div ref={controlRef} className="flex shrink-0 items-center gap-3">
          {props.children}
        </div>
      ) : null}
    </div>
  );
}

interface SettingsValueRowProps extends RowActivationProps {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}

export function SettingsValueRow(props: SettingsValueRowProps) {
  const actionRef = useRef<HTMLDivElement>(null);
  const isRowInteractive =
    (props.interactiveRow ?? true) &&
    (!!props.onActivate || props.action !== undefined);
  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isInteractiveClickTarget(event.target)) return;

    if (props.onActivate) {
      props.onActivate();

      return;
    }

    activateRowControl(actionRef.current);
  };

  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-border-default py-3 last:border-b-0 md:gap-4 md:py-4',
        isRowInteractive && SETTINGS_ROW_INTERACTIVE_CLASS
      )}
      onClick={isRowInteractive ? handleRowClick : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
        <TruncateText className="text-xs text-text-secondary md:text-sm">
          {props.label}
        </TruncateText>
        <div className="min-w-0 overflow-hidden text-sm text-text-primary md:text-base">
          {props.value}
        </div>
      </div>
      {props.action ? (
        <div ref={actionRef} className="shrink-0">
          {props.action}
        </div>
      ) : null}
    </div>
  );
}
