---
description: >
  Build plugins for AppOS (formerly 2Panez), the dual-pane macOS file manager. Use this
  skill whenever someone asks about creating, building, testing, or deploying AppOS
  plugins, or when working in a repo that imports from @appos.space/*. Triggers on:
  "AppOS plugin", "2Panez plugin", "@appos.space/plugin-types", "registerWebPanel",
  "pipeShellToWebPanel", "WorkspaceTemplate", "SmartFolder filter", "lifecycle
  dependencies", "plugin.json minHostVersion", or any of the 22 plugin API namespaces.
  Also use PROACTIVELY when the user is working with TypeScript files that import from
  @appos.space/plugin-types or call globalThis.activate with PluginContext.
---

# AppOS Plugin Development

Build plugins for AppOS (formerly 2Panez), a dual-pane file manager for macOS. Plugins are TypeScript modules compiled to IIFE bundles and executed inside JavaScriptCore (JSC). They receive a typed `PluginContext` object that exposes 22 API namespaces for interacting with the host.

The canonical reference implementation is **`appos-plugin-ytdlp`** — the flagship yt-dlp GUI plugin. When designing anything non-trivial, mirror its patterns.

## Architecture

```
TypeScript source
    → esbuild (IIFE, es2020, bundle)
    → dist/main.js
    → JSCore runtime
    → PluginContext (22 namespaces)
    → native SwiftUI  OR  WKWebView with plugin-panel:// scheme
```

- Each plugin runs in its own JSC isolate on a serial dispatch queue.
- No shared state between plugins except through `dataContracts` and `interPluginEvents`.
- UI has **two rendering modes**, chosen per-panel:
  - **ViewDescriptor** — declarative JSON tree → native SwiftUI. Use for lightweight sidebars, file-row annotations, toolbars, menu bar popovers.
  - **WebView panel** — ships HTML/CSS/JS in the plugin bundle, loaded via `plugin-panel://` into a WKWebView. Use for rich UI, streaming progress, media playback, complex forms.
- **JSC has no DOM, no Node, no browser APIs.** Timers may or may not exist — guard with `typeof setTimeout === 'function'`.

## The SDK packages (`@appos.space/*`)

Always depend on the official SDK packages instead of hand-writing types or utilities:

| Package | Purpose | Install |
|---|---|---|
| `@appos.space/plugin-types` | TypeScript types for `PluginContext`, manifest, all 22 namespaces, 33 permissions, design tokens. Declaration-only, zero runtime. | `devDependency` |
| `@appos.space/plugin-utils` | Pure helpers: `urlToPath`, `pathToUrl`, `fileExtension`, `formatSize`, `formatDate`, `generateId`, `debounce`, `throttle`, `createActionRouter`. | `dependency` |
| `@appos.space/view-builders` | Typed helpers (`vstack`, `section`, `listItem`, `button`) that return plain `ViewDescriptor` objects. Zero runtime. | `dependency` |

The plugin-types version `2.4.x` tracks **plugin API** `2.4.x` — it is NOT the host app version. See the *minHostVersion landmine* section below.

### Mandatory tsconfig flag

Because `@appos.space/plugin-types` is declaration-only, you MUST enable:

```json
{ "compilerOptions": { "verbatimModuleSyntax": true } }
```

Without it, `import { PluginContext }` compiles to a runtime import against a no-JS package and the bundler will fail.

### Importing from the SDK

```ts
import type { PluginContext, DependencyStatus, WorkspaceTemplate } from '@appos.space/plugin-types';
import { urlToPath, formatSize, createActionRouter } from '@appos.space/plugin-utils';
import { vstack, section, listItem, button } from '@appos.space/view-builders';
```

Use `import type` for everything from `plugin-types`. The other two packages have real runtime exports.

## Plugin entry pattern

The JSC runtime looks up `activate` / `deactivate` on `globalThis` — not as named ESM exports (IIFE format doesn't expose them). Assign at the bottom of `src/main.ts`:

```ts
import type { PluginContext } from '@appos.space/plugin-types';

const disposables: Array<() => void | Promise<void>> = [];

async function activate(ctx: PluginContext): Promise<void> {
    // Register everything. Push every disposer onto disposables[].
    disposables.push(await registerDownloadPanel(ctx));
    // ...
}

async function deactivate(): Promise<void> {
    // Drain in reverse order with per-item try/catch so one bad dispose
    // never blocks the rest.
    while (disposables.length) {
        const d = disposables.pop();
        try { await d?.(); } catch (err) { console.error('[plugin] Dispose error:', err); }
    }
}

;(globalThis as any).activate = activate;
;(globalThis as any).deactivate = deactivate;
```

The leading `;` on the globalThis assignments prevents ASI hazards when the preceding statement lacks a semicolon. **Use `ctx` as the parameter name**, not `pluginContext` or `context`.

## Decision tree: UI needs → API choice

| Need | API | Rendering | Notes |
|---|---|---|---|
| Rich forms, streaming progress, media playback | `ctx.ui.registerWebPanel()` | WKWebView | Bundle HTML/CSS/JS under `webview/<panel>/`. Use for yt-dlp-style UIs. |
| Lightweight sidebar (file annotations, git status, file stats) | `ctx.ui.registerPanel()` | SwiftUI via ViewDescriptor | Cheap, reactive, composes well. |
| Activity bar icon + sidebar | `ctx.ui.registerActivityView()` | SwiftUI via ViewDescriptor | Use for primary feature entry points. |
| Menu bar status item (with badge) | `ctx.menubar.register()` / `setBadge()` | NSStatusItem | Subscribe to `menubar.clicked` event to handle clicks. |
| Multi-pane layout (opening the plugin puts tabs in both panes) | `ctx.workspaces.register()` + `apply()` | Native window layout | Apply unconditionally on every activation. See workspace section below. |
| File-aware filters (smart folders) | `ctx.smartFolders.registerFilterType()` | Host invokes `evaluate` closure in plugin's JSC | Closures capture plugin state — rebuild lookups on state change via `subscribe()`. |
| Toast / HUD / alert | `ctx.feedback.toast()` / `.hud()` / `.alert()` | Native AppKit | `notify()` auto-routes: focused→toast, unfocused→HUD, background→system notification. |
| Keyboard shortcuts | `ctx.shortcuts.register({ commandId, keys })` | — | Must bind to an already-registered `ctx.commands.register()`. |
| Persistent state (queue, library, history) | `ctx.cache.set(key, value, { persist: true })` | SQLite write-through | Default is memory-only — pass `persist: true` for durability. `cache.get()` returns deserialized values — do NOT `JSON.parse`. |
| Run a CLI with streaming output | `ctx.ui.pipeShellToWebPanel(panelId, shellOpts)` | Chunks flow into the webview | **Method lives on `ctx.ui`, NOT `ctx.shell`.** Hard 120s timeout — use resume-loops for long jobs. |
| React to dependency changes | `ctx.lifecycle.onDependencyStatusChanged(fn)` | — | Host pushes status at activation. `getDependencyStatus()` / `recheckDependencies()` are types-only — do NOT call. |

### Two WebView panels maximum per plugin

The host caps WebView panels at **2 per plugin / 6 globally**. If your UI needs more surfaces, use view switching inside a panel or fall back to ViewDescriptor-based panels.

### ViewDescriptor quick reference

The SDK defines **17 ViewDescriptor types**: `vstack`, `hstack`, `scroll`, `list`, `grid`, `text`, `label`, `image`, `remoteImage`, `badge`, `button`, `listItem`, `textField`, `progress`, `section`, `divider`, `spacer`. Use `@appos.space/view-builders` for typed helpers.

### WebView Panel Guidance

**When to choose WebView over ViewDescriptor:**
- Rich interactive UI: forms, tables, streaming terminal output, media playback, charts
- Complex layouts that exceed what `vstack`/`hstack`/`grid` can express
- Reuse of existing HTML/CSS/JS libraries

**When to use ViewDescriptor instead:**
- Simple sidebars, file annotations, status displays, settings panels
- No need for custom styling or complex interaction
- Lower overhead (no WKWebView process)

**File structure for WebView panels:**

```
my-plugin/
  src/main.ts           # registerWebPanel('main-panel', { htmlPath: 'webview/main/index.html' })
  webview/
    main/
      index.html        # Entry point (NO inline <script> or <style> — CSP blocks them)
      app.js            # External JS loaded via <script type="module" src="app.js">
      styles.css        # External CSS loaded via <link rel="stylesheet" href="styles.css">
```

**Message bridge:** Use `window.twopanez.send(msg)` for fire-and-forget messages and `window.twopanez.request(msg)` for request/response. Receive host pushes via `window.twopanez.onMessage(fn)`. Version all messages with `v: 1` and discriminate by `type`.

**CSP constraint:** Inline `<script>` and `<style>` are blocked by Content Security Policy. All JS and CSS must be external files. If the WebView renders blank, check for inline scripts first.

**CSS custom properties:** The host injects `--twopanez-bg`, `--twopanez-text`, `--twopanez-accent`, and 12 other design tokens into every WebView. Use `var(--twopanez-bg)` instead of hardcoded colors. See `extension-api.md` for the full list.

## WebView panel pattern (rich UI)

Register the panel in `activate()`, passing the bundle-relative path to the HTML:

```ts
ctx.ui.registerWebPanel('download', {
    title: 'Downloads',
    icon: 'arrow.down.circle',
    htmlPath: 'webview/download/index.html',
    allowNavigation: false,
});

ctx.ui.onWebPanelMessage('download', (envelope) => {
    const msg = envelope.data;  // unknown — validate before routing
    // Route msg.type to handlers...
});
```

The `htmlPath` resolves **relative to the plugin root at runtime**, so the `webview/` tree MUST ship with the installed plugin (do not exclude it from rsync). All JS/CSS must be external files — CSP blocks inline `<script>` and `<style>`.

### Webview-side bridge

The host injects `window.twopanez` into every plugin webview with this shape:

```ts
window.twopanez.send(msg)        // fire-and-forget → onWebPanelMessage
window.twopanez.request(msg)     // request/response → onWebPanelRequest
window.twopanez.onMessage(fn)    // inbound push from postToWebPanel
window.twopanez.instanceId       // per-WKWebView UUID (multi-instance isolation)
window.twopanez.windowId         // app window ID
window.twopanez.paneId           // "left" | "right"
```

Wrap this in a thin `bridge.js` module per plugin (see `appos-plugin-ytdlp/webview/shared/bridge.js` for the canonical pattern, including how to split "protocol messages" from "shell chunks" into separate listener buckets).

### pipeShellToWebPanel (direct CLI → WebView streaming)

This is the superpower that makes CLI-wrapping plugins possible. The host spawns the process, streams `{ stream: "stdout"|"stderr", data, bytesTotal }` chunks directly to every WKWebView instance of the panel, and returns a final `ShellExecuteResult`:

```ts
const result = await ctx.ui.pipeShellToWebPanel('download', {
    command: 'yt-dlp',
    args: ['--ignore-config', '--newline', url],
    cwd: outputDir,           // T1 (contained) tier REQUIRES absolute cwd
    timeout: 119,             // host hard-caps at 120s; leave headroom
});
```

**Critical gotchas:**
- `ctx.ui.pipeShellToWebPanel`, not `ctx.shell.pipeShellToWebPanel`. Some older docs are wrong.
- Still subject to the 120s cap — long-running jobs need a resume loop with `--continue`-style flags.
- Shell chunks arrive via `window.twopanez.onMessage()` **alongside** `postToWebPanel` messages, so filter them in the bridge (chunks have `{stream, data}` without `v`/`type`).
- Always pass `cwd` as an expanded absolute path — T1 sandbox rejects `~` and relative paths.
- Always pass `--ignore-config` (or equivalent) to CLIs that read ambient user config, so users' `~/.config/<tool>/config` can't inject flags that bypass your validation.

### postToWebPanel (plugin → webview push)

```ts
ctx.ui.postToWebPanel('download', {
    v: 1,
    type: 'queue-update',
    entries: state.getQueue(),
});
```

Always version your messages (`v: 1`) and discriminate by `type`. Drop malformed inbound messages at the webview bridge (protocol guard). The ytdlp plugin uses a typed `PanelInboundMessage` discriminated union + a `parseInbound` function to narrow — adopt that pattern for any non-trivial panel.

## ViewDescriptor pattern (lightweight native UI)

For simple panels, skip the WebView entirely and ship a ViewDescriptor tree. Use `@appos.space/view-builders` for ergonomics:

```ts
import { vstack, section, listItem, button, hstack, spacer } from '@appos.space/view-builders';

ctx.ui.registerPanel('stats', {
    title: 'File Stats',
    icon: 'chart.bar',
    priority: 100,
    view: vstack([
        section('Summary', { icon: 'doc.on.doc', badge: String(total) }, [
            listItem('Files', { icon: 'doc', subtitle: `${fileCount}` }),
            listItem('Total size', { icon: 'shippingbox', subtitle: formatSize(totalBytes) }),
        ]),
        hstack([
            button('Refresh', { action: 'refresh' }),
            spacer(),
        ]),
    ]),
    handler: (action) => { /* route action strings */ },
});
```

Call `registerPanel` with the same ID to replace the view reactively.

### menuActions on listItem

Context menus are the #1 UX pattern for ViewDescriptor lists. The value MUST be a JSON string (not an object):

```ts
import { encodeMenuActions } from '@appos.space/view-builders';

listItem(entry.title, {
    icon: 'video',
    action: 'open:' + entry.id,
    menuActions: encodeMenuActions([
        { title: 'Open',   icon: 'arrow.up.forward.app', action: 'open:' + entry.id },
        { title: 'Reveal', icon: 'magnifyingglass',       action: 'reveal:' + entry.id },
        { title: '---' },
        { title: 'Delete', icon: 'trash', action: 'delete:' + entry.id, destructive: true },
    ]),
});
```

Actions are plain strings routed through the panel `handler`. Use short semantic prefixes: `open:`, `reveal:`, `delete:`, `select:` — not verbose `open-collection:` or `delete-entry:`.

## WorkspaceTemplate (dual-pane layouts)

Workspaces register an entire window layout and can be applied with one call. Use this to give your plugin a "canonical UI" users can open in one click.

```ts
import type { WorkspaceTemplate } from '@appos.space/plugin-types';

await ctx.workspaces.register({
    schemaVersion: 1,
    id: 'ytdlp-dual-pane',
    name: 'yt-dlp Downloader',
    source: { type: 'plugin', pluginId: ctx.pluginId },
    leftPane: {
        tabs: [
            { type: 'pluginPanel', panelId: 'download' },
            { type: 'terminal' },
        ],
        activeTab: 0,
    },
    rightPane: {
        tabs: [
            { type: 'pluginPanel', panelId: 'library' },
            { type: 'fileBrowser', path: outputDir },
            { type: 'webBrowser' },
        ],
        activeTab: 0,
    },
});
```

**Apply unconditionally on every activation** — NOT gated on a first-run cache flag. `activate()` only runs once per 2Panez launch, so calling `ctx.workspaces.apply('ytdlp-dual-pane')` at the end of activation is effectively once-per-launch. This is the only reliable way to guarantee the user sees your plugin's UI.

> **LANDMINE — do not gate workspace apply behind `applyIfFirstRun` / `cache.get('initialized')`**
>
> Cache-flag gating (`if (await ctx.cache.get('initialized')) return;`) causes a silent "plugin installed but invisible" bug on every launch after the first. The workspace dropdown is easy to miss, the command palette requires knowing exact names, and the menubar NSStatusItem is a single small icon — none of those are reliable discovery paths. Always apply the workspace unconditionally; the user can still switch to a different workspace after activation and you won't override them until next launch. This is what `appos-plugin-ytdlp` does at Step 11 of `activate()`.

**Panel-open commands must apply the workspace first**: `ctx.ui.showPaneTab(panelId, ...)` only **focuses** an existing tab — it does NOT create tabs. A command like "Open yt-dlp Downloader" that calls `showPaneTab` will silently do nothing if the current workspace has no tab for that panel. Always `await ctx.workspaces.apply(WORKSPACE_ID)` before `showPaneTab` in panel-open commands.

```ts
ctx.commands.register('open-download-panel', {
    title: 'Open yt-dlp Downloader',
    handler: async () => {
        try { await ctx.workspaces.apply('ytdlp-dual-pane'); } catch (err) { console.warn(err); }
        try { ctx.ui.showPaneTab('download', { title: 'Downloads', pane: 'left' }); } catch { /* workspace apply already surfaced the panel */ }
    },
});
```

**Re-register on settings change**: for paths that depend on settings (like `fileBrowser.path`), subscribe via `ctx.settings.onKeyChange()` and call `workspaces.register()` again with the updated template. `register()` returns `Promise<string>` (the workspace ID).

## Menu bar (fn-41)

```ts
await ctx.menubar.register({ icon: 'arrow.down.circle' });
await ctx.menubar.setBadge(activeCount);  // 0 clears

const clickToken = ctx.events.subscribe('menubar.clicked', async () => {
    await ctx.workspaces.apply('ytdlp-dual-pane');
});
// Cleanup: ctx.events.unsubscribe(clickToken)
```

`ctx.menubar.register({ icon, label? })` — only `icon` and `label` are supported in `MenuBarRegisterOptions`. Drive `setBadge` from your state `subscribe()` so it stays reactive. Cleanup order: unsubscribe state → `ctx.events.unsubscribe(clickToken)` → `ctx.menubar.remove()`. Guard every step with try/catch so one failure can't block the next.

## Smart folder filters (fn-13)

Filter types let you contribute to Smart Folders. The `evaluate` callback is **synchronous** and invoked from the host in your plugin's JSC isolate, which means closures capture plugin state directly.

```ts
// Rebuild lookup tables on every state change...
let favoritesByUrl = new Map<string, boolean>();
const unsubState = subscribe(() => {
    favoritesByUrl = new Map(library.map(e => [e.fileUrl, e.favorite]));
});

await ctx.smartFolders.registerFilterType({
    id: 'favorites',           // auto-prefixed with `{pluginId}.filter.`
    displayName: 'Favorites',
    evaluate: (item: { url: string; metadata: Record<string, unknown> }) =>
        favoritesByUrl.get(item.url) === true,
});
```

`registerFilterType` returns `Promise<string>` (the namespaced ID). There is no `unregisterFilterType` — filters auto-clean on plugin deactivation. Set a `disposed` flag in the closure so any late `evaluate` calls return `false` safely.

## Lifecycle + dependency management (fn-50)

Declare system/plugin dependencies in `plugin.json.dependencies`. The host probes them at activation and pushes status via `ctx.lifecycle.onDependencyStatusChanged`:

```ts
// Subscribe early so you never miss the initial status push at activation
const token = ctx.lifecycle.onDependencyStatusChanged((statuses) => {
    // DependencyStatus[]: { name, type, required, satisfied, state, installedVersion, installHint, ... }
    // Update UI banner, resume paused work if deps just became available
});
```

> **WARNING**: `ctx.lifecycle.getDependencyStatus()` and `ctx.lifecycle.recheckDependencies()` are defined in `plugin-api.d.ts` and compile without error, but **runtime support is deferred**. Do NOT call these APIs in plugin code yet. Use `onDependencyStatusChanged` (which IS wired) to receive status updates pushed by the host. See `appos-plugin-ytdlp/src/main.ts` step 9 for the canonical pattern.

## plugin.json manifest

```json
{
    "id": "space.appos.myplugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "runtime": "javascript",
    "entrypoint": "dist/main.js",
    "minHostVersion": "1.0.0",
    "author": "Me",
    "description": "What it does.",
    "license": "MIT",
    "activation": { "events": ["onStartup"] },
    "permissions": [
        "ui.webPanel",
        "shell.execute",
        "filesystem.read",
        "filesystem.write",
        "cache",
        "feedback"
    ],
    "shellCommands": ["yt-dlp", "ffmpeg"],
    "dependencies": {
        "system": [
            {
                "name": "yt-dlp",
                "required": true,
                "check": { "command": "yt-dlp", "args": ["--version"], "versionPattern": "(\\d{4}\\.\\d{2}\\.\\d{2})" },
                "minVersion": "2024.08.06",
                "installHint": "brew install yt-dlp"
            }
        ]
    },
    "settings": [
        { "key": "outputDir", "label": "Download Directory", "type": "string", "default": "" }
    ]
}
```

**Plugin ID conventions:**
- Flagship / first-party plugins: `space.appos.<name>` (e.g., `space.appos.ytdlp`)
- Community plugins: `com.community.<name>`
- Never use host-internal prefixes like `space.appos.core.*` (reserved).

### minHostVersion LANDMINE

`minHostVersion` is compared against the host app's `CFBundleShortVersionString` (e.g., `1.7.0` for `/Applications/2Panez.app`), **NOT** the `@appos.space/plugin-types` SDK version (`2.4.x`). Conflating them causes silent plugin load failures — `DependencyResolver` emits `hostVersionTooLow` and the plugin never appears in the Settings sheet.

- Default to `"1.0.0"` unless you know you need a newer host.
- Check the real host version with `defaults read /Applications/2Panez.app/Contents/Info.plist CFBundleShortVersionString`.
- If a plugin doesn't appear after install + restart, CHECK THIS FIRST.

### Permissions

There are 33 permission scopes. Only request what you use. Common ones:

- `ui.webPanel` — register WebView panels (required for `registerWebPanel`)
- `ui.sidebar` — register sidebar panels (required for `registerPanel`)
- `ui.contextMenu` — contribute to right-click menus
- `ui.notifications` — legacy `ctx.ui.showNotification()` (NOT for `ctx.feedback`)
- `ui.shortcuts` — keyboard shortcuts
- `shell.execute` — run CLIs (must also list binary names in `shellCommands`)
- `filesystem.read`, `filesystem.write` — file ops via `fileOps`
- `clipboard.read`, `clipboard.write` — clipboard access
- `feedback` — `ctx.feedback.toast()`, `.hud()`, `.notify()`, `.systemNotification()`
- `feedback.confirm` — `ctx.feedback.alert()` (blocking modal)
- `network.outbound` — `ctx.network.fetch()` / `.download()` (also list domains in `networkDomains`)
- `network.unrestricted` — unrestricted network access (no domain allowlist)
- `cache`, `workspaces`, `menubar`, `smartFolders`
- `webview` — the runtime capability that backs `ui.webPanel` / `pipeShellToWebPanel`

The full list lives in `reference/plugin-api.d.ts` under `PermissionScope`.

## Build

Use esbuild via a `build.mjs` script, not raw flags — this is the pattern used by `appos-plugin-ytdlp` and it supports watch mode cleanly:

```js
// build.mjs
import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const opts = {
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
    const ctx = await context(opts);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await build(opts);
}
```

```json
// package.json scripts
{
    "scripts": {
        "build": "node build.mjs",
        "watch": "node build.mjs --watch",
        "typecheck": "tsc --noEmit"
    }
}
```

**Required esbuild flags**: `format: 'iife'`, `target: 'es2020'`, `bundle: true`. ESM will NOT load in JSC.

## Deploy

Install to the user plugin directory. The bundle ID prefix is `com.twopanez` (legacy — kept for install-path compatibility), not `space.appos`:

```bash
rsync -av --delete --delete-excluded \
  --exclude='.DS_Store' --exclude='.git/' --exclude='.gitignore' \
  --exclude='node_modules/' --exclude='src/' --exclude='scripts/' \
  --exclude='*.test.ts' --exclude='build.mjs' --exclude='tsconfig.json' \
  --exclude='package.json' --exclude='package-lock.json' \
  --exclude='CLAUDE.md' --exclude='AGENTS.md' --exclude='SPEC.md' \
  --exclude='types/' --exclude='dist/main.js.map' \
  ./ "$HOME/Library/Application Support/com.twopanez/plugins/$PLUGIN_ID/"
```

**Critical flags:**
- `--delete` removes files on dest that are absent on source.
- `--delete-excluded` removes files matching `--exclude` patterns on dest. **Without it**, files you added to `--exclude` stay on dest forever if they were copied on a previous deploy — this bit us during the ytdlp ship.
- Ship `dist/main.js`, `plugin.json`, `webview/`, `assets/`, `README.md`, `LICENSE`, `CHANGELOG.md`. Exclude `src/`, tests, build config, dev docs, `.flow/`, `.git/`.

Then restart AppOS to pick up the new plugin (plugins are loaded at startup).

## Critical constraints (the gotchas that bite)

- **IIFE only** — `format: 'iife'`. ESM will not load in JSC.
- **`globalThis.activate` / `deactivate`** — not ESM exports. The runtime looks them up on globalThis.
- **Use `ctx` as the parameter name** — enforced convention in AppOS plugins.
- **`verbatimModuleSyntax: true`** is mandatory when using `@appos.space/plugin-types`.
- **`ctx.ui.pipeShellToWebPanel`**, not `ctx.shell.pipeShellToWebPanel`.
- **120-second shell cap** — `ctx.shell.execute` (and `pipeShellToWebPanel`) hard-limit at 120s. Long jobs need a resume loop.
- **`cwd` is required** for shell execution in T1 (contained) tier. Must be an absolute expanded path — no `~`.
- **Max 2 WebView panels per plugin, 6 globally.**
- **Cache returns deserialized values** — no `JSON.parse` on `cache.get()`. Pass `{ persist: true }` on `cache.set()` for durability.
- **`process.terminate()` only signals direct child** — subprocesses (e.g., ffmpeg spawned by yt-dlp) orphan on cancel.
- **No DOM/Node APIs in main.js** — only webviews have a DOM. Guard any timer usage with `typeof setTimeout === 'function'`.
- **Webview CSP blocks inline JS/CSS** — everything must be external files loaded via `<script type="module">` / `<link rel="stylesheet">`. Content is served via `plugin-panel://`.
- **`--ignore-config`** or equivalent on every wrapped CLI invocation — neutralize ambient user config that could inject dangerous flags.
- **`minHostVersion` is the HOST version**, NOT the SDK version. Default to `"1.0.0"`.
- **Host does not expose `unregisterFilterType`** — smart folder filters auto-clean on unload. Use a `disposed` flag guard.
- **Install path**: `~/Library/Application Support/com.twopanez/plugins/$PLUGIN_ID/` (note `com.twopanez`, not `space.appos`).

## Reference files

For the full API, read these in `reference/`:
- `plugin-api.d.ts` — Live TypeScript type definitions synced from `@appos.space/plugin-types` (~2950 lines, 22 namespaces).
- `patterns.md` — Canonical patterns extracted from `appos-plugin-ytdlp` (activation ordering, disposable tracking, message typing, resume loops, multi-instance isolation).
- `extension-api.md` — Human-readable API walkthrough for namespaces, manifest fields, and permissions.

When starting a new plugin, always read `patterns.md` and spot-check `plugin-api.d.ts` against any API you plan to call — the host is still evolving and the SDK version you're compiling against may lag runtime.
