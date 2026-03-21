# Claude Code Prompt: Build a 2Panez Plugin Development Plugin + Marketplace

## Prompt

```
Create a Claude Code plugin called "twopanez-dev" that gives Claude Code the skills, commands, and
agents needed to create, build, test, and deploy 2Panez file manager plugins. Also create a
marketplace so others can install it via `/plugin marketplace add twopanez/2panez-dev-plugin`.

Context: Read everything in ~/Documents/GitHub/2panez-community-plugins/ before writing anything.
That repo contains:
- plugin-api.d.ts — Full TypeScript API definitions (~1,800 lines)
- EXTENSION-API.md — Human-readable API spec (~670 lines)  
- template/ — Minimal plugin skeleton
- plugins/ — Seven complete reference plugins (bookmarks, git-gutter, duplicate-finder,
  quick-notes, scaffolder, theme-pack, workspace-snapshot)
- scripts/ — build-all.sh, deploy.sh, create-plugin.sh, sync-types.sh

Also read the official Claude Code plugin docs:
- https://code.claude.com/docs/en/plugins (create plugins)
- https://code.claude.com/docs/en/plugin-marketplaces (create marketplaces)
- https://github.com/anthropics/claude-plugins-official/tree/main/plugins/example-plugin (reference)

## What to build

Create this at ~/Documents/GitHub/2panez-dev-plugin/:

### Directory structure

```
2panez-dev-plugin/
├── .claude-plugin/
│   ├── plugin.json                    # Plugin manifest
│   └── marketplace.json               # Marketplace catalog (single plugin)
├── commands/
│   ├── new-plugin.md                  # /twopanez-dev:new-plugin — scaffold a new 2Panez plugin
│   ├── build.md                       # /twopanez-dev:build — esbuild the current plugin
│   ├── deploy.md                      # /twopanez-dev:deploy — deploy to ~/Library/App Support/
│   └── validate.md                    # /twopanez-dev:validate — check manifest + entry points
├── agents/
│   ├── plugin-architect.md            # Designs plugin structure from requirements
│   └── viewdescriptor-builder.md      # Specializes in building ViewDescriptor UI trees
├── skills/
│   ├── twopanez-plugin-dev/
│   │   ├── SKILL.md                   # Main skill — triggers on "2Panez plugin", "file manager plugin"
│   │   └── reference/
│   │       ├── extension-api.md       # Copy of EXTENSION-API.md
│   │       ├── plugin-api.d.ts        # Copy of plugin-api.d.ts
│   │       └── patterns.md            # Common patterns from the 7 example plugins
│   └── viewdescriptor-authoring/
│       └── SKILL.md                   # Focused skill for ViewDescriptor tree building
├── README.md                          # Plugin documentation
└── LICENSE                            # MIT
```

### plugin.json

```json
{
  "name": "twopanez-dev",
  "description": "Create, build, test, and deploy 2Panez file manager plugins. Provides skills for the full plugin API (16 namespaces, 13 ViewDescriptor types, 24 permissions), commands for scaffolding/building/deploying, and specialized agents for plugin architecture and UI design.",
  "version": "1.0.0",
  "homepage": "https://github.com/twopanez/2panez-dev-plugin"
}
```

### marketplace.json

```json
{
  "plugins": [
    {
      "name": "twopanez-dev",
      "description": "Create, build, test, and deploy 2Panez file manager plugins. Skills for the full plugin API, commands for scaffolding/building/deploying, and agents for plugin architecture.",
      "version": "1.0.0",
      "homepage": "https://github.com/twopanez/2panez-dev-plugin"
    }
  ]
}
```

## Commands spec

### /twopanez-dev:new-plugin

Interactive scaffolding command. Prompts for:
- Plugin name and ID (generates reverse-domain com.community.{name})
- What the plugin does (maps to permissions, API namespaces)
- Where to create it (default: ~/Documents/GitHub/2panez-community-plugins/plugins/{name}/)

Then:
1. Copies the template/ directory
2. Updates plugin.json with the correct id, name, description, permissions, shellCommands, networkDomains
3. Generates src/main.ts with activate/deactivate stubs and the appropriate PluginContext interface
4. Creates tsconfig.json extending the shared base
5. Runs esbuild to produce dist/main.js

Frontmatter should include `allowed-tools: [Read, Write, Bash, Glob, Grep]` and `argument-hint: [plugin-name]`.

### /twopanez-dev:build

Builds the current 2Panez plugin. Detects the plugin root (looks for plugin.json), runs:
```bash
npx esbuild src/main.ts --bundle --format=iife --target=es2020 --outfile=dist/main.js
```
Then validates the bundle contains `globalThis.activate` and `globalThis.deactivate`.

Frontmatter: `allowed-tools: [Bash, Read, Grep]`

### /twopanez-dev:deploy

Deploys the current plugin to ~/Library/Application Support/com.twopanez/plugins/{id}/.
Reads the plugin ID from plugin.json, rsyncs, and reminds the user to restart 2Panez.

Frontmatter: `allowed-tools: [Bash, Read]`

### /twopanez-dev:validate

Checks:
- plugin.json exists and has required fields (id, name, version, runtime, entrypoint)
- dist/main.js exists and contains activate/deactivate
- Permissions declared match APIs used in source
- Settings declared in manifest match keys used in context.settings.get() calls
- Shell commands used in source match shellCommands allowlist

Frontmatter: `allowed-tools: [Read, Grep, Glob]`

## Agents spec

### plugin-architect

System prompt should make it a 2Panez plugin design specialist that:
- Understands all 16 API namespaces and when to use each
- Can map requirements to the minimal set of permissions
- Knows the sidebar panel vs activity bar view decision
- Recommends settings schema based on what's configurable
- Designs the action handler routing scheme (prefixed action strings)
- Should read reference/extension-api.md and reference/patterns.md for full API knowledge

### viewdescriptor-builder

System prompt should make it a specialist in building ViewDescriptor JSON trees that:
- Knows all 13 ViewDescriptor types and their properties
- Builds section + listItem hierarchies with proper IDs and badges
- Generates menuActions JSON strings with dividers and destructive actions
- Uses width/align/mono for column alignment
- Creates button children with tooltips and hover states
- Handles empty states, loading states, and error states
- Should read reference/extension-api.md for the ViewDescriptor section

## Skills spec

### twopanez-plugin-dev (main skill)

SKILL.md frontmatter:
```yaml
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
```

Body should include:
1. Architecture overview (TypeScript → IIFE → JSCore → PluginContext → native SwiftUI)
2. Decision tree mapping requirements to APIs
3. ViewDescriptor quick reference (all 13 types)
4. menuActions pattern (the #1 UX pattern for plugin authors)
5. Manifest template with all fields
6. Build command and deploy path
7. Pointers to reference/ for full API spec, type definitions, and patterns

Keep SKILL.md under 400 lines. Full reference docs go in reference/.

### viewdescriptor-authoring (focused skill)

SKILL.md for just the ViewDescriptor system — triggered when building UI specifically.
Covers all 13 types, column alignment, menuActions, section/badge patterns, 
font values, color values, and the listItem trailing children pattern.
Keep under 200 lines.

### reference/patterns.md

Extract these common patterns from the 7 example plugins with working code snippets:
- Sidebar panel with collapsible sections (from git-gutter)
- Activity bar view with badge (from bookmarks)
- listItem with trailing columns (from file-stats pattern in all v2 plugins)
- menuActions with dividers and destructive actions
- Action handler routing with prefixed strings
- shell.execute helpers for open/reveal/terminal
- Event subscription with re-render pattern
- Settings reading with fallback defaults
- URL/path conversion helpers
- Empty state guidance pattern

## Important constraints to encode

- Plugins install to ~/Library/Application Support/com.twopanez/plugins/{plugin-id}/
- Plugin IDs: reverse-domain format (com.community.pluginname)
- dist/main.js must be an IIFE bundle (esbuild --format=iife), NOT ESM
- globalThis.activate receives PluginContext — the ONLY way to access APIs
- globalThis.deactivate clears local state; host handles UI unregistration
- ViewDescriptor has exactly 13 types — NO HTML/WebView escape hatch
- menuActions is a JSON STRING on listItem properties (must JSON.stringify)
- width on text/button creates fixed-width columns (essential for aligned sidebars)
- mono: true enables .monospacedDigit() for numeric alignment
- Settings are READ-ONLY from plugin side (context.settings.get())
- Community plugins repo: ~/Documents/GitHub/2panez-community-plugins/
- 2Panez is NOT open source — only the plugin API and community plugins are public

## After creating the plugin

1. Init a git repo at ~/Documents/GitHub/2panez-dev-plugin/
2. Make the initial commit
3. Test locally: `claude --plugin-dir ~/Documents/GitHub/2panez-dev-plugin/`
4. Verify /twopanez-dev:new-plugin works by scaffolding a test plugin
5. Verify the main skill triggers when asked "create a 2Panez plugin that shows word counts"
```
