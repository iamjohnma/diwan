import { useMemo, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Form } from '@/components/common/form-wrapper';
import {
  AuthFormField,
  AuthPageWrapper,
  AuthPasswordInput,
  AuthTranslatedPageHeader
} from '@/components/pages/_auth';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { handleError } from '@/lib/errors';
import {
  type SetNewPasswordValues,
  createSetNewPasswordSchema
} from '@/schemas/pages/_auth/auth';
import {
  clearResetPasswordContext,
  readResetPasswordContext,
  stashSignInEmail
} from '@/utils/core/auth/auth-flow';

export function SetNewPasswordPage() {
  const translation = useTranslation();
  const t = translation.t;
  const navigate = useNavigate();
  const authActions = useAuthActions();
  const resetContext = readResetPasswordContext();
  const [isLoading, setIsLoading] = useState(false);
  const schema = useMemo(() => createSetNewPasswordSchema(t), [t]);
  const form = useForm<SetNewPasswordValues>({
    defaultValues: { password: '', confirmPassword: '' },
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  const onSubmit = async (values: SetNewPasswordValues) => {
    if (!resetContext) {
      await navigate({ to: '/forgot-password', replace: true });
      return;
    }
    setIsLoading(true);
    try {
      const result = await authActions.signIn('password', {
        flow: 'reset-verification',
        email: resetContext.email,
        code: resetContext.code,
        newPassword: values.password
      });
      if (!result.signingIn) throw new Error('INVALID_VERIFICATION_CODE');
      await authActions.signOut();
      clearResetPasswordContext();
      stashSignInEmail(resetContext.email);
      toast.success(t('setNewPassword.success'));
      await navigate({ to: '/sign-in', replace: true });
    } catch (error) {
      handleError(error);
      setIsLoading(false);
    }
  };

  return (
    <AuthPageWrapper>
      <AuthTranslatedPageHeader translationPrefix="setNewPassword.pageHeader" />
      <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-3">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <AuthFormField
                label={t('setNewPassword.formContent.passwordLabel')}
              >
                <AuthPasswordInput
                  {...field}
                  showStrength
                  autoComplete="new-password"
                  autoFocus
                  placeholder={t(
                    'setNewPassword.formContent.passwordPlaceholder'
                  )}
                  disabled={isLoading}
                />
              </AuthFormField>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <AuthFormField
                label={t('setNewPassword.formContent.confirmPasswordLabel')}
              >
                <AuthPasswordInput
                  {...field}
                  autoComplete="new-password"
                  placeholder={t(
                    'setNewPassword.formContent.confirmPasswordPlaceholder'
                  )}
                  disabled={isLoading}
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
          disabled={isLoading}
          loading={isLoading}
        >
          {t('setNewPassword.formContent.submitButton')}
        </Button>
      </Form>
    </AuthPageWrapper>
  );
}
