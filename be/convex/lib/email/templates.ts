const BRAND_NAME = "Diwan";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createVerificationCodeEmail(code: string) {
  const safeCode = escapeHtml(code);
  const subject = `Your ${BRAND_NAME} verification code: ${code}`;
  const text = `Your ${BRAND_NAME} verification code is ${code}.\n\nThis code expires in 15 minutes.\n\nIf you did not request this code, you can safely ignore this email.`;
  const html = `<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f7f8f7;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 10px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="padding:32px 24px">
      <p style="margin:0 0 24px;color:#1a1f25;font-size:24px;font-weight:700">Your verification code</p>
      <p style="margin:0 0 20px;color:#4a5568;font-size:16px;line-height:1.7">Use the code below to continue on ${BRAND_NAME}. Do not share it with anyone.</p>
      <div style="margin:0 0 20px;padding:24px;border-radius:12px;background:#f7f8f7;text-align:center;color:#1a1f25;font-size:32px;font-weight:700;letter-spacing:8px">${safeCode}</div>
      <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.6">This code expires in 15 minutes. If you did not request it, you can safely ignore this email.</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
