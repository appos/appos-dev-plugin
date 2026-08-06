---
allowed-tools: [Read, Write, Bash, Glob, Grep]
argument-hint: "<plugin-name>"
description: Scaffold a new AppOS plugin using the SDK+WebView flagship pattern
---

# Scaffold a new AppOS plugin

Create a new AppOS plugin targeting the SDK pattern (`@appos.space/plugin-types` + `@appos.space/plugin-utils` + `@appos.space/view-builders`) with optional WebView panels. Reference implementation: `appos-plugin-ytdlp`.

**Do not copy from the legacy community-plugin template — it's the ViewDescriptor-only model and should not be used for new plugins.** Write files directly with the Write tool.

## 1. Gather information

If a plugin name was provided as an argument, use it. Otherwise ask for:
- **Plugin name** (kebab-case, e.g. `file-stats`)
- **One-sentence description**
- **Flagship or community?** — flagships (first-party, shipped with AppOS) use `space.appos.*` IDs; community plugins use `com.community.*` IDs.
- **Target directory** — where to create the project (any location works; ask if not obvious from context).
- **Rendering mode** — WebView panel (rich UI, streaming progress, media), ViewDescriptor sidebar (simple lists, native feel), or both. If unsure, ask the user what the primary UI looks like.

Generate the plugin ID:
- Flagship: `space.appos.{namenohyphens}` → e.g. `space.appos.filestats`
- Community: `com.community.{namenohyphens}` → e.g. `com.community.filestats`

## 2. Read the relevant skill(s)

Before writing code, invoke the main skill to load the full SDK pattern:

```
Skill: appos-plugin-dev
```

If the plugin will use a WebView panel, also invoke:

```
Skill: webview-panels
```

These skills contain the canonical APIs, file layout, and gotchas. Do not proceed without reading them — the wrong entry-point pattern or an inline `<script>` tag will silently break the plugin.

## 3. Plan permissions and APIs

From the one-sentence description, decide:
- **Permissions** — start minimal. `ui.sidebar` for any panel, `ui.webPanel` for WebView panels (do NOT add the legacy `webview` alias — it has no host-side entry, is never granted, and `/appos-dev:validate` flags it as an ERROR), `shell.execute` + `shellCommands: [...]` for CLI wrappers, `filesystem.read`/`filesystem.write` for file work, `cache` for persistence.
- **System dependencies** — CLIs to probe on startup (with `check.command`, `check.args`, `versionPattern`, `minVersion`, `installHint`, `installUrl`).
- **Settings** — `string`, `enum`, `bool`, or `number` keys shown in the plugin settings sheet. The manifest schema's settings type enum is `bool` — writing `boolean` fails `/appos-dev:validate` schema validation.
- **Rendering mode** — confirms from step 1. Drives whether you create `webview/` or not.

## 4. Create the project directory

```bash
TARGET="{target-directory}"
mkdir -p "$TARGET/src" "$TARGET/dist"
```

If WebView panels are needed, also create `$TARGET/webview/{panelId}/` and `$TARGET/webview/shared/` directories.

## 5. Write package.json

**CRITICAL**: `@appos.space/plugin-types` is the declaration-only SDK. `@appos.space/plugin-utils` and `@appos.space/view-builders` are runtime packages. All three are published on npm — depend on them by version:

```json
{
    "name": "{plugin-name}",
    "version": "1.0.0",
    "private": true,
    "description": "{one-sentence description}",
    "scripts": {
        "build": "node build.mjs",
        "watch": "node build.mjs --watch",
        "typecheck": "tsc --noEmit"
    },
    "devDependencies": {
        "@appos.space/plugin-types": "^3.0.0",
        "esbuild": "^0.20.0",
        "typescript": "^5.4.0"
    },
    "dependencies": {
        "@appos.space/plugin-utils": "^3.0.0",
        "@appos.space/view-builders": "^3.0.0"
    }
}
```

If the plugin doesn't use ViewDescriptor panels at all, you can drop `@appos.space/view-builders` from `dependencies`. If it doesn't need runtime helpers, drop `@appos.space/plugin-utils` too. **`@appos.space/plugin-types` stays in `devDependencies` always** — it's type-only.

If the plugin uses a WebView panel, step 10 extends the `typecheck` script to also cover `webview/` sources — leave it as written for now.

<details>
<summary>SDK contributors only: developing against a local plugin-sdk checkout</summary>

If you are working on the SDK itself, point the three `@appos.space/*` entries at your clone with `file:` dependencies instead of npm versions — e.g. `"@appos.space/plugin-types": "file:../plugin-sdk/packages/plugin-types"` (adjust the relative path to reach your clone's `packages/*` from the plugin directory). Re-run `npm install` after switching. Do not scaffold `file:` paths for third-party plugin authors.

</details>

## 6. Write tsconfig.json + src/jsc-globals.d.ts

**MANDATORY**: `verbatimModuleSyntax: true` is required because `@appos.space/plugin-types` is declaration-only. Without this flag, TypeScript emits runtime `import` statements that try to resolve a non-existent module at runtime.

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "noEmit": true,
        "verbatimModuleSyntax": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "lib": ["ES2022"]
    },
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

Note `"lib": ["ES2022"]` — deliberately **no `DOM`**. Plugin-side code runs in JavaScriptCore: there is no `document`, no `window`, no browser `fetch` (use `ctx.network.fetch`), and no guaranteed timers. Putting `DOM` in this lib would make all of those typecheck clean and then throw at runtime. The globals the runtime genuinely provides come from a scaffolded ambient file instead — write `src/jsc-globals.d.ts` (it is matched by `"include": ["src/**/*.ts"]`, so it is part of this program automatically):

```ts
// src/jsc-globals.d.ts — ambient globals of the AppOS JavaScriptCore plugin
// runtime. JSC ships a native console; the host injects NO timers, so the
// timer globals are typed `| undefined` — an unguarded setTimeout(...) is a
// type error (TS2722) while a `typeof setTimeout === 'function'`-narrowed
// call compiles. Do not add DOM globals here: document/window/browser fetch
// do not exist in the plugin runtime (use ctx.network.fetch).
declare const console: {
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    trace(...args: unknown[]): void;
};
declare const setTimeout: ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => number) | undefined;
declare const clearTimeout: ((id: number | undefined) => void) | undefined;
declare const setInterval: ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => number) | undefined;
declare const clearInterval: ((id: number | undefined) => void) | undefined;
```

With this pair, accidental browser-global use in `src/` fails `npm run typecheck` (`document` → TS2584, `window`/`fetch` → TS2304), an unguarded `setTimeout(...)` fails TS2722, and a `typeof setTimeout === 'function'`-guarded call compiles — matching what actually happens at runtime. `skipLibCheck: true` stays on here because this program pulls in the external SDK `.d.ts` from `node_modules`; the WebView config in step 10 sets it to `false` because its only declaration file is project-owned. This config deliberately covers `src/**/*.ts` ONLY: nothing under `webview/` is part of this program. WebView sources are a separate compilation world — DOM belongs exclusively to their `tsconfig.webview.json`, which step 10 writes and chains into `npm run typecheck`.

## 7. Write build.mjs

This is the esbuild API pattern, not the CLI. It's slightly more code than `npx esbuild ...`, but supports watch mode cleanly and survives `npm run build` across platforms.

```js
/**
 * Build script — bundles TypeScript into a single IIFE for the AppOS JSCore runtime.
 *
 * Usage:
 *   node build.mjs          # One-shot build
 *   node build.mjs --watch  # Watch mode
 */
import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: 'dist/main.js',
    sourcemap: true,
    logLevel: 'info',
};

if (isWatch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await build(buildOptions);
}
```

## 8. Write plugin.json

**LANDMINE**: `minHostVersion` refers to the host app's `CFBundleShortVersionString` (currently `1.0.0`), NOT the `@appos.space/plugin-types` SDK version. Defaulting to the SDK version (e.g. `"3.0.0"`, or the older `"2.4.0"`) will cause `DependencyResolver.swift` to silently reject the plugin before it reaches the plugins sheet. **Always default to `"1.0.0"`.**

```json
{
    "id": "{plugin-id}",
    "name": "{Plugin Display Name}",
    "version": "1.0.0",
    "runtime": "javascript",
    "entrypoint": "dist/main.js",
    "minHostVersion": "1.0.0",
    "author": "{author}",
    "description": "{description}",
    "license": "MIT",
    "activation": { "events": ["onStartup"] },
    "permissions": [
        "ui.sidebar"
    ],
    "settings": []
}
```

Add permissions incrementally based on what the plugin actually does. If it uses a WebView panel, add `"ui.webPanel"` only — do NOT add the legacy `"webview"` alias (it passes schema validation but has no host-side entry, so it is silently never granted, and `/appos-dev:validate`'s legacy-alias post-check reports it as an ERROR). If it uses a CLI, add `shell.execute`, `"shellCommands": ["your-tool"]`, and a `dependencies.system[]` entry with a check command and install hint. If it uses the menubar, add `"menubar"` and remember to call `ctx.menubar.setContent()` to populate the popover (without it, clicking shows "No content").

### Optional: declare public actions via `extensions[]`

If the plugin exposes public actions (command palette, automation), add an `extensions[]` array with `actions.definition` contributions (requires the `actions.register` permission):

```json
"extensions": [
    {
        "extensionPoint": "actions.definition",
        "contribution": {
            "id": "refresh-stats",
            "displayName": "Refresh File Stats",
            "description": "Re-scan the active directory.",
            "inputSchema": { "type": "object" },
            "visibility": ["palette"],
            "risk": "read",
            "approval": "auto"
        }
    }
]
```

**Dual registration is required.** Manifest-declared actions don't reach discovery on their own yet (host bug fn-163; see `skills/appos-plugin-dev/reference/extension-api.md`): an `actions.definition` contribution alone currently never becomes palette-visible or invokable — no cold-start palette entry, no `ctx.actions.all()` stub, no Settings → Actions row. Today the manifest entry is catalog/manifest metadata (visible in catalogs and manifest scans), not runtime discovery. Pair EVERY `actions.definition` contribution with a runtime `ctx.actions.register(...)` or `ctx.actions.registerFromCommand(...)` call in `activate()` using the same id — the runtime registration is what makes the action discoverable and executable. Ship BOTH, exactly as `appos-plugin-ytdlp` does. <!-- remove when fn-163 lands -->

**Removal marker**: when you retire an action, remove BOTH sites — the runtime `register()` call and the manifest contribution. A leftover manifest stub is stale catalog/manifest metadata today, and once fn-163 lands it would be replayed into discovery at every cold start as a permanently non-executable palette entry.

## 9. Write src/main.ts

Use the `disposables[]` + `globalThis.activate` pattern. This is the canonical AppOS plugin entry shape:

```ts
/**
 * {Plugin Name} — entry point.
 */
import type { PluginContext } from '@appos.space/plugin-types';

const disposables: Array<() => void | Promise<void>> = [];

async function activate(ctx: PluginContext): Promise<void> {
    console.log(`[${ctx.pluginId}] activating`);

    // TODO: register panels, commands, events — push each disposer into `disposables`
    // Example:
    //   const panelDisposer = await registerMyPanel(ctx);
    //   disposables.push(panelDisposer);

    console.log(`[${ctx.pluginId}] ready`);
}

async function deactivate(): Promise<void> {
    while (disposables.length > 0) {
        const d = disposables.pop();
        try {
            await d?.();
        } catch (err) {
            const name = err instanceof Error ? err.constructor.name : 'unknown';
            console.error(`[plugin] Dispose error (${name})`);
        }
    }
}

// AppOS injects `activate`/`deactivate` onto globalThis — do NOT use ESM exports here.
(globalThis as unknown as { activate: typeof activate }).activate = activate;
(globalThis as unknown as { deactivate: typeof deactivate }).deactivate = deactivate;
```

**Never use ESM `export` for activate/deactivate.** The IIFE bundle runs the whole file once; the host reads `activate`/`deactivate` off `globalThis` after the script evaluates. Module exports disappear into the IIFE closure.

**Always use `ctx` as the parameter name**, never `pluginContext`. This matches `appos-plugin-ytdlp` and every reference plugin.

## 10. If using a WebView panel, write the webview scaffold

Create `webview/{panelId}/index.html`, `webview/{panelId}/styles.css`, `webview/{panelId}/app.js`, and `webview/shared/bridge.js`. The bridge file is copy-pasta from `appos-plugin-ytdlp/webview/shared/bridge.js` — use the version in the `webview-panels` skill.

Minimal `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self';">
    <title>{Panel Title}</title>
    <link rel="stylesheet" href="./styles.css">
</head>
<body>
    <div id="app"></div>
    <script type="module" src="./app.js"></script>
</body>
</html>
```

**CSP gotcha**: no inline `<script>`, no inline `<style>`, no `onclick="..."`. Everything external, ES modules only. See the `webview-panels` skill for the full rules.

Then in `src/main.ts`, register the panel:

```ts
const disposables: Array<() => void | Promise<void>> = [];  // declared once, in step 9

// SDK 3.0.0 types both calls as returning registration-token strings.
const panelToken = ctx.ui.registerWebPanel('{panelId}', {
    title: '{Panel Title}',
    icon: 'square.grid.2x2',          // SF Symbol
    htmlPath: 'webview/{panelId}/index.html',
    allowNavigation: false,
});

let panelDisposed = false;
const messageToken = ctx.ui.onWebPanelMessage('{panelId}', (envelope) => {
    if (panelDisposed) return;
    // handle messages from webview
});
disposables.push(() => { panelDisposed = true; });
```

Capture the string tokens (`panelToken`, `messageToken`) per the 3.0.0 types, but do NOT build cleanup on their runtime values — the shipped 1.0.0 host returns `undefined` from both calls at runtime (host↔d.ts reconciliation is a known SDK follow-up), and it removes panels and message handlers automatically on plugin unload. Use the `disposed` flag as above for mid-life teardown; calling `onWebPanelMessage` again for the same panel replaces the previous handler. See the `webview-panels` skill → "Cleanup" section.

### Wire webview sources into the typecheck

The step-6 `tsconfig.json` checks `src/**/*.ts` only — without more wiring, nothing under `webview/` (neither the bridge declaration nor your panel `.js`) ever enters `npm run typecheck`, and a misspelled `window.twopanez` / `bridge` member fails silently at runtime. Write `tsconfig.webview.json` next to `tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "noEmit": true,
        "allowJs": true,
        "checkJs": true,
        "skipLibCheck": false,
        "forceConsistentCasingInFileNames": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"]
    },
    "include": ["webview/**/*"]
}
```

Then:

1. Copy the `window.twopanez` ambient declaration from the `webview-panels` skill ("The bridge" section) to `webview/twopanez.d.ts` — it is what types the host-injected global for this config.
2. Update the `typecheck` script in `package.json` to run both worlds: `"typecheck": "tsc --noEmit && tsc -p tsconfig.webview.json"`.

`skipLibCheck` is `false` here on purpose (unlike the step-6 config): the only declaration file this small program sees is the project-owned `webview/twopanez.d.ts`. With `skipLibCheck: true`, a broken or misspelled type inside that file is silently suppressed — `window.twopanez` degrades to an error-`any` and member typos like `window.twopanez.onMesage(...)` pass, which is exactly what this config exists to catch. With `false`, the corruption itself fails typecheck (`TS2552: Cannot find name 'TwopanezBrige'`).

`checkJs` + `strict` means webview `.js` functions need JSDoc `@param`/`@returns` annotations — the skill's `bridge.js` already carries them; copy it as-is. Use `/** @param {any} x */` where typing isn't worth it. `/appos-dev:deploy` already excludes `tsconfig.*.json` from the rsync, so the extra config never ships with the plugin.

## 11. Build

```bash
cd "{target-directory}"
npm install
npm run build
```

Expected output: `dist/main.js` exists and is a single IIFE bundle. Typical size is 20–100kB depending on how much you pulled in from plugin-utils / view-builders.

## 12. Validate

Quick sanity check — the bundle must contain `globalThis` assignments for both entry points:

```bash
grep -c "globalThis" "{target-directory}/dist/main.js"
```

Should return at least 2. If it returns 0, the bundler inlined away the assignments — check that the file ends with `(globalThis as unknown...).activate = activate;`.

Also verify the manifest is well-formed and has `minHostVersion: "1.0.0"`:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('{target-directory}/plugin.json','utf8')).minHostVersion)"
```

Run the typecheck — it must exit 0:

```bash
cd "{target-directory}" && npm run typecheck
```

The typecheck models the real runtimes on both sides. Plugin side (`src/`): browser globals fail (`document` → TS2584, `window`/`fetch` → TS2304) and an unguarded `setTimeout(...)` fails TS2722 — if any of those fire, the code would have thrown in JavaScriptCore at runtime; fix the code (guard timers, use `ctx.network.fetch`) rather than adding `DOM` to the step-6 lib. For WebView plugins it also covers `webview/` via `tsconfig.webview.json` — a misspelled bridge member like `window.twopanez.onMesage(...)` fails there with `TS2551 … Did you mean 'onMessage'?` instead of silently doing nothing at runtime.

## 13. Report

Tell the user:
- Where the plugin was created
- Which permissions/dependencies were declared
- Which rendering mode was used
- Next steps: edit `src/main.ts` to add functionality, `/appos-dev:build` to rebuild, `/appos-dev:deploy` to install, `/appos-dev:validate` to check for issues.

If this is a first-time plugin, also point them at `appos-plugin-ytdlp` as the canonical reference for any pattern they're unsure about — it ships every supported SDK feature.
