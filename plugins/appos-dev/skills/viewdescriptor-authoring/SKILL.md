---
name: viewdescriptor-authoring
description: >
  Build ViewDescriptor UI trees for AppOS plugins. Use this skill when building or
  designing sidebar panels, activity views, or any plugin UI. Triggers on: "ViewDescriptor",
  "sidebar panel UI", "listItem", "menuActions", "section with badge", "column alignment",
  "trailing children", or when designing the view tree for an AppOS plugin. Also use
  PROACTIVELY when the user is building ViewDescriptor JSON trees or asking about
  AppOS UI component types.
---

# ViewDescriptor Authoring

Build native SwiftUI views for AppOS plugins using JSON ViewDescriptor trees. Each node has a `type`, optional `properties`, and optional `children`. The host maps these to SwiftUI components.

## All 17 types

### Layout containers

| Type | Properties | Notes |
|------|-----------|-------|
| `vstack` | — | Vertical stack. Main layout container. |
| `hstack` | — | Horizontal stack. Use for toolbar rows, inline elements. |
| `scroll` | `axes` ("horizontal"/"vertical") | Wrap outer vstack for scrollable panels. |
| `list` | — | VStack container, functionally identical. |
| `grid` | `columns` (default 3), `spacing` (default 8) | LazyVGrid with flexible columns. Children render as grid items. |

### Content elements

| Type | Properties | Notes |
|------|-----------|-------|
| `text` | `content`, `font`, `width`, `align`, `mono`, `tooltip` | Fixed-width columns when `width` set. |
| `label` | `title`, `icon`, `font` | Icon + text pair. Use for status/info rows. |
| `image` | `systemName` | SF Symbol icon. |
| `remoteImage` | `url`, `width`, `height`, `cornerRadius`, `maxDimension` (default 512) | Loads image from URL (file:// only in Phase 1). `maxDimension` caps pixel size for downsampling. |
| `badge` | `text`/`content`, `color` | Capsule label. |

### Interactive elements

| Type | Properties | Notes |
|------|-----------|-------|
| `button` | `title`, `action`, `tooltip`, `width` | With `width`: inline action button with hover. |
| `listItem` | `title`, `subtitle`, `icon`, `iconColor`, `action`, `menuActions` | Primary row type. Trailing columns go in top-level `children`, NOT in `properties`. |
| `textField` | `placeholder`, `text`, `action` | Editable text input. Action fires on submit. `text` seeds the initial contents (the host falls back to a legacy `value` key for back-compat only — do not write it). |
| `progress` | `value` (0.0-1.0), `label`, `style` ("bar"/"circular") | Omit `value` for indeterminate. Default style: "bar". |
| `section` | `title`, `icon`, `badge`, `isExpanded`, `id` | Collapsible group. Content goes in top-level `children`. |

### Structural

| Type | Properties | Notes |
|------|-----------|-------|
| `divider` | — | Horizontal line separator. |
| `spacer` | `minLength` | Flexible space between elements. |

> **`children` is never a property.** On every descriptor that nests content (`listItem`, `section`, `vstack`, `hstack`, `scroll`, `list`, `grid`), `children` is a top-level field — a SIBLING of `properties` (e.g. `ListItemDescriptor` declares `children?: ViewDescriptor[]` alongside `properties`). Putting `children` inside `properties` fails excess-property checking on typed descriptors, and in loosely built JSON the host ignores it, silently dropping the nested views.

## Font values

`"largeTitle"`, `"title"`, `"title2"`, `"title3"`, `"headline"`, `"subheadline"`, `"body"`, `"callout"`, `"footnote"`, `"caption"`, `"caption2"`

## Color values

**System**: `"systemRed"`, `"systemOrange"`, `"systemYellow"`, `"systemGreen"`, `"systemBlue"`, `"systemPurple"`

**Semantic**: `"primary"`, `"secondary"`, `"tertiary"`

**Design tokens**: `"ux_synapse"`, `"ux_cortex"`, `"ux_pulse"`, `"ux_signal"`, `"ux_warning"`, `"ux_error"`

**Hex**: `"#FF5733"`

## Column alignment with width

Set `width` on `text` or `button` inside `listItem.children` for fixed-width trailing columns:

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

- `width`: fixed-width frame in points
- `align`: `"trailing"` right-aligns within frame
- `mono: true`: `.monospacedDigit()` for number alignment
- `font: "caption"`: standard for trailing metadata

## menuActions (context menus)

JSON-encoded array on `listItem.properties.menuActions`:

```typescript
const url = "file:///Users/me/notes.md";

const menu = [
    { title: "Open", icon: "arrow.up.forward.app", action: "open:" + url },
    { title: "Reveal in Finder", icon: "magnifyingglass", action: "reveal:" + url },
    { title: "---" },  // divider
    { title: "Delete", icon: "trash", action: "delete:" + url, destructive: true }
];

const properties = { menuActions: JSON.stringify(menu) };
```

**Rules:**
- Value MUST be `JSON.stringify(array)` — a string, not an object
- Menu items: `{ title, icon?, action, destructive? }`
- Dividers: `{ title: "---" }`
- Place destructive actions last, after a divider
- Actions route through the panel's `handler` callback

## Section with badge

Collapsible groups with item counts:

```json
{
    "type": "section",
    "properties": {
        "title": "Modified",
        "icon": "pencil.circle.fill",
        "badge": "5",
        "isExpanded": true,
        "id": "git-modified"
    },
    "children": [ /* listItem elements */ ]
}
```

- `badge`: always a string (`"" + count`)
- `id`: preserves collapse state across re-renders
- `isExpanded`: initial state (user can toggle)

## Button patterns

```json
// Toolbar button in hstack
{ "type": "button", "properties": { "title": "Refresh", "action": "refresh", "tooltip": "Refresh data", "width": 50 } }

// Inline action button (trailing in listItem)
{ "type": "button", "properties": { "title": "✕", "tooltip": "Remove", "action": "remove:id", "width": 24 } }

// Full-width action button
{ "type": "button", "properties": { "title": "Save Note", "action": "save-note" } }
```

With `width`: renders as `InlineActionButton` with visible hover background and tooltip.
Without `width` but with `tooltip`: gets `.help(tooltip)` for native macOS tooltip.

## Empty states

Always provide guidance when there's no data:

```json
[
    { "type": "spacer", "properties": { "minLength": 16 } },
    { "type": "label", "properties": { "title": "No items yet", "icon": "tray", "font": "caption" } },
    { "type": "text", "properties": { "content": "Click Scan to find items", "font": "caption" } }
]
```

## Loading states

```json
{ "type": "label", "properties": { "title": "Scanning...", "icon": "arrow.trianglehead.2.clockwise", "font": "caption" } }
```

## Panel registration

Wrap in scroll > vstack for scrollable content:

```typescript
import type { ViewDescriptor } from '@appos.space/plugin-types';

declare const children: ViewDescriptor[];
declare function handleAction(action: string): void;

// Sidebar panel (default)
ctx.ui.registerPanel("my-panel", {
    title: "My Plugin",
    icon: "puzzlepiece.extension",
    position: "bottom",   // "top" or "bottom"
    priority: 100,         // lower = higher in sidebar
    view: { type: "scroll", children: [{ type: "vstack", children }] },
    handler: (action: string) => { /* route all actions here */ }
});

// Full-pane view — takes an entire pane instead of sidebar
ctx.ui.registerPanel("my-pane", {
    title: "My Plugin",
    icon: "tray.2.fill",
    target: "pane",        // KEY: "pane" instead of default "sidebar"
    priority: 10,
    view: { type: "scroll", children: [{ type: "vstack", children }] },
    handler: handleAction
});
```

`title` and `view` are required (`PanelOptions`, SDK 3.0.0). `registerPanel` is typed to return a registration-token string. Call it again with the same ID to reactively replace the view.

## Full-pane layout: unified zones

Full-pane plugins should use a **unified layout** with composable builder functions — never toggle between separate views (list mode ↔ detail mode).

```typescript
import type { ViewDescriptor, PluginColor } from '@appos.space/plugin-types';

type Item = { id: string; name: string; icon: string; count: number; color: PluginColor };
declare function buildNav(): ViewDescriptor[];
declare function getActive(): Item | undefined;
declare function buildToolbar(item: Item): ViewDescriptor[];
declare function buildItemList(item: Item): ViewDescriptor[];
declare function buildEmptyState(): ViewDescriptor[];
declare function handler(action: string): void;

function render(): void {
    const children: ViewDescriptor[] = [];
    children.push(...buildNav());           // Always-visible nav/picker (~20%)
    children.push({ type: "divider" });
    const item = getActive();
    if (item) {
        children.push(...buildToolbar(item));    // Contextual toolbar hstack
        children.push(...buildItemList(item));   // Main content (~80%)
    } else {
        children.push(...buildEmptyState());     // Guidance text
    }
    ctx.ui.registerPanel("my-pane", {
        title: "My Plugin",
        target: "pane",
        view: { type: "scroll", children: [{ type: "vstack", children }] },
        handler
    });
}
```

Each `build*()` function returns `ViewDescriptor[]`. Composable, no mode state.

### Toolbar pattern for full-pane views

```typescript
import type { ViewDescriptor, PluginColor } from '@appos.space/plugin-types';

type Item = { id: string; name: string; icon: string; count: number; color: PluginColor };

function buildToolbar(item: Item): ViewDescriptor[] {
    return [{
        type: "hstack",
        children: [
            { type: "label", properties: { title: item.name, icon: item.icon, font: "headline" } },
            { type: "badge", properties: { content: String(item.count), color: item.color } },
            { type: "spacer", properties: {} },
            { type: "button", properties: { title: "+ Add Selected", action: "add-selected", tooltip: "Add from other pane", width: 110 } },
            { type: "button", properties: { title: "Copy Paths", action: "export-paths:" + item.id, tooltip: "Copy to clipboard", width: 80 } },
        ]
    }];
}
```

### Activity bar as pane opener

Pair full-pane views with a lightweight activity bar icon. Don't duplicate the pane content — just provide an entry point:

```typescript
declare const items: { length: number };
declare function handleAction(action: string): void;

ctx.ui.registerActivityView("my-activity", {
    title: "My Plugin",
    icon: "tray.2.fill",
    badge: items.length > 0 ? String(items.length) : undefined,
    priority: 30,
    view: { type: "vstack", children: [
        { type: "label", properties: { title: "Open in pane", icon: "tray.2.fill", font: "caption" } }
    ] },
    handler: handleAction
});
```
