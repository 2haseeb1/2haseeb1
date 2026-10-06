/**
 * A structural guard on the import graph.
 *
 * Three packages cannot be *imported* on every platform:
 *
 *   expo-notifications             throws on Android in Expo Go (module body)
 *   react-native-android-widget    throws without its native module (module body)
 *   expo-widgets                   needs the widget extension to exist
 *
 * Because these throw during module evaluation, a `try`/`catch` at a call site
 * cannot contain them — the only thing that helps is never statically importing
 * them from a module the app loads at startup. The original crash came precisely
 * from `store.ts → lib/notifications.ts → expo-notifications`, three static hops
 * away from boot.
 *
 * This walks the real static import graph from the app entry and asserts the
 * chain is clean. Dynamic `import()` and `require()` inside functions are
 * deliberately *not* followed: deferring the load is the whole fix.
 *
 * The file is written without `node:fs`/`node:path` types on purpose — adding
 * `@types/node` to `tsconfig.types` would pull Node's globals into the type
 * environment for the whole app, where they shadow React Native's.
 */

import { parse } from '@babel/parser';

interface NodeFs {
  existsSync(path: string): boolean;
  statSync(path: string): { isFile(): boolean };
  readFileSync(path: string, encoding: 'utf8'): string;
}

// `require` is part of the RN/Jest runtime and is already used elsewhere in this
// codebase; typing it structurally keeps Node's globals out of the app's types.
// Paths are resolved relative to the Jest root directory, which is `blink/`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as NodeFs;

/** Packages that must never appear in the eager import graph. */
const FORBIDDEN = ['expo-notifications', 'react-native-android-widget', 'expo-widgets'];

/** Where a cold start begins. */
const ENTRIES = ['index.js', 'src/app/_layout.tsx'];

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

function normalize(input: string): string {
  const parts: string[] = [];
  for (const segment of input.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function dirname(input: string): string {
  const index = input.lastIndexOf('/');
  return index === -1 ? '' : input.slice(0, index);
}

function candidatesFor(specifier: string, fromFile: string): string[] {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith('.')) {
    base = normalize(`${dirname(fromFile)}/${specifier}`);
  } else {
    return []; // external package — recorded, not traversed
  }
  return EXTENSIONS.map((extension) => base + extension);
}

function resolve(specifier: string, fromFile: string): string | null {
  for (const candidate of candidatesFor(specifier, fromFile)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Static, runtime-relevant imports and re-exports only. */
function staticSpecifiers(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  const found: string[] = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration' && node.importKind !== 'type') {
      // `import 'foo'` has no specifiers but is still a side-effect import.
      found.push(node.source.value);
    } else if (
      (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
      node.source &&
      node.exportKind !== 'type'
    ) {
      found.push(node.source.value);
    }
  }
  return found;
}

/** Walks the eager graph, collecting every external package and project file reached. */
function walk(entry: string): { packages: Set<string>; files: Set<string> } {
  const packages = new Set<string>();
  const files = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);

    for (const specifier of staticSpecifiers(file)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
        packages.add(specifier);
        continue;
      }
      const target = resolve(specifier, file);
      if (target) queue.push(target);
    }
  }

  return { packages, files };
}

function isForbidden(specifier: string): boolean {
  return FORBIDDEN.some((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`));
}

describe('eager import graph', () => {
  it('runs from the project root, so relative paths mean what they say', () => {
    // A silent cwd difference would make the walk find nothing and pass for the
    // wrong reason, so this is asserted rather than assumed.
    expect(fs.existsSync('package.json')).toBe(true);
    expect(fs.existsSync('index.js')).toBe(true);
    expect(fs.existsSync('src/app/_layout.tsx')).toBe(true);
  });

  it.each(ENTRIES)('boots %s without a forbidden native package', (entry) => {
    const { packages, files } = walk(entry);

    // Sanity check: the walk has to actually reach our code, or it proves nothing.
    expect(files.size).toBeGreaterThan(5);

    const offenders = [...packages].filter(isForbidden);
    expect(offenders).toEqual([]);
  });

  it('reaches the notification and widget modules, so the guard is meaningful', () => {
    // If these stopped being reachable, the tests above would pass trivially.
    const fromLayout = [...walk('src/app/_layout.tsx').files];
    expect(fromLayout).toContain('src/lib/notifications.ts');
    expect(fromLayout).toContain('src/features/widget/bridge.tsx');

    // The handler is reached from the app entry, not from the root layout.
    const fromEntry = [...walk('index.js').files];
    expect(fromEntry).toContain('src/widgets/widget-task-handler.tsx');
  });

  it('would catch a forbidden import if one were reintroduced', () => {
    // Fail-safe on the test itself: verify the detector actually detects.
    const { packages } = walk('src/app/_layout.tsx');
    expect([...packages]).toContain('expo-share-intent');
    expect(isForbidden('expo-notifications')).toBe(true);
    expect(isForbidden('expo-notifications/build/index')).toBe(true);
    expect(isForbidden('expo-notifications-extra')).toBe(false);
  });
});
