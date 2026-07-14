import { useMemo, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form } from '@/components/common/form-wrapper';
import {
  AuthFormField,
  AuthGoogleButton,
  AuthLinkFooter,
  AuthPageWrapper,
  AuthPasswordInput,
  AuthTranslatedPageHeader
} from '@/components/pages/_auth';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { handleError } from '@/lib/errors';
import {
  type SignInValues,
  createSignInSchema
} from '@/schemas/pages/_auth/auth';
import { takeSignInEmail } from '@/utils/core/auth/auth-flow';

export function SignInPage() {
  const translation = useTranslation();
  const t = translation.t;
  const navigate = useNavigate();
  const authActions = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const schema = useMemo(() => createSignInSchema(t), [t]);
  const prefetchedEmail = useMemo(() => takeSignInEmail(), []);
  const form = useForm<SignInValues>({
    defaultValues: { email: prefetchedEmail, password: '' },
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  const onSubmit = async (values: SignInValues) => {
    setIsLoading(true);
    try {
      const result = await authActions.signIn('password', {
        ...values,
        flow: 'signIn'
      });
      if (!result.signingIn) {
        await navigate({
          to: '/verify-otp',
          search: { email: values.email, type: 'email-verification' },
          replace: true
        });
      }
    } catch (error) {
      handleError(error);
      setIsLoading(false);
    }
  };

  const onGoogleLogin: Parameters<
    typeof AuthGoogleButton
  >[0]['onSuccess'] = async (response) => {
    setIsGoogleLoading(true);
    try {
      if (!response.credential) throw new Error('GOOGLE_ID_TOKEN_REQUIRED');
      const result = await authActions.signIn('google', {
        idToken: response.credential
      });
      if (!result.signingIn) throw new Error('INVALID_GOOGLE_CREDENTIAL');
    } catch (error) {
      handleError(error);
      setIsGoogleLoading(false);
    }
  };

  const formDisabled = isLoading || isGoogleLoading;

  return (
    <AuthPageWrapper>
      <AuthTranslatedPageHeader translationPrefix="signIn.pageHeader" />
      <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-3">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <AuthFormField label={t('signIn.formContent.emailLabel')}>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  autoFocus={!prefetchedEmail}
                  placeholder={t('signIn.formContent.emailPlaceholder')}
                  disabled={formDisabled}
                />
              </AuthFormField>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <AuthFormField label={t('signIn.formContent.passwordLabel')}>
                <AuthPasswordInput
                  {...field}
                  autoComplete="current-password"
                  autoFocus={!!prefetchedEmail}
                  placeholder={t('signIn.formContent.passwordPlaceholder')}
                  disabled={formDisabled}
                />
              </AuthFormField>
            )}
          />
          <Link
            to="/forgot-password"
            className="-mt-1 w-fit text-sm font-medium text-primary opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
          >
            {t('signIn.formContent.forgotPassword')}
          </Link>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lgTall"
          layout="full"
          className="font-medium"
          disabled={formDisabled}
          loading={isLoading}
        >
          {t('signIn.formContent.submitButton')}
        </Button>
        <AuthGoogleButton
          mode="signIn"
          disabled={formDisabled}
          loading={isGoogleLoading}
          onSuccess={(response) => void onGoogleLogin(response)}
          onError={() => {
            setIsGoogleLoading(false);
            handleError(new Error('INVALID_GOOGLE_CREDENTIAL'));
          }}
        />
      </Form>
      <AuthLinkFooter
        to="/sign-up"
        prompt={t('signIn.formFooter.accountPrompt')}
        label={t('signIn.formFooter.actionLink')}
      />
    </AuthPageWrapper>
  );
}
