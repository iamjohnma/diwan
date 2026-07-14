import type { ReactNode } from 'react';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';

export function AuthFormField(props: { label: string; children: ReactNode }) {
  return (
    <FormItem>
      <FormLabel>{props.label}</FormLabel>
      <FormControl>{props.children}</FormControl>
      <FormMessage />
    </FormItem>
  );
}

export function AuthOtpInput(props: {
  value: string;
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onComplete: (value: string) => void;
}) {
  const value = props.value.replace(/\D/g, '').slice(0, 5);
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <input
        autoFocus
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={5}
        aria-label={props.ariaLabel}
        disabled={props.disabled}
        value={value}
        onBlur={props.onBlur}
        onChange={(event) => {
          const next = event.currentTarget.value.replace(/\D/g, '').slice(0, 5);
          props.onChange(next);
          if (next.length === 5) props.onComplete(next);
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-text text-base opacity-0"
      />
      <div
        dir="ltr"
        aria-hidden="true"
        className="grid w-full grid-cols-5 gap-3 sm:gap-4"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const active = index === Math.min(value.length, 4);
          return (
            <span
              key={index}
              className={
                'flex aspect-square min-w-0 w-full items-center justify-center rounded-lg border bg-background-base p-0 text-2xl font-semibold text-text-primary shadow-xs transition-all duration-150 sm:text-3xl ' +
                (active
                  ? 'border-border-strong bg-background-elevated/70'
                  : 'border-border-default')
              }
            >
              {value[index] ?? ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
