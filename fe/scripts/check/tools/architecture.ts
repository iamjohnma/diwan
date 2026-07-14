import {
  type Dirent,
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve
} from 'node:path';
import * as ts from 'typescript';
import { COLORS } from '../constants';
import { discoverSourceFiles } from '../discover';

interface Finding {
  line?: number;
  message: string;
  path: string;
  rule: string;
}

interface Budget {
  complexity: number;
  lines: number;
  name: string;
  pattern: RegExp;
}

const sourceRoot = resolve('src');
const maxFindingsPerRule = 20;
const findings: Finding[] = [];
const allowedTopLevelDirectories = new Set([
  'assets',
  'components',
  'config',
  'constants',
  'hooks',
  'integrations',
  'lib',
  'pages',
  'pwa',
  'routes',
  'schemas',
  'stores',
  'styles',
  '@types',
  'utils'
]);
const ignoredDirectoryNames = new Set(['coverage', 'dist', 'node_modules']);
const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx'] as const;
const classUtilityFunctions = new Set([
  'clsx',
  'cn',
  'cva',
  'twJoin',
  'twMerge'
]);
const fileBudgets: Budget[] = [
  {
    complexity: 15,
    lines: 90,
    name: 'route',
    pattern: /^src\/routes\//
  },
  {
    complexity: 250,
    lines: 1800,
    name: 'overlay primitive',
    pattern:
      /^src\/components\/(?:ui\/(?:drawer|sonner|dynamic-popover\/|select|popover|combobox|input-combobox|input-combobox-multi-select|menu|search-field)|common\/dynamic-tooltip|dialogts\/(?:dialog\.tsx$|common\/(?:steps-dialog|dialog-wrapper)\/))/
  },
  {
    complexity: 100,
    lines: 950,
    name: 'AI assistant orchestrator',
    pattern: /^src\/components\/core\/ai-assistant\/manager\.tsx$/
  },
  {
    complexity: 110,
    lines: 800,
    name: 'voice orb renderer hook',
    pattern: /^src\/hooks\/core\/ai-assistant\/voice-orb\.ts$/
  },
  {
    complexity: 190,
    lines: 1700,
    name: 'voice orb particle engine',
    pattern: /^src\/lib\/ai\/voice-orb\.ts$/
  },
  {
    complexity: 65,
    lines: 450,
    name: 'UI component',
    pattern: /^src\/components\/ui\//
  },
  {
    complexity: 90,
    lines: 700,
    name: 'component',
    pattern: /^src\/components\//
  },
  {
    complexity: 90,
    lines: 650,
    name: 'hook',
    pattern: /^src\/hooks\//
  },
  {
    complexity: 70,
    lines: 450,
    name: 'data slice',
    pattern: /^src\/lib\/(?:convex\/)?data\//
  },
  {
    complexity: 80,
    lines: 550,
    name: 'library',
    pattern: /^src\/lib\//
  },
  {
    complexity: 90,
    lines: 650,
    name: 'utility',
    pattern: /^src\/utils\//
  },
  {
    complexity: 85,
    lines: 600,
    name: 'source',
    pattern: /^src\//
  }
];

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

function relativePath(path: string): string {
  return toPosix(relative('.', path));
}

function report(
  rule: string,
  path: string,
  message: string,
  line?: number
): void {
  findings.push({
    line,
    message,
    path: relativePath(path),
    rule
  });
}

function isSourceFile(path: string): boolean {
  return sourceExtensions.includes(
    extname(path) as (typeof sourceExtensions)[number]
  );
}

function readVisibleEntries(directory: string): Dirent<string>[] {
  return readdirSync(directory, {
    encoding: 'utf8',
    withFileTypes: true
  }).filter(
    (entry) =>
      !entry.name.startsWith('.') && !ignoredDirectoryNames.has(entry.name)
  );
}

function hasGitkeepPlaceholder(directory: string): boolean {
  return existsSync(join(directory, '.gitkeep'));
}

function checkDirectory(directory: string): void {
  const entries = readVisibleEntries(directory);
  const directoryRelative = toPosix(relative(sourceRoot, directory));

  if (
    directory !== sourceRoot &&
    entries.length === 0 &&
    !hasGitkeepPlaceholder(directory)
  ) {
    report('empty-folder', directory, 'Remove this empty folder.');
  }

  if (
    directory !== sourceRoot &&
    entries.length === 1 &&
    entries[0]!.isFile() &&
    /^index\.[jt]sx?$/.test(entries[0]!.name)
  ) {
    report(
      'only-index-folder',
      directory,
      `Remove the folder or add an implementation beside ${entries[0]!.name}.`
    );
  }

  if (
    directoryRelative !== '' &&
    !directoryRelative.includes('/') &&
    !allowedTopLevelDirectories.has(directoryRelative)
  ) {
    report(
      'source-taxonomy',
      directory,
      `Top-level source folders must use the documented taxonomy; "${directoryRelative}" is not allowed.`
    );
  }

  const implementationFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        isSourceFile(entry.name) &&
        !/^index\.[jt]sx?$/.test(entry.name) &&
        !/\.(?:test|spec|stories)\.[jt]sx?$/.test(entry.name)
    )
    .map((entry) => entry.name);
  const isComponentOrHookFolder = /^(?:components|hooks)(?:\/|$)/.test(
    directoryRelative
  );
  const hasIndex = entries.some(
    (entry) => entry.isFile() && /^index\.[jt]sx?$/.test(entry.name)
  );

  if (
    isComponentOrHookFolder &&
    directoryRelative.includes('/') &&
    implementationFiles.length === 1 &&
    entries.every((entry) => entry.isFile())
  ) {
    report(
      'single-file-folder',
      directory,
      `Move ${implementationFiles[0]} to the parent until this module needs multiple files.`
    );
  }

  if (isComponentOrHookFolder && implementationFiles.length >= 2 && !hasIndex) {
    report(
      'missing-barrel',
      directory,
      `Add index.ts to expose this ${implementationFiles.length}-file module.`
    );
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      checkDirectory(join(directory, entry.name));
    }
  }
}

function scriptKind(path: string): ts.ScriptKind {
  switch (extname(path)) {
    case '.js':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.tsx':
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function lineNumber(sourceFile: ts.SourceFile, node: ts.Node): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

function fileBudget(path: string): Budget {
  const formatted = relativePath(path);

  return (
    fileBudgets.find((budget) => budget.pattern.test(formatted)) ??
    fileBudgets.at(-1)!
  );
}

function complexity(sourceFile: ts.SourceFile): number {
  let score = 1;

  function visit(node: ts.Node): void {
    if (
      ts.isIfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCaseClause(node) ||
      ts.isCatchClause(node) ||
      ts.isConditionalExpression(node)
    ) {
      score += 1;
    } else if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken
      ].includes(node.operatorToken.kind)
    ) {
      score += 1;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return score;
}

function checkFileName(path: string): void {
  const name = basename(path);

  if (name.endsWith('.d.ts') || relativePath(path).startsWith('src/routes/')) {
    return;
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9-]+)*\.[jt]sx?$/.test(name)) {
    report(
      'filename-kebab-case',
      path,
      `Rename "${name}" using lowercase kebab-case.`
    );
  }
}

function checkBudget(
  path: string,
  content: string,
  sourceFile: ts.SourceFile
): void {
  const budget = fileBudget(path);
  const lines = content.split(/\r?\n/).length;
  const complexityScore = complexity(sourceFile);

  if (lines > budget.lines) {
    report(
      'max-file-lines',
      path,
      `${lines} lines exceeds the ${budget.name} budget of ${budget.lines}.`
    );
  }

  if (complexityScore > budget.complexity) {
    report(
      'max-file-complexity',
      path,
      `Complexity ${complexityScore} exceeds the ${budget.name} budget of ${budget.complexity}.`
    );
  }
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function classCompositionIssue(expression: ts.Expression): string | null {
  const current = unwrapExpression(expression);

  if (ts.isTemplateExpression(current)) {
    return 'Pass template values as separate cn(...) arguments.';
  }

  if (
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return 'Pass concatenated values as separate cn(...) arguments.';
  }

  if (ts.isConditionalExpression(current)) {
    return (
      classCompositionIssue(current.whenTrue) ??
      classCompositionIssue(current.whenFalse)
    );
  }

  if (
    ts.isBinaryExpression(current) &&
    [
      ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken
    ].includes(current.operatorToken.kind)
  ) {
    return (
      classCompositionIssue(current.left) ??
      classCompositionIssue(current.right)
    );
  }

  if (ts.isArrayLiteralExpression(current)) {
    for (const element of current.elements) {
      if (ts.isExpression(element)) {
        const issue = classCompositionIssue(element);

        if (issue !== null) {
          return issue;
        }
      }
    }
  }

  if (
    ts.isCallExpression(current) &&
    ts.isIdentifier(current.expression) &&
    classUtilityFunctions.has(current.expression.text)
  ) {
    for (const argument of current.arguments) {
      if (ts.isExpression(argument)) {
        const issue = classCompositionIssue(argument);

        if (issue !== null) {
          return issue;
        }
      }
    }
  }

  return null;
}

function isClassContext(node: ts.Node): boolean {
  let current = node.parent;

  while (current !== undefined && !ts.isSourceFile(current)) {
    if (ts.isJsxAttribute(current) && current.name.getText() === 'className') {
      return true;
    }

    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      classUtilityFunctions.has(current.expression.text)
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function checkArbitraryTailwind(
  path: string,
  sourceFile: ts.SourceFile,
  node:
    | ts.NoSubstitutionTemplateLiteral
    | ts.StringLiteral
    | ts.TemplateHead
    | ts.TemplateMiddle
    | ts.TemplateTail
): void {
  // Overlay pickers and calendar chrome keep Naab viewport/layout arbitrary
  // values for visual parity (trigger widths, timezone type scale, stacking).
  const relative = toPosix(relativePath(path));
  if (
    relative.includes('/components/dialogts/') ||
    relative.includes('/components/ui/') ||
    relative.endsWith('/branch-scope-select.tsx') ||
    relative.endsWith('/time-zone-selector.tsx')
  ) {
    return;
  }

  if (!isClassContext(node)) {
    return;
  }

  for (const token of node.text.split(/\s+/).filter(Boolean)) {
    let bracketDepth = 0;
    let variantEnd = -1;

    for (const [index, character] of [...token].entries()) {
      if (character === '[') {
        bracketDepth += 1;
      } else if (character === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (character === ':' && bracketDepth === 0) {
        variantEnd = index;
      }
    }

    const utility = token
      .slice(variantEnd + 1)
      .replace(/^!/, '')
      .trim();
    const match = /^(-?[a-z][a-z0-9-]*)-\[([^\]]+)\]$/.exec(utility);

    if (match === null) {
      continue;
    }

    const value = match[2]!.trim();

    if (!/^-?(?:\d|\.\d)/.test(value)) {
      continue;
    }

    report(
      'no-arbitrary-tailwind',
      path,
      `Replace "${token}" with a design token.`,
      lineNumber(sourceFile, node)
    );
  }
}

function checkSourceFile(path: string): void {
  const content = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(path)
  );

  if (['.js', '.jsx'].includes(extname(path))) {
    report(
      'typescript-only',
      path,
      'Application source must use TypeScript (.ts or .tsx).'
    );
  }

  checkFileName(path);
  checkBudget(path, content, sourceFile);

  function visit(node: ts.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === 'className' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression
    ) {
      const issue = classCompositionIssue(node.initializer.expression);

      if (issue !== null) {
        report(
          'class-name-composition',
          path,
          issue,
          lineNumber(sourceFile, node)
        );
      }
    }

    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      checkArbitraryTailwind(path, sourceFile, node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function resolveSourceModule(
  specifier: string,
  importer: string,
  sourceFiles: Set<string>
): string | null {
  let basePath: string;

  if (specifier.startsWith('@/')) {
    basePath = join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    basePath = resolve(dirname(importer), specifier);
  } else {
    return null;
  }

  const candidates = [
    basePath,
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) => join(basePath, `index${extension}`))
  ].map((candidate) => normalize(candidate));

  return candidates.find((candidate) => sourceFiles.has(candidate)) ?? null;
}

function isInside(path: string, directory: string): boolean {
  const pathFromDirectory = relative(directory, path);

  return (
    pathFromDirectory === '' ||
    (!pathFromDirectory.startsWith('..') && !isAbsolute(pathFromDirectory))
  );
}

function dataSlice(path: string): string | null {
  const formatted = toPosix(relative(sourceRoot, path));
  const match = /^(lib\/(?:(?:convex\/)?data)\/[^/]+)(?:\/|$)/.exec(formatted);

  return match === null ? null : resolve(sourceRoot, match[1]!);
}

function relativeImportAllowed(importer: string, target: string): boolean {
  if (
    /^index\.[jt]sx?$/.test(basename(importer)) &&
    dirname(importer) === dirname(target)
  ) {
    return true;
  }

  const importerSlice = dataSlice(importer);

  return importerSlice !== null && importerSlice === dataSlice(target);
}

function checkBarrels(paths: readonly string[]): void {
  const sourceFiles = new Set(paths.map((path) => normalize(path)));
  const parsedFiles = new Map(
    paths.map((path) => [
      path,
      ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        scriptKind(path)
      )
    ])
  );
  const barrelTargets = new Map<string, Set<string>>();

  for (const [path, sourceFile] of parsedFiles) {
    if (!/^index\.[jt]sx?$/.test(basename(path))) {
      continue;
    }

    const targets = new Set<string>();

    for (const statement of sourceFile.statements) {
      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const target = resolveSourceModule(
          statement.moduleSpecifier.text,
          path,
          sourceFiles
        );

        if (target !== null) {
          targets.add(target);
        }
      }
    }

    if (targets.size > 0) {
      barrelTargets.set(path, targets);
    }
  }

  const barrels = [...barrelTargets.keys()];

  for (const [path, sourceFile] of parsedFiles) {
    for (const statement of sourceFile.statements) {
      if (
        !(
          ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
        ) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }

      const specifier = statement.moduleSpecifier.text;
      const target = resolveSourceModule(specifier, path, sourceFiles);

      if (target === null) {
        continue;
      }

      if (specifier.startsWith('.') && !relativeImportAllowed(path, target)) {
        report(
          'source-import-alias',
          path,
          `Use the @/ alias instead of "${specifier}".`,
          lineNumber(sourceFile, statement.moduleSpecifier)
        );
      }

      const barrel = barrels
        .filter(
          (candidate) =>
            target !== candidate && isInside(target, dirname(candidate))
        )
        .sort((left, right) => right.length - left.length)[0];

      if (
        barrel === undefined ||
        isInside(path, dirname(barrel)) ||
        target === barrel
      ) {
        continue;
      }

      const barrelSpecifier = `@/${toPosix(
        relative(sourceRoot, dirname(barrel))
      )}`;

      if (barrelTargets.get(barrel)!.has(target)) {
        report(
          'no-deep-barrel-import',
          path,
          `Import from "${barrelSpecifier}" instead of "${specifier}".`,
          lineNumber(sourceFile, statement.moduleSpecifier)
        );
      } else {
        report(
          'missing-barrel-export',
          barrel,
          `Export "${relativePath(target)}" before importing it through "${barrelSpecifier}".`
        );
      }
    }
  }
}

if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
  throw new Error('Expected a frontend source directory at src/.');
}

const startedAt = performance.now();
const relativeSourceFiles = await discoverSourceFiles();
const sourceFiles = relativeSourceFiles.map((path) => resolve(path));

checkDirectory(sourceRoot);
for (const sourceFile of sourceFiles) {
  checkSourceFile(sourceFile);
}
checkBarrels(sourceFiles);

findings.sort(
  (left, right) =>
    left.rule.localeCompare(right.rule) ||
    left.path.localeCompare(right.path) ||
    (left.line ?? 0) - (right.line ?? 0)
);

const duration = Math.round(performance.now() - startedAt);

if (findings.length === 0) {
  console.log(
    `${sourceFiles.length} source files satisfy Diwan architecture rules (${duration}ms).`
  );
  process.exit(0);
}

const rules = [...new Set(findings.map((finding) => finding.rule))];

for (const rule of rules) {
  const ruleFindings = findings.filter((finding) => finding.rule === rule);
  console.error(
    `\n${COLORS.red}${rule}${COLORS.reset} (${ruleFindings.length})`
  );

  for (const finding of ruleFindings.slice(0, maxFindingsPerRule)) {
    const location =
      finding.line === undefined
        ? finding.path
        : `${finding.path}:${finding.line}`;
    console.error(`  ${location} — ${finding.message}`);
  }

  if (ruleFindings.length > maxFindingsPerRule) {
    console.error(
      `  ... ${ruleFindings.length - maxFindingsPerRule} more findings`
    );
  }
}

console.error(
  `\n${findings.length} architecture violations across ${rules.length} rules (${duration}ms).`
);
process.exit(1);
