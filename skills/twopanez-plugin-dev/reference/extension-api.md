# 2Panez Extension API

> Version 2.0.0 · Last updated March 2026

Complete reference for the 2Panez Plugin API. Plugins are TypeScript/JavaScript modules that receive a `PluginContext` object in their `activate()` function. This document covers every namespace, method, type, and permission.

For working examples, see the [community plugins](plugins/) in this repo. For the raw TypeScript definitions, see [`plugin-api.d.ts`](plugin-api.d.ts).

## Table of contents

- [Plugin lifecycle](#plugin-lifecycle)
- [Manifest (plugin.json)](#manifest)
- [Data types](#data-types)
- [ViewDescriptor system](#viewdescriptor-system)
- [API namespaces](#api-namespaces)
  - [commands](#commands)
  - [fileOps](#fileops)
  - [ui](#ui)
  - [storage](#storage)
  - [settings](#settings)
  - [events](#events)
  - [shell](#shell)
  - [clipboard](#clipboard)
  - [network](#network)
  - [shortcuts](#shortcuts)
  - [themes](#themes)
  - [smartFolders](#smartfolders)
  - [preview](#preview)
  - [extensionPoints](#extensionpoints)
  - [dataContracts](#datacontracts)
  - [interPluginEvents](#interplugineventss)
  - [lifecycle](#lifecycle-api)
- [Permissions](#permissions)
- [Error codes](#error-codes)

---

## Plugin lifecycle

Every plugin must export two functions on `globalThis`:

```typescript
(globalThis as any).activate = function(context: PluginContext): void {
  // Called when the plugin loads.
  // Use context.* to register UI, commands, event handlers.
};

(globalThis as any).deactivate = function(): void {
  // Called before the plugin unloads.
  // Clear local state. The host handles unregistering UI and event subscriptions.
};
```

Plugins are compiled to IIFE bundles (esbuild `--format=iife`) and executed in a dedicated JavaScriptCore context per plugin. Each plugin gets its own serial dispatch queue — no shared state between plugins except through the inter-plugin APIs.

---

## Manifest

Every plugin requires a `plugin.json` manifest:

```json
{
  "id": "com.community.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "runtime": "javascript",
  "entrypoint": "dist/main.js",
  "minHostVersion": "1.0.0",
  "author": "Your Name",
  "description": "What this plugin does.",
  "license": "MIT",
  "activation": { "events": ["onStartup"] },
  "permissions": ["ui.sidebar", "filesystem.read"],
  "shellCommands": ["git"],
  "networkDomains": ["api.github.com"],
  "settings": [
    { "key": "maxItems", "label": "Max Items", "type": "number", "default": 10, "min": 1, "max": 100 },
    { "key": "showHidden", "label": "Show Hidden Files", "type": "bool", "default": false },
    { "key": "sortOrder", "label": "Sort Order", "type": "enum", "default": "name", "options": ["name", "size", "date"] },
    { "key": "outputDir", "label": "Output Directory", "type": "string", "default": "" }
  ]
}
```

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Reverse-domain identifier (e.g. `com.community.myplugin`) |
| `name` | string | Human-readable display name |
| `version` | string | Semantic version (MAJOR.MINOR.PATCH) |
| `runtime` | string | `"javascript"` for JS plugins |
| `entrypoint` | string | Path to the compiled JS bundle |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `minHostVersion` | string | Minimum 2Panez version required |
| `author` | string | Plugin author name |
| `description` | string | Brief description |
| `license` | string | SPDX license identifier |
| `activation.events` | string[] | When to activate (currently `["onStartup"]`) |
| `permissions` | string[] | Required permission scopes |
| `shellCommands` | string[] | Allowed shell command names for `shell.execute` |
| `networkDomains` | string[] | Allowed outbound domains for `network.fetch` |
| `settings` | object[] | User-configurable settings schema |

### Settings schema

Each setting object supports:

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Setting identifier (used with `context.settings.get(key)`) |
| `label` | string | Display label in the settings UI |
| `type` | string | `"bool"`, `"number"`, `"enum"`, or `"string"` |
| `default` | any | Default value when no user override exists |
| `options` | any[] | Allowed values (for `enum` type) |
| `min` | number | Minimum value (for `number` type) |
| `max` | number | Maximum value (for `number` type) |

---

## Data types

### PluginFileDescriptor

Returned by `fileOps.listDirectory()`, `fileOps.getSelectedFiles()`, and `fileOps.getFileInfo()`.

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | File URL (e.g. `"file:///Users/alice/readme.md"`) |
| `name` | string | Filename including extension |
| `isDirectory` | boolean | Whether this is a directory |
| `size` | number \| null | Size in bytes, null for directories |
| `modificationDate` | string \| null | ISO 8601 date string |
| `isHidden` | boolean | Whether the file is hidden |
| `fileExtension` | string \| null | Lowercase extension without dot |

---

## ViewDescriptor system

Plugin UI is built from a JSON tree of ViewDescriptors. The host maps each type to a native SwiftUI component.

### Types

| Type | Purpose | Key properties |
|------|---------|----------------|
| `vstack` | Vertical stack | `children` |
| `hstack` | Horizontal stack | `children` |
| `text` | Text label | `content`, `font`, `width`, `align`, `mono`, `tooltip` |
| `button` | Action button | `title`, `action`, `tooltip`, `width` |
| `label` | Icon + text | `title`, `icon`, `font` |
| `image` | SF Symbol icon | `systemName` |
| `section` | Collapsible group | `title`, `icon`, `badge`, `isExpanded`, `id`, `children` |
| `listItem` | Styled row | `title`, `subtitle`, `icon`, `iconColor`, `action`, `menuActions`, `children` |
| `badge` | Capsule label | `text`/`content`, `color` |
| `divider` | Horizontal line | — |
| `spacer` | Flexible space | `minLength` |
| `scroll` | Scroll container | `axes` (`"horizontal"`/`"vertical"`), `children` |
| `list` | VStack container | `children` |

### Font values

Used by `text`, `label`: `"largeTitle"`, `"title"`, `"title2"`, `"title3"`, `"headline"`, `"subheadline"`, `"body"`, `"callout"`, `"footnote"`, `"caption"`, `"caption2"`.

### Color values

Used by `iconColor`, `color` on badge: System colors (`"systemRed"`, `"systemOrange"`, `"systemYellow"`, `"systemGreen"`, `"systemBlue"`, `"systemPurple"`, `"red"`, `"orange"`, `"yellow"`, `"green"`, `"blue"`, `"purple"`), semantic colors (`"primary"`, `"secondary"`, `"tertiary"`), design tokens (`"ux_synapse"`, `"ux_cortex"`, `"ux_pulse"`, `"ux_signal"`, `"ux_warning"`, `"ux_error"`, etc.), or hex strings (`"#FF5733"`).

### Column alignment

The `text` and `button` types support fixed-width columns via the `width` property. When set, the element renders with `.frame(width:alignment:)`. Use inside `listItem.children` for aligned trailing columns:

```json
{
  "type": "listItem",
  "properties": {
    "title": ".json",
    "icon": "doc",
    "action": "filter:json"
  },
  "children": [
    { "type": "text", "properties": { "content": "4", "width": 28, "align": "trailing", "font": "caption", "mono": true } },
    { "type": "text", "properties": { "content": "(33.3%)", "width": 52, "align": "trailing", "font": "caption" } }
  ]
}
```

### Context menus (menuActions)

Any `listItem` can have a native right-click context menu via the `menuActions` string property. The value is a JSON-encoded array:

```json
{
  "type": "listItem",
  "properties": {
    "title": "myfile.ts",
    "icon": "doc",
    "action": "open:file-url",
    "menuActions": "[{\"title\":\"Open\",\"icon\":\"arrow.up.forward.app\",\"action\":\"open:url\"},{\"title\":\"---\"},{\"title\":\"Delete\",\"icon\":\"trash\",\"action\":\"delete:url\",\"destructive\":true}]"
  }
}
```

Menu item format: `{ title: string, icon?: string, action: string, destructive?: boolean }`. Use `{ title: "---" }` for dividers. Actions route through the same `handler` callback as button actions.

### Button hover + tooltips

Buttons with `width` set render as `InlineActionButton` with visible hover background and native tooltip. Buttons with `tooltip` set (but no width) get `.help(tooltip)` for native macOS tooltip on hover.

---

## API namespaces

### commands

Register and execute commands. Commands are the primary way to expose plugin actions to the command palette and keyboard shortcuts.

| Method | Returns | Permission | Description |
|--------|---------|------------|-------------|
| `register(id, options)` | void | — | Register a command with title, icon, and handler |
| `execute(id, args?)` | Promise\<void\> | — | Execute a command by ID (own or core) |
| `getRegistered()` | string[] | — | List own registered command IDs |
| `onCommandExecuted(id, handler)` | string | — | Subscribe to post-execution events (own commands only) |

```typescript
context.commands.register("refresh", {
  title: "Refresh Data",
  icon: "arrow.clockwise",
  handler: () => { /* ... */ }
});

await context.commands.execute("refresh");
```

Commands are auto-prefixed with your plugin ID. `register("refresh")` creates `com.myplugin.refresh`.

---

### fileOps

File system operations. Most methods require `filesystem.read` or `filesystem.write` permissions.

#### Reading

| Method | Returns | Permission |
|--------|---------|------------|
| `getActiveDirectory()` | Promise\<string\> | `filesystem.read` |
| `getPaneDirectory(paneId)` | Promise\<string\> | `filesystem.read` |
| `getSelectedFiles()` | Promise\<PluginFileDescriptor[]\> | `filesystem.read` |
| `listDirectory(url)` | Promise\<PluginFileDescriptor[]\> | `filesystem.read` |
| `getFileInfo(url)` | Promise\<PluginFileDescriptor\> | `filesystem.read` |
| `readFile(url, encoding?)` | Promise\<string\> | `filesystem.read` |
| `readFileData(url)` | Promise\<string\> | `filesystem.read` |

`readFileData` returns base64-encoded binary content. Decode with:
```typescript
const base64 = await context.fileOps.readFileData(url);
const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
```

#### Writing

| Method | Returns | Permission |
|--------|---------|------------|
| `copy(sources, dest)` | Promise\<void\> | `filesystem.write` |
| `move(sources, dest)` | Promise\<void\> | `filesystem.write` |
| `delete(urls, trash?)` | Promise\<void\> | `filesystem.write` |
| `rename(url, newName)` | Promise\<string\> | `filesystem.write` |
| `createDirectory(parentUrl, name)` | Promise\<string\> | `filesystem.write` |
| `createFile(parentUrl, name, contents?)` | Promise\<string\> | `filesystem.write` |
| `writeFile(url, contents, encoding?)` | Promise\<void\> | `filesystem.write` |
| `batch(operations)` | Promise\<Result[]\> | `filesystem.write` |

Batch operations execute sequentially. Max 1000 per call. Each returns `{ index, success, error? }`.

#### Watching

| Method | Returns | Permission |
|--------|---------|------------|
| `watchDirectory(url, handler)` | string | `filesystem.watch` |
| `watchDirectoryWithOptions(url, options, handler)` | string | `filesystem.watch` |
| `unwatchDirectory(subscriptionId)` | void | — |

`watchDirectoryWithOptions` supports `debounceMs` (100-5000, default 500) and `recursive` (default true).

#### Hooks

| Method | Returns | Permission |
|--------|---------|------------|
| `onBeforeOperation(type, handler)` | string | `filesystem.write` |
| `onAfterOperation(type, handler)` | string | `filesystem.read` |
| `removeBeforeHook(subscriptionId)` | void | — |
| `removeAfterHook(subscriptionId)` | void | — |

Before-hooks can cancel operations by returning `{ reason: "..." }`. The initiating plugin's own hook is skipped. 2-second per-handler timeout, 10-second global budget.

---

### ui

UI contribution methods for sidebar panels, activity bar, status bar, toolbars, context menus, file annotations, notifications, and sheets.

#### Panels

| Method | Returns | Permission |
|--------|---------|------------|
| `registerPanel(id, options)` | string | `ui.sidebar` |
| `updatePanel(id, options)` | string | `ui.sidebar` |
| `registerActivityView(id, options)` | string | `ui.sidebar` |
| `registerActivityBarItem(id, options)` | string | `ui.sidebar` |
| `showPanel(id, options)` | string | `ui.sidebar` |
| `unregister(tokenId)` | void | — |

`registerPanel` creates a sidebar or pane panel. Pass `target: "pane"` to render into a full pane instead of the sidebar — use this when the content needs file-list-grade space (collections, project explorers, multi-column data). Pair full-pane views with a lightweight `registerActivityView` as an opener. Call `registerPanel` again with the same ID to replace the content (reactive re-rendering pattern). `registerActivityView` creates a dedicated activity bar icon that shows a full sidebar view when clicked.

**Full-pane layout pattern**: Use a single `render()` function with composable `build*()` functions returning `ViewDescriptor[]`. Never use mode switching (list view ↔ detail view). Always-visible nav/picker at top, divider, active content or empty state below.

**Action naming**: Use short semantic prefixes (`"select:"`, `"open:"`, `"remove:"`, `"delete:"`). Don't repeat the noun — `"select:"` not `"open-collection:"`. Simple actions use bare strings: `"refresh"`, `"add-selected"`, `"new-collection"`.

#### Status bar, toolbar, context menu, annotations

| Method | Returns | Permission |
|--------|---------|------------|
| `registerStatusBarItem(id, options)` | string | `ui.statusBar` |
| `registerToolbarItem(id, options)` | string | `ui.sidebar` |
| `registerContextMenuItem(id, options)` | string | `ui.contextMenu` |
| `registerFileRowAnnotation(id, options)` | string | `ui.sidebar` |

File row annotations provide per-file icons in the file browser (e.g. git status indicators). The `handler` function is called for each visible file and should return `{ icon, color }` or `null`.

#### Notifications, sheets, filtering

| Method | Returns | Permission |
|--------|---------|------------|
| `showNotification(options)` | void | `ui.notifications` |
| `showSheet(options)` | void | `ui.sheets` |
| `setQuickFilter(text)` | void | `ui.sidebar` |

`setQuickFilter` sets the active pane's quick filter, matching filenames via `localizedCaseInsensitiveContains`. Pass empty string to clear.

---

### storage

Scoped key-value storage. No permission required. Values must be JSON-serializable.

| Method | Returns | Permission | Description |
|--------|---------|------------|-------------|
| `get(key)` | any \| null | — | Read from scoped storage |
| `set(key, value)` | void | — | Write to scoped storage (max 1MB/value, 10MB/plugin) |
| `getSecure(key)` | string \| null | `keychain.plugin` | Read from macOS Keychain |
| `setSecure(key, value)` | void | `keychain.plugin` | Write to macOS Keychain |
| `deleteSecure(key)` | true \| undefined | `keychain.plugin` | Delete from macOS Keychain |

Storage is persisted to `UserDefaults(suiteName: "com.twopanez.plugin.{pluginId}")`. Keychain items use `kSecAttrService = "com.twopanez.plugin.{pluginId}"`. Secure methods are synchronous (not Promise-based).

---

### settings

Read user-configurable settings declared in the manifest.

| Method | Returns | Permission |
|--------|---------|------------|
| `get(key)` | any \| null | — |

Precedence: UserDefaults value (set by settings UI) → manifest `default` → null.

```typescript
const showUntracked = context.settings.get("showUntracked") ?? true;
const maxTypes = context.settings.get("maxTypes") ?? 10;
```

---

### events

Subscribe to host application events.

| Method | Returns | Permission |
|--------|---------|------------|
| `subscribe(eventName, handler)` | string | varies |
| `unsubscribe(token)` | void | — |

#### Available events

| Event | Permission | Payload |
|-------|-----------|---------|
| `navigation.directoryChanged` | `filesystem.read` | `{ paneId, oldUrl, newUrl }` |
| `navigation.paneActivated` | `filesystem.read` | `{ paneId }` |
| `selection.changed` | `filesystem.read` | `{ paneId, selectedPaths }` |
| `smartFolder.evaluated` | `filesystem.read` | `{ folderId, resultCount }` |
| `app.willQuit` | none | `{}` |
| `app.didBecomeActive` | none | `{}` |
| `plugin.activated` | none | `{ pluginId }` |
| `plugin.deactivated` | none | `{ pluginId }` |
| `fileOps.operationCompleted` | `filesystem.readAll` | `{ type, paths, success, error?, initiatorPluginId }` |

---

### shell

Execute shell commands via `Foundation.Process`. Commands must be listed in the manifest's `shellCommands` array.

| Method | Returns | Permission |
|--------|---------|------------|
| `execute(options)` | Promise\<{ exitCode, stdout, stderr }\> | `shell.execute` |

**Options:** `command` (required, must be in allowlist), `args` (string[]), `cwd` (absolute path), `timeout` (seconds, max 120), `env` (key-value pairs merged with host environment).

**Security:** Arguments passed as array to `/usr/bin/env` (no shell interpolation). Git commands auto-inject `GIT_TERMINAL_PROMPT=0`. Max 5 concurrent processes per plugin. stdout/stderr capped at 10MB each.

```typescript
const result = await context.shell.execute({
  command: "git",
  args: ["status", "--porcelain"],
  cwd: "/Users/alice/project",
  timeout: 10
});
if (result.exitCode === 0) {
  console.log(result.stdout);
}
```

---

### clipboard

System clipboard read/write via `NSPasteboard.general`.

| Method | Returns | Permission |
|--------|---------|------------|
| `read()` | Promise\<string \| null\> | `clipboard.read` |
| `write(text)` | Promise\<boolean\> | `clipboard.write` |

Note: macOS 15.4+ shows a system privacy alert for programmatic clipboard reads.

---

### network

HTTP fetching and file downloading via URLSession.

| Method | Returns | Permission |
|--------|---------|------------|
| `fetch(url, options?)` | Promise\<{ status, headers, body }\> | `network.outbound` |
| `download(url, destPath)` | Promise\<string\> | `network.outbound` + `filesystem.write` |

**Security:** HTTPS enforced (except localhost). Domains must be in manifest `networkDomains` array (bypassed by `network.unrestricted`). Redirects re-validated. DNS rebinding to private IPs blocked. Max 10 concurrent requests per plugin.

**Fetch options:** `method` (default "GET"), `headers` (key-value), `body` (string).

---

### shortcuts

Keyboard shortcut registration. First-registered-wins conflict resolution.

| Method | Returns | Permission |
|--------|---------|------------|
| `register(options)` | Promise\<string\> | `ui.shortcuts` |
| `unregister(shortcutId)` | Promise\<void\> | `ui.shortcuts` |
| `getAll()` | Promise\<ShortcutInfo[]\> | — |

**Options:** `commandId` (must be an own-namespace command), `keys` (e.g. `"cmd+shift+n"`), `when` (optional context condition).

**Key format:** Modifiers joined by `+`: `cmd`/`command`, `shift`, `opt`/`option`/`alt`, `ctrl`/`control`. Special keys: `delete`, `return`, `escape`, `tab`, `space`, arrows, `f1`-`f12`. At least one modifier required.

```typescript
await context.shortcuts.register({ commandId: "create-note", keys: "cmd+shift+n" });
```

---

### themes

Color theme registration and activation.

| Method | Returns | Permission |
|--------|---------|------------|
| `registerTheme(options)` | Promise\<void\> | `ui.themes` |
| `getActiveTheme()` | Promise\<string \| null\> | — |
| `setActiveTheme(themeId)` | Promise\<void\> | `ui.themes` |
| `getThemeList()` | Promise\<ThemeInfo[]\> | — |
| `onThemeChanged(callback)` | Promise\<string\> | — |
| `offThemeChanged(token)` | Promise\<void\> | — |

**Theme options:** `id` (unique), `name` (display), `tokens` (flat map of dot-separated token keys to hex colors). Max 10 themes per plugin. Pass `null` to `setActiveTheme` to revert to host defaults.

```typescript
await context.themes.registerTheme({
  id: "dracula",
  name: "Dracula",
  tokens: {
    "sidebar.background": "#282a36",
    "text.primary": "#f8f8f2",
    "accent.synapse": "#ff79c6"
  }
});
```

---

### smartFolders

Register custom filter types for smart folders and evaluate items against them.

| Method | Returns | Permission |
|--------|---------|------------|
| `registerFilterType(options)` | Promise\<string\> | `filesystem.read` |
| `getSmartFolders()` | Promise\<SmartFolderDescriptor[]\> | `filesystem.read` |
| `evaluateFilter(folderId, items)` | Promise\<FilterEvalResult[]\> | `filesystem.read` |
| `onSmartFolderEvaluated(callback)` | Promise\<string\> | — |
| `offSmartFolderEvaluated(token)` | Promise\<void\> | — |

The `evaluate` function in `registerFilterType` must be synchronous and return a boolean. It receives `{ url, metadata }` per item. Non-boolean returns are treated as unmatched.

---

### preview

File preview queries and programmatic preview triggering.

| Method | Returns | Permission |
|--------|---------|------------|
| `canPreview(filePath)` | Promise\<boolean\> | `filesystem.read` |
| `showPreview(filePath)` | Promise\<void\> | `filesystem.read` |
| `getRegisteredTypes()` | Promise\<string[]\> | — |
| `registerProvider(options)` | Promise\<void\> | `ui.preview` |

Note: `registerProvider` is CorePlugin-only in v1. JS plugins can query preview capabilities and trigger the preview panel, but cannot register custom preview providers (NSView cannot cross the JSC bridge).

---

### extensionPoints

Declare extension points that other plugins can contribute to. Enables plugin-to-plugin composition.

| Method | Returns | Permission |
|--------|---------|------------|
| `declare(id, options)` | Promise\<string\> | `interPlugin.declare` |
| `contribute(targetId, contribution, options?)` | Promise\<string\> | `interPlugin.contribute` |
| `discover(pointId)` | Promise\<Contribution[]\> | — |
| `removeContribution(targetId, contributionId)` | Promise\<void\> | `interPlugin.contribute` |

Contributions are validated against the extension point's JSON schema. `discover` returns contributions sorted by priority (ascending).

---

### dataContracts

Expose queryable data for other plugins to consume.

| Method | Returns | Permission |
|--------|---------|------------|
| `expose(contractId, version, options)` | Promise\<string\> | `interPlugin.declare` |
| `query(qualifiedContractId, version, args)` | Promise\<unknown\> | `interPlugin.query` |
| `unexpose(contractId, version?)` | Promise\<void\> | `interPlugin.declare` |
| `getAvailableContracts()` | Promise\<string[]\> | — |

Qualified IDs use the format `"com.publisher:contractId"`. The `provider` function in expose options receives args from the querying plugin.

```typescript
// Provider plugin
await context.dataContracts.expose("bookmarks", 1, {
  description: "User's bookmarks",
  provider: async (args) => {
    if (args?.tag) return bookmarks.filter(b => b.tags.includes(args.tag));
    return bookmarks;
  }
});

// Consumer plugin (must declare dependency on provider)
const bookmarks = await context.dataContracts.query("com.community.bookmarks:bookmarks", 1, { tag: "work" });
```

---

### interPluginEvents

Pub/sub event channels between plugins.

| Method | Returns | Permission |
|--------|---------|------------|
| `declareEvent(eventName, schema?)` | Promise\<string\> | `interPlugin.declare` |
| `emit(eventName, payload)` | Promise\<void\> | `interPlugin.emit` |
| `subscribe(qualifiedEventName, handler)` | Promise\<string\> | dependency required |
| `unsubscribe(token)` | Promise\<void\> | — |

Subscribers must declare a dependency on the publishing plugin in their manifest. Payloads are validated against the declared schema.

---

### lifecycle

Dependency availability notifications.

| Method | Returns | Permission |
|--------|---------|------------|
| `onDependencyAvailable(depId, handler)` | void | — |
| `onDependencyUnavailable(depId, handler)` | void | — |

Used by plugins that depend on other plugins to react to activation/deactivation.

---

## Permissions

Plugins declare required permissions in `plugin.json`. The host validates at runtime — missing permissions cause API calls to throw with `PERMISSION_DENIED`.

### UI permissions

| Scope | Grants access to |
|-------|-----------------|
| `ui.sidebar` | `registerPanel`, `registerActivityView`, `registerActivityBarItem`, `registerToolbarItem`, `registerFileRowAnnotation`, `showPanel`, `setQuickFilter` |
| `ui.statusBar` | `registerStatusBarItem` |
| `ui.contextMenu` | `registerContextMenuItem` |
| `ui.notifications` | `showNotification` |
| `ui.sheets` | `showSheet` |
| `ui.shortcuts` | `shortcuts.register`, `shortcuts.unregister` |
| `ui.themes` | `themes.registerTheme`, `themes.setActiveTheme` |
| `ui.preview` | `preview.registerProvider` (CorePlugin-only in v1) |

### Filesystem permissions

| Scope | Grants access to |
|-------|-----------------|
| `filesystem.read` | Read operations within pane root directories |
| `filesystem.write` | Write operations within pane root directories |
| `filesystem.watch` | `fileOps.watchDirectory`, `fileOps.watchDirectoryWithOptions` |
| `filesystem.readAll` | Read operations anywhere on disk |
| `filesystem.writeAll` | Write operations anywhere on disk |

### Other permissions

| Scope | Grants access to |
|-------|-----------------|
| `shell.execute` | `shell.execute` (also requires `shellCommands` allowlist in manifest) |
| `clipboard.read` | `clipboard.read` |
| `clipboard.write` | `clipboard.write` |
| `network.outbound` | `network.fetch`, `network.download` (also requires `networkDomains` allowlist) |
| `network.unrestricted` | `network.fetch`, `network.download` (bypasses domain allowlist) |
| `keychain.plugin` | `storage.getSecure`, `storage.setSecure`, `storage.deleteSecure` |
| `interPlugin.declare` | `extensionPoints.declare`, `dataContracts.expose`, `interPluginEvents.declareEvent` |
| `interPlugin.contribute` | `extensionPoints.contribute`, `extensionPoints.removeContribution` |
| `interPlugin.query` | `dataContracts.query` |
| `interPlugin.emit` | `interPluginEvents.emit` |

---

## Error codes

These appear as `err.code` on rejected Promises or `context.exception`:

| Code | Description |
|------|-------------|
| `PERMISSION_DENIED` | Missing required permission scope |
| `INVALID_ARGUMENT` | Invalid or missing required parameters |
| `PATH_OUT_OF_SCOPE` | File path outside allowed pane roots |
| `SHELL_EXECUTION_ERROR` | Shell process launch failure |
| `KEYCHAIN_ACCESS_ERROR` | macOS Keychain SecItem failure |
| `NETWORK_DOMAIN_DENIED` | URL domain not in manifest allowlist |
| `RESOURCE_LIMIT_EXCEEDED` | Per-plugin concurrency or resource limit reached |
| `SHORTCUT_CONFLICT` | Key combination conflicts with existing binding |
| `CONTRACT_VALIDATION` | Extension point contribution or data contract schema mismatch |

---

*This document is generated from [`plugin-api.d.ts`](plugin-api.d.ts). For the most accurate and up-to-date type information, refer to the TypeScript definitions directly.*
