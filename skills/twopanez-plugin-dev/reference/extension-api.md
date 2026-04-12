# AppOS Plugin API — Reference Overview

This is a high-level map of the `@appos.space/plugin-types` SDK surface. For exact type signatures, read `plugin-api.d.ts` in this directory (a consolidated snapshot of the live SDK declaration files). For working examples of every API, read `~/Documents/GitHub/AppOS/appos-plugin-ytdlp/`.

SDK version: **2.4.0-fn50**. Host version: check `/Applications/2Panez.app/Contents/Info.plist` → `CFBundleShortVersionString` (currently `1.7.0`).

## The PluginContext

`activate(ctx)` receives a `PluginContext` with **22 readonly namespaces** plus metadata:

| Metadata | Type | Notes |
|---|---|---|
| `ctx.pluginId` | string | e.g., `"space.appos.ytdlp"` |
| `ctx.pluginVersion` | string | from `plugin.json` |
| `ctx.hostVersion` | string | host `CFBundleShortVersionString` |

### Namespaces

| Namespace | Purpose | Permissions required |
|---|---|---|
| `ctx.commands` | Register commands for palette + shortcuts | (none) |
| `ctx.fileOps` | Read/write/watch filesystem, get active dir, move/copy/delete | `filesystem.read`, `filesystem.write`, `filesystem.watch` |
| `ctx.ui` | Panels (`registerPanel`, `registerWebPanel`, `registerActivityView`), status bar, context menus, notifications, sheets, shortcuts registration, `postToWebPanel`, `onWebPanelMessage`, `pipeShellToWebPanel` | `ui.*`, `webview` |
| `ctx.storage` | Scoped key-value storage (plaintext + keychain) | `keychain.plugin` for secure entries |
| `ctx.settings` | Read user-configurable settings from manifest | (none) |
| `ctx.extensionPoints` | Declare/contribute extension points for other plugins | `interPlugin.declare`, `interPlugin.contribute` |
| `ctx.dataContracts` | Expose queryable data for other plugins | `interPlugin.query` |
| `ctx.interPluginEvents` | Pub/sub between plugins | `interPlugin.emit` |
| `ctx.smartFolders` | Custom filter types for smart folders (fn-13) | `smartFolders` |
| `ctx.preview` | File preview registry queries | `ui.preview` |
| `ctx.events` | Subscribe to navigation, pane activation, selection, app.willQuit, menubar.clicked | (none) |
| `ctx.network` | HTTP fetch and file download | `network` / `network.outbound` / `network.unrestricted` |
| `ctx.shell` | Execute allowed shell commands (streaming) | `shell.execute` |
| `ctx.clipboard` | Read/write system clipboard | `clipboard.read`, `clipboard.write` |
| `ctx.shortcuts` | Register keyboard shortcuts | `ui.shortcuts` |
| `ctx.themes` | Register/manage color themes | `ui.themes` |
| `ctx.workspaces` | Register/apply workspace templates (fn-40) | `workspaces` |
| `ctx.cache` | Memory+SQLite cache with TTL (fn-41) | `cache` |
| `ctx.feedback` | Toasts, HUD, confirmation, progress (fn-41) | `feedback`, `feedback.confirm` |
| `ctx.oauth` | OAuth 2.0 + PKCE (fn-41) | `oauth`, `oauth.{id}` |
| `ctx.menubar` | NSStatusItem management (fn-41) | `menubar`, `menubar.globalShortcut` |
| `ctx.lifecycle` | Dependency status notifications (fn-50) | (none) |

## The 33 permissions

`@appos.space/plugin-types` defines exactly 33 permission scopes:

**UI** — `ui.sidebar`, `ui.statusBar`, `ui.contextMenu`, `ui.notifications`, `ui.sheets`, `ui.shortcuts`, `ui.themes`, `ui.preview`, `ui.aiChat`, `ui.webPanel`

**Filesystem** — `filesystem.read`, `filesystem.write`, `filesystem.watch`, `filesystem.readAll`, `filesystem.writeAll`

**Shell** — `shell.execute`, `shell.uncontained`

**Clipboard** — `clipboard.read`, `clipboard.write`

**Network** — `network`, `network.outbound`, `network.fetch`, `network.unrestricted`

**Secure storage** — `keychain.plugin`

**Inter-plugin** — `interPlugin.declare`, `interPlugin.contribute`, `interPlugin.query`, `interPlugin.emit`

**WebView / workspaces / caching / feedback** — `webview`, `workspaces`, `cache`, `feedback`, `feedback.confirm`

**Advanced integrations** — `smartFolders`, `menubar`, `menubar.globalShortcut`, `oauth`, `` `oauth.${string}` ``

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

See `views.d.ts` inside `plugin-api.d.ts` for full signatures.

## Plugin manifest

`plugin.json` shape (see `PluginManifest` in `plugin-api.d.ts`):

- `id` — reverse-domain (`space.appos.*` flagship, `com.community.*` community)
- `name`, `version`, `runtime: "javascript"`, `entrypoint`
- `minHostVersion` — **MUST be the host `CFBundleShortVersionString`, NOT the SDK version**. Default to `"1.0.0"` unless you know you need more.
- `author`, `description`, `license`, `homepage`
- `activation.events` — currently only `"onStartup"` is supported
- `permissions` — array from the 33-permission set above
- `shellCommands` — allowlist of commands if `shell.execute` is declared
- `shellDeniedPatterns` — regex denylist evaluated before the allowlist (fn-46)
- `networkDomains` — allowlist of hostnames if `network.outbound` is declared
- `dependencies.system[]` — system binaries with `check.command`, `check.args`, `versionPattern`, `minVersion`, `installHint`, `installUrl`, `description` (fn-50)
- `dependencies.plugins[]` — other plugins the plugin depends on
- `settings[]` — user-configurable settings (`string`, `enum`, `bool`, `number`)
- `oauth.providers[]` — OAuth provider declarations (fn-41)
- `menubar.icon`, `menubar.label`, `menubar.globalShortcut` — menu bar config (fn-41)
- `categories`, `keywords` — Plugin Store metadata

## Dependency lifecycle (fn-50)

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

## Workspaces (fn-40)

`ctx.workspaces.register(template)` registers a template defining a dual-pane layout:

```ts
ctx.workspaces.register({
    id: 'ytdlp-workspace',
    name: 'Downloads',
    icon: 'arrow.down.circle',
    source: { type: 'plugin', pluginId: ctx.pluginId },
    layout: {
        left:  { panels: [{ type: 'pluginPanel', pluginId: ctx.pluginId, panelId: 'download' }, { type: 'terminal' }] },
        right: { panels: [{ type: 'pluginPanel', pluginId: ctx.pluginId, panelId: 'library' }, { type: 'fileBrowser' }, { type: 'webBrowser' }] },
    },
});
```

Apply via `ctx.workspaces.apply('ytdlp-workspace')` unconditionally at the end of `activate()`. Do NOT gate on a first-run cache flag — that's a documented landmine that causes "plugin installed but no UI visible" on second launch and beyond. See `patterns.md` section 6 for the full explanation.

## Menu bar (fn-41)

`ctx.menubar.register({ icon, label?, globalShortcut? })` adds an NSStatusItem to the system menu bar. Subscribe to `ctx.events.subscribe('menubar.clicked', handler)` to respond to clicks. Use `ctx.menubar.setBadge(count)` to update the badge text.

## Smart folders (fn-13)

`ctx.smartFolders.registerFilterType({ id, name, icon, schema, evaluate })` adds a custom filter type to the smart-folder filter picker. The `evaluate` closure runs **synchronously** against each `PluginFileDescriptor` — keep it cheap.

## Cache (fn-41)

`ctx.cache.get(key)` returns the **deserialized** value (no `JSON.parse` needed — the host handles it). `ctx.cache.set(key, value, { persist: true, ttl: '1h' })` writes with durability. Memory + SQLite tiers are merged transparently.

## Feedback (fn-41)

- `ctx.feedback.toast(message, { tone: 'info' | 'success' | 'error' })` — non-modal
- `ctx.feedback.confirm({ title, message, confirmText, destructive })` — modal confirmation
- `ctx.feedback.log(level, message)` — persistent log entry

## WebView panels (fn-48)

See the `webview-panels` skill for the full authoring guide. Quick reference:

- `ctx.ui.registerWebPanel(id, { title, icon, htmlPath, allowNavigation, width })` — once per panel
- `ctx.ui.postToWebPanel(id, message, { instanceId? })` — send to webview (broadcasts by default, targets a specific instance with `instanceId`)
- `ctx.ui.onWebPanelMessage(id, (envelope) => ...)` — receive from webview; envelope has `data`, `instanceId`, `windowId`, `paneId`
- `ctx.ui.pipeShellToWebPanel(id, { command, args, cwd, timeout })` — spawn a child and stream chunks directly to the webview (bypasses plugin main). **Lives on `ctx.ui`, NOT `ctx.shell`.**

**Limits**: max 2 WebView panels per plugin, 6 globally. Hard 120s timeout on `pipeShellToWebPanel`.

## Where to find exact signatures

Read `plugin-api.d.ts` in this directory — it's a consolidated snapshot of:
- `core.d.ts` — `PluginContext`, `PluginManifest`, dependency types
- `namespaces.d.ts` — all 22 namespace interfaces (~1100 lines, the biggest file)
- `views.d.ts` — `ViewDescriptor` discriminated union + `MenuAction`
- `permissions.d.ts` — the 33 `PermissionScope` literals
- `colors.d.ts` — `PluginColor` literals
- `fonts.d.ts` — `PluginFont` literals
- `icons.d.ts` — `SFSymbolName` curated list + `string & {}` escape hatch

For patterns, read `patterns.md` in this directory or `~/Documents/GitHub/AppOS/appos-plugin-ytdlp/` directly.
