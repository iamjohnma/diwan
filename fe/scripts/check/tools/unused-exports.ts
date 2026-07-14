import { dirname, isAbsolute, normalize, relative, resolve } from 'node:path';
import * as ts from 'typescript';
import { COLORS } from '../constants';

interface NamedUsage {
  kind: 'named';
  names: string[];
  target: string;
}

interface WholeModuleUsage {
  kind: 'all';
  target: string;
}

type Usage = NamedUsage | WholeModuleUsage;

interface ReExport {
  exported: string;
  imported: string;
  target: string;
}

interface ModuleInfo {
  dependencies: Set<string>;
  reExports: ReExport[];
  sourceFile: ts.SourceFile;
  usages: Usage[];
}

interface UnusedExport {
  file: string;
  line: number;
  name: string;
}

const sourceRoot = normalize(resolve('src'));
const maxRows = 40;

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

function relativePath(path: string): string {
  return toPosix(relative('.', path));
}

const generatedSegments = ['/routeTree.gen.', '/@types/generated/'] as const;

function isGenerated(path: string): boolean {
  const normalized = `/${toPosix(relative('.', path))}`;

  return generatedSegments.some((segment) => normalized.includes(segment));
}

function isInsideSource(path: string): boolean {
  const pathFromSource = relative(sourceRoot, normalize(path));

  return (
    pathFromSource !== '' &&
    !pathFromSource.startsWith('..') &&
    !isAbsolute(pathFromSource) &&
    !isGenerated(path)
  );
}

function isEntryFile(path: string): boolean {
  const formatted = relativePath(path);

  return (
    formatted === 'src/main.tsx' ||
    formatted === 'src/main.ts' ||
    formatted.startsWith('src/routes/') ||
    /\.entry\.[jt]sx?$/.test(formatted)
  );
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n'
  });
}

const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');

if (configPath === undefined) {
  throw new Error('Could not find tsconfig.json.');
}

const config = ts.readConfigFile(configPath, ts.sys.readFile);

if (config.error !== undefined) {
  throw new Error(formatDiagnostics([config.error]));
}

const parsedConfig = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  dirname(configPath)
);

if (parsedConfig.errors.length > 0) {
  throw new Error(formatDiagnostics(parsedConfig.errors));
}

const program = ts.createProgram({
  options: parsedConfig.options,
  rootNames: parsedConfig.fileNames
});
const checker = program.getTypeChecker();
const sourceFiles = program
  .getSourceFiles()
  .filter(
    (sourceFile) =>
      !sourceFile.isDeclarationFile && isInsideSource(sourceFile.fileName)
  )
  .sort((left, right) => left.fileName.localeCompare(right.fileName));
const sourceFileNames = new Set(
  sourceFiles.map((sourceFile) => normalize(resolve(sourceFile.fileName)))
);
const resolutionCache = ts.createModuleResolutionCache(
  process.cwd(),
  (fileName) =>
    ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
  parsedConfig.options
);

function resolveModule(specifier: string, importer: string): string | null {
  const cleanSpecifier = specifier.split(/[?#]/, 1)[0]!;
  const resolvedModule = ts.resolveModuleName(
    cleanSpecifier,
    importer,
    parsedConfig.options,
    ts.sys,
    resolutionCache
  ).resolvedModule;

  if (resolvedModule === undefined) {
    return null;
  }

  // TypeScript can return the resolved file name relative to the working
  // directory (observed for same-directory relative specifiers); anchor it
  // before comparing against the absolute program file set.
  const fileName = normalize(resolve(resolvedModule.resolvedFileName));

  return sourceFileNames.has(fileName) ? fileName : null;
}

function moduleExports(sourceFile: ts.SourceFile): ts.Symbol[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

  return moduleSymbol === undefined
    ? []
    : checker.getExportsOfModule(moduleSymbol);
}

function literalText(node: ts.Node | undefined): string | null {
  return node !== undefined &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function importTypeName(name: ts.EntityName): string {
  let current = name;

  while (ts.isQualifiedName(current)) {
    current = current.left;
  }

  return current.text;
}

function globPatterns(node: ts.Expression | undefined): string[] {
  if (node === undefined) {
    return [];
  }

  const literal = literalText(node);

  if (literal !== null) {
    return [literal];
  }

  return ts.isArrayLiteralExpression(node)
    ? node.elements
        .map((element) => literalText(element))
        .filter((value): value is string => value !== null)
    : [];
}

const modules = new Map<string, ModuleInfo>();
const pendingGlobs: {
  importer: string;
  patterns: string[];
}[] = [];

for (const sourceFile of sourceFiles) {
  const importer = normalize(resolve(sourceFile.fileName));
  const info: ModuleInfo = {
    dependencies: new Set(),
    reExports: [],
    sourceFile,
    usages: []
  };
  modules.set(importer, info);

  function addTarget(specifier: string): string | null {
    const target = resolveModule(specifier, importer);

    if (target !== null) {
      info.dependencies.add(target);
    }

    return target;
  }

  function addNamedUsage(target: string | null, names: string[]): void {
    if (target !== null && names.length > 0) {
      info.usages.push({ kind: 'named', names, target });
    }
  }

  function addWholeModuleUsage(target: string | null): void {
    if (target !== null) {
      info.usages.push({ kind: 'all', target });
    }
  }

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const target = addTarget(node.moduleSpecifier.text);
      const clause = node.importClause;
      const names: string[] = [];

      if (clause?.name !== undefined) {
        names.push('default');
      }

      if (
        clause?.namedBindings !== undefined &&
        ts.isNamedImports(clause.namedBindings)
      ) {
        names.push(
          ...clause.namedBindings.elements.map(
            (element) => element.propertyName?.text ?? element.name.text
          )
        );
        addNamedUsage(target, names);
      } else if (
        clause?.namedBindings !== undefined &&
        ts.isNamespaceImport(clause.namedBindings)
      ) {
        addWholeModuleUsage(target);
      } else {
        addNamedUsage(target, names);
      }
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const target = addTarget(node.moduleSpecifier.text);

      if (target === null) {
        return;
      }

      if (node.exportClause === undefined) {
        info.reExports.push({ exported: '*', imported: '*', target });
      } else if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          info.reExports.push({
            exported: element.name.text,
            imported: element.propertyName?.text ?? element.name.text,
            target
          });
        }
      } else if (ts.isNamespaceExport(node.exportClause)) {
        info.reExports.push({
          exported: node.exportClause.name.text,
          imported: '*',
          target
        });
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const reference = node.moduleReference;

      if (
        ts.isExternalModuleReference(reference) &&
        reference.expression !== undefined
      ) {
        addWholeModuleUsage(addTarget(literalText(reference.expression) ?? ''));
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;

      if (
        ts.isLiteralTypeNode(argument) &&
        ts.isStringLiteral(argument.literal)
      ) {
        const target = addTarget(argument.literal.text);

        if (node.qualifier === undefined) {
          addWholeModuleUsage(target);
        } else {
          addNamedUsage(target, [importTypeName(node.qualifier)]);
        }
      }
    } else if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const specifier = literalText(node.arguments[0]);

      if (
        expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(expression) && expression.text === 'require')
      ) {
        addWholeModuleUsage(specifier === null ? null : addTarget(specifier));
      } else if (
        ts.isPropertyAccessExpression(expression) &&
        expression.expression.getText(sourceFile) === 'import.meta' &&
        ['glob', 'globEager'].includes(expression.name.text)
      ) {
        pendingGlobs.push({
          importer,
          patterns: globPatterns(node.arguments[0])
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

for (const pending of pendingGlobs) {
  const info = modules.get(pending.importer)!;

  for (const pattern of pending.patterns) {
    const absolutePattern = resolve(dirname(pending.importer), pattern);
    const workspacePattern = toPosix(relative('.', absolutePattern));
    const glob = new Bun.Glob(workspacePattern);

    for await (const file of glob.scan({ cwd: '.', onlyFiles: true })) {
      const target = normalize(resolve(file));

      if (sourceFileNames.has(target)) {
        info.dependencies.add(target);
        info.usages.push({ kind: 'all', target });
      }
    }
  }
}

const reachableFiles = new Set<string>();
const pendingFiles = sourceFiles
  .filter((sourceFile) => isEntryFile(sourceFile.fileName))
  .map((sourceFile) => normalize(resolve(sourceFile.fileName)));

while (pendingFiles.length > 0) {
  const file = pendingFiles.pop()!;

  if (reachableFiles.has(file)) {
    continue;
  }

  reachableFiles.add(file);

  for (const dependency of modules.get(file)?.dependencies ?? []) {
    pendingFiles.push(dependency);
  }
}

const demandedExports = new Map<string, Set<string>>();

function demandExport(
  modulePath: string,
  exportName: string,
  visited = new Set<string>()
): void {
  const key = `${modulePath}\0${exportName}`;

  if (visited.has(key)) {
    return;
  }

  visited.add(key);
  const demanded = demandedExports.get(modulePath) ?? new Set<string>();
  demanded.add(exportName);
  demandedExports.set(modulePath, demanded);
  const info = modules.get(modulePath);

  if (info === undefined) {
    return;
  }

  if (exportName === '*') {
    for (const symbol of moduleExports(info.sourceFile)) {
      demandExport(modulePath, symbol.name, visited);
    }

    return;
  }

  for (const reExport of info.reExports) {
    if (reExport.exported === exportName) {
      demandExport(reExport.target, reExport.imported, visited);
    } else if (reExport.exported === '*') {
      demandExport(reExport.target, exportName, visited);
    }
  }
}

for (const file of reachableFiles) {
  const info = modules.get(file);

  if (info === undefined) {
    continue;
  }

  for (const usage of info.usages) {
    if (usage.kind === 'all') {
      demandExport(usage.target, '*');
    } else {
      for (const name of usage.names) {
        demandExport(usage.target, name);
      }
    }
  }
}

const deadFiles = sourceFiles
  .map((sourceFile) => normalize(resolve(sourceFile.fileName)))
  .filter((file) => !reachableFiles.has(file))
  .map(relativePath);
const unusedExports: UnusedExport[] = [];

for (const [modulePath, info] of modules) {
  if (!reachableFiles.has(modulePath) || isEntryFile(modulePath)) {
    continue;
  }

  const demanded = demandedExports.get(modulePath) ?? new Set<string>();

  for (const exportedSymbol of moduleExports(info.sourceFile)) {
    if (
      exportedSymbol.name === 'default' ||
      demanded.has('*') ||
      demanded.has(exportedSymbol.name)
    ) {
      continue;
    }

    const localDeclaration = exportedSymbol.declarations?.find(
      (declaration) =>
        normalize(resolve(declaration.getSourceFile().fileName)) === modulePath
    );
    const line =
      localDeclaration === undefined
        ? 1
        : info.sourceFile.getLineAndCharacterOfPosition(
            localDeclaration.getStart(info.sourceFile)
          ).line + 1;

    unusedExports.push({
      file: relativePath(modulePath),
      line,
      name: exportedSymbol.name
    });
  }
}

deadFiles.sort();
unusedExports.sort(
  (left, right) =>
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.name.localeCompare(right.name)
);

if (deadFiles.length === 0 && unusedExports.length === 0) {
  console.log(
    `${sourceFiles.length} source files are reachable and exports are consumed.`
  );
  process.exit(0);
}

if (deadFiles.length > 0) {
  console.error(
    `\n${COLORS.red}dead-files${COLORS.reset} (${deadFiles.length})`
  );

  for (const file of deadFiles.slice(0, maxRows)) {
    console.error(`  ${file}`);
  }

  if (deadFiles.length > maxRows) {
    console.error(`  ... ${deadFiles.length - maxRows} more files`);
  }
}

if (unusedExports.length > 0) {
  console.error(
    `\n${COLORS.red}unused-exports${COLORS.reset} (${unusedExports.length})`
  );

  for (const item of unusedExports.slice(0, maxRows)) {
    console.error(`  ${item.file}:${item.line} — ${item.name}`);
  }

  if (unusedExports.length > maxRows) {
    console.error(`  ... ${unusedExports.length - maxRows} more exports`);
  }
}

console.error(
  `\n${deadFiles.length} dead files and ${unusedExports.length} unused exports.`
);
process.exit(1);
