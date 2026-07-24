---
allowed-tools: [Read, Grep, Glob, Bash]
description: Validate an AppOS plugin's manifest, build layout, permissions, and settings
---

# Validate an AppOS plugin

Run comprehensive validation on the plugin in the current directory.

## 1. Find plugin root

Locate `plugin.json` in the current directory or parent directories.

## 2. Manifest validation

Read `plugin.json` and check:

- **Required fields present**: `id`, `name`, `version`, `runtime`, `entrypoint`, `minHostVersion`
- **ID format**: reverse-domain (`space.appos.*` for flagships, `com.community.*` for community)
- **Runtime**: must be `"javascript"`
- **Entrypoint**: must point at a JS file that exists (typically `"dist/main.js"`)
- **Version**: valid semver (MAJOR.MINOR.PATCH)
- **minHostVersion**: **LANDMINE CHECK** — this must be the host app `CFBundleShortVersionString`, NOT the `@appos.space/plugin-types` SDK version. If it's set to `"2.0.0"`, `"2.1.0"`, `"2.2.0"`, `"2.3.0"`, `"2.4.0"`, or similar SDK-like values, flag it as an ERROR. Default safe value: `"1.0.0"`. Host version can be read via:
  ```bash
  defaults read /Applications/AppOS.app/Contents/Info.plist CFBundleShortVersionString
  ```
- **Permissions**: must be from the valid set (see below)

Valid permissions (33 total, from `@appos.space/plugin-types`):
`ui.sidebar`, `ui.statusBar`, `ui.contextMenu`, `ui.notifications`, `ui.sheets`, `ui.shortcuts`, `ui.themes`, `ui.preview`, `ui.webPanel`, `ui.quickActions`, `filesystem.read`, `filesystem.write`, `filesystem.watch`, `filesystem.readAll`, `filesystem.writeAll`, `shell.execute`, `clipboard.read`, `clipboard.write`, `network`, `network.outbound`, `network.unrestricted`, `cache`, `feedback`, `feedback.confirm`, `workspaces`, `menubar`, `smartFolders`, `webview`, `keychain.plugin`, `interPlugin.declare`, `interPlugin.contribute`, `interPlugin.query`, `interPlugin.emit`

If the manifest declares `shell.execute`, verify `"shellCommands"` is present and non-empty. The AppOS sandbox blocks any command not in that list.

## 3. SDK layout validation

Check for the SDK-pattern scaffolding:

- `package.json` exists
- `package.json` has `@appos.space/plugin-types` in `devDependencies`
- `tsconfig.json` exists and contains `"verbatimModuleSyntax": true` — without this, imports from declaration-only packages emit broken runtime requires
- `build.mjs` exists (canonical build script)
- `src/main.ts` exists

If any are missing and the plugin still builds, flag as a warning: "Plugin does not follow the SDK pattern — consider migrating. See `appos-plugin-dev` skill."

## 4. Build validation

- `dist/main.js` exists
- `grep -c "globalThis" dist/main.js` returns at least 2 (activate + deactivate)
- `dist/main.js` does NOT contain `export async function activate` or `module.exports` (both symptoms of accidental ESM/CJS output instead of IIFE)

## 5. Permission audit

Search `src/main.ts` and any files it imports (`src/**/*.ts`) for API usage and cross-reference with declared permissions:

| Source pattern | Required permission |
|---|---|
| `ctx.ui.registerPanel`, `ctx.ui.registerActivityView`, `ctx.ui.registerFileRowAnnotation` | `ui.sidebar` |
| `ctx.ui.registerWebPanel`, `ctx.ui.postToWebPanel`, `ctx.ui.onWebPanelMessage`, `ctx.ui.pipeShellToWebPanel` | `ui.webPanel` + `webview` |
| `ctx.ui.registerStatusBarItem` | `ui.statusBar` |
| `ctx.ui.registerContextMenuItem` | `ui.contextMenu` |
| `ctx.ui.showNotification` | `ui.notifications` |
| `ctx.ui.showSheet` | `ui.sheets` |
| `ctx.ui.registerQuickAction` | `ui.quickActions` |
| `ctx.shortcuts.register` | `ui.shortcuts` |
| `ctx.themes.registerTheme` | `ui.themes` |
| `ctx.fileOps.listDirectory`, `.readFile`, `.getActiveDirectory` | `filesystem.read` |
| `ctx.fileOps.createFile`, `.writeFile`, `.delete`, `.moveFile`, `.copyFile` | `filesystem.write` |
| `ctx.fileOps.watchDirectory` | `filesystem.watch` |
| `ctx.shell.execute`, `ctx.shell.pipeToWebPanel` (deprecated — use `ctx.ui.pipeShellToWebPanel`) | `shell.execute` |
| `ctx.clipboard.read` | `clipboard.read` |
| `ctx.clipboard.write` | `clipboard.write` |
| `ctx.network.fetch` | `network` or `network.outbound` |
| `ctx.cache.get`, `.set`, `.delete` | `cache` |
| `ctx.feedback.toast`, `.log` | `feedback` |
| `ctx.feedback.confirm`, `.prompt` | `feedback.confirm` |
| `ctx.workspaces.register`, `.apply`, `.list` | `workspaces` |
| `ctx.menubar.register`, `.setBadge`, `.remove` | `menubar` |
| `ctx.smartFolders.registerFilterType` | `smartFolders` |
| `ctx.storage.getSecure`, `.setSecure` | `keychain.plugin` |

Report any missing permissions (API used but not declared) or excess permissions (declared but not used).

## 6. Settings audit

Search `src/**/*.ts` for `ctx.settings.get("KEY")` calls. Cross-reference each key against the `settings` array in `plugin.json`. Report:
- Settings used in code but not declared in manifest
- Settings declared in manifest but not used in code (warning only)

## 7. Shell commands audit

If `shell.execute` is declared, find every `command:` value passed to `ctx.shell.execute(...)` or `ctx.ui.pipeShellToWebPanel(...)`. Cross-reference against the `shellCommands` array in `plugin.json`. Report any missing commands — the sandbox will reject them at runtime.

Also check the `dependencies.system[]` array: if a command is in `shellCommands`, it should generally have a matching `system` entry so the plugin can detect and install it.

## 8. WebView panel audit

If the plugin calls `ctx.ui.registerWebPanel`, additional checks:

- Every `htmlPath` referenced must point at an existing file relative to the plugin root
- Each panel's HTML file must NOT contain inline `<script>`, `<style>`, or `on*=` handlers (CSP will block them)
- Each panel's HTML file must NOT contain dynamic code execution patterns (the WebView CSP blocks them — search for the common suspects and flag any hits)
- The `webview/shared/bridge.js` file (or equivalent) should exist if panels use the bridge pattern
- Count of `registerWebPanel` calls ≤ 2 (per-plugin limit)

## 9. Entry point audit

Search `src/main.ts` for:
- `globalThis.activate = activate` (or the typed cast variant) — REQUIRED
- `globalThis.deactivate = deactivate` — REQUIRED
- ESM `export async function activate` — should NOT be used, flag as error

The IIFE bundle runs the whole file once; only globals reach the host. ESM exports get hidden in the closure.

## 10. Report

```
Plugin Validation: {plugin-name}
================================

Manifest:        ✓ Required fields present
                 ✓ Valid ID format (space.appos.filestats)
                 ✓ minHostVersion: 1.0.0 (safe)
                 ✓ Valid permissions

SDK Layout:      ✓ build.mjs present
                 ✓ tsconfig verbatimModuleSyntax: true
                 ✓ @appos.space/plugin-types in devDependencies

Build:           ✓ dist/main.js exists (42 KB)
                 ✓ globalThis entry points found

Permissions:     ✓ All used APIs have matching permissions
                 ⚠ Excess permission: ui.sheets (declared but not used)

Settings:        ✓ All settings keys match

Shell Commands:  ✓ All commands declared
                 ✓ System dependencies have install hints

WebView:         ✓ 1 panel registered (within limit)
                 ✓ No inline scripts/styles/handlers
                 ✓ bridge.js present

Entry point:     ✓ globalThis.activate assigned
                 ✓ globalThis.deactivate assigned

Overall: PASS (1 warning)
```

If `minHostVersion` is wrong, put it at the top of the report in red — it's the single most common cause of "plugin installed but not appearing in Settings".
