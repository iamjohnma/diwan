import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) {
    failures.push(message);
  }
}

async function read(path: string): Promise<string> {
  return await readFile(join(frontendRoot, path), 'utf8');
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      return entry.isDirectory() ? await collectFiles(path) : [path];
    })
  );

  return files.flat();
}

function parseHexTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const tokenPattern = /--([\w-]+):\s*(#[\da-f]{6});/gi;

  for (const match of css.matchAll(tokenPattern)) {
    const [, name, value] = match;

    if (name && value) {
      tokens.set(name, value);
    }
  }

  return tokens;
}

function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

const [html, styles, colors, theme, fonts, base, animations, layout] =
  await Promise.all([
    read('index.html'),
    read('src/styles.css'),
    read('src/styles/colors.css'),
    read('src/styles/theme.css'),
    read('src/styles/fonts.css'),
    read('src/styles/base.css'),
    read('src/styles/animations.css'),
    read('src/components/core/layout.tsx')
  ]);

check(
  /<html\s+lang="ar"\s+dir="rtl"/u.test(html),
  'index.html must declare Arabic and RTL before first paint.'
);
check(
  html.includes("root.style.colorScheme = 'light'"),
  'The boot script must lock the v1 interface to light mode.'
);
check(
  html.includes("localStorage.getItem('diwan:font-size')"),
  'The boot script must restore the saved font scale before React starts.'
);
check(
  html.includes('viewport-fit=cover'),
  'The viewport must support safe-area utilities on installed devices.'
);

const orderedStyleImports = [
  "@import 'tailwindcss';",
  "@import './styles/colors.css';",
  "@import './styles/theme.css';",
  "@import './styles/fonts.css';",
  "@import './styles/base.css';",
  "@import './styles/utils.css';",
  "@import './styles/animations.css';"
];
let previousImportIndex = -1;

for (const importStatement of orderedStyleImports) {
  const importIndex = styles.indexOf(importStatement);
  check(
    importIndex > previousImportIndex,
    `Missing or out-of-order stylesheet import: ${importStatement}`
  );
  previousImportIndex = importIndex;
}

const requiredTokenMappings = {
  background: 'background-base',
  'background-base': 'background-base',
  'background-surface': 'background-surface',
  'background-elevated': 'background-elevated',
  'background-muted': 'background-muted',
  'border-default': 'border-default',
  'border-strong': 'border-strong',
  error: 'error',
  'error-bg': 'error-bg',
  foreground: 'text-primary',
  primary: 'primary',
  'primary-active': 'primary-active',
  'primary-foreground': 'primary-foreground',
  'primary-hover': 'primary-hover',
  'primary-light': 'primary-light',
  secondary: 'secondary',
  'secondary-foreground': 'secondary-foreground',
  success: 'success',
  'success-bg': 'success-bg',
  'text-primary': 'text-primary',
  'text-secondary': 'text-secondary',
  'text-tertiary': 'text-tertiary',
  warning: 'warning',
  'warning-bg': 'warning-bg'
} as const;

for (const [utility, token] of Object.entries(requiredTokenMappings)) {
  check(
    colors.includes(`--${token}:`),
    `colors.css is missing the --${token} semantic token.`
  );
  check(
    theme.includes(`--color-${utility}: var(--${token});`),
    `theme.css must map --${token} to --color-${utility}.`
  );
}

for (let chartIndex = 1; chartIndex <= 5; chartIndex += 1) {
  check(
    colors.includes(`--chart-${chartIndex}:`),
    `colors.css is missing --chart-${chartIndex}.`
  );
  check(
    theme.includes(`--color-chart-${chartIndex}: var(--chart-${chartIndex});`),
    `theme.css is missing the chart-${chartIndex} Tailwind mapping.`
  );
}

for (const spacingName of ['xs', 'sm', 'md', 'lg', 'xl']) {
  check(
    theme.includes(`--spacing-app-${spacingName}:`),
    `theme.css is missing the namespaced app-${spacingName} spacing token.`
  );
}
check(
  !/--spacing-(?:xs|sm|md|lg|xl):/u.test(theme),
  'Custom spacing tokens must use the app-* namespace so they cannot override Tailwind container widths.'
);

// Tajawal is the only allowed typeface, self-hosted from the Naab-customized
// files (they carry vertical-metric fixes the public build lacks).
const fontFaceSources = [
  '../assets/fonts/tajawal/Tajawal-Regular.woff2',
  '../assets/fonts/tajawal/Tajawal-Medium.woff2',
  '../assets/fonts/tajawal/Tajawal-Bold.woff2'
];

for (const fontFaceSource of fontFaceSources) {
  check(
    fonts.includes(fontFaceSource),
    `fonts.css must load ${fontFaceSource} via a local @font-face.`
  );
}

check(
  !fonts.includes('@fontsource') && !styles.includes('@fontsource'),
  'Fonts must be self-hosted from the Naab-customized files, not @fontsource.'
);
check(
  !fonts.includes('Amiri'),
  'Tajawal is the only allowed typeface; Amiri must not be referenced.'
);
check(
  fonts.includes('--app-font-family-rtl:') &&
    fonts.includes('--app-font-display: var(--app-font-family-rtl)'),
  'The font contract must keep Tajawal for both body text and headings.'
);
check(
  base.includes(':focus-visible') && base.includes('outline: 2px solid'),
  'Keyboard focus must have a visible global outline.'
);
check(
  base.includes('@media (forced-colors: active)'),
  'Focus styling must remain visible in forced-colors mode.'
);
check(
  animations.includes('@media (prefers-reduced-motion: reduce)'),
  'Motion utilities must honor reduced-motion preferences.'
);
check(
  layout.includes('id="main-content"'),
  'The application shell must expose the main-content landmark.'
);
check(
  layout.includes('href="#main-content"') &&
    layout.includes('focus:translate-y-0'),
  'The application shell must provide a keyboard-visible skip link.'
);

const tokenValues = parseHexTokens(colors);
const contrastPairs = [
  ['primary', 'primary-foreground'],
  ['secondary-foreground', 'secondary'],
  ['text-primary', 'background-base'],
  ['text-secondary', 'background-base'],
  ['text-tertiary', 'background-base'],
  ['success', 'success-bg'],
  ['warning', 'warning-bg'],
  ['error', 'error-bg']
] as const;

for (const [foregroundToken, backgroundToken] of contrastPairs) {
  const foreground = tokenValues.get(foregroundToken);
  const background = tokenValues.get(backgroundToken);
  check(
    foreground !== undefined && background !== undefined,
    `Cannot evaluate contrast for --${foregroundToken} on --${backgroundToken}.`
  );

  if (foreground && background) {
    const ratio = contrastRatio(foreground, background);
    check(
      ratio >= 4.5,
      `--${foregroundToken} on --${backgroundToken} has ${ratio.toFixed(2)}:1 contrast; 4.5:1 is required.`
    );
  }
}

const sourceFiles = (await collectFiles(join(frontendRoot, 'src'))).filter(
  (path) => /\.(?:css|ts|tsx)$/u.test(path)
);
const forbiddenHex = /#[\da-f]{3,8}\b/giu;
const forbiddenPalette =
  /\b(?:bg|border|from|text|to|via)-(?:amber|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|yellow|zinc)-[\w/.-]+/giu;
const forbiddenPhysicalClass =
  /\b(?:border-[lr]|left-\S+|m[lr]-\S+|p[lr]-\S+|right-\S+|rounded-[lr]|text-left|text-right)\b/giu;

for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, 'utf8');
  const path = relative(frontendRoot, sourceFile);

  if (path !== 'src/styles/colors.css') {
    check(
      !forbiddenHex.test(source),
      `${path} contains a raw hex color; only colors.css may define colors.`
    );
    forbiddenHex.lastIndex = 0;
  }

  check(
    !forbiddenPalette.test(source),
    `${path} contains a raw Tailwind palette class; use semantic tokens.`
  );
  forbiddenPalette.lastIndex = 0;
  check(
    !forbiddenPhysicalClass.test(source),
    `${path} contains a physical directional class; use logical RTL-safe utilities.`
  );
  forbiddenPhysicalClass.lastIndex = 0;
  check(
    !/\b(?:bg-)?gradient\b/iu.test(source),
    `${path} contains a gradient; the restrained foundation forbids gradients.`
  );
}

if (failures.length > 0) {
  process.stderr.write(
    `Frontend foundation checks failed:\n${failures
      .map((failure) => `- ${failure}`)
      .join('\n')}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `Frontend foundation checks passed (${sourceFiles.length} source files, ${contrastPairs.length} contrast pairs).\n`
);
