import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "../../_generated/server";

function requireEnv(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required to send authentication emails`);
  }
  return normalized;
}

export async function sendSesEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const client = new SESv2Client({
    region: requireEnv(env.AWS_SES_REGION, "AWS_SES_REGION"),
    credentials: {
      accessKeyId: requireEnv(
        env.AWS_SES_ACCESS_KEY_ID,
        "AWS_SES_ACCESS_KEY_ID",
      ),
      secretAccessKey: requireEnv(
        env.AWS_SES_SECRET_ACCESS_KEY,
        "AWS_SES_SECRET_ACCESS_KEY",
      ),
    },
  });

  await client.send(
    new SendEmailCommand({
      FromEmailAddress: requireEnv(
        env.AWS_SES_FROM_EMAIL,
        "AWS_SES_FROM_EMAIL",
      ),
      Destination: { ToAddresses: [args.to] },
      Content: {
        Simple: {
          Subject: { Charset: "UTF-8", Data: args.subject },
          Body: {
            Text: { Charset: "UTF-8", Data: args.text },
            Html: { Charset: "UTF-8", Data: args.html },
          },
        },
      },
    }),
  );
}
