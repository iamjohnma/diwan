import { type ComponentProps, type ReactNode, useState } from 'react';
import {
  ChecksIcon,
  EyeIcon,
  EyeSlashIcon,
  InfoIcon
} from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function AuthPageWrapper(props: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex w-full flex-col gap-y-4 rounded-lg px-4 sm:w-96 sm:gap-y-6 sm:px-0',
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

export function AuthPageHeader(props: {
  title: string;
  subtitle?: ReactNode;
  subtitleClassName?: string;
}) {
  return (
    <div className="mb-2 text-center">
      <h1 className="font-display text-4xl tracking-tight text-text-primary">
        {props.title}
      </h1>
      {props.subtitle == null ? null : (
        <p
          className={cn(
            'mt-1 text-xl text-text-primary',
            props.subtitleClassName
          )}
        >
          {props.subtitle}
        </p>
      )}
    </div>
  );
}

export function AuthTranslatedPageHeader(props: { translationPrefix: string }) {
  const translation = useTranslation();
  const t = translation.t;
  return (
    <AuthPageHeader
      title={t(`${props.translationPrefix}.title` as never)}
      subtitle={t(`${props.translationPrefix}.subtitle` as never)}
    />
  );
}

export function AuthLinkFooter(props: {
  to: '/sign-in' | '/sign-up';
  prompt?: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-y-8">
      <p className="flex h-6 items-center justify-center text-center text-sm leading-6 text-text-tertiary">
        {props.prompt ? <>{props.prompt}&nbsp;</> : null}
        <Link
          to={props.to}
          className="inline font-medium text-text-primary opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
        >
          {props.label}
        </Link>
      </p>
    </div>
  );
}

type AuthPasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'> & {
  showStrength?: boolean;
};

export function AuthPasswordInput(props: AuthPasswordInputProps) {
  const translation = useTranslation();
  const t = translation.t;
  const [visible, setVisible] = useState(false);
  const { showStrength, value, ...inputProps } = props;
  const password = typeof value === 'string' ? value : '';
  const rules = [
    {
      label: t('common.passwordStrength.minLength'),
      passed: password.length >= 8
    },
    {
      label: t('common.passwordStrength.numbers'),
      passed: /\d/.test(password)
    },
    {
      label: t('common.passwordStrength.specialSymbols'),
      passed: /[^A-Za-z0-9]/.test(password)
    }
  ];
  const eye = password ? (
    <button
      type="button"
      tabIndex={-1}
      aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
      className="flex cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:text-text-primary"
      onClick={() => setVisible((current) => !current)}
    >
      {visible ? (
        <EyeSlashIcon className="size-[18px]" />
      ) : (
        <EyeIcon className="size-[18px]" />
      )}
    </button>
  ) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Input
        {...inputProps}
        value={value}
        type={visible ? 'text' : 'password'}
        prefixIcon={document.documentElement.dir === 'rtl' ? eye : undefined}
        suffixIcon={document.documentElement.dir === 'rtl' ? undefined : eye}
      />
      {showStrength ? (
        <ul className="mb-0 flex list-none flex-row flex-wrap gap-2 ps-0">
          {rules.map((rule) => {
            const RuleIcon = rule.passed ? ChecksIcon : InfoIcon;
            return (
              <li
                key={rule.label}
                className={cn(
                  'inline-flex h-7 min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium transition-colors',
                  rule.passed
                    ? 'bg-success-bg text-success'
                    : 'bg-background-elevated text-text-secondary'
                )}
              >
                <RuleIcon className="size-4 shrink-0" />
                <span className="leading-none">{rule.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function AuthVerificationFooter(props: {
  prompt: string;
  resendLabel: string;
  unavailableLabel: string;
  secondsRemaining: number;
  isResending: boolean;
  onResend: () => void;
}) {
  const coolingDown = props.secondsRemaining > 0;
  const countdownLabel = `${props.resendLabel} (${props.secondsRemaining})`;
  return (
    <p className="flex h-6 items-center justify-center gap-x-1 text-center text-sm leading-6 text-text-tertiary">
      {coolingDown ? (
        <>
          <span>{props.prompt}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled
            className="h-6 min-h-6 p-0 text-sm font-medium text-text-primary opacity-80"
          >
            {countdownLabel}
          </Button>
        </>
      ) : (
        <>
          <span>{props.prompt || props.unavailableLabel}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={props.isResending}
            loading={props.isResending}
            onClick={props.onResend}
            className="h-6 min-h-6 p-0 text-sm font-medium text-text-primary opacity-80 hover:no-underline"
          >
            {props.resendLabel}
          </Button>
        </>
      )}
    </p>
  );
}
