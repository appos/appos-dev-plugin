# Common Patterns from 2Panez Community Plugins

Extracted from the 7 reference plugins: bookmarks, git-gutter, duplicate-finder, quick-notes, scaffolder, theme-pack, workspace-snapshot.

---

## 1. Sidebar panel with collapsible sections

From git-gutter — groups changed files by status category with badge counts:

```typescript
const sectionChildren: ViewDescriptor[] = files.map(f => ({
    type: "listItem",
    properties: {
        title: filename,
        subtitle: f.relPath.includes("/") ? f.relPath.split("/").slice(0, -1).join("/") : undefined,
        icon: statusIcon(cat),
        iconColor: statusColor(cat),
        action: "open:" + fileUrl,
        menuActions: JSON.stringify(menu)
    },
    children: [
        { type: "text", properties: { content: f.status.trim(), width: 24, align: "trailing", font: "caption", mono: true } }
    ]
}));

children.push({
    type: "section",
    properties: { title: "Modified", icon: "pencil.circle.fill", badge: "" + files.length, isExpanded: true, id: "git-modified" },
    children: sectionChildren
});

context.ui.registerPanel("git-panel", {
    title: "Git Changes", icon: "arrow.triangle.branch", position: "bottom", priority: 40,
    badge: totalFiles > 0 ? "" + totalFiles : undefined,
    view: { type: "scroll", children: [{ type: "vstack", children }] },
    handler: (action: string) => { /* route actions */ }
});
```

Key points:
- Wrap the outer vstack in `{ type: "scroll", children: [...] }` for scrollable panels
- Set `badge` on the panel for file count indicators
- Set `id` on sections so collapse state persists across re-renders
- Always convert badge values to strings: `"" + count`

---

## 2. Activity bar view with badge

From bookmarks — dedicated activity bar icon with full sidebar view:

```typescript
context.ui.registerActivityView("bookmarks-view", {
    title: "Bookmarks",
    icon: "bookmark.fill",
    badge: bookmarks.length > 0 ? "" + bookmarks.length : undefined,
    view: { type: "scroll", children: [{ type: "vstack", children }] },
    handler: (action: string) => { /* route actions */ },
    priority: 50
});
```

Use `registerActivityView` instead of `registerPanel` when you want a dedicated icon in the activity bar (left sidebar icons). The view shows when the user clicks that icon.

---

## 3. listItem with trailing columns

Used across all v2 plugins for aligned data display. Children of a listItem render as trailing elements:

```typescript
// From duplicate-finder — file size column
{
    type: "listItem",
    properties: {
        title: f.name,
        icon: "doc.on.doc",
        iconColor: "systemOrange",
        action: "open:" + f.url,
        menuActions: JSON.stringify(menu)
    },
    children: [
        { type: "text", properties: { content: formatSize(f.size), width: 52, align: "trailing", font: "caption", mono: true } }
    ]
}

// From quick-notes — date column
children: [
    { type: "text", properties: { content: date, width: 62, align: "trailing", font: "caption" } }
]

// From bookmarks — action buttons as trailing children
children: [
    { type: "button", properties: { title: "↗", tooltip: "Reveal in Finder", action: "reveal:" + b.url, width: 24 } },
    { type: "button", properties: { title: "✕", tooltip: "Remove Bookmark", action: "remove:" + b.url, width: 24 } }
]

// From git-gutter — status code column
children: [
    { type: "text", properties: { content: f.status.trim(), width: 24, align: "trailing", font: "caption", mono: true } }
]
```

Key points:
- `width` creates a fixed-width frame via `.frame(width:alignment:)`
- `align: "trailing"` right-aligns text within the frame
- `mono: true` enables `.monospacedDigit()` for numeric alignment
- `font: "caption"` is standard for trailing metadata
- Buttons with `width` render as `InlineActionButton` with hover background

---

## 4. menuActions with dividers and destructive actions

The #1 UX pattern — every listItem should have a context menu:

```typescript
// From bookmarks — full menu with conditional sections
const menu: any[] = [
    { title: "Open", icon: "arrow.up.forward.app", action: "open:" + b.url },
    { title: "Reveal in Finder", icon: "magnifyingglass", action: "reveal:" + b.url },
];
if (b.isDirectory) {
    menu.push({ title: "---" });  // divider
    menu.push({ title: "Open in Terminal", icon: "terminal", action: "terminal:" + b.url });
    menu.push({ title: "Open in VS Code", icon: "chevron.left.forwardslash.chevron.right", action: "vscode:" + b.url });
}
menu.push({ title: "---" });  // divider before destructive
menu.push({ title: "Remove Bookmark", icon: "trash", action: "remove:" + b.url, destructive: true });

// CRITICAL: menuActions is a JSON STRING, not an object
properties: {
    menuActions: JSON.stringify(menu)
}
```

Menu item format: `{ title: string, icon?: string, action: string, destructive?: boolean }`
- Use `{ title: "---" }` for dividers
- Place destructive actions last, after a divider
- Actions route through the same `handler` callback as button clicks

---

## 5. Action handler routing with prefixed strings

Every plugin uses the same pattern — prefix-based action routing:

```typescript
handler: (action: string) => {
    if (action === "refresh") refreshData();
    else if (action === "export") exportData();
    else if (action.startsWith("open:")) openFile(action.substring(5));
    else if (action.startsWith("reveal:")) revealInFinder(action.substring(7));
    else if (action.startsWith("remove:")) removeItem(action.substring(7));
    else if (action.startsWith("stage:")) stageFile(action.substring(6));
    else if (action.startsWith("discard:")) discardFile(action.substring(8));
}
```

Convention:
- Simple actions: `"refresh"`, `"export"`, `"scan"`
- Parameterized actions: `"prefix:" + value` (typically a file URL)
- Extract with: `action.substring("prefix:".length)` or `action.substring(N)`

---

## 6. shell.execute helpers for open/reveal/terminal

Common shell patterns used across bookmarks, git-gutter, quick-notes:

```typescript
// Open file with default app
async function openFile(url: string): Promise<void> {
    context.shell.execute({ command: "open", args: [urlToPath(url)], timeout: 5 }).catch(() => {});
}

// Reveal in Finder
async function revealInFinder(url: string): Promise<void> {
    context.shell.execute({ command: "open", args: ["-R", urlToPath(url)], timeout: 5 }).catch(() => {});
}

// Open in Terminal
async function openInTerminal(url: string): Promise<void> {
    context.shell.execute({ command: "open", args: ["-a", "Terminal", urlToPath(url)], timeout: 5 }).catch(() => {});
}

// Open with specific app
async function openWithApp(url: string, appName: string): Promise<void> {
    context.shell.execute({ command: "open", args: ["-a", appName, urlToPath(url)], timeout: 5 }).catch(() => {});
}
```

Always `.catch(() => {})` on shell calls to prevent unhandled rejections. The `open` command must be in the manifest `shellCommands` array.

---

## 7. Event subscription with re-render pattern

From git-gutter — re-render UI when directory changes:

```typescript
let eventToken: string | null = null;

// In activate():
eventToken = context.events.subscribe("navigation.directoryChanged", () => {
    refreshData().then(() => setupWatcher());
});

// In deactivate():
if (pluginContext && eventToken) pluginContext.events.unsubscribe(eventToken);
eventToken = null;
```

From workspace-snapshot — multiple event subscriptions:

```typescript
let subscriptions: string[] = [];

// In activate():
subscriptions.push(context.events.subscribe("navigation.directoryChanged", refresh));
subscriptions.push(context.events.subscribe("navigation.paneActivated", refresh));
subscriptions.push(context.events.subscribe("selection.changed", refresh));

// In deactivate():
subscriptions.forEach(s => pluginContext!.events.unsubscribe(s));
subscriptions = [];
```

Key: Always clean up subscriptions in deactivate. The host handles UI unregistration, but event tokens should be cleaned.

---

## 8. Settings reading with fallback defaults

Every plugin reads settings with `??` fallback:

```typescript
// Boolean setting
const showUntracked = context.settings.get("showUntracked") ?? true;

// Number setting
const maxBookmarks = context.settings.get("maxBookmarks") ?? 100;
const minSize = context.settings.get("minFileSize") ?? 1024;

// String setting
const format = context.settings.get("timestampFormat") || "iso";
const folderName = context.settings.get("notesFolderName") || ".quicknotes";
```

Settings are read-only — declared in plugin.json, changed by the user in 2Panez settings UI. Use `??` for null/undefined fallback, `||` for falsy fallback.

---

## 9. URL/path conversion helpers

Every plugin that works with files needs these:

```typescript
function urlToPath(url: string): string {
    if (url.startsWith("file://")) return decodeURIComponent(url.substring(7));
    return url;
}

function pathToUrl(path: string): string {
    return "file://" + encodeURIComponent(path).replace(/%2F/g, "/");
}
```

The 2Panez API uses file URLs (`file:///Users/...`) but shell commands need POSIX paths (`/Users/...`). Always convert before passing to `shell.execute`.

---

## 10. Empty state guidance pattern

Every plugin should show helpful empty states:

```typescript
// From bookmarks — empty state with guidance
if (bookmarks.length === 0) {
    children.push({ type: "spacer", properties: { minLength: 16 } });
    children.push({
        type: "label",
        properties: { title: "No bookmarks yet", icon: "bookmark.slash", font: "caption" }
    });
    children.push({
        type: "text",
        properties: {
            content: "Right-click a file and choose Bookmark This",
            font: "caption"
        }
    });
}

// From git-gutter — not a git repo
children.push({ type: "label", properties: { title: "Not a git repository", icon: "xmark.octagon", font: "caption" } });

// From duplicate-finder — scanning state
children.push({ type: "label", properties: { title: "Scanning...", icon: "arrow.trianglehead.2.clockwise", font: "caption" } });

// From duplicate-finder — clean state
children.push({ type: "label", properties: { title: "No duplicates found", icon: "checkmark.circle", font: "caption" } });
```

Pattern: `label` with descriptive icon + `text` with instructions on how to get started.

---

## 11. Reactive re-rendering pattern

All plugins use `registerPanel` / `registerActivityView` with the same ID to replace content:

```typescript
let ctx: PluginContext | null = null;

function render(): void {
    if (!ctx) return;
    // Build the view tree...
    ctx.ui.registerPanel("my-panel", {
        title: "My Plugin",
        icon: "puzzlepiece.extension",
        position: "bottom",
        priority: 100,
        view: { type: "scroll", children: [{ type: "vstack", children }] },
        handler: handleAction
    });
}

// Call render() any time state changes.
// Calling registerPanel with the same ID replaces the view.
```

---

## 12. Full-pane views (target: "pane")

From collection-manager — renders into an entire pane instead of the sidebar:

```typescript
ctx.ui.registerPanel("collection-pane", {
    title: c ? c.name : "Collections",
    icon: "tray.2.fill",
    target: "pane",        // KEY: takes a full pane, not sidebar
    priority: 10,
    view: { type: "scroll", children: [{ type: "vstack", children }] },
    handler: handleAction
});
```

Use when the content needs file-list-grade space: collections, project explorers, multi-column data views. The dual-pane interaction becomes: browse files in one pane, plugin view in the other.

Pair with a lightweight `registerActivityView` that just opens the pane (don't duplicate the view tree):

```typescript
ctx.ui.registerActivityView("collection-activity", {
    title: "Collections",
    icon: "tray.2.fill",
    badge: collections.length > 0 ? String(collections.length) : undefined,
    priority: 30,
    view: { type: "vstack", children: [
        { type: "label", properties: { title: "Open Collections pane", icon: "tray.2.fill", font: "caption" } }
    ] },
    handler: handleAction
});
```

---

## 13. Unified layout with composable builders (no mode switching)

From collection-manager — one `render()` function builds all zones. Never toggle between separate views.

```typescript
function render(): void {
    if (!ctx) return;
    const children: ViewDescriptor[] = [];

    // TOP: Always-visible nav/picker
    children.push(...buildCollectionNav());
    children.push({ type: "divider", properties: {} });

    // BOTTOM: Active content or empty state
    const c = active();
    if (c) {
        children.push(...buildToolbar(c));
        children.push(...buildItemList(c));
    } else {
        children.push(...buildEmptyState());
    }

    ctx.ui.registerPanel("collection-pane", {
        title: c ? c.name : "Collections",
        target: "pane",
        view: { type: "scroll", children: [{ type: "vstack", children }] },
        handler: handleAction
    });
}
```

Each `build*()` returns `ViewDescriptor[]`. No `viewMode` state variable, no `if (mode === "list")` branching, no back buttons. The nav is always visible at top, content below.

---

## 14. Action naming conventions

Use short, semantic prefixes. The handler knows its context — the prefix doesn't need the noun:

```typescript
// GOOD — short and clear
handler: (action: string) => {
    if (action === "new-collection") { ... }    // bare string for simple actions
    if (action === "add-selected") { ... }      // bare string
    if (action.startsWith("select:")) { ... }   // select:{id}
    if (action.startsWith("delete:")) { ... }   // delete:{id}
    if (action.startsWith("rename:")) { ... }   // rename:{id}
    if (action.startsWith("open:")) { ... }     // open:{url}
    if (action.startsWith("reveal:")) { ... }   // reveal:{url}
    if (action.startsWith("remove:")) { ... }   // remove:{url}
    if (action.startsWith("terminal:")) { ... } // terminal:{url}
    if (action.startsWith("copy-path:")) { ... }// copy-path:{url}
    if (action.startsWith("export-paths:")) { ... } // export-paths:{id}
}

// BAD — verbose, redundant noun in prefix
// "open-collection:"  → just use "select:"
// "delete-collection:" → just use "delete:"
// "rename-collection:" → just use "rename:"
```

---

## 15. Multiple empty states

From collection-manager — distinct states for different conditions:

```typescript
function buildEmptyState(): ViewDescriptor[] {
    if (collections.length === 0) {
        // First-run: onboarding with hints
        return [
            { type: "spacer", properties: { minLength: 32 } },
            { type: "label", properties: { title: "Playlists for your files", icon: "tray.2.fill", font: "headline" } },
            { type: "spacer", properties: { minLength: 8 } },
            { type: "text", properties: { content: "Create a collection, then add files from the other pane.", font: "caption" } },
            { type: "text", properties: { content: "⌘⇧C   Quick-add selected files", font: "caption" } },
        ];
    }
    // Has collections but none selected
    return [
        { type: "spacer", properties: { minLength: 32 } },
        { type: "label", properties: { title: "Select a collection above", icon: "tray.fill", font: "caption" } },
    ];
}
```

Three common states: first-run (onboarding), has-data-but-no-selection, selection-is-empty.

---

## 16. Plugin activate/deactivate skeleton

Standard pattern across all plugins:

```typescript
let pluginContext: PluginContext | null = null;

(globalThis as any).activate = async function(context: PluginContext): Promise<void> {
    pluginContext = context;

    // 1. Load persisted state
    const stored = context.storage.get("myData");

    // 2. Register commands
    context.commands.register("my-command", {
        title: "Do Thing",
        icon: "star",
        handler: () => { /* ... */ }
    });

    // 3. Subscribe to events
    const token = context.events.subscribe("navigation.directoryChanged", () => { refresh(); });

    // 4. Initial render
    renderPanel();
};

(globalThis as any).deactivate = function(): void {
    // Clear local state only — host handles UI unregistration
    pluginContext = null;
};
```
