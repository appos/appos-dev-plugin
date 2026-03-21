# twopanez-dev

A Claude Code plugin for creating, building, testing, and deploying [2Panez](https://twopanez.com) file manager plugins.

## Features

- **Skills** — Full API knowledge for the 2Panez plugin system (16 namespaces, 13 ViewDescriptor types, 24 permissions)
- **Commands** — Scaffold, build, deploy, and validate plugins from the command line
- **Agents** — Specialized agents for plugin architecture design and ViewDescriptor UI building

## Installation

### From marketplace

```bash
claude /plugin marketplace add twopanez/2panez-dev-plugin
```

### Local development

```bash
claude --plugin-dir ~/Documents/GitHub/2panez-dev-plugin/
```

## Commands

| Command | Description |
|---------|-------------|
| `/twopanez-dev:new-plugin` | Scaffold a new 2Panez plugin interactively |
| `/twopanez-dev:build` | Build the current plugin with esbuild |
| `/twopanez-dev:deploy` | Deploy to ~/Library/Application Support/com.twopanez/plugins/ |
| `/twopanez-dev:validate` | Validate manifest, entry points, permissions, and settings |

## Skills

| Skill | Triggers on |
|-------|-------------|
| twopanez-plugin-dev | "2Panez plugin", "file manager plugin", PluginContext, ViewDescriptor |
| viewdescriptor-authoring | Building UI trees, ViewDescriptor types, menuActions, column alignment |

## Agents

| Agent | Purpose |
|-------|---------|
| plugin-architect | Designs plugin structure from requirements — maps APIs, permissions, settings |
| viewdescriptor-builder | Builds ViewDescriptor JSON trees — all 13 types, menuActions, columns |

## Prerequisites

- [2Panez](https://twopanez.com) file manager for macOS
- [esbuild](https://esbuild.github.io/) (`npm install -g esbuild`)
- The community plugins repo at `~/Documents/GitHub/2panez-community-plugins/`

## Key constraints

- Plugins compile to IIFE bundles (`esbuild --format=iife`), NOT ESM
- Entry points: `globalThis.activate` / `globalThis.deactivate`
- Plugin IDs use reverse-domain format: `com.community.pluginname`
- ViewDescriptor has exactly 13 types — no HTML/WebView escape hatch
- `menuActions` is a JSON string (must `JSON.stringify()`)
- Settings are read-only from the plugin side
- Install path: `~/Library/Application Support/com.twopanez/plugins/{plugin-id}/`

## License

MIT
