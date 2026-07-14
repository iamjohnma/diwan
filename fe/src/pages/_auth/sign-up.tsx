import { useMemo, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
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
  type SignUpValues,
  createSignUpSchema
} from '@/schemas/pages/_auth/auth';
import { persistOtpCooldown } from '@/utils/core/auth/auth-flow';

export function SignUpPage() {
  const translation = useTranslation();
  const t = translation.t;
  const navigate = useNavigate();
  const authActions = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const schema = useMemo(() => createSignUpSchema(t), [t]);
  const form = useForm<SignUpValues>({
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  const onSubmit = async (values: SignUpValues) => {
    setIsLoading(true);
    try {
      await authActions.signIn('password', { ...values, flow: 'signUp' });
      persistOtpCooldown('email-verification', values.email);
      await navigate({
        to: '/verify-otp',
        search: { email: values.email, type: 'email-verification' },
        replace: true
      });
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
      <AuthTranslatedPageHeader translationPrefix="signUp.pageHeader" />
      <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-3">
          <div className="flex gap-x-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <AuthFormField label={t('signUp.formContent.firstNameLabel')}>
                  <Input
                    {...field}
                    autoFocus
                    placeholder={t('signUp.formContent.firstNamePlaceholder')}
                    disabled={formDisabled}
                  />
                </AuthFormField>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <AuthFormField label={t('signUp.formContent.lastNameLabel')}>
                  <Input
                    {...field}
                    placeholder={t('signUp.formContent.lastNamePlaceholder')}
                    disabled={formDisabled}
                  />
                </AuthFormField>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <AuthFormField label={t('signUp.formContent.emailLabel')}>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder={t('signUp.formContent.emailPlaceholder')}
                  disabled={formDisabled}
                />
              </AuthFormField>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <AuthFormField label={t('signUp.formContent.passwordLabel')}>
                <AuthPasswordInput
                  {...field}
                  showStrength
                  autoComplete="new-password"
                  maxLength={128}
                  placeholder={t('signUp.formContent.passwordPlaceholder')}
                  disabled={formDisabled}
                />
              </AuthFormField>
            )}
          />
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
          {t('signUp.formContent.submitButton')}
        </Button>
        <AuthGoogleButton
          mode="signUp"
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
        to="/sign-in"
        prompt={t('signUp.formFooter.accountPrompt')}
        label={t('signUp.formFooter.actionLink')}
      />
    </AuthPageWrapper>
  );
}
