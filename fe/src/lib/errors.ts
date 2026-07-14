import { ConvexError } from 'convex/values';
import { toast } from '@/components/ui/sonner';
import { i18n } from '@/integrations/i18n/config';

const ERROR_CODE_KEYS = [
  'UNAUTHENTICATED',
  'NOT_A_FIRM_MEMBER',
  'INSUFFICIENT_PERMISSIONS',
  'INVALID_ACCOUNT_ID',
  'INVALID_PASSWORD',
  'INVALID_SECRET',
  'INVALID_CREDENTIALS',
  'INVALID_VERIFICATION_CODE',
  'INVALID_AUTH_FLOW',
  'EMAIL_REQUIRED',
  'PASSWORD_REQUIRED',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'PASSWORD_REQUIRES_NUMBER',
  'PASSWORD_REQUIRES_SPECIAL_SYMBOL',
  'NEW_PASSWORD_REQUIRED',
  'ACCOUNT_ALREADY_EXISTS',
  'ACCOUNT_DISABLED',
  'GOOGLE_OAUTH_NOT_CONFIGURED',
  'INVALID_GOOGLE_CREDENTIAL',
  'GOOGLE_ID_TOKEN_REQUIRED'
] as const;

type ErrorCodeKey = (typeof ERROR_CODE_KEYS)[number];

function isErrorCodeKey(code: string): code is ErrorCodeKey {
  return (ERROR_CODE_KEYS as readonly string[]).includes(code);
}

function getErrorCode(error: unknown): string | null {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;

    if (typeof data === 'string') {
      return data;
    }

    if (
      typeof data === 'object' &&
      data !== null &&
      'code' in data &&
      typeof data.code === 'string'
    ) {
      return data.code;
    }
  }

  // Convex Auth provider errors cross the action boundary as regular Errors.
  // Only recover a code from our fixed allowlist so backend details never leak.
  const message = error instanceof Error ? error.message : String(error);
  const wrappedCode = ERROR_CODE_KEYS.find((code) =>
    new RegExp(`(?:^|[^A-Z_])${code}(?:$|[^A-Z_])`).test(message)
  );

  if (wrappedCode !== undefined) return wrappedCode;

  return null;
}

function getErrorMessage(error: unknown): string {
  const code = getErrorCode(error);

  if (code !== null && isErrorCodeKey(code)) {
    return i18n.t(`errors.code.${code}`);
  }

  return i18n.t('errors.default');
}

export function isUnauthenticatedError(error: unknown): boolean {
  return getErrorCode(error) === 'UNAUTHENTICATED';
}

export function toastAppError(error: unknown): void {
  toast.error(getErrorMessage(error));
}

export function handleError(
  error: unknown,
  _options?: { forceToast?: boolean }
): void {
  toastAppError(error);
}
