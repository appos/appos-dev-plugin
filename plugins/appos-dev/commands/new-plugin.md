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
- **Flagship or community?** — flagships use `space.appos.*` IDs and live under `~/Documents/GitHub/AppOS/appos-plugin-{name}/`. Community plugins use `com.community.*` IDs and live under a community-plugins repo of the user's choice.
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
- **Permissions** — start minimal. `ui.sidebar` for any panel, `ui.webPanel` + `webview` for WebView panels (BOTH required), `shell.execute` + `shellCommands: [...]` for CLI wrappers, `filesystem.read`/`filesystem.write` for file work, `cache` for persistence.
- **System dependencies** — CLIs to probe on startup (with `check.command`, `check.args`, `versionPattern`, `minVersion`, `installHint`, `installUrl`).
- **Settings** — `string`, `enum`, or `boolean` keys shown in the plugin settings sheet.
- **Rendering mode** — confirms from step 1. Drives whether you create `webview/` or not.

## 4. Create the project directory

```bash
TARGET="{target-directory}"
mkdir -p "$TARGET/src" "$TARGET/dist"
```

If WebView panels are needed, also create `$TARGET/webview/{panelId}/` and `$TARGET/webview/shared/` directories.

## 5. Write package.json

**CRITICAL**: `@appos.space/plugin-types` is the declaration-only SDK. `@appos.space/plugin-utils` and `@appos.space/view-builders` are runtime packages.

For local development against the SDK in the AppOS repo, use `file:` dependencies. Adjust the relative paths to reach `~/Documents/GitHub/AppOS/plugin-sdk/packages/*` from the target directory.

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
        "@appos.space/plugin-types": "file:../plugin-sdk/packages/plugin-types",
        "esbuild": "^0.20.0",
        "typescript": "^5.4.0"
    },
    "dependencies": {
        "@appos.space/plugin-utils": "file:../plugin-sdk/packages/plugin-utils",
        "@appos.space/view-builders": "file:../plugin-sdk/packages/view-builders"
    }
}
```

If the plugin doesn't use ViewDescriptor panels at all, you can drop `@appos.space/view-builders` from `dependencies`. If it doesn't need runtime helpers, drop `@appos.space/plugin-utils` too. **`@appos.space/plugin-types` stays in `devDependencies` always** — it's type-only.

## 6. Write tsconfig.json

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
        "lib": ["ES2020", "DOM"]
    },
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

Note `"lib": ["ES2020", "DOM"]` — the `DOM` entry is only needed if the plugin ships `webview/*.js` files it wants to typecheck. For pure plugin-side code, `"ES2020"` alone is fine.

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

**LANDMINE**: `minHostVersion` refers to the host app's `CFBundleShortVersionString` (currently `1.7.0`), NOT the `@appos.space/plugin-types` SDK version. Defaulting to the SDK version (e.g. `"2.4.0"`) will cause `DependencyResolver.swift` to silently reject the plugin before it reaches the plugins sheet. **Always default to `"1.0.0"`.**

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

Add permissions incrementally based on what the plugin actually does. If it uses a WebView panel, add BOTH `"ui.webPanel"` AND `"webview"`. If it uses a CLI, add `shell.execute`, `"shellCommands": ["your-tool"]`, and a `dependencies.system[]` entry with a check command and install hint. If it uses the menubar, add `"menubar"` and remember to call `ctx.menubar.setContent()` to populate the popover (without it, clicking shows "No content").

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
ctx.ui.registerWebPanel('{panelId}', {
    title: '{Panel Title}',
    icon: 'square.grid.2x2',          // SF Symbol
    htmlPath: 'webview/{panelId}/index.html',
    allowNavigation: false,
});

disposables.push(ctx.ui.onWebPanelMessage('{panelId}', (envelope) => {
    // handle messages from webview
}));
```

`onWebPanelMessage` returns `void`, not a disposer — track a `disposed` flag inside your handler instead, or push a no-op cleanup. See the `webview-panels` skill → "Cleanup" section.

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

## 13. Report

Tell the user:
- Where the plugin was created
- Which permissions/dependencies were declared
- Which rendering mode was used
- Next steps: edit `src/main.ts` to add functionality, `/appos-dev:build` to rebuild, `/appos-dev:deploy` to install, `/appos-dev:validate` to check for issues.

If this is a first-time plugin, also point them at `appos-plugin-ytdlp` as the canonical reference for any pattern they're unsure about — it ships every supported SDK feature.
