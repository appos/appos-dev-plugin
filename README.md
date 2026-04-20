# appos-dev

A Claude Code plugin for creating, building, testing, and deploying [AppOS](https://appos.space) workspace manager plugins using the `@appos.space` SDK.

## What's new in v2.0

v2.0 is a full rewrite targeting the SDK+WebView flagship pattern used by `appos-plugin-ytdlp`. The legacy ViewDescriptor-only model is still supported but is no longer the primary pattern. Key changes:

- **SDK-based scaffolding** — `new-plugin` now writes `package.json` with `@appos.space/plugin-types` (declaration-only types), `@appos.space/plugin-utils` (runtime helpers), and `@appos.space/view-builders` (typed view builders), plus a `tsconfig.json` with `verbatimModuleSyntax: true` and a `build.mjs` esbuild-API build script.
- **WebView panels are first-class** — new `webview-panels` skill covers `registerWebPanel`, the host-injected webview bridge, CSP constraints, typed message protocols, throttled broadcasts, and `pipeShellToWebPanel` for streaming CLI output directly to the UI.
- **22 namespaces, 34 permissions** — updated to match the current `@appos.space/plugin-types` surface. Adds `menubar`, `workspaces`, `smartFolders`, `cache`, `feedback`, `webview`, and more.
- **minHostVersion landmine documented** — the single most common "plugin won't appear in Settings" bug now has a prominent warning everywhere it matters.
- **Canonical reference** — `appos-plugin-ytdlp` is the flagship plugin that exercises every supported SDK feature. Skills and agents point at it for ground truth.

## Features

- **Skills** — Full API knowledge for the AppOS plugin SDK, including WebView panel authoring
- **Commands** — Scaffold, build, deploy, and validate plugins
- **Agents** — Specialized agents for plugin architecture design and WebView panel implementation

## Installation

### From marketplace

```bash
claude /plugin marketplace add appos/appos-dev-plugin
```

### Local development

```bash
claude --plugin-dir ~/Documents/GitHub/appos-dev-plugin/
```

## Commands

| Command | Description |
|---------|-------------|
| `/appos-dev:new-plugin` | Scaffold a new AppOS plugin using the SDK+WebView flagship pattern |
| `/appos-dev:build` | Build the current plugin with `node build.mjs` (SDK pattern) |
| `/appos-dev:deploy` | Deploy to the host's plugin directory with safe exclude list |
| `/appos-dev:validate` | Validate manifest (incl. minHostVersion), SDK layout, permissions, and settings |

## Skills

| Skill | Triggers on |
|-------|-------------|
| appos-plugin-dev | "AppOS plugin", "workspace manager plugin", PluginContext, SDK packages, workspaces, menubar |
| webview-panels | "registerWebPanel", "postToWebPanel", "pipeShellToWebPanel", "bridge.js", "shell chunks", CSP, webview |

## Agents

| Agent | Purpose |
|-------|---------|
| plugin-architect | Designs plugin structure from requirements — maps APIs, permissions, rendering mode, settings |
| webview-panel-builder | Builds WebView panels end-to-end — registration, HTML bundle, typed message protocol, pipeShellToWebPanel wiring |

## Prerequisites

- [AppOS](https://appos.space) workspace manager for macOS
- [Node.js](https://nodejs.org) 18+ with npm
- The AppOS SDK checked out at `~/Documents/GitHub/AppOS/plugin-sdk/` (for `file:` dependencies during local development)
- The canonical reference plugin `~/Documents/GitHub/AppOS/appos-plugin-ytdlp/` (for patterns and examples)

## Key constraints

- Plugins compile to IIFE bundles via `build.mjs` (esbuild API), NOT ESM — ESM bundles silently fail to load in JavaScriptCore
- Entry points: `globalThis.activate` / `globalThis.deactivate` (never ESM `export`)
- Plugin IDs: `space.appos.*` for flagships, `com.community.*` for community
- `minHostVersion` defaults to `"1.0.0"` — NEVER use the `@appos.space/plugin-types` SDK version here (that's the single biggest cause of "plugin won't appear in Settings")
- `tsconfig.json` MUST have `verbatimModuleSyntax: true` because `@appos.space/plugin-types` is declaration-only
- Max 2 WebView panels per plugin, 6 globally
- WebView CSP blocks inline scripts/styles/handlers — everything external, ES modules only
- `pipeShellToWebPanel` lives on `ctx.ui`, NOT `ctx.shell` (stale docs are wrong)
- Install path: `~/Library/Application Support/com.twopanez/plugins/{plugin-id}/` (legacy bundle ID on disk; do not change — see `/appos-dev:deploy`)

## License

MIT
