import * as React from 'react';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { usePopoverMode } from '@/components/ui/popover';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { assignRef } from '@/utils/common/assign-ref';
import { focusAutoFocusTarget } from '@/utils/common/can-auto-focus';
import { cn } from '@/utils/common/cn';

interface SearchFieldProps {
  value: string;
  onValueChange: (value: string) => void;

  placeholder?: string;
  /**
   * Leading icon. When omitted, a magnifier is shown automatically in sheet
   * (flush) mode and nothing is shown in panel mode — so dropdown searches stay
   * icon-less on desktop while bottom-sheet searches get the magnifier. Pass an
   * explicit node to force an icon in both modes, or `null` to force none.
   */
  icon?: React.ReactNode;

  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  type?: string;
  autoComplete?: string;
  spellCheck?: boolean;

  isLoading?: boolean;
  showClear?: boolean;
  onClear?: () => void;
  clearLabel?: string;

  /**
   * Renders flush at the top of a bottom sheet (no top padding, comfortable
   * height, magnifier). Defaults to auto-detecting drawer mode from the
   * surrounding Popover; pass explicitly when used outside a Popover (e.g. a bare
   * Drawer).
   */
  flush?: boolean;
  containerClassName?: string;
  inputClassName?: string;
}

export function SearchField(props: SearchFieldProps) {
  const {
    value,
    onValueChange,
    placeholder,
    icon,
    inputRef,
    autoFocus,
    onKeyDown,
    onBlur,
    inputMode,
    type = 'text',
    autoComplete = 'off',
    spellCheck = false,
    isLoading,
    showClear,
    onClear,
    clearLabel,
    flush,
    containerClassName,
    inputClassName
  } = props;

  const touchScreen = useTouchScreen();
  const popoverMode = usePopoverMode();
  const isFlush = flush ?? popoverMode === 'drawer';
  const hasTouchUi = touchScreen.hasTouchCapability;

  const localRef = React.useRef<HTMLInputElement>(null);
  const setRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node;
      assignRef(inputRef, node);
    },
    [inputRef]
  );

  const resolvedIcon =
    icon !== undefined ? (
      icon
    ) : isFlush ? (
      <MagnifyingGlassIcon weight="regular" />
    ) : null;

  const trailing = isLoading ? (
    <LoadingSpinner removePadding className="size-4 shrink-0" />
  ) : showClear && value ? (
    <button
      type="button"
      aria-label={clearLabel}
      className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-background-muted hover:text-text-primary"
      onClick={() => {
        onValueChange('');
        onClear?.();
        focusAutoFocusTarget(localRef.current);
      }}
    >
      <XIcon className="size-3.5" weight="bold" />
    </button>
  ) : null;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border-default',
        isFlush ? 'h-15 px-4' : cn('px-3 py-2.5', hasTouchUi && 'min-h-14'),
        containerClassName
      )}
    >
      {resolvedIcon ? (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center',
            isFlush
              ? 'text-text-secondary [&>svg]:size-5'
              : 'text-text-tertiary [&>svg]:size-4'
          )}
        >
          {resolvedIcon}
        </span>
      ) : null}
      <input
        ref={setRef}
        type={type}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        inputMode={inputMode}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary',
          isFlush ? 'text-lg' : cn('text-sm', hasTouchUi && 'text-base'),
          inputClassName
        )}
      />
      {trailing}
    </div>
  );
}
