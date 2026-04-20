# CLAUDE.md — appos-dev plugin

Project instructions for Claude Code when working inside this repo.

## What this is

A Claude Code plugin that gives Claude Code the skills, commands, and agents needed to create, build, test, and deploy AppOS workspace manager plugins. Canonical reference: `~/Documents/GitHub/AppOS/appos-plugin-ytdlp` — the flagship plugin that exercises every supported SDK feature.

This plugin is versioned at **2.0.0** because it was fully rewritten to target the SDK+WebView flagship pattern. The legacy ViewDescriptor-only model is still supported but is no longer the primary pattern.

## Repository layout

```
appos-dev-plugin/
├── .claude-plugin/
│   ├── plugin.json          # Claude Code plugin manifest
│   └── marketplace.json     # Single-plugin marketplace catalog
├── commands/
│   ├── new-plugin.md        # /appos-dev:new-plugin
│   ├── build.md             # /appos-dev:build
│   ├── deploy.md            # /appos-dev:deploy
│   └── validate.md          # /appos-dev:validate
├── agents/
│   ├── plugin-architect.md          # Designs plugin architecture from requirements
│   └── webview-panel-builder.md     # Builds WebView panels end-to-end
├── skills/
│   ├── appos-plugin-dev/
│   │   ├── SKILL.md         # Main SDK+WebView skill
│   │   └── reference/       # Full API spec, patterns, type definitions
│   └── webview-panels/
│       └── SKILL.md         # Focused WebView authoring skill
├── README.md
└── LICENSE
```

## Key references

Before editing anything, be aware of these external sources of truth:

- **Flagship reference plugin**: `~/Documents/GitHub/AppOS/appos-plugin-ytdlp/` — all patterns in the skills match this plugin's implementation. When in doubt, read its source files.
- **SDK source**: `~/Documents/GitHub/AppOS/plugin-sdk/packages/plugin-types/dist/` — the current declaration-only TypeScript types. Use for reference when validating API shapes in skills or commands.
- **Host version**: read `/Applications/2Panez.app/Contents/Info.plist` → `CFBundleShortVersionString` (currently `1.7.0`). This is the host app's on-disk bundle (legacy name, do not rename); its version is what `plugin.json` `minHostVersion` is compared against, NOT the SDK package version.

## Conventions

- **Plugin IDs**: use `space.appos.*` for flagship plugins (the ones shipped with AppOS), `com.community.*` for community plugins, other reverse-domain for private/personal plugins.
- **minHostVersion**: always default to `"1.0.0"`. The single biggest cause of "plugin installed but not appearing in Settings" is conflating the SDK version (`2.4.x`) with the host version (`1.7.x`). The `appos-plugin-dev` skill has a "minHostVersion landmine" section; keep it prominent.
- **tsconfig**: always include `verbatimModuleSyntax: true`. Without it, TypeScript emits broken runtime imports from the declaration-only `@appos.space/plugin-types` package.
- **Entry point**: always `globalThis.activate = activate` + `globalThis.deactivate = deactivate`, never ESM `export`. ESM exports disappear inside the IIFE closure and the host can't find them.
- **Parameter naming**: always `ctx`, never `pluginContext`. Matches `appos-plugin-ytdlp` and every reference plugin.
- **rsync deploy**: always use `--delete-excluded` and a comprehensive exclude list. Without `--delete-excluded`, files added to the exclude list after a previous deploy linger on the destination forever.

## When updating skills or commands

1. Read the corresponding code in `appos-plugin-ytdlp` first — that's the ground truth.
2. If the SDK surface changed, check `~/Documents/GitHub/AppOS/plugin-sdk/packages/plugin-types/dist/` for the current type definitions.
3. Keep examples copyable — prefer full working snippets over fragments.
4. When documenting a gotcha, include a `**Why**:` line with the root cause so future-you can judge edge cases.

## When adding new commands/agents/skills

Follow Claude Code plugin conventions:

- Commands go in `commands/*.md` with frontmatter declaring `allowed-tools` and `argument-hint`
- Agents go in `agents/*.md` with frontmatter declaring `name`, `description`, `whenToUse`, `tools`
- Skills go in `skills/{name}/SKILL.md` with frontmatter declaring `description` (include the trigger phrases that should activate it)

## Testing locally

```bash
claude --plugin-dir ~/Documents/GitHub/appos-dev-plugin/
```

Then verify:
- `/appos-dev:new-plugin` scaffolds a plugin using the SDK pattern
- The main skill triggers when asked something like "create an AppOS plugin that downloads with yt-dlp"
- The `webview-panels` skill triggers when asked about `registerWebPanel` or `pipeShellToWebPanel`
- The `plugin-architect` agent triggers when asked to design a new plugin
- The `webview-panel-builder` agent triggers when asked to build a WebView panel

## Do NOT

- Do NOT copy from the legacy community-plugin template — it's the ViewDescriptor-only model and should not be used for new plugins
- Do NOT recommend ESM `export` for activate/deactivate
- Do NOT set `minHostVersion` to anything other than `"1.0.0"` without a documented reason
- Do NOT add inline `<script>`/`<style>`/`on*=` to WebView HTML examples (CSP blocks them)
- Do NOT recommend `ctx.shell.pipeShellToWebPanel` — that's stale documentation; the correct path is `ctx.ui.pipeShellToWebPanel`
