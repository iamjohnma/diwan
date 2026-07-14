const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
} as const;

const AR_PATH = 'src/integrations/i18n/locales/ar.json';
const EN_PATH = 'src/integrations/i18n/locales/en.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Set<string> {
  const keys = new Set<string>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flattenKeys(
        value as Record<string, unknown>,
        fullKey
      )) {
        keys.add(nested);
      }
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

function stripPluralSuffix(key: string): string {
  return key.replace(/_(zero|one|two|few|many|other)$/, '');
}

console.warn(`\n${COLORS.bold}Running i18n parity checks...${COLORS.reset}\n`);

const start = performance.now();

const arJson = await Bun.file(AR_PATH).json();
const enJson = await Bun.file(EN_PATH).json();

const arKeys = flattenKeys(arJson);
const enKeys = flattenKeys(enJson);

const arBaseKeys = new Set([...arKeys].map(stripPluralSuffix));
const enBaseKeys = new Set([...enKeys].map(stripPluralSuffix));

const missingInAr: string[] = [];
const missingInEn: string[] = [];

for (const key of enBaseKeys) {
  if (!arBaseKeys.has(key)) {
    missingInAr.push(key);
  }
}

for (const key of arBaseKeys) {
  if (!enBaseKeys.has(key)) {
    missingInEn.push(key);
  }
}

const duration = Math.round(performance.now() - start);

if (missingInAr.length === 0 && missingInEn.length === 0) {
  console.warn(
    `  ${COLORS.green}OK${COLORS.reset} All i18n base keys are in sync (${arBaseKeys.size} ar base, ${enBaseKeys.size} en base; ${arKeys.size} ar leaves, ${enKeys.size} en leaves) ${COLORS.dim}${duration}ms${COLORS.reset}`
  );
  process.exit(0);
}

if (missingInAr.length > 0) {
  console.warn(
    `  ${COLORS.red}ERR${COLORS.reset} ${COLORS.cyan}Missing in ar.json${COLORS.reset} ${COLORS.dim}(${missingInAr.length} keys)${COLORS.reset}`
  );
  for (const key of missingInAr.slice(0, 15)) {
    console.warn(`    ${COLORS.yellow}${key}${COLORS.reset}`);
  }
  if (missingInAr.length > 15) {
    console.warn(
      `    ${COLORS.dim}...and ${missingInAr.length - 15} more${COLORS.reset}`
    );
  }
}

if (missingInEn.length > 0) {
  console.warn(
    `  ${COLORS.red}ERR${COLORS.reset} ${COLORS.cyan}Missing in en.json${COLORS.reset} ${COLORS.dim}(${missingInEn.length} keys)${COLORS.reset}`
  );
  for (const key of missingInEn.slice(0, 15)) {
    console.warn(`    ${COLORS.yellow}${key}${COLORS.reset}`);
  }
  if (missingInEn.length > 15) {
    console.warn(
      `    ${COLORS.dim}...and ${missingInEn.length - 15} more${COLORS.reset}`
    );
  }
}

process.exit(1);
