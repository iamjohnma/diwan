import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../../_generated/server";

const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export async function verifyGoogleIdToken(idToken: string) {
  const audience = env.AUTH_GOOGLE_ID?.trim();
  if (!audience) throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");

  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
      maxTokenAge: "1h",
      clockTolerance: 5,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      payload.email_verified !== true
    ) {
      throw new Error("INVALID_GOOGLE_CREDENTIAL");
    }

    const firstName =
      typeof payload.given_name === "string" ? payload.given_name.trim() : "";
    const lastName =
      typeof payload.family_name === "string" ? payload.family_name.trim() : "";
    const fallbackName =
      typeof payload.name === "string" ? payload.name.trim() : "";

    return {
      accountId: payload.sub,
      profile: {
        email: payload.email.trim().toLowerCase(),
        emailVerified: true,
        name:
          [firstName, lastName].filter(Boolean).join(" ") ||
          fallbackName ||
          payload.email,
        ...(typeof payload.picture === "string"
          ? { image: payload.picture }
          : {}),
      },
    };
  } catch {
    throw new Error("INVALID_GOOGLE_CREDENTIAL");
  }
}
