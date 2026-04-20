# AppOS Plugin API — Reference Overview

This is a high-level map of the `@appos.space/plugin-types` SDK surface. For exact type signatures, read `plugin-api.d.ts` in this directory (a consolidated snapshot of the live SDK declaration files). For working examples of every API, read `~/Documents/GitHub/AppOS/appos-plugin-ytdlp/`.

SDK version: **2.4.0-fn50**. Host version: check `/Applications/2Panez.app/Contents/Info.plist` → `CFBundleShortVersionString` (currently `1.7.0`).

## The PluginContext

`activate(ctx)` receives a `PluginContext` with **22 readonly namespaces** plus metadata:

| Metadata | Type | Notes |
|---|---|---|
| `ctx.pluginId` | string | e.g., `"space.appos.ytdlp"`. Runtime-injected by the host bridge. |
| `ctx.pluginVersion` | string | from `plugin.json`. Runtime-injected. |
| `ctx.hostVersion` | string | host `CFBundleShortVersionString`. Runtime-injected. |

These metadata properties are set by the host at activation time but are not declared in `plugin-api.d.ts`. Add a local ambient declaration to your project:

```ts
// src/ambient.d.ts
import type { PluginContext } from '@appos.space/plugin-types';
declare module '@appos.space/plugin-types' {
    interface PluginContext {
        readonly pluginId: string;
        readonly pluginVersion: string;
        readonly hostVersion: string;
    }
}
```

### Namespaces

| Namespace | Purpose | Permissions required |
|---|---|---|
| `ctx.commands` | Register commands for palette + shortcuts | (none) |
| `ctx.fileOps` | Read/write/watch filesystem, get active dir, move/copy/delete | `filesystem.read`, `filesystem.write`, `filesystem.watch` |
| `ctx.ui` | Panels (`registerPanel`, `registerWebPanel`, `registerActivityView`), status bar, context menus, notifications, sheets, shortcuts registration, `postToWebPanel`, `onWebPanelMessage`, `pipeShellToWebPanel` | `ui.*` (e.g., `ui.sidebar`, `ui.webPanel`) |
| `ctx.storage` | Scoped key-value storage (plaintext + keychain) | `keychain.plugin` for secure entries |
| `ctx.settings` | Read user-configurable settings from manifest | (none) |
| `ctx.extensionPoints` | Declare/contribute extension points for other plugins | `interPlugin.declare`, `interPlugin.contribute` |
| `ctx.dataContracts` | Expose queryable data for other plugins | `interPlugin.declare` (expose), `interPlugin.query` (query) |
| `ctx.interPluginEvents` | Pub/sub between plugins | `interPlugin.declare` (declare), `interPlugin.emit` (emit/subscribe) |
| `ctx.smartFolders` | Custom filter types for smart folders (fn-13) | `filesystem.read` |
| `ctx.preview` | File preview registry queries | `filesystem.read` (per-method; `registerProvider` is core-only) |
| `ctx.events` | Subscribe to navigation, pane activation, selection, app.willQuit, menubar.clicked | per-event (see `HostEventsAPI` in `plugin-api.d.ts`) |
| `ctx.network` | HTTP fetch and file download | `network.outbound` / `network.unrestricted` |
| `ctx.shell` | Execute allowed shell commands (streaming) | `shell.execute` |
| `ctx.clipboard` | Read/write system clipboard | `clipboard.read`, `clipboard.write` |
| `ctx.shortcuts` | Register keyboard shortcuts | `ui.shortcuts` |
| `ctx.themes` | Register/manage color themes | `ui.themes` |
| `ctx.workspaces` | Register/apply workspace templates (fn-40) | `workspaces` |
| `ctx.cache` | Memory+SQLite cache with TTL (fn-41) | `cache` |
| `ctx.feedback` | Toasts, HUD, confirmation, progress (fn-41) | `feedback`, `feedback.confirm` |
| `ctx.oauth` | OAuth 2.0 + PKCE (fn-41) | `oauth`, `oauth.{id}` |
| `ctx.menubar` | NSStatusItem management (fn-41) | `menubar` |
| `ctx.lifecycle` | Dependency status notifications (fn-50) | (none) |

## Permissions

Permission scopes are enforced by the host at runtime. The following are the scopes referenced in `plugin-api.d.ts` API comments:

**UI** — `ui.sidebar`, `ui.statusBar`, `ui.toolbar`, `ui.contextMenu`, `ui.notifications`, `ui.sheets`, `ui.shortcuts`, `ui.themes`, `ui.preview`, `ui.aiChat`, `ui.webPanel`, `ui.settings`

**Filesystem** — `filesystem.read`, `filesystem.write`, `filesystem.watch`, `filesystem.readAll`, `filesystem.writeAll`

**Shell** — `shell.execute`

**Clipboard** — `clipboard.read`, `clipboard.write`

**Network** — `network.outbound`, `network.unrestricted`

**Secure storage** — `keychain.plugin`

**Inter-plugin** — `interPlugin.declare`, `interPlugin.contribute`, `interPlugin.query`, `interPlugin.emit`

**Workspaces / caching / feedback** — `workspaces`, `cache`, `feedback`, `feedback.confirm`

**Advanced integrations** — `menubar`, `menubar.globalShortcut`, `oauth`, `` `oauth.${string}` ``

**Alias**: `"network.fetch"` is accepted as an alias for `"network.outbound"`. Use the canonical name in new plugins.

**If you declare `shell.execute`**, you MUST also declare `"shellCommands": ["..."]` with the exact commands the plugin invokes. The sandbox blocks any command not in that list.

## ViewDescriptor types

The SDK defines **17 ViewDescriptor types** (up from the legacy 13):

**Layout** — `vstack`, `hstack`, `scroll`, `list`, `grid`

**Content** — `text`, `label`, `image`, `remoteImage`, `badge`

**Interactive** — `button`, `listItem`, `textField`, `progress`

**Structural** — `section`, `divider`, `spacer`

Each has a `type` discriminator and a typed `properties` object. `listItem` also supports `children` for trailing inline columns. `menuActions` on `listItem` is a **JSON string**, not an array — always `JSON.stringify(MenuAction[])`.

**`listItem` properties**: `title`, `subtitle`, `icon`, `iconColor`, `action`, `trailing`, `menuActions`

**`MenuAction`**: `{ title, icon?, action?, destructive? }`

### New types (fn-48+)

**`grid`** — Renders children in a `LazyVGrid` with flexible columns.
- Properties: `columns` (number, default 3), `spacing` (number, default 8)
- Children are rendered as grid items

**`remoteImage`** — Loads an image from a URL (file:// only in Phase 1).
- Properties: `url` (string), `width` (number), `height` (number), `cornerRadius` (number), `maxDimension` (number, default 512 — max pixel size for downsampling)

**`textField`** — Editable text input field.
- Properties: `placeholder` (string), `value` (string), `action` (string — fires on submit)

**`progress`** — Determinate or indeterminate progress indicator.
- Properties: `value` (number 0.0-1.0, omit for indeterminate), `label` (string), `style` ("bar" | "circular", default: "bar")

See the `ViewDescriptor` interface in `plugin-api.d.ts` for full signatures.

## Plugin manifest

`plugin.json` shape (see dependency and manifest types in `plugin-api.d.ts`):

- `id` — reverse-domain (`space.appos.*` flagship, `com.community.*` community)
- `name`, `version`, `runtime: "javascript"`, `entrypoint`
- `minHostVersion` — **MUST be the host `CFBundleShortVersionString`, NOT the SDK version**. Default to `"1.0.0"` unless you know you need more.
- `author`, `description`, `license`, `homepage`
- `activation.events` — currently only `"onStartup"` is supported
- `permissions` — array from the permission scopes listed above
- `shellCommands` — allowlist of commands if `shell.execute` is declared
- `shellDeniedPatterns` — regex denylist evaluated before the allowlist (fn-46)
- `networkDomains` — allowlist of hostnames if `network.outbound` is declared
- `dependencies.system[]` — system binaries with `check.command`, `check.args`, `versionPattern`, `minVersion`, `installHint`, `installUrl`, `description` (fn-50)
- `dependencies.plugins[]` — other plugins the plugin depends on
- `settings[]` — user-configurable settings (`string`, `enum`, `bool`, `number`)
- `oauth.providers[]` — OAuth provider declarations (fn-41)
- `menubar.icon`, `menubar.label` — menu bar config (fn-41)
- `scope` — `"app"` (default, single shared instance) or `"window"` (per-window instance, JS plugins only; core-swift always behaves as `"app"`)
- `isolation` — `"jscontext"` (default, in-process) or `"xpc"` (sandboxed, future)
- `categories`, `keywords` — Plugin Store metadata

## Plugin dependencies (fn-50)

### Manifest schema

Declare system binary and plugin dependencies in `plugin.json`:

```json
{
    "dependencies": {
        "system": [
            {
                "name": "yt-dlp",
                "required": true,
                "check": {
                    "command": "yt-dlp",
                    "args": ["--version"],
                    "versionPattern": "(\\d{4}\\.\\d{2}\\.\\d{2})"
                },
                "minVersion": "2024.08.06",
                "installHint": "brew install yt-dlp",
                "installUrl": "https://github.com/yt-dlp/yt-dlp#installation",
                "description": "Video downloader"
            },
            {
                "name": "ffmpeg",
                "required": false,
                "check": {
                    "command": "ffmpeg",
                    "args": ["-version"],
                    "versionPattern": "ffmpeg version (\\d+\\.\\d+)"
                },
                "installHint": "brew install ffmpeg"
            }
        ],
        "plugins": [
            {
                "id": "com.community.shared-utils",
                "minVersion": "1.0.0",
                "required": false
            }
        ]
    }
}
```

**`SystemDependency` fields:**
- `name` — human-readable name
- `check.command` — binary to execute (MUST be in `shellCommands` allowlist)
- `check.args` — arguments for version check (e.g., `["--version"]`)
- `check.versionPattern` — regex with one capture group to extract the version from stdout
- `minVersion` — minimum version constraint string
- `required` — whether the dependency is required (default: `true`)
- `installHint` — shell command hint (e.g., `"brew install yt-dlp"`)
- `installUrl` — URL to installation instructions (must start with `https://` or `http://`)
- `description` — human-readable description of the dependency's purpose

**`PluginDependency` fields:** `id`, `minVersion`, `required`

The host probes system dependencies at activation time by running `check.command` + `check.args` via shell.

### Dependency status

`ctx.lifecycle.getDependencyStatus()` returns `DependencyStatus[]` reflecting each declared dependency:

```
{
    name, type: 'system' | 'plugin',
    required, satisfied,
    state: 'not_found' | 'installed' | 'installed_version_unknown' | 'permission_denied' | 'command_not_allowed',
    installedVersion?, requiredVersion?,
    installHint?, installUrl?, description?,
    unsatisfiedReason?, causalChain?
}
```

Subscribe with `ctx.lifecycle.onDependencyStatusChanged(handler)` to react to install/uninstall at runtime.

### Runtime query APIs — types only, runtime deferred

> **WARNING**: `ctx.lifecycle.getDependencyStatus()` and `ctx.lifecycle.recheckDependencies()` are defined in `plugin-api.d.ts` and compile without error, but **runtime support is deferred**. Do NOT call these APIs in plugin code yet — they will reject or return empty results. Use `ctx.lifecycle.onDependencyStatusChanged(handler)` (which IS wired) to receive status updates pushed by the host at activation time. The host probes dependencies automatically; plugins do not need to trigger checks manually.

## Workspaces (fn-40)

`ctx.workspaces.register(template)` registers a template defining a dual-pane layout. Returns `Promise<string>` (the workspace ID).

```ts
await ctx.workspaces.register({
    schemaVersion: 1,
    id: 'ytdlp-workspace',
    name: 'Downloads',
    icon: 'arrow.down.circle',
    // source is auto-stamped by register() — do not pass it manually
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
            { type: 'fileBrowser' },
            { type: 'webBrowser' },
        ],
        activeTab: 0,
    },
});
```

Apply via `ctx.workspaces.apply('ytdlp-workspace')` unconditionally at the end of `activate()`. Do NOT gate on a first-run cache flag — that's a documented landmine that causes "plugin installed but no UI visible" on second launch and beyond. See `patterns.md` section 6 for the full explanation.

## Menu bar (fn-41)

`ctx.menubar.register({ icon, label? })` adds an NSStatusItem to the system menu bar. Subscribe to `ctx.events.subscribe('menubar.clicked', handler)` to respond to clicks (returns a token string; clean up with `ctx.events.unsubscribe(token)`). Use `ctx.menubar.setBadge(count)` to update the badge count (0 clears).

## Smart folders (fn-13)

`ctx.smartFolders.registerFilterType({ id, displayName, editorConfig?, evaluate })` registers a custom filter type in `FilterTypeRegistry`. Returns `Promise<string>` (the namespaced filter type ID `{pluginId}.filter.{id}`). The `evaluate` closure runs **synchronously** against each item `{ url: string, metadata: Record<string, unknown> }` — keep it cheap. There is no unregister API; filters auto-clean on plugin deactivation. Use a `disposed` flag in the closure to guard against late calls.

## Cache (fn-41)

`ctx.cache.get(key)` returns the **deserialized** value (no `JSON.parse` needed — the host handles it). `ctx.cache.set(key, value, { persist: true, ttl: 3600 })` writes with durability. `ttl` is in **seconds** (number, not a duration string). Memory + SQLite tiers are merged transparently.

## Feedback (fn-41)

- `ctx.feedback.toast(message, { kind: 'info' | 'success' | 'warning' | 'error' })` — always shows a toast
- `ctx.feedback.hud(message, { kind?, progress? })` — always shows a HUD panel; returns handle ID
- `ctx.feedback.updateHud(id, { progress?, message? })` — updates an existing HUD
- `ctx.feedback.dismissHud(id)` — dismisses a HUD panel
- `ctx.feedback.alert(message, { informativeText?, buttons?, style? })` — shows an NSAlert; returns 0-based button index. Requires `feedback.confirm` permission.
- `ctx.feedback.systemNotification(title, message, { kind? })` — always sends a system notification
- `ctx.feedback.notify(message, { kind? })` — adaptive routing: focused window -> toast, unfocused -> HUD, background -> system notification

## WebView panels (fn-48)

WebView panels render HTML/CSS/JS inside a WKWebView, loaded via `plugin-panel://` scheme. Use for rich interactive UI: forms, streaming progress, media playback, complex layouts.

**Permission**: `ui.webPanel`

**Limits**: max 2 WebView panels per plugin, 6 globally.

### 5 APIs on `ctx.ui`

1. **`registerWebPanel(id, options)`** — Registers a panel definition. Synchronous. WKWebView instances are created lazily when pane tabs open.

   ```ts
   ctx.ui.registerWebPanel('download', {
       title: 'Downloads',
       icon: 'arrow.down.circle',
       htmlPath: 'panels/download/index.html',
       allowNavigation: false,
   });
   ```

   `WebPanelOptions`:
   - `title` (string, required) — display title for the panel tab
   - `icon` (string, optional) — SF Symbol name for the tab icon
   - `htmlPath` (string, required) — relative path to HTML file within plugin bundle. Must not be absolute or contain `..`
   - `allowNavigation` (boolean, default `false`) — whether the WebView can navigate away from the initial page
   - `width` (number, optional) — preferred width in points (stored for future floating/popover use; pane tabs use full pane width)

   The `id` is the SHORT identifier (e.g., `'download'`). The runtime auto-prefixes it with `{pluginId}.` to form the qualified ID.

2. **`postToWebPanel(panelId, message, options?)`** — Sends a JSON message to all active WebView instances of a panel. Pass `{ instanceId }` to target a specific instance. Max message size: 1MB.

3. **`onWebPanelMessage(panelId, handler)`** — Receives fire-and-forget messages sent from the WebView via `window.twopanez.send(data)`. The handler receives a `WebPanelMessage` envelope: `{ data, instanceId, windowId, paneId }`. One handler per panelId; calling again replaces the previous handler.

4. **`onWebPanelRequest(panelId, handler)`** — Receives request/response messages sent from the WebView via `window.twopanez.request(data)`. The handler must return a value or Promise (10s timeout). The resolved value is sent back to the WebView as the return value of `request()`. One handler per panelId.

5. **`pipeShellToWebPanel(panelId, shellOptions)`** — Spawns a shell command and streams `{ stream, data, bytesTotal }` chunks directly to all WebView instances of the panel. Returns the final `ShellExecuteResult` as a Promise. **Lives on `ctx.ui`, NOT `ctx.shell`.** Requires `ui.webPanel` + `shell.execute`. Hard 120s timeout — long jobs need resume loops.

### Webview-side bridge (`window.twopanez`)

The host injects `window.twopanez` into every plugin WebView:

| Method/Property | Description |
|---|---|
| `window.twopanez.send(msg)` | Fire-and-forget message to plugin → `onWebPanelMessage` |
| `window.twopanez.request(msg)` | Request/response to plugin → `onWebPanelRequest`, returns Promise |
| `window.twopanez.onMessage(fn)` | Receive inbound push from `postToWebPanel` and `pipeShellToWebPanel` chunks |
| `window.twopanez.instanceId` | Per-WKWebView UUID (multi-instance isolation) |
| `window.twopanez.windowId` | App window ID |
| `window.twopanez.paneId` | `"left"` or `"right"` |

Shell chunks from `pipeShellToWebPanel` arrive via `onMessage` alongside `postToWebPanel` messages. Filter them in the bridge: chunks have `{ stream, data, bytesTotal }` without `v`/`type`.

### CSP constraints

WebView content is served via `plugin-panel://` with a Content Security Policy that **blocks inline `<script>` and `<style>` tags**. All JavaScript and CSS must be external files:

```html
<!-- CORRECT: external files -->
<script type="module" src="app.js"></script>
<link rel="stylesheet" href="styles.css">

<!-- WRONG: inline — will be blocked by CSP, WebView renders blank -->
<script>console.log('blocked')</script>
<style>body { color: red; }</style>
```

### CSS custom properties

The host injects CSS custom properties into every plugin WebView, mapped to the app's design system. They update at runtime when the theme changes (no page reload needed):

| Property | Description | Default value |
|---|---|---|
| `--twopanez-bg` | Window background | `#0D1117` |
| `--twopanez-bg-sidebar` | Sidebar background | `#0A0E14` |
| `--twopanez-bg-control` | Control background | `#1C2128` |
| `--twopanez-bg-surface` | Surface background | `#161B22` |
| `--twopanez-bg-elevated` | Elevated surface | `#262C36` |
| `--twopanez-accent` | Cyan accent | `#00D9FF` |
| `--twopanez-accent-cortex` | Magenta accent | `#BD00FF` |
| `--twopanez-accent-pulse` | Amber accent | `#FF6B35` |
| `--twopanez-accent-signal` | Green accent | `#00FF9F` |
| `--twopanez-accent-warning` | Gold warning | `#FFB800` |
| `--twopanez-accent-error` | Red error | `#FF3366` |
| `--twopanez-text` | Primary text | `#E6EDF3` |
| `--twopanez-text-secondary` | Secondary text | `#8B949E` |
| `--twopanez-text-muted` | Muted text | `#484F58` |
| `--twopanez-text-ghost` | Ghost text | `#30363D` |

```css
body {
    background-color: var(--twopanez-bg);
    color: var(--twopanez-text);
}
.button { background-color: var(--twopanez-accent); }
```

## Streaming shell output (fn-47)

`ctx.shell.execute()` supports an `onData` callback for real-time streaming output. When provided, chunks are delivered as the process writes to stdout/stderr. The final Promise still resolves with the full buffered result (subject to 10MB truncation), but `onData` sees all data including bytes beyond the truncation threshold.

### ShellDataChunk

```ts
interface ShellDataChunk {
    stream: "stdout" | "stderr";  // which pipe this chunk came from
    data: string;                  // UTF-8 decoded text (may contain partial lines)
    bytesTotal: number;            // running total of bytes on this stream
}
```

### Buffered vs streaming patterns

**Buffered (default)** — omit `onData`. The Promise resolves with `{ exitCode, stdout, stderr }` after process exit:

```ts
// T1 plugins: cwd must be within active pane roots
const activeDir = await ctx.fileOps.getActiveDirectory();
const result = await ctx.shell.execute({
    command: 'yt-dlp', args: ['--version'],
    cwd: activeDir ? urlToPath(activeDir) : undefined,
});
console.log(result.stdout.trim());  // "2024.08.06"
```

**Streaming** — provide `onData` for real-time progress:

```ts
await ctx.shell.execute({
    command: 'yt-dlp',
    args: ['--ignore-config', '--progress', '--newline', url],
    cwd: outputDir,
    onData: (chunk) => {
        if (chunk.stream === 'stdout') {
            const match = chunk.data.match(/(\d+\.?\d*)%/);
            if (match) updateProgress(parseFloat(match[1]) / 100);
        }
    },
});
```

Chunks arrive on the plugin's serial queue. If `onData` throws, the error is logged but the process continues — streaming is best-effort. Order is preserved per-stream but stdout/stderr interleaving is OS-dependent.

## Shell security tiers (fn-46)

Shell execution is governed by a three-tier security model:

| Tier | Name | When | CWD restriction | Denied patterns | Allowlist |
|---|---|---|---|---|---|
| T0 | none | No `shell.execute` declared | N/A (calls rejected) | N/A | N/A |
| T1 | contained | JS plugins with `shell.execute` but no filesystem-wide perms | CWD must be within active pane roots. `cwd` is **required** (omitting throws). | Enforced: destructive commands (`rm -rf`, `dd`, `shutdown`, etc.) are blocked. Shell metacharacter patterns (`$()`, backticks, pipe-to-shell) are checked when the command is a shell interpreter (`sh`, `bash`, `zsh`). | Enforced |
| T2 | uncontained | Core-swift plugins or JS with `filesystem.readAll`/`writeAll` | No CWD restriction | Skipped | Enforced |

**Allowlist**: All tiers enforce the `shellCommands` allowlist from `plugin.json`. Only commands listed there can be executed.

### `shellDeniedPatterns` (manifest field)

Plugins may declare `shellDeniedPatterns: string[]` in `plugin.json` to add custom regex guards. These are **merged** with the built-in defaults (never replacing them). Invalid regexes are logged and skipped at parse time.

```json
{
    "shellDeniedPatterns": [
        "\\bsudo\\b",
        "--recursive.*--force"
    ]
}
```

## Where to find exact signatures

Read `plugin-api.d.ts` in this directory — it's a consolidated snapshot (~2950 lines) containing:
- `PluginContext` interface with all 22 namespace properties
- All namespace interfaces (`UIAPI`, `ShellAPI`, `WorkspacesAPI`, `PluginFeedbackAPI`, etc.)
- `ViewDescriptor` interface with the 17-type discriminated union
- Dependency types (`SystemDependency`, `DependencyStatus`, `PluginDependencies`)
- WebView panel types (`WebPanelOptions`, `WebPanelMessage`, CSS custom property docs)
- Shell types (`ShellExecuteOptions`, `ShellDataChunk`, `ShellExecuteResult`)
- Workspace types (`WorkspaceTemplate`, `WorkspaceTemplateTabSlot`, `WorkspaceTemplatePaneConfig`)

For patterns, read `patterns.md` in this directory or `~/Documents/GitHub/AppOS/appos-plugin-ytdlp/` directly.
