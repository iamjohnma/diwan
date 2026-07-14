import { useEffect, useMemo, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form } from '@/components/common/form-wrapper';
import {
  AuthFormField,
  AuthLinkFooter,
  AuthPageWrapper,
  AuthTranslatedPageHeader
} from '@/components/pages/_auth';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { handleError } from '@/lib/errors';
import {
  type ForgotPasswordValues,
  createForgotPasswordSchema
} from '@/schemas/pages/_auth/auth';
import {
  clearResetPasswordContext,
  persistOtpCooldown
} from '@/utils/core/auth/auth-flow';

export function ForgotPasswordPage() {
  const translation = useTranslation();
  const t = translation.t;
  const navigate = useNavigate();
  const authActions = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const schema = useMemo(() => createForgotPasswordSchema(t), [t]);
  const form = useForm<ForgotPasswordValues>({
    defaultValues: { email: '' },
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  useEffect(clearResetPasswordContext, []);

  const onSubmit = async (values: ForgotPasswordValues) => {
    setIsLoading(true);
    try {
      await authActions.signIn('password', {
        email: values.email,
        flow: 'reset'
      });
      persistOtpCooldown('reset-password', values.email);
      await navigate({
        to: '/verify-otp',
        search: { email: values.email, type: 'reset-password' },
        replace: true
      });
    } catch (error) {
      handleError(error);
      setIsLoading(false);
    }
  };

  return (
    <AuthPageWrapper>
      <AuthTranslatedPageHeader translationPrefix="forgotPassword.pageHeader" />
      <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <AuthFormField label={t('forgotPassword.formContent.emailLabel')}>
              <Input
                {...field}
                type="email"
                autoComplete="email"
                autoFocus
                placeholder={t('forgotPassword.formContent.emailPlaceholder')}
                disabled={isLoading}
              />
            </AuthFormField>
          )}
        />
        <Button
          type="submit"
          variant="primary"
          size="lgTall"
          layout="full"
          className="font-medium"
          disabled={isLoading}
          loading={isLoading}
        >
          {t('forgotPassword.formContent.submitButton')}
        </Button>
      </Form>
      <AuthLinkFooter
        to="/sign-in"
        label={t('forgotPassword.formFooter.backToSignIn')}
      />
    </AuthPageWrapper>
  );
}
