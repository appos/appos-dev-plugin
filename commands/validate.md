---
allowed-tools: [Read, Grep, Glob]
description: Validate a 2Panez plugin's manifest, entry points, permissions, and settings
---

# Validate a 2Panez plugin

Run comprehensive validation checks on the current 2Panez plugin.

## 1. Find plugin root

Locate `plugin.json` in the current directory or parent directories.

## 2. Manifest validation

Read `plugin.json` and check:

- **Required fields present**: `id`, `name`, `version`, `runtime`, `entrypoint`
- **ID format**: must be reverse-domain (e.g. `com.community.myplugin`)
- **Runtime**: must be `"javascript"`
- **Entrypoint**: must be `"dist/main.js"`
- **Version**: must be valid semver (MAJOR.MINOR.PATCH)
- **Permissions**: must be from the valid set (see below)

Valid permissions: `ui.sidebar`, `ui.statusBar`, `ui.contextMenu`, `ui.notifications`, `ui.sheets`, `ui.shortcuts`, `ui.themes`, `ui.preview`, `filesystem.read`, `filesystem.write`, `filesystem.watch`, `filesystem.readAll`, `filesystem.writeAll`, `shell.execute`, `clipboard.read`, `clipboard.write`, `network.outbound`, `network.unrestricted`, `keychain.plugin`, `interPlugin.declare`, `interPlugin.contribute`, `interPlugin.query`, `interPlugin.emit`

## 3. Build validation

- Check `dist/main.js` exists
- Search for `globalThis` in the bundle to verify activate/deactivate are exported

## 4. Permission audit

Search `src/main.ts` for API usage and cross-reference with declared permissions:

| Source pattern | Required permission |
|---------------|-------------------|
| `ui.registerPanel` | `ui.sidebar` |
| `ui.registerActivityView` | `ui.sidebar` |
| `ui.registerStatusBarItem` | `ui.statusBar` |
| `ui.registerContextMenuItem` | `ui.contextMenu` |
| `ui.showNotification` | `ui.notifications` |
| `ui.showSheet` | `ui.sheets` |
| `ui.registerFileRowAnnotation` | `ui.sidebar` |
| `fileOps.listDirectory`, `fileOps.readFile`, `fileOps.getActiveDirectory` | `filesystem.read` |
| `fileOps.createFile`, `fileOps.writeFile`, `fileOps.delete` | `filesystem.write` |
| `fileOps.watchDirectory` | `filesystem.watch` |
| `shell.execute` | `shell.execute` |
| `clipboard.read` | `clipboard.read` |
| `clipboard.write` | `clipboard.write` |
| `network.fetch` | `network.outbound` |
| `shortcuts.register` | `ui.shortcuts` |
| `themes.registerTheme` | `ui.themes` |
| `storage.getSecure` | `keychain.plugin` |

Report any missing permissions (API used but not declared) or excess permissions (declared but not used).

## 5. Settings audit

Search `src/main.ts` for `settings.get("KEY")` calls. Cross-reference each key against the `settings` array in plugin.json. Report:
- Settings used in code but not declared in manifest
- Settings declared in manifest but not used in code

## 6. Shell commands audit

If `shell.execute` is used, search for all `command:` values in shell.execute calls. Cross-reference against the `shellCommands` array in plugin.json. Report any missing commands.

## 7. Report

Output a validation report:

```
Plugin Validation: {plugin-name}
================================

Manifest:        ✓ All required fields present
                 ✓ Valid plugin ID format
                 ✓ Valid permissions

Build:           ✓ dist/main.js exists
                 ✓ globalThis exports found

Permissions:     ✓ All used APIs have matching permissions
                 ⚠ Excess permission: ui.sheets (declared but not used)

Settings:        ✓ All settings keys match
                 ⚠ Missing declaration: "maxItems" used in code but not in manifest

Shell Commands:  ✓ All commands declared

Overall: PASS (2 warnings)
```
