---
description: >
  Build plugins for the 2Panez dual-pane file manager for macOS. Use this skill whenever
  someone asks about creating, building, testing, or deploying 2Panez plugins, or when
  working in the 2panez-community-plugins repo. Triggers on: "2Panez plugin", "2Panez
  extension", "file manager plugin", "create a plugin for 2Panez", "build a sidebar panel",
  "ViewDescriptor", "registerPanel", or any 2Panez API namespace. Also use PROACTIVELY when
  the user is working with TypeScript files that contain PluginContext, globalThis.activate,
  or ViewDescriptor patterns.
---

# 2Panez Plugin Development

Build plugins for the 2Panez dual-pane file manager for macOS. Plugins are TypeScript modules compiled to IIFE bundles and executed in JavaScriptCore. They receive a `PluginContext` object to interact with the host app through native SwiftUI views.

## Architecture

```
TypeScript source → esbuild (IIFE) → dist/main.js → JSCore → PluginContext → native SwiftUI
```

- Each plugin runs in its own JSCore context on a serial dispatch queue
- No shared state between plugins except through inter-plugin APIs
- UI is declarative JSON trees (ViewDescriptor) mapped to SwiftUI components
- No HTML, WebView, or DOM — all rendering is native

## Plugin lifecycle

Export two functions on `globalThis`:

```typescript
(globalThis as any).activate = function(context: PluginContext): void {
    // Store context, register UI/commands/events, initial render
};

(globalThis as any).deactivate = function(): void {
    // Clear local state only — host handles UI unregistration
};
```

## Decision tree: requirements → APIs

Use this to map what the plugin needs to the correct APIs and permissions:

| Need | API | Permission |
|------|-----|------------|
| Sidebar panel | `ui.registerPanel()` | `ui.sidebar` |
| **Full-pane view** | `ui.registerPanel({ target: "pane" })` | `ui.sidebar` |
| Activity bar icon + view | `ui.registerActivityView()` | `ui.sidebar` |
| Status bar text | `ui.registerStatusBarItem()` | `ui.statusBar` |
| Toolbar button | `ui.registerToolbarItem()` | `ui.sidebar` |
| Right-click menu item | `ui.registerContextMenuItem()` | `ui.contextMenu` |
| File row icons (git status) | `ui.registerFileRowAnnotation()` | `ui.sidebar` |
| Toast notifications | `ui.showNotification()` | `ui.notifications` |
| Modal sheet | `ui.showSheet()` | `ui.sheets` |
| Quick filter | `ui.setQuickFilter()` | `ui.sidebar` |
| Read files/dirs | `fileOps.listDirectory()` etc. | `filesystem.read` |
| Write/create files | `fileOps.createFile()` etc. | `filesystem.write` |
| Watch for changes | `fileOps.watchDirectory()` | `filesystem.watch` |
| Run shell commands | `shell.execute()` | `shell.execute` + `shellCommands` |
| HTTP requests | `network.fetch()` | `network.outbound` + `networkDomains` |
| Clipboard | `clipboard.read()`/`write()` | `clipboard.read`/`clipboard.write` |
| Keyboard shortcuts | `shortcuts.register()` | `ui.shortcuts` |
| Color themes | `themes.registerTheme()` | `ui.themes` |
| Smart folder filters | `smartFolders.registerFilterType()` | `filesystem.read` |
| Key-value storage | `storage.get()`/`set()` | none |
| Keychain storage | `storage.getSecure()`/`setSecure()` | `keychain.plugin` |
| Settings (read-only) | `settings.get()` | none |
| Host events | `events.subscribe()` | varies |
| Expose data to plugins | `dataContracts.expose()` | `interPlugin.declare` |
| Query other plugins | `dataContracts.query()` | `interPlugin.query` |
| Publish events | `interPluginEvents.emit()` | `interPlugin.emit` |
| Extension points | `extensionPoints.declare()` | `interPlugin.declare` |

## ViewDescriptor quick reference (13 types)

| Type | Purpose | Key properties |
|------|---------|----------------|
| `vstack` | Vertical layout | `children` |
| `hstack` | Horizontal layout | `children` |
| `text` | Text label | `content`, `font`, `width`, `align`, `mono`, `tooltip` |
| `button` | Action button | `title`, `action`, `tooltip`, `width` |
| `label` | Icon + text | `title`, `icon`, `font` |
| `image` | SF Symbol | `systemName` |
| `section` | Collapsible group | `title`, `icon`, `badge`, `isExpanded`, `id`, `children` |
| `listItem` | Styled row | `title`, `subtitle`, `icon`, `iconColor`, `action`, `menuActions`, `children` |
| `badge` | Capsule label | `text`/`content`, `color` |
| `divider` | Horizontal line | — |
| `spacer` | Flexible space | `minLength` |
| `scroll` | Scroll container | `axes`, `children` |
| `list` | VStack container | `children` |

For detailed ViewDescriptor guidance, see the `viewdescriptor-authoring` skill.

## menuActions — the #1 UX pattern

Every `listItem` should have a context menu. The value is a **JSON string** (not an object):

```typescript
const menu = [
    { title: "Open", icon: "arrow.up.forward.app", action: "open:" + url },
    { title: "Reveal in Finder", icon: "magnifyingglass", action: "reveal:" + url },
    { title: "---" },  // divider
    { title: "Delete", icon: "trash", action: "delete:" + url, destructive: true }
];

// MUST be a string
properties: { menuActions: JSON.stringify(menu) }
```

Actions route through the same `handler` callback. Use prefixed strings: `"open:" + url`, then extract with `action.substring(5)`.

## Full-pane views (target: "pane")

Plugins can render into an entire pane instead of a sidebar panel. Use this when the content needs file-list-grade space — collections, project explorers, multi-column data. The dual-pane interaction becomes: browse in one pane, plugin view in the other.

```typescript
context.ui.registerPanel("my-pane", {
    title: "My Plugin",
    icon: "tray.2.fill",
    target: "pane",        // "pane" instead of default "sidebar"
    priority: 10,
    view: { type: "scroll", children: [{ type: "vstack", children }] },
    handler: handleAction
});
```

Pair with `registerActivityView` so the user has an activity bar icon that opens the pane. Keep the activity view lightweight — just a label or minimal view, not a duplicate of the pane content.

### Unified layout — never use mode switching

Don't toggle between separate views (list mode ↔ detail mode). Instead, render all zones in a single `vstack`:

```typescript
function render(): void {
    const children: ViewDescriptor[] = [];
    children.push(...buildNav());           // Always-visible nav/picker
    children.push({ type: "divider", properties: {} });
    const selected = getSelected();
    if (selected) {
        children.push(...buildToolbar(selected));  // Contextual toolbar
        children.push(...buildContent(selected));  // Main content
    } else {
        children.push(...buildEmptyState());       // Guidance
    }
    ctx.ui.registerPanel("my-pane", { target: "pane", view: { type: "scroll", children: [{ type: "vstack", children }] }, handler });
}
```

Each `build*()` function returns `ViewDescriptor[]` — composable, testable, no mode state to track.

## Action naming conventions

Use short, semantic prefixes. Keep the prefix as short as possible while remaining unambiguous:

**Good — short and clear:**
- `"select:"` + id — pick/activate an item
- `"open:"` + url — open with default app
- `"reveal:"` + url — reveal in Finder
- `"remove:"` + url — remove from collection/list
- `"delete:"` + id — destructive delete
- `"rename:"` + id — rename action
- `"duplicate:"` + id — clone action
- `"export-paths:"` + id — export operation
- `"terminal:"` + url — open in Terminal
- `"vscode:"` + url — open in VS Code
- `"copy-path:"` + url — copy to clipboard

**Bad — verbose and redundant:**
- ~~`"open-collection:"` + id~~ → use `"select:"`
- ~~`"delete-collection:"` + id~~ → use `"delete:"`
- ~~`"rename-collection:"` + id~~ → use `"rename:"`

The handler already knows the context (which panel it belongs to), so the prefix doesn't need to repeat the noun. Simple actions use bare strings: `"refresh"`, `"add-selected"`, `"new-collection"`, `"remove-stale"`.

## Multiple empty states

Plugins should have distinct empty states for different conditions:

```typescript
function buildEmptyState(): ViewDescriptor[] {
    if (collections.length === 0) {
        // First-run: onboarding with keyboard shortcut hints
        return [
            { type: "label", properties: { title: "Playlists for your files", icon: "tray.2.fill", font: "headline" } },
            { type: "text", properties: { content: "Create a collection, then add files from the other pane.", font: "caption" } },
            { type: "text", properties: { content: "⌘⇧C   Quick-add selected files", font: "caption" } },
        ];
    }
    // Collections exist but none selected
    return [
        { type: "label", properties: { title: "Select a collection above", icon: "tray.fill", font: "caption" } },
    ];
}
```

## Manifest template (plugin.json)

```json
{
    "id": "com.community.PLUGINNAME",
    "name": "Plugin Display Name",
    "version": "1.0.0",
    "runtime": "javascript",
    "entrypoint": "dist/main.js",
    "minHostVersion": "1.0.0",
    "author": "Your Name",
    "description": "What this plugin does.",
    "license": "MIT",
    "activation": { "events": ["onStartup"] },
    "permissions": ["ui.sidebar", "filesystem.read"],
    "shellCommands": ["open"],
    "networkDomains": [],
    "settings": [
        { "key": "maxItems", "label": "Max Items", "type": "number", "default": 10, "min": 1, "max": 100 }
    ]
}
```

Required fields: `id`, `name`, `version`, `runtime`, `entrypoint`.

## Build and deploy

Build with esbuild (IIFE, not ESM):

```bash
npx esbuild src/main.ts --bundle --format=iife --target=es2020 --outfile=dist/main.js
```

Deploy to the 2Panez plugins directory:

```bash
PLUGIN_ID=$(python3 -c "import json; print(json.load(open('plugin.json'))['id'])")
rsync -a --delete --exclude='.DS_Store' --exclude='node_modules' \
    ./ "$HOME/Library/Application Support/com.twopanez/plugins/$PLUGIN_ID/"
```

Then restart 2Panez to load the plugin.

## Critical constraints

- **IIFE only**: `--format=iife` — ESM modules will not load in JSCore
- **globalThis exports**: `activate` and `deactivate` must be on `globalThis`
- **Plugin IDs**: reverse-domain format `com.community.pluginname`
- **No HTML/WebView**: UI is ViewDescriptor JSON only, rendered as native SwiftUI
- **menuActions is a string**: Must `JSON.stringify()` the array
- **Settings are read-only**: Plugins read with `context.settings.get()`, users change in 2Panez UI
- **File URLs**: API returns `file:///...` URLs — convert with `urlToPath()` before shell commands
- **Install path**: `~/Library/Application Support/com.twopanez/plugins/{plugin-id}/`
- **Community plugins repo**: `~/Documents/GitHub/2panez-community-plugins/`
- **2Panez is NOT open source** — only the plugin API and community plugins are public

## Reference files

For the complete API specification, read these files in `reference/`:
- `extension-api.md` — Full human-readable API spec (~670 lines, 16 namespaces)
- `plugin-api.d.ts` — TypeScript type definitions (~1,800 lines)
- `patterns.md` — Common patterns extracted from 7 reference plugins

When creating a plugin, always read these references for the full API details.
