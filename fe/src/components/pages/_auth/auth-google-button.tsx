import type { CredentialResponse } from '@react-oauth/google';
import { GoogleLogin } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { appEnv } from '@/config/env';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.94A6 6 0 0 1 6.1 12c0-.67.12-1.33.32-1.94V7.44H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.56l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.94 5.44l3.35 2.62C7.2 7.7 9.4 5.94 12 5.94Z"
      />
    </svg>
  );
}

export function AuthGoogleButton(props: {
  mode: 'signIn' | 'signUp';
  disabled: boolean;
  loading: boolean;
  onSuccess: (response: CredentialResponse) => void;
  onError: () => void;
}) {
  const translation = useTranslation();
  if (!appEnv.VITE_ENABLE_GOOGLE_OAUTH) return null;
  const prefix = props.mode === 'signIn' ? 'signIn' : 'signUp';

  return (
    <>
      <div className="flex items-center gap-3 text-xs font-medium text-text-tertiary">
        <span className="h-px flex-1 bg-border-default" />
        <span>{translation.t(`${prefix}.formContent.separator` as never)}</span>
        <span className="h-px flex-1 bg-border-default" />
      </div>
      <div className="relative w-full">
        <Button
          type="button"
          variant="outline"
          size="lgTall"
          layout="full"
          className="pointer-events-none border-border-default text-sm font-medium"
          disabled={props.disabled}
          loading={props.loading}
          prefixIcon={<GoogleIcon />}
        >
          {translation.t(`${prefix}.formContent.googleButton` as never)}
        </Button>
        {!props.disabled && !props.loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden opacity-0 [&>div]:h-full [&>div]:w-full">
            <GoogleLogin
              onSuccess={props.onSuccess}
              onError={props.onError}
              auto_select={false}
              theme="outline"
              size="large"
              text={props.mode === 'signIn' ? 'signin_with' : 'continue_with'}
              shape="rectangular"
              logo_alignment="left"
              width="400"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
