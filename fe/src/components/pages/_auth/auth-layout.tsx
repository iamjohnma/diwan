import { GoogleOAuthProvider } from '@react-oauth/google';
import { Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import authShaderSrc from '@/assets/pages/_auth/shadow-shader.webp';
import { GuestLanguageToggle } from '@/components/pages/_auth/guest-language-toggle';
import { appEnv } from '@/config/env';
import { getGoogleLocale } from '@/utils/common/google-sign-in';

export function AuthLayout() {
  const translation = useTranslation();
  const googleLocale = getGoogleLocale(translation.i18n.language);
  const content = (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background-base font-sans text-text-primary">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${authShaderSrc}")` }}
        />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${authShaderSrc}")` }}
        />
        <div
          className="absolute inset-0 scale-y-[-1] bg-cover bg-center bg-no-repeat opacity-60"
          style={{ backgroundImage: `url("${authShaderSrc}")` }}
        />
        <div className="absolute inset-0 bg-primary-light/20 mix-blend-multiply" />
      </div>
      <div className="absolute start-3 top-3 z-20">
        <GuestLanguageToggle />
      </div>
      <div className="relative z-10 flex w-full justify-center py-8">
        <Outlet />
      </div>
    </main>
  );

  return appEnv.VITE_ENABLE_GOOGLE_OAUTH ? (
    <GoogleOAuthProvider
      key={googleLocale}
      clientId={appEnv.VITE_GOOGLE_OAUTH_CLIENT_ID}
      locale={googleLocale}
    >
      {content}
    </GoogleOAuthProvider>
  ) : (
    content
  );
}
