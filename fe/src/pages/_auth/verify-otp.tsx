import { useEffect, useMemo, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Form } from '@/components/common/form-wrapper';
import {
  AuthOtpInput,
  AuthPageHeader,
  AuthPageWrapper,
  AuthVerificationFooter
} from '@/components/pages/_auth';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage
} from '@/components/ui/form';
import { handleError } from '@/lib/errors';
import { type OtpValues, createOtpSchema } from '@/schemas/pages/_auth/auth';
import {
  persistOtpCooldown,
  readOtpCooldown,
  writeResetPasswordContext
} from '@/utils/core/auth/auth-flow';

export function VerifyOtpPage(props: {
  email: string;
  type: 'email-verification' | 'reset-password';
}) {
  const translation = useTranslation();
  const t = translation.t;
  const navigate = useNavigate();
  const authActions = useAuthActions();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [availableAt, setAvailableAt] = useState(() =>
    readOtpCooldown(props.type, props.email)
  );
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const schema = useMemo(() => createOtpSchema(t), [t]);
  const form = useForm<OtpValues>({
    defaultValues: { code: '' },
    resolver: zodResolver(schema),
    mode: 'onSubmit'
  });

  useEffect(() => {
    const update = () =>
      setSecondsRemaining(
        availableAt
          ? Math.max(0, Math.ceil((availableAt - Date.now()) / 1000))
          : 0
      );
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [availableAt]);

  const verify = async (code: string) => {
    if (code.length !== 5 || isVerifying) return;
    if (props.type === 'reset-password') {
      writeResetPasswordContext({ email: props.email, code });
      await navigate({
        to: '/set-new-password',
        search: { email: undefined, otp: undefined },
        replace: true
      });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await authActions.signIn('password', {
        email: props.email,
        code,
        flow: 'email-verification'
      });
      if (!result.signingIn) throw new Error('INVALID_VERIFICATION_CODE');
    } catch (error) {
      handleError(error);
      form.reset({ code: '' });
      setIsVerifying(false);
    }
  };

  const onResend = async () => {
    setIsResending(true);
    try {
      await authActions.signIn('password', {
        email: props.email,
        flow: props.type === 'reset-password' ? 'reset' : 'email-verification'
      });
      setAvailableAt(persistOtpCooldown(props.type, props.email));
    } catch (error) {
      handleError(error);
    } finally {
      setIsResending(false);
    }
  };

  const flowKey =
    props.type === 'reset-password' ? 'resetPassword' : 'emailVerification';
  return (
    <AuthPageWrapper className="lg:w-[28rem]">
      <AuthPageHeader
        title={t(`verifyOtp.pageHeader.${flowKey}.title`)}
        subtitle={
          <Trans
            i18nKey={`verifyOtp.pageHeader.${flowKey}.subtitle`}
            values={{ email: props.email }}
            components={{
              email: <span dir="ltr" className="inline whitespace-nowrap" />
            }}
          />
        }
        subtitleClassName="text-base text-muted-foreground"
      />
      <Form
        form={form}
        onSubmit={(values) => verify(values.code)}
        className="flex flex-col gap-y-6"
      >
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem className="w-full items-center px-1 py-1">
              <FormControl>
                <AuthOtpInput
                  value={field.value}
                  disabled={isVerifying}
                  ariaLabel={t('verifyOtp.codeInputLabel')}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  onComplete={(code) => void verify(code)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <AuthVerificationFooter
          prompt={t('verifyOtp.pageFooter.resendPrompt')}
          resendLabel={t('verifyOtp.pageFooter.resendButton')}
          unavailableLabel={t('verifyOtp.pageFooter.resendUnavailable')}
          secondsRemaining={secondsRemaining}
          isResending={isResending}
          onResend={() => void onResend()}
        />
      </Form>
    </AuthPageWrapper>
  );
}
