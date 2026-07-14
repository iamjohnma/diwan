const FOREGROUND_LIGHT = '#ffffff';
const FOREGROUND_DARK = '#0f172a';
const MIN_WHITE_CONTRAST_RATIO = 3;

export type ForegroundOverride = 'auto' | 'dark' | 'light';

const APPEARANCE_STORAGE_KEY = 'diwan:appearance';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseStrictHexColor(hex: string): Rgb | null {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function relativeLuminance(rgb: Rgb): number {
  const channel = (value: number) => {
    const srgb = value / 255;

    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
  );
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));

  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastForeground(
  hex: string,
  override: ForegroundOverride = 'auto'
): string {
  if (override === 'dark') return FOREGROUND_DARK;
  if (override === 'light') return FOREGROUND_LIGHT;

  const rgb = parseStrictHexColor(hex);

  return !rgb ||
    contrastRatio({ r: 255, g: 255, b: 255 }, rgb) >= MIN_WHITE_CONTRAST_RATIO
    ? FOREGROUND_LIGHT
    : FOREGROUND_DARK;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(rgb: Rgb): string {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixWith(hex: string, target: Rgb, amount: number): string {
  const rgb = parseStrictHexColor(hex);
  if (!rgb) return hex;

  return rgbToHex({
    r: rgb.r + (target.r - rgb.r) * amount,
    g: rgb.g + (target.g - rgb.g) * amount,
    b: rgb.b + (target.b - rgb.b) * amount
  });
}

export function applyPrimaryColor(
  color: string,
  foregroundOverride: ForegroundOverride = 'auto'
): void {
  if (typeof document === 'undefined' || !parseStrictHexColor(color)) return;

  const root = document.documentElement;
  root.style.setProperty('--primary', color);
  root.style.setProperty(
    '--primary-hover',
    mixWith(color, { r: 0, g: 0, b: 0 }, 0.1)
  );
  root.style.setProperty(
    '--primary-active',
    mixWith(color, { r: 0, g: 0, b: 0 }, 0.2)
  );
  root.style.setProperty(
    '--primary-light',
    mixWith(color, { r: 255, g: 255, b: 255 }, 0.88)
  );
  root.style.setProperty(
    '--primary-foreground',
    getContrastForeground(color, foregroundOverride)
  );
  root.style.setProperty(
    '--secondary',
    mixWith(color, { r: 255, g: 255, b: 255 }, 0.92)
  );
  root.style.setProperty(
    '--secondary-hover',
    mixWith(color, { r: 255, g: 255, b: 255 }, 0.86)
  );
  root.style.setProperty(
    '--secondary-active',
    mixWith(color, { r: 255, g: 255, b: 255 }, 0.8)
  );
  root.style.setProperty(
    '--secondary-foreground',
    mixWith(color, { r: 0, g: 0, b: 0 }, 0.24)
  );
}

/** Restores system color preferences before any route-specific UI mounts. */
export function hydrateStoredPrimaryColor(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const stored = JSON.parse(
      localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}'
    ) as {
      primaryColor?: unknown;
      foregroundOverride?: unknown;
    };
    const foregroundOverride =
      stored.foregroundOverride === 'dark' ||
      stored.foregroundOverride === 'light' ||
      stored.foregroundOverride === 'auto'
        ? stored.foregroundOverride
        : 'auto';

    if (typeof stored.primaryColor === 'string') {
      applyPrimaryColor(stored.primaryColor, foregroundOverride);
    }
  } catch {
    // Storage can be unavailable or contain data from an older app version.
  }
}
