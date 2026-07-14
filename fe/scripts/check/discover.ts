const SOURCE_IGNORES = [
  '/node_modules/',
  '/dist/',
  '/coverage/',
  '/routeTree.gen.',
  '/@types/generated/'
] as const;

const LINT_PATTERNS = [
  'src/**/*.{js,jsx,ts,tsx}',
  'scripts/**/*.{ts,js,mjs}',
  '*.{ts,js,mjs}'
] as const;

const FORMAT_PATTERNS = [
  ...LINT_PATTERNS,
  'src/**/*.css',
  'src/**/*.json',
  '*.json',
  '*.html'
] as const;

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

function shouldIgnore(path: string): boolean {
  const normalized = `/${toPosix(path)}`;

  return SOURCE_IGNORES.some((segment) => normalized.includes(segment));
}

async function discover(patterns: readonly string[]): Promise<string[]> {
  const files = new Set<string>();

  await Promise.all(
    patterns.map(async (pattern) => {
      const glob = new Bun.Glob(pattern);

      for await (const path of glob.scan({ cwd: '.', onlyFiles: true })) {
        if (!shouldIgnore(path)) {
          files.add(toPosix(path));
        }
      }
    })
  );

  return [...files].sort();
}

export function discoverSourceFiles(): Promise<string[]> {
  return discover(['src/**/*.{js,jsx,ts,tsx}']);
}

export function discoverLintFiles(): Promise<string[]> {
  return discover(LINT_PATTERNS);
}

export function discoverFormatFiles(): Promise<string[]> {
  return discover(FORMAT_PATTERNS);
}

export function splitFileChunks(
  items: readonly string[],
  requestedChunks: number
): string[][] {
  if (items.length === 0) {
    return [];
  }

  const chunkCount = Math.min(Math.max(1, requestedChunks), items.length);
  const maxCharacters = process.platform === 'win32' ? 6_000 : 100_000;
  const chunks: string[][] = Array.from({ length: chunkCount }, () => []);
  const lengths = Array.from({ length: chunkCount }, () => 0);

  for (const item of items) {
    const fittingChunks = lengths
      .map((length, index) => ({ index, length }))
      .filter(({ length }) => length + item.length + 1 <= maxCharacters)
      .sort(
        (left, right) => left.length - right.length || left.index - right.index
      );
    const chunkIndex = fittingChunks[0]?.index;

    if (chunkIndex === undefined) {
      chunks.push([item]);
      lengths.push(item.length + 1);
    } else {
      chunks[chunkIndex]!.push(item);
      lengths[chunkIndex]! += item.length + 1;
    }
  }

  return chunks.filter((chunk) => chunk.length > 0);
}
