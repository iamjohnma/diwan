import { Email } from "@convex-dev/auth/providers/Email";
import { createVerificationCodeEmail } from "../../lib/email/templates";
import { sendSesEmail } from "../../lib/email/ses";

export const VERIFICATION_CODE_LENGTH = 5;
export const VERIFICATION_CODE_MAX_AGE_SECONDS = 15 * 60;

function createNumericVerificationCode(): string {
  const bytes = new Uint8Array(VERIFICATION_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => String(value % 10)).join("");
}

export const SesOtp = Email({
  id: "ses-otp",
  maxAge: VERIFICATION_CODE_MAX_AGE_SECONDS,
  async generateVerificationToken() {
    return createNumericVerificationCode();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    await sendSesEmail({ to: email, ...createVerificationCodeEmail(token) });
  },
});
