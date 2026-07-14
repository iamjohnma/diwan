import type { TFunction } from 'i18next';
import { z } from 'zod';

const passwordRules = (schema: z.ZodString, t: TFunction, prefix: string) =>
  schema
    .min(8, { message: t(`${prefix}.passwordMin` as never) })
    .max(128, { message: t(`${prefix}.passwordMax` as never) })
    .regex(/\d/, { message: t(`${prefix}.passwordNumber` as never) })
    .regex(/[^A-Za-z0-9]/, {
      message: t(`${prefix}.passwordSpecialSymbol` as never)
    });

const emailField = (t: TFunction, prefix: string) =>
  z
    .string()
    .trim()
    .min(1, { message: t(`${prefix}.emailRequired` as never) })
    .email({ message: t(`${prefix}.emailInvalid` as never) });

export function createSignInSchema(t: TFunction) {
  return z.object({
    email: emailField(t, 'signIn.validation'),
    password: z
      .string()
      .min(1, { message: t('signIn.validation.passwordRequired') })
  });
}

export function createSignUpSchema(t: TFunction) {
  return z.object({
    firstName: z
      .string()
      .trim()
      .min(2, { message: t('signUp.validation.firstNameMin') })
      .max(50, { message: t('signUp.validation.firstNameMax') }),
    lastName: z
      .string()
      .trim()
      .min(2, { message: t('signUp.validation.lastNameMin') })
      .max(50, { message: t('signUp.validation.lastNameMax') }),
    email: emailField(t, 'signUp.validation').max(255, {
      message: t('signUp.validation.emailMax')
    }),
    password: passwordRules(
      z.string().min(1, { message: t('signUp.validation.passwordRequired') }),
      t,
      'signUp.validation'
    )
  });
}

export function createForgotPasswordSchema(t: TFunction) {
  return z.object({ email: emailField(t, 'forgotPassword.validation') });
}

export function createOtpSchema(t: TFunction) {
  return z.object({
    code: z
      .string()
      .trim()
      .length(5, { message: t('verifyOtp.validation.codeLength') })
      .regex(/^\d+$/, { message: t('verifyOtp.validation.codeNumeric') })
  });
}

export function createSetNewPasswordSchema(t: TFunction) {
  return z
    .object({
      password: passwordRules(
        z.string().min(1, {
          message: t('setNewPassword.validation.passwordRequired')
        }),
        t,
        'setNewPassword.validation'
      ),
      confirmPassword: z.string().min(1, {
        message: t('setNewPassword.validation.confirmPasswordRequired')
      })
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ['confirmPassword'],
      message: t('setNewPassword.validation.passwordsMustMatch')
    });
}

export type SignInValues = z.infer<ReturnType<typeof createSignInSchema>>;
export type SignUpValues = z.infer<ReturnType<typeof createSignUpSchema>>;
export type ForgotPasswordValues = z.infer<
  ReturnType<typeof createForgotPasswordSchema>
>;
export type OtpValues = z.infer<ReturnType<typeof createOtpSchema>>;
export type SetNewPasswordValues = z.infer<
  ReturnType<typeof createSetNewPasswordSchema>
>;
