---
name: appos-plugin-dev
description: >
  Build plugins for AppOS, the dual-pane macOS workspace manager. Use
  whenever someone asks about creating, building, testing, or deploying
  AppOS plugins, or when working in a repo importing from @appos.space/*.
  Triggers on: "AppOS plugin", "@appos.space/plugin-types", "PluginContext",
  "actions.register", "ActionExecutionContext", "registerWebPanel",
  "pipeShellToWebPanel", "WorkspaceTemplate", "extensions[]", "plugin.json
  minHostVersion", or any ctx.<namespace> plugin API call. Also use
  PROACTIVELY on TypeScript that imports @appos.space/plugin-types or
  assigns activate/deactivate onto globalThis.
---

# AppOS Plugin Development

Build plugins for AppOS, a dual-pane workspace manager for macOS. Plugins
are TypeScript modules compiled to IIFE bundles executed inside
JavaScriptCore (JSC). They receive a typed `PluginContext` exposing, as of
SDK 3.0.0, 43 namespaces — the original host surface (panels, files,
shell, workspaces) plus the core-plugin platform wave (actions, scheduler,
notifications, storage, vault, entities, LLM, recipes, ...). The canonical
reference implementation is **`appos-plugin-ytdlp`** — the flagship yt-dlp
GUI plugin; when designing anything non-trivial, mirror its patterns.

## Reference files (read these early)

Everything enumerable lives in `reference/` — this file teaches the shape,
the references carry the detail:

- `reference/extension-api.md` — namespace-by-namespace API map,
  `extensions[]` manifests, the permission-scope model, catalog bundle
  layout, WebView bridge + CSS tokens.
- `reference/patterns.md` — canonical patterns (activation ordering,
  actions, notifications, scheduler, message typing, resume loops).
- `reference/plugin-api/` — byte-verbatim mirror of the published
  `@appos.space/plugin-types` d.ts modules. Namespace methods:
  `grep -rn "interface ActionsAPI" reference/plugin-api/`; all namespaces:
  `grep -n "readonly" reference/plugin-api/core.d.ts`; permission union:
  `grep -n "CanonicalPermissionScope" reference/plugin-api/permissions.d.ts`.
- `reference/migration-2.x-to-3.0.md` — migrating a 2.4.x-era plugin to
  SDK 3.0.0 (renames, exec-context handlers, token returns, pins).

For a new plugin: read `patterns.md` first, spot-check every API you plan
to call against the `plugin-api/` mirror.

## Architecture

```
TypeScript source
    → esbuild (IIFE, es2020, bundle)
    → dist/main.js
    → JSCore runtime
    → PluginContext (typed namespaces)
    → native SwiftUI  OR  WKWebView with plugin-panel:// scheme
```

- Each plugin runs in its own JSC isolate on a serial dispatch queue.
  Cross-plugin interaction flows through platform surfaces (public actions,
  the typed event bus, `dataContracts`, shared-store grants) — never
  shared memory.
- UI has **two rendering modes**, chosen per-panel: **ViewDescriptor**
  (declarative JSON tree → native SwiftUI; lightweight sidebars,
  annotations, toolbars, popovers) or **WebView panel** (HTML/CSS/JS in
  the bundle via `plugin-panel://`; rich UI, streaming, media, forms).
- **JSC has no DOM, no Node, no browser APIs.** Timers may or may not
  exist — guard with `typeof setTimeout === 'function'`. Same for `URL`:
  hosts 1.1.0+ inject a Foundation-bridged `URL` global (immutable v1
  subset, no `searchParams`), but older hosts, the
  `appos.jsc.urlGlobal.disabled` kill switch, and menu-bar contexts lack
  it — guard with `typeof URL === 'function'`
  (`reference/patterns.md` §24).

## The SDK packages (`@appos.space/*`)

Always depend on the official SDK packages (3.0.0 line) instead of
hand-writing types or utilities:

| Package | Purpose | Install |
|---|---|---|
| `@appos.space/plugin-types` | Types for `PluginContext`, every namespace, manifest, permission scopes, design tokens. Declaration-only, zero runtime. | `devDependency` |
| `@appos.space/plugin-utils` | Pure helpers: `urlToPath`, `pathToUrl`, `fileExtension`, `formatSize`, `formatDate`, `generateId`, `debounce`, `throttle`, `createActionRouter`. | `dependency` |
| `@appos.space/view-builders` | Typed helpers (`vstack`, `section`, `listItem`, `button`, `encodeMenuActions`) returning plain `ViewDescriptor` objects. | `dependency` |

Pin the 3.x line: `"@appos.space/plugin-types": "^3.0.0"` (and siblings).
The SDK version is NOT the host app version (see the *minHostVersion
landmine* below), and the README inside the published plugin-types tarball
is stale — trust the d.ts, not the package README.

### Mandatory tsconfig flag

Because `@appos.space/plugin-types` is declaration-only, you MUST enable:

```json
{ "compilerOptions": { "verbatimModuleSyntax": true } }
```

Without it, `import { PluginContext }` compiles to a runtime import against
a no-JS package and the bundler will fail.

### Importing from the SDK — no ambient globals

```ts
import type { PluginContext, ActionExecutionContext, WorkspaceTemplate } from '@appos.space/plugin-types';
import { urlToPath, formatSize } from '@appos.space/plugin-utils';
import { vstack, section, listItem, button } from '@appos.space/view-builders';
```

The SDK's main entry ships no ambient globals — `import type` every
`plugin-types` name you use (TS2304 on an SDK name means you forgot). The
other two packages have real runtime exports. One opt-in exception: the
SDK 3.0.1+ `@appos.space/plugin-types/globals` subpath types the
host-injected `URL` global — it augments nothing unless a tsconfig
references it; the scaffolded `src/jsc-globals.ts` declares the same
surface locally (any 3.x pin; keep exactly ONE).

## Plugin entry pattern

The JSC runtime looks up `activate` / `deactivate` on `globalThis` — not as
named ESM exports (IIFE format doesn't expose them). Assign at the bottom
of `src/main.ts`:

```ts
import type { PluginContext } from '@appos.space/plugin-types';

declare function registerDownloadPanel(ctx: PluginContext): Promise<() => void>;

const disposables: Array<() => void | Promise<void>> = [];

async function activate(ctx: PluginContext): Promise<void> {
    // Register everything; push every disposer onto disposables[].
    disposables.push(await registerDownloadPanel(ctx));
}

async function deactivate(): Promise<void> {
    // Drain in reverse with per-item try/catch — one bad dispose never blocks the rest.
    while (disposables.length) {
        const d = disposables.pop();
        try { await d?.(); } catch (err) { console.error('[plugin] Dispose error:', err); }
    }
}

;(globalThis as any).activate = activate;
;(globalThis as any).deactivate = deactivate;
```

The leading `;` on the globalThis assignments prevents ASI hazards. **Use
`ctx` as the parameter name**, not `pluginContext` or `context`.

## Decision tree: need → API

| Need | API | Notes |
|---|---|---|
| Expose a capability to the palette, other plugins, or AI agents | `ctx.actions.register()` | The fn-89 action fabric — schema-validated, receipted. See below. |
| Rich forms, streaming progress, media playback | `ctx.ui.registerWebPanel()` | WKWebView; bundle HTML/CSS/JS under `webview/<panel>/`. |
| Lightweight sidebar (annotations, status, stats) | `ctx.ui.registerPanel()` | SwiftUI via ViewDescriptor — cheap, reactive. |
| Activity bar icon + sidebar | `ctx.ui.registerActivityView()` | Primary feature entry points. |
| Menu bar status item (with badge) | `ctx.menubar.register()` / `setBadge()` / `setContent()` | `setContent` is REQUIRED or the popover says "No content". |
| Multi-pane layout on open | `ctx.workspaces.register()` + `apply()` | Apply unconditionally on every activation (see below). |
| Run work on a schedule | `ctx.scheduler.scheduleJob()` | Cron/interval/fsEvents/calendar triggers dispatching a registered action. |
| Notify the user (routable) | `ctx.notifications.emit()` | User rules pick the channel — never the emitter. |
| Toast / HUD / alert (always local) | `ctx.feedback.toast()` / `.hud()` / `.alert()` | `notify()` auto-routes by focus state. |
| Durable, queryable storage | `ctx.store` | Document + KV namespaces; prefer over `cache`/`storage` for real data. |
| Secrets | `ctx.vault` | You supply raw material once at `store()`; after that only opaque refs — no read-back into JS. |
| Persistent small state (queue, prefs) | `ctx.cache.set(key, value, { persist: true })` | `cache.get()` returns deserialized values — do NOT `JSON.parse`. |
| Run a CLI with streaming output | `ctx.ui.pipeShellToWebPanel(panelId, shellOpts)` | **On `ctx.ui`, NOT `ctx.shell`.** 120s hard cap — resume-loop long jobs. |
| File-aware filters (smart folders) | `ctx.smartFolders.registerFilterType()` | Synchronous `evaluate` closure; rebuild lookups on state change. |
| React to dependency changes | `ctx.lifecycle.onDependencyStatusChanged(fn)` | `getDependencyStatus()` reads on demand; `recheckDependencies()` re-probes. |

The full namespace surface (resources/tokens/bundles, entities, ledger,
views, sidecars, input, webhook, LLM, recipes/sequences, ...) is mapped in
`reference/extension-api.md`.

## Public actions (fn-89) — the platform's front door

Actions are how a plugin exposes typed, schema-validated capabilities.
Every invocation runs validate → permission → approve → execute → receipt.
The handler receives ONE argument — the execution context — and reads its
payload via `exec.input`:

```ts
import type { ActionExecutionContext } from '@appos.space/plugin-types';

type GreetInput = { name: string };

const token = await ctx.actions.register(
    {
        id: 'greet',
        title: 'Greet Someone',
        inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        visibility: ['user', 'api', 'agent'],
        approval: 'auto',
    },
    async (exec: ActionExecutionContext) => {
        // exec: { invocationId, source, input, sourceId? }
        const input = exec.input as GreetInput;   // assert to a `type`, never an `interface`
        return { greeting: `Hello, ${input.name}!` };
    },
);
void token; // keep for ctx.actions.unregister(token) on dispose
```

- `exec.source` is the `InvocationSource` union (`"user" | "plugin" |
  "agent" | "recipe" | "sequence" | "system"`); `visibility: ['agent']`
  projects the action to AI agents as a tool — write schema descriptions
  for an LLM reader. `registerFromCommand(commandId, metadata)` projects
  an existing command into the catalog.
- Declare actions in the manifest `extensions[]` too, but ALWAYS pair with
  the runtime registration — the manifest entry is replayed into discovery
  (visible in `all()` / `palette.query()`, badged "manifest only") but
  invoking it surfaces `ACTION_NOT_FOUND` until the runtime `register()`
  binds the handler (see `reference/extension-api.md`).
- Scopes: `actions.register` to register, `actions.invoke` to invoke
  (`actions.invoke.agent` additionally for agent-sourced invokes).

## WebView panel pattern (rich UI)

Register the panel in `activate()`, passing the bundle-relative path to
the HTML. The SDK 3.0.0 types say registration and handler methods return
token strings, but the shipped AppOS 1.0.0 host returns `undefined` from
them at runtime — do NOT build teardown on the runtime value (it would
call `ctx.ui.unregister(undefined)`, which cannot unregister the panel
and may throw). The host removes the panel and its handlers automatically
on plugin unload; a `disposed` flag is the mid-life teardown mechanism
(`reference/patterns.md` §6):

```ts
const panelToken = ctx.ui.registerWebPanel('download', {
    title: 'Downloads',
    icon: 'arrow.down.circle',
    htmlPath: 'webview/download/index.html',
    allowNavigation: false,
});
void panelToken; // typed as string, but undefined on the 1.0.0 host — see reference/patterns.md §6
```

Receive messages with `ctx.ui.onWebPanelMessage(panelId, handler)`
(envelope `{ data, instanceId, windowId, paneId }`; `data` is unknown —
validate before routing); request/response via `onWebPanelRequest`. The
`htmlPath` resolves **relative to the plugin root at runtime**, so the
`webview/` tree MUST ship with the installed plugin. CSP blocks inline
`<script>`/`<style>` — external files only. Max 2 WebView panels per
plugin, 6 globally.

### Webview-side bridge (`window.twopanez`)

The host injects `window.twopanez` into every plugin webview: `send(msg)`
(fire-and-forget → `onWebPanelMessage`), `request(msg)` (request/response →
`onWebPanelRequest`), `onMessage(fn)` (inbound pushes), plus `instanceId`,
`windowId`, `paneId`. Webview code ships as plain `.js`; for typed WebView
TypeScript, add the ambient declaration from `reference/extension-api.md`
("WebView-side bridge") as `webview/twopanez.d.ts`. Wrap the bridge in a
thin `bridge.js` per plugin (see `appos-plugin-ytdlp/webview/shared/bridge.js`
for the canonical split of protocol messages vs shell chunks).

Push plugin→webview with `ctx.ui.postToWebPanel(panelId, message)` (all
active instances; max 1MB; `{ instanceId }` targets one). Version every
message (`v: 1`), discriminate by `type`, drop malformed inbound at the
bridge — typed union + `parseInbound` narrowing (`reference/patterns.md` §7).

### pipeShellToWebPanel (direct CLI → WebView streaming)

The host spawns the process, streams `{ stream, data, bytesTotal }` chunks
directly to every WKWebView instance of the panel, and returns a final
`ShellExecuteResult`:

```ts
declare const url: string;
declare const outputDir: string;

const result = await ctx.ui.pipeShellToWebPanel('download', {
    command: 'yt-dlp',
    args: ['--ignore-config', '--newline', url],
    cwd: outputDir,           // T1 (contained) tier REQUIRES absolute cwd
    timeout: 119,             // host hard-caps at 120s; leave headroom
});
console.log(result.exitCode);
```

**Critical gotchas:** it lives on `ctx.ui`, NOT `ctx.shell`; the 120s cap
still applies (long jobs need a `--continue`-style resume loop); shell
chunks arrive via `window.twopanez.onMessage()` **alongside**
`postToWebPanel` messages — filter in the bridge (chunks have
`{stream, data}` and no `v`/`type`); `cwd` must be an expanded absolute
path (T1 rejects `~` and relative); always pass `--ignore-config` (or
equivalent) so ambient user config can't inject flags.

## ViewDescriptor pattern (lightweight native UI)

For simple panels, skip the WebView and ship a ViewDescriptor tree:

```ts
import { vstack, section, listItem, button } from '@appos.space/view-builders';

declare const fileCount: number;

ctx.ui.registerPanel('stats', {
    title: 'File Stats',
    icon: 'chart.bar',
    priority: 100,
    view: vstack([
        section('Summary', { icon: 'doc.on.doc', badge: String(fileCount) }, [
            listItem('Files', { icon: 'doc', subtitle: `${fileCount}` }),
        ]),
        button('Refresh', { action: 'refresh' }),
    ]),
    handler: (action) => { void action; /* route action strings */ },
});
```

Call `registerPanel` with the same ID to replace the view reactively. The
SDK defines **17 ViewDescriptor types** (`vstack`, `hstack`, `scroll`,
`list`, `grid`, `text`, `label`, `image`, `remoteImage`, `badge`, `button`,
`listItem`, `textField`, `progress`, `section`, `divider`, `spacer`).

### menuActions on listItem

Context menus are the #1 UX pattern for ViewDescriptor lists. The
`menuActions` value MUST be a JSON string (not an array) — build it with
`encodeMenuActions([...])` from `@appos.space/view-builders` (dividers:
`{ title: '---' }`; destructive entries last, with `destructive: true`).
Actions are plain strings routed through the panel `handler` — short
semantic prefixes (`open:`, `reveal:`, `delete:`). Worked example:
`reference/patterns.md` §16. That `(action: string) => void` handler shape
is `plugin-utils`' `ActionHandler` — unrelated to fn-89 action handlers.

## WorkspaceTemplate (dual-pane layouts)

Workspaces register an entire window layout applied with one call — your
plugin's "canonical UI":

```ts
await ctx.workspaces.register({
    schemaVersion: 1,
    id: 'ytdlp-dual-pane',
    name: 'yt-dlp Downloader',
    // source is auto-stamped by register() — do not pass it manually
    leftPane: {
        tabs: [{ type: 'pluginPanel', panelId: 'download' }, { type: 'terminal' }],
        activeTab: 0,
    },
    rightPane: {
        tabs: [{ type: 'pluginPanel', panelId: 'library' }, { type: 'fileBrowser' }],
        activeTab: 0,
    },
});
```

**Apply unconditionally on every activation** — NOT gated on a first-run
cache flag. `activate()` runs once per host launch, so `apply(...)` at the
end of activation is effectively once-per-launch, and it is the only
reliable way to guarantee the user sees your plugin's UI.

> **GOTCHA** — `apply()` resolves `false` (not an error) when no browser
> window is focused, e.g. activation from the Settings sheet. Always fall
> back: `if (!applied) ctx.ui.showPaneTab('download', { pane: 'left' })`.

> **LANDMINE** — do not gate workspace apply behind
> `cache.get('initialized')`. Cache-flag gating causes a silent "plugin
> installed but invisible" bug on every launch after the first. Apply
> unconditionally; the user can still switch workspaces afterward.

**Re-register on settings change**: subscribe via
`ctx.settings.onKeyChange()` and call `workspaces.register()` again with
the updated template (`register()` returns `Promise<string>`). Full
pattern incl. panel-open commands: `reference/patterns.md` §10.

## Menu bar

`ctx.menubar.register({ icon })` creates the NSStatusItem; `setBadge(n)`
updates the badge (0 clears). **You MUST call `ctx.menubar.setContent(view)`
with a ViewDescriptor** — without it, clicking the icon shows a "No
content" popover (easy to miss: register/badge/click events all work
without it). Handle clicks via `ctx.events.subscribe('menubar.clicked',
handler)` (token → `ctx.events.unsubscribe`). Drive `setBadge` +
`setContent` reactively from your state subscriber; full pattern:
`reference/patterns.md` §11.

## Smart folder filters

`ctx.smartFolders.registerFilterType({ id, displayName, evaluate })`
contributes a filter to Smart Folders. The `evaluate` callback is
**synchronous**, runs in your JSC isolate per item `{ url, metadata }`,
and must be cheap — build lookup Maps on state change and capture them in
the closure. Returns `Promise<string>` (id auto-prefixed
`{pluginId}.filter.`). No `unregisterFilterType` — filters auto-clean on
deactivation; a `disposed` flag guards late calls
(`reference/patterns.md` §12).

## Lifecycle + dependency management

Declare system/plugin dependencies in `plugin.json.dependencies`; the host
probes them at activation. Subscribe with
`ctx.lifecycle.onDependencyStatusChanged(handler)` FIRST, then do the
initial `getDependencyStatus()` read — no update can slip between them.
`recheckDependencies()` forces a re-probe (wire it to a "Re-check"
button). All three are host-wired and safe to call. Show a degraded banner
with the `installHint` when a required dep is missing — don't refuse to
load. Full pattern: `reference/patterns.md` §13 + §23.

## plugin.json manifest

```json
{
    "id": "space.appos.myplugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "runtime": "javascript",
    "entrypoint": "dist/main.js",
    "minHostVersion": "1.0.0",
    "activation": { "events": ["onStartup"] },
    "permissions": [
        "ui.webPanel",
        { "scope": "shell.execute", "reason": "Runs yt-dlp to download media you request" },
        "filesystem.write",
        "cache",
        "feedback"
    ],
    "shellCommands": ["yt-dlp", "ffmpeg"],
    "settings": [{ "key": "outputDir", "label": "Download Directory", "type": "string", "default": "" }]
}
```

**Plugin ID conventions:** flagship `space.appos.<name>`; community
`com.community.<name>`; never host-reserved `space.appos.core.*`.

Two manifest families live in `reference/extension-api.md`: `extensions[]`
(manifest-declarative core-plugin contributions — qualified-id grammar,
per-EP payloads, dual-registration contract for actions) and
`dependencies` (system binaries + plugin deps; full example:
`reference/patterns.md` §23).

### minHostVersion LANDMINE

`minHostVersion` is compared against the host app's
`CFBundleShortVersionString` (e.g. `1.0.0` for `/Applications/AppOS.app`),
**NOT** the SDK version. Conflating them causes silent load failures — the
host emits `hostVersionTooLow` and the plugin never appears in Settings.
Default to `"1.0.0"`; check the real host version with `defaults read
/Applications/AppOS.app/Contents/Info.plist CFBundleShortVersionString`.
If a plugin doesn't appear after install + restart, CHECK THIS FIRST.

### Permissions

Request only what you use, optionally as `{ scope, reason }` (shown in
the approval UI). Common scopes: `ui.webPanel` (also gates
`pipeShellToWebPanel` with `shell.execute`), `ui.sidebar`, `shell.execute`
(+ `shellCommands` allowlist), `filesystem.read`/`write`,
`network.outbound` (+ `networkDomains`), `cache`, `feedback`,
`workspaces`, `menubar`, `actions.register`, `actions.invoke`,
`scheduler.job.own`, `notifications.emit`, `store.namespace.own`. The
complete union (135 canonical permission scopes as of SDK 3.0.0, plus
deprecated legacy aliases like `webview` and `network.fetch`) lives in
`reference/plugin-api/permissions.d.ts`; grouped walkthrough:
`reference/extension-api.md`.

## Build

Use esbuild via a `build.mjs` script, not raw flags (full script:
`reference/patterns.md` §17). **Required options**: `format: 'iife'`,
`target: 'es2020'`, `bundle: true`, `platform: 'browser'`,
`outfile: 'dist/main.js'` — ESM will NOT load in JSC. Pair with the
mandatory tsconfig (`reference/patterns.md` §18): `strict`, `noEmit`,
`verbatimModuleSyntax`, `moduleResolution: "bundler"`.

## Deploy

Install to the user plugin directory
`~/Library/Application Support/AppOS/plugins/$PLUGIN_ID/`:

```bash
rsync -av --delete --delete-excluded \
  --exclude='.DS_Store' --exclude='.git/' --exclude='node_modules/' \
  --exclude='src/' --exclude='scripts/' --exclude='*.test.ts' \
  --exclude='build.mjs' --exclude='tsconfig.json' --exclude='package.json' \
  --exclude='package-lock.json' --exclude='types/' --exclude='dist/main.js.map' \
  ./ "$HOME/Library/Application Support/AppOS/plugins/$PLUGIN_ID/"
```

`--delete-excluded` removes files matching `--exclude` patterns that a
previous deploy already copied — without it they linger forever. Ship
`dist/main.js`, `plugin.json`, `webview/`, `assets/`; exclude sources,
tests, build config (full list: `reference/patterns.md` §19). Then restart
AppOS (plugins load at startup). **Publishing to the catalog** uses a
different zip layout (root `manifest.json` + `appos/runtime/plugin.json`)
— a dev-layout bundle is NOT publishable as-is; see "Catalog bundle
layout" in `reference/extension-api.md`.

## Critical constraints (the gotchas that bite)

- **IIFE only** (`format: 'iife'`); **`globalThis.activate` /
  `deactivate`**, not ESM exports; **use `ctx` as the parameter name**.
- **`verbatimModuleSyntax: true`** is mandatory; **no ambient globals from
  the SDK main entry** — `import type` every SDK name (TS2304 means you
  forgot).
- **Action handlers get `exec`, not raw input** — read `exec.input`; assert
  it to a `type` alias, never an `interface` (TS2352).
- **Registration tokens are types-only on the 1.0.0 host** — SDK 3.0.0
  types `registerWebPanel` / `onWebPanelMessage` / `onWebPanelRequest` as
  returning token strings, but the shipped host returns `undefined` from
  them at runtime. Never pass the runtime value to `ctx.ui.unregister`
  (it takes slot-based contribution ids only, never handler tokens — no
  handler-unregister API exists); the host removes panels + handlers on
  plugin unload, and a `disposed` flag guard is the disposal mechanism
  (`reference/patterns.md` §6).
- **`ctx.ui.pipeShellToWebPanel`**, not `ctx.shell.pipeShellToWebPanel`.
- **120-second shell cap** on `ctx.shell.execute` and
  `pipeShellToWebPanel`; long jobs need a resume loop. **`cwd` is
  required** for T1 shell execution — absolute expanded path, no `~`.
- **Max 2 WebView panels per plugin, 6 globally.**
- **Cache returns deserialized values** — no `JSON.parse` on `cache.get()`;
  pass `{ persist: true }` for durability.
- **No in-flight shell cancellation** — `ShellAPI` exposes only
  `execute()`, and `ShellExecuteResult` carries no PID or process handle,
  so a running command cannot be terminated from plugin code. It ends
  only by exiting on its own or hitting the 120-second cap; keep long
  jobs short and resumable so an abandoned run bounds itself.
- **No DOM/Node APIs in main.js** — only webviews have a DOM; guard timers
  with `typeof setTimeout === 'function'` and `URL` with
  `typeof URL === 'function'` (Foundation-bridged v1 subset;
  `searchParams` THROWS — parse `url.search` manually). **Webview CSP
  blocks inline JS/CSS** — external files only, served via
  `plugin-panel://`.
- **`--ignore-config`** (or equivalent) on every wrapped CLI invocation.
- **`minHostVersion` is the HOST version**, NOT the SDK version — default
  `"1.0.0"`.
- **No `unregisterFilterType`** — smart folder filters auto-clean; use a
  `disposed` flag guard.
- **Install path**: `~/Library/Application Support/AppOS/plugins/$PLUGIN_ID/`.

## Migrating a 2.x plugin

Renamed namespace types (`<Name>API` everywhere), exec-context action
handlers, token-returning registrations, no ambient globals, `interface` →
`type` for `exec.input` assertions, `^3.0.0` pins — full walkthrough with
before/after examples: `reference/migration-2.x-to-3.0.md`.
