---
allowed-tools: [Read, Grep, Glob, Bash]
description: Validate an AppOS plugin's manifest, build layout, permissions, and settings
---

# Validate an AppOS plugin

Run comprehensive validation on the plugin in the current directory.

## 1. Find plugin root

Locate `plugin.json` in the current directory or parent directories. The directory containing it is the **plugin root** — referred to as `$PLUGIN_ROOT` below. All later steps (manifest, layout, build, and audit checks) resolve paths against `$PLUGIN_ROOT`, not the current working directory, so validation works when invoked from `src/` or any other subdirectory.

## 2. Manifest validation

Read `$PLUGIN_ROOT/plugin.json` and check:

- **Required fields present**: `id`, `name`, `version`, `runtime`, `entrypoint`, `minHostVersion`
- **ID format**: reverse-domain (`space.appos.*` for flagships, `com.community.*` for community)
- **Runtime**: must be `"javascript"`
- **Entrypoint**: must point at a JS file that exists (typically `"dist/main.js"`)
- **Version**: valid semver (MAJOR.MINOR.PATCH)
- **minHostVersion**: **LANDMINE CHECK** — this must be the host app `CFBundleShortVersionString`, NOT the `@appos.space/plugin-types` SDK version. If it's set to `"3.0.0"` (the current SDK major), `"2.0.0"`, `"2.1.0"`, `"2.2.0"`, `"2.3.0"`, `"2.4.0"`, or similar SDK-like values, flag it as an ERROR. Default safe value: `"1.0.0"`. Note the dev-plugin itself is versioned 3.0.0 (aligned with the SDK it teaches) — that number is ALSO not a valid `minHostVersion`. Host version can be read via:
  ```bash
  defaults read /Applications/AppOS.app/Contents/Info.plist CFBundleShortVersionString
  ```
  If a from-source/dev build of the host reports `0.0.0` (symptom: even `minHostVersion: "1.0.0"` plugins get rejected), the cause is a mis-generated Xcode project: xcodegen defaults version keys to a 2-component `"1.0"`, which fails the host's strict `X.Y.Z` semver parse and collapses to `0.0.0`. That's a host build issue (fixed in the host's `project.yml` version properties), not a plugin manifest issue — report it as such instead of telling the user to lower `minHostVersion`.
- **Permissions**: validated by the manifest schema (next step). Do NOT hand-check against a hardcoded list — the authoritative permission set lives in the SDK's `schemas/plugin-v1.json` and grows with each SDK release.

### Schema validation (authoritative)

Validate the whole manifest against the SDK's published JSON Schema. This checks required fields, field shapes, and the full permissions enum in one step.

**Preferred (no clone needed)** — fetch the schema from the public `appos/plugin-sdk` repo's `v3.0.0` release tag and validate with ajv:

```bash
curl -fsSL -o /tmp/appos-plugin-v1.schema.json \
  https://raw.githubusercontent.com/appos/plugin-sdk/v3.0.0/schemas/plugin-v1.json
npx --yes -p ajv-cli -p ajv-formats ajv validate \
  --spec=draft2020 -c ajv-formats \
  -s /tmp/appos-plugin-v1.schema.json -d "$PLUGIN_ROOT/plugin.json"
```

Exit 0 with `plugin.json valid` = pass. On failure, ajv prints the offending JSON paths — e.g., an unknown permission string fails the `permissions` items enum.

> **Why the `v3.0.0` tag:** the schema anchor is chosen for *install-time* truth. The shipped AppOS 1.0.0 host validates and gates permissions against its full current scope surface (`PermissionScope.allKnown`), and the SDK 3.0.0 release schema carries the full permission enum (135 canonical permission scopes + 5 legacy aliases (deprecated)) plus the `extensions` field for core-plugin extension contributions. **Caveat:** the 5 legacy aliases are schema-*tolerated*, not host-honored — only `network.fetch` has a host-side alias entry (normalized to `network.outbound` at manifest parse time); the other four (`network`, `smartFolders`, `webview`, `shell.uncontained`) grant nothing at install time, so an AJV pass alone is NOT install-time permission truth. Always run the legacy-alias post-check below after schema validation. Pin the tag for reproducibility; `main` currently carries the same schema, but tags don't move under you. Do NOT use the older `v2.4.0` tag — its schema predates the core-plugin waves: it knows only 37 of the current 140 permission strings and rejects the `extensions` field entirely, so it falsely FAILS valid manifests — including the flagship `appos-plugin-ytdlp`, which declares `actions.register`, `actions.invoke`, `notifications.emit`, and `extensions[]` contributions. (The published `@appos.space/plugin-types` npm package ships only `.d.ts` files — there is no per-release package schema to fetch from npm.) Note the separate compile-time bound: the SDK version you compile against (`^3.0.0`) limits which *typed APIs* your TypeScript sees, not which manifest permissions the host accepts. If a future SDK schema ever moves ahead of your installed host, cross-check the `minHostVersion` guidance above — manifest validity is anchored to the host, not the npm package.

**Alternative (plugin-sdk clone available)** — validate offline with the clone's own validator, passing your manifest path as a positional argument:

```bash
node "$SDK_CLONE/scripts/validate-schema.mjs" "$PLUGIN_ROOT/plugin.json"
```

Exit 0 = pass; on failure it prints the offending JSON paths. This runs fully offline — both the schema and the validator live in the clone — with one precondition: the clone's dev dependencies (`ajv`, `ajv-formats`) must be installed. Run `npm install` in `$SDK_CLONE` once while online; if that never happened and you're offline now, use the structural fallback below instead. Do NOT substitute the `npx ajv` recipe here — `npx` resolves its packages from npm, so it is not offline-capable.

If you're offline and have no clone, fall back to the structural checks above (required fields, ID format, minHostVersion landmine) and state in the report that the permission set could NOT be authoritatively verified.

### Legacy-alias post-check (required — a schema pass is not host truth)

The schema tolerates 5 legacy aliases for compile-time compatibility, but the host's alias map implements only ONE of them — see the "Deprecated legacy aliases" table in the `appos-plugin-dev` skill's `reference/extension-api.md` (host-behavior authority) and `LegacyPermissionScope` in `reference/plugin-api/permissions.d.ts`. After schema validation passes (whichever path you used), re-scan the manifest's `permissions` array — both bare strings and `{ scope, reason }` object entries — and:

- **ERROR — dead aliases.** These pass AJV but have NO host-side entry: they are silently never granted, so the plugin installs "successfully" yet lacks the capability at runtime. Flag each occurrence as an ERROR with its canonical replacement:
  - `network` → replace with `network.outbound`
  - `webview` → replace with `ui.webPanel`
  - `smartFolders` → replace with `filesystem.read` (smart-folder filter registration runs under filesystem read)
  - `shell.uncontained` → remove entirely; the uncontained tier is NOT declarable — the host infers it from `filesystem.readAll`
- **WARNING — tolerated but rename.** `network.fetch` is the one real alias: the host normalizes it to `network.outbound` at manifest parse time, so it works today, but flag it and recommend declaring `network.outbound` directly.

A manifest declaring any of the four dead aliases must NOT be reported as an overall PASS on permissions.

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
| `ctx.ui.registerWebPanel`, `ctx.ui.postToWebPanel`, `ctx.ui.onWebPanelMessage`, `ctx.ui.onWebPanelRequest` | `ui.webPanel` (the `webview` alias is dead — never granted) |
| `ctx.ui.pipeShellToWebPanel` | BOTH `ui.webPanel` AND `shell.execute` — it streams into a WebView panel *and* spawns a shell process; every piped command must also be listed in `shellCommands` (step 7) |
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
| `ctx.shell.execute` | `shell.execute` (`ShellAPI` has ONLY `execute` in SDK 3.0.0 — any `ctx.shell.pipe*` spelling comes from stale docs and does not exist; flag such a call as an ERROR pointing to `ctx.ui.pipeShellToWebPanel`) |
| `ctx.clipboard.read` | `clipboard.read` |
| `ctx.clipboard.write` | `clipboard.write` |
| `ctx.network.fetch` | `network.outbound` (legacy `network.fetch` is normalized to it; bare `network` is dead — never granted) |
| `ctx.cache.get`, `.set`, `.delete` | `cache` |
| `ctx.feedback.toast`, `.log` | `feedback` |
| `ctx.feedback.confirm`, `.prompt` | `feedback.confirm` |
| `ctx.workspaces.register`, `.apply`, `.list` | `workspaces` |
| `ctx.menubar.register`, `.setBadge`, `.remove` | `menubar` |
| `ctx.smartFolders.registerFilterType` | `filesystem.read` (the `smartFolders` alias is dead — never granted) |
| `ctx.storage.getSecure`, `.setSecure` | `keychain.plugin` |

The table above covers the classic namespaces. Core-plugin namespaces (`ctx.actions`, `ctx.notifications`, `ctx.scheduler`, `ctx.vault`, `ctx.store`, `ctx.resources`, `ctx.entities`, `ctx.views`, `ctx.webhook`, `ctx.llm`, `ctx.recipes`, `ctx.sequences`, ...) each require their own scopes (e.g. `actions.register`, `actions.invoke`, `notifications.emit`, `scheduler.job.own`). Do NOT hand-check those against a memorized list — look the scope up per namespace in the `appos-plugin-dev` skill's permission reference (the schema validation in step 2 is the authoritative enum check).

Also cross-check `extensions[]`: for each entry, look up the `extensionPoint`'s required permission scope in the per-extension-point documentation in the `appos-plugin-dev` skill's `reference/extension-api.md` (the `extensions[]` section plus the per-namespace scope notes), and verify the exact spelling against `CanonicalPermissionScope` in `reference/plugin-api/permissions.d.ts`. Do NOT derive the scope mechanically as `<family>.register` — several contribution families use differently-shaped scopes, and a mechanical suffix both misses the real requirement and recommends a scope that does not exist. Contrasting examples:

- `actions.definition` → `actions.register`, and `space.appos.core.notifications:channel` → `notifications.channel.register` (the `*.register` families, where the suffix happens to hold)
- `surfaces.contribution` → the per-surface scope `surfaces.contribute.<surface>` (e.g. `surfaces.contribute.sidebar.top`) — there is NO `surfaces.register`
- computed-field provider contributions (fn-93 entities) → `entities.computedField.provide` — a `*.provide` scope, not `*.register`

If a declared scope is a valid canonical scope for that extension point per the reference, do not report it as missing merely because it lacks a `.register` suffix.

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
                 ✓ Schema validation passed (plugin-v1.json)

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
