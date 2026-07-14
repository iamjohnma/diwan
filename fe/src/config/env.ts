// Deliberately dependency-free: this module runs on the first-paint critical
// path, so it must not drag validation libraries into the eager bundle.

interface AppEnv {
  VITE_CONVEX_URL: string;
  VITE_ENABLE_GOOGLE_OAUTH: boolean;
  VITE_GOOGLE_OAUTH_CLIENT_ID: string;
}

const REQUIRED_ENV_KEYS = ['VITE_CONVEX_URL'] as const;

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalBoolean(value: unknown, key: string): boolean | null {
  const trimmed = readTrimmedString(value);
  if (trimmed === null) return null;
  const normalized = trimmed.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(`[ENV] ${key} must be either true or false`);
}

function parseAppEnv(env: ImportMetaEnv): AppEnv {
  const values: Record<string, string> = {};
  const missingKeys: string[] = [];

  for (const key of REQUIRED_ENV_KEYS) {
    const value = readTrimmedString(env[key]);
    if (value === null) {
      missingKeys.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missingKeys.length > 0) {
    const message = `Missing required environment variables: ${missingKeys.join(', ')}`;
    console.error(`[ENV] ${message}`);
    throw new Error(`[ENV] ${message}`);
  }

  const googleClientId =
    readTrimmedString(env.VITE_GOOGLE_OAUTH_CLIENT_ID) ?? '';
  const explicitGoogleOAuth = readOptionalBoolean(
    env.VITE_ENABLE_GOOGLE_OAUTH,
    'VITE_ENABLE_GOOGLE_OAUTH'
  );
  const enableGoogleOAuth = explicitGoogleOAuth ?? googleClientId.length > 0;
  if (enableGoogleOAuth && !googleClientId) {
    throw new Error(
      '[ENV] VITE_GOOGLE_OAUTH_CLIENT_ID is required when Google OAuth is enabled'
    );
  }

  return {
    VITE_CONVEX_URL: values.VITE_CONVEX_URL!,
    VITE_ENABLE_GOOGLE_OAUTH: enableGoogleOAuth,
    VITE_GOOGLE_OAUTH_CLIENT_ID: googleClientId
  };
}

export const appEnv = parseAppEnv(import.meta.env);
