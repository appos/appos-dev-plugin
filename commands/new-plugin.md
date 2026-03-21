---
allowed-tools: [Read, Write, Bash, Glob, Grep]
argument-hint: "<plugin-name>"
description: Scaffold a new 2Panez plugin interactively
---

# Scaffold a new 2Panez plugin

Create a new 2Panez plugin from the community template. Follow these steps:

## 1. Gather information

If a plugin name was provided as an argument, use it. Otherwise ask the user for:
- **Plugin name** (kebab-case, e.g. `file-stats`)
- **What the plugin does** (one sentence)
- **Where to create it** (default: `~/Documents/GitHub/2panez-community-plugins/plugins/{name}/`)

Generate the plugin ID as: `com.community.{name-without-hyphens}` (e.g. `com.community.filestats`).

## 2. Read the API reference

Read the main skill reference files to understand the full API. Use Glob to find `**/reference/extension-api.md` and `**/reference/patterns.md` in the twopanez-dev plugin directory, then read them:
- `extension-api.md` — Full API spec with all 16 namespaces
- `patterns.md` — Common patterns from 7 reference plugins

## 3. Map requirements to APIs

Based on what the plugin does, determine:
- Which API namespaces are needed
- Which permissions to declare
- Which shell commands to allow (if any)
- Which network domains to allow (if any)
- Which settings to declare (if any)
- UI strategy:
  - **Sidebar panel** (`registerPanel`) — supplements the file browser (stats, git status)
  - **Full-pane view** (`registerPanel` with `target: "pane"`) — IS the content, replaces a file pane (collections, virtual folders, dashboards). Always pair with lightweight `registerActivityView`.
  - **Activity bar view** (`registerActivityView`) — dedicated icon + sidebar for primary features (bookmarks)

## 4. Copy the template

```bash
REPO_ROOT="$HOME/Documents/GitHub/2panez-community-plugins"
TARGET="{target-directory}"
cp -R "$REPO_ROOT/template/" "$TARGET/"
```

## 5. Update plugin.json

Write the manifest with the correct id, name, description, permissions, shellCommands, networkDomains, and settings. Use the Write tool.

## 6. Generate src/main.ts

Write the main TypeScript file with:
- A `PluginContext` interface with only the APIs this plugin needs
- A `ViewDescriptor` interface if UI is needed
- `let ctx: PluginContext | null = null;` for state (use short variable name)
- Helper functions (`urlToPath`, `pathToUrl` if working with files)
- A single `render()` function that builds the full view tree
  - For full-pane: composable `build*()` functions returning `ViewDescriptor[]` — NO mode switching
  - Unified layout: always-visible nav at top + divider + active content or empty state below
- Action handler with short semantic prefixes (`"select:"`, `"open:"`, `"remove:"` — never verbose `"open-collection:"`)
- `globalThis.activate` that stores context, registers commands/events, and does initial render
- `globalThis.deactivate` that clears local state
- menuActions on every listItem (this is the #1 UX pattern)
- Multiple distinct empty states (first-run onboarding, no-selection, empty-content)

Follow the patterns from `reference/patterns.md`.

## 7. Create tsconfig.json

```json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "outDir": "dist"
    },
    "include": ["src/**/*"]
}
```

## 8. Build

```bash
cd "{target-directory}"
npx esbuild src/main.ts --bundle --format=iife --target=es2020 --outfile=dist/main.js
```

## 9. Validate

Verify the bundle contains the required entry points:

```bash
grep -c "globalThis" "{target-directory}/dist/main.js"
```

Report the created plugin structure and suggest next steps:
- Edit `src/main.ts` to add more functionality
- Run `/twopanez-dev:build` to rebuild after changes
- Run `/twopanez-dev:deploy` to install in 2Panez
- Run `/twopanez-dev:validate` to check for issues
