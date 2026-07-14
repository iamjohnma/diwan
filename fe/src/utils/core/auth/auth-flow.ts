const RESET_CONTEXT_KEY = 'diwan.auth.reset-context';
const OTP_COOLDOWN_PREFIX = 'diwan.auth.otp-resend';
const SIGN_IN_EMAIL_KEY = 'diwan.auth.sign-in-email';

export const OTP_RESEND_COOLDOWN_MS = 60_000;

export interface ResetPasswordContext {
  email: string;
  code: string;
}

export function writeResetPasswordContext(value: ResetPasswordContext): void {
  sessionStorage.setItem(RESET_CONTEXT_KEY, JSON.stringify(value));
}

export function readResetPasswordContext(): ResetPasswordContext | null {
  try {
    const raw = sessionStorage.getItem(RESET_CONTEXT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ResetPasswordContext>;
    return typeof value.email === 'string' && typeof value.code === 'string'
      ? { email: value.email, code: value.code }
      : null;
  } catch {
    return null;
  }
}

export function clearResetPasswordContext(): void {
  sessionStorage.removeItem(RESET_CONTEXT_KEY);
}

function cooldownKey(flow: string, email: string): string {
  return `${OTP_COOLDOWN_PREFIX}:${flow}:${email.trim().toLowerCase()}`;
}

export function persistOtpCooldown(flow: string, email: string): number {
  const availableAt = Date.now() + OTP_RESEND_COOLDOWN_MS;
  localStorage.setItem(cooldownKey(flow, email), String(availableAt));
  return availableAt;
}

export function readOtpCooldown(flow: string, email: string): number | null {
  const value = Number(localStorage.getItem(cooldownKey(flow, email)));
  return Number.isFinite(value) && value > Date.now() ? value : null;
}

export function stashSignInEmail(email: string): void {
  sessionStorage.setItem(SIGN_IN_EMAIL_KEY, email);
}

export function takeSignInEmail(): string {
  const email = sessionStorage.getItem(SIGN_IN_EMAIL_KEY) ?? '';
  sessionStorage.removeItem(SIGN_IN_EMAIL_KEY);
  return email;
}
