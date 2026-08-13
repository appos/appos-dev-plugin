---
allowed-tools: [Bash, Read, Grep]
description: Build the current AppOS plugin with esbuild (build.mjs pattern)
---

# Build the current AppOS plugin

Build the plugin in the current directory (or the nearest parent containing `plugin.json`). Uses the SDK+build.mjs pattern — the reference is `appos-plugin-ytdlp`.

## 1. Find the plugin root

Look for `plugin.json` in the current directory or parent directories:

```bash
dir="$(pwd)"
while [ "$dir" != "/" ]; do
    if [ -f "$dir/plugin.json" ]; then
        echo "$dir"
        break
    fi
    dir="$(dirname "$dir")"
done
```

If no `plugin.json` is found, report an error and suggest running `/appos-dev:new-plugin` first.

## 2. Read the manifest

Read `plugin.json` to confirm this is an AppOS plugin (`"runtime": "javascript"`, `"entrypoint": "dist/main.js"`).

## 3. Confirm the SDK build layout

Check that the plugin follows the SDK pattern:

- `build.mjs` exists at the plugin root
- `package.json` exists and has `@appos.space/plugin-types` in `devDependencies`
- `tsconfig.json` exists with `verbatimModuleSyntax: true`

If `build.mjs` is missing but the plugin has `src/main.ts`, this is a legacy plugin. Fall back to the legacy build below, and warn the user they should migrate to the SDK pattern.

## 4. Install dependencies (if needed)

If `node_modules/` doesn't exist or `package-lock.json` is newer than `node_modules/`:

```bash
cd "{plugin-root}"
npm install
```

## 5. Typecheck

```bash
cd "{plugin-root}"
npm run typecheck
```

If typecheck fails, show the errors and stop — do not proceed to build. Type errors in a strict SDK project almost always point at a real bug (missing permission, wrong message shape, untyped webview chunk).

## 6. Build with esbuild

```bash
cd "{plugin-root}"
npm run build
```

Under the hood this runs `node build.mjs`, which calls the esbuild API with the canonical options:
- `bundle: true`
- `format: 'iife'` — **critical**: ESM bundles will not load in JavaScriptCore
- `platform: 'browser'`
- `target: 'es2020'`
- `outfile: 'dist/main.js'`
- `sourcemap: true`

## 7. Validate the bundle

The bundle MUST contain assignments to `globalThis.activate` and `globalThis.deactivate`:

```bash
grep -c "globalThis" "{plugin-root}/dist/main.js"
```

Expect at least 2. If 0, the bundler tree-shook them away — check that `src/main.ts` ends with:

```ts
import type { PluginContext } from '@appos.space/plugin-types';

async function activate(ctx: PluginContext): Promise<void> { /* ... your real activate ... */ }
async function deactivate(): Promise<void> { /* ... your real deactivate ... */ }

(globalThis as unknown as { activate: typeof activate }).activate = activate;
(globalThis as unknown as { deactivate: typeof deactivate }).deactivate = deactivate;
```

ESM `export` statements will NOT work — they get hidden inside the IIFE closure. Only `globalThis` assignments reach the host.

## 8. Report results

Show the bundle path, bundle size, and a one-line summary of which namespaces are imported. If the build failed, show the error and suggest fixes — the most common are:

- Missing `verbatimModuleSyntax: true` in tsconfig (emits broken imports from declaration-only `@appos.space/plugin-types`)
- Using `import { UIAPI }` as a value instead of `import type { UIAPI }`
- `src/main.ts` exporting `activate`/`deactivate` via ESM instead of assigning to `globalThis`

## Legacy fallback (no build.mjs)

Only if `build.mjs` is missing and the user hasn't migrated yet:

```bash
cd "{plugin-root}"
mkdir -p dist
npx esbuild src/main.ts --bundle --format=iife --target=es2020 --outfile=dist/main.js
```

Warn: "This plugin uses the legacy CLI build. Consider migrating to `build.mjs` + SDK — see the `appos-plugin-dev` skill."
