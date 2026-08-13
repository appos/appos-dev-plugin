---
allowed-tools: [Bash, Read]
description: Deploy the current AppOS plugin to the local plugins directory
---

# Deploy the current AppOS plugin

Deploy the built plugin to `~/Library/Application Support/AppOS/plugins/`.

## 1. Find and read plugin.json

Locate `plugin.json` in the current directory or parent directories. Read it to get:
- `id` (target install directory name)
- `name` (for the report)
- `minHostVersion` — verify this is NOT set to an SDK version like `"3.0.0"` or `"2.4.0"`. If it is, STOP and warn the user: this is the minHostVersion landmine — it must be a host `CFBundleShortVersionString` (`"1.0.0"` is the safe default). See `appos-plugin-dev` skill → "minHostVersion landmine" section.

## 2. Verify the build exists

Check that `dist/main.js` exists. If not, suggest running `/appos-dev:build` first.

If the plugin has a `webview/` directory, also verify at least one `webview/*/index.html` exists — an empty webview tree indicates a partial build.

## 3. Deploy with rsync

**Critical**: use `--delete-excluded` so that files added to the exclude list after a previous deploy are actually removed from the destination. Without this flag, stale dev files (`.mcp.json`, `SPEC.md`, etc.) will linger from earlier syncs and get loaded by the host.

```bash
PLUGIN_ID="{id-from-plugin.json}"
INSTALL_DIR="$HOME/Library/Application Support/AppOS/plugins/$PLUGIN_ID"
mkdir -p "$INSTALL_DIR"

rsync -av --delete --delete-excluded \
    --exclude='.DS_Store' \
    --exclude='.git/' \
    --exclude='.gitignore' \
    --exclude='.gitattributes' \
    --exclude='.github/' \
    --exclude='.vscode/' \
    --exclude='.claude/' \
    --exclude='.mcp.json' \
    --exclude='.flow/' \
    --exclude='node_modules/' \
    --exclude='src/' \
    --exclude='scripts/' \
    --exclude='test/' \
    --exclude='tests/' \
    --exclude='*.test.ts' \
    --exclude='*.test.js' \
    --exclude='tsconfig.json' \
    --exclude='tsconfig.*.json' \
    --exclude='build.mjs' \
    --exclude='build.sh' \
    --exclude='package.json' \
    --exclude='package-lock.json' \
    --exclude='*.md' \
    --exclude='CLAUDE.md' \
    --exclude='AGENTS.md' \
    --exclude='SPEC.md' \
    --exclude='README.md' \
    "{plugin-root}/" "$INSTALL_DIR/"
```

**What ships**: `plugin.json`, `dist/main.js` (+ sourcemap), `webview/**` (if present), `assets/**` (if present), and any other runtime resources.

**What does NOT ship**: source TypeScript, build configs, tests, docs, `.git`, `node_modules`, dev tooling.

The exclude list is aggressive on purpose — the host installer does not enforce any layout beyond `plugin.json` + `entrypoint`, so stray files like `SPEC.md` or `.mcp.json` get quietly deployed and published. Better to exclude broadly and allowlist specific `*.md` files back in with `--include` if a plugin ships documentation.

## 4. Confirm

Report the deployment path and next steps:

```
Deployed {plugin-name} ({plugin-id}) to:
  ~/Library/Application Support/AppOS/plugins/{plugin-id}/

Files installed:
  - plugin.json
  - dist/main.js
  - webview/ (if applicable)

Next: restart AppOS to load the updated plugin.
If the plugin does not appear in Settings → Plugins, run /appos-dev:validate to check for manifest issues — especially minHostVersion.
```

## 5. Optional: verify files landed

```bash
ls -la "$INSTALL_DIR/"
test -f "$INSTALL_DIR/plugin.json" && echo "✓ manifest" || echo "✗ manifest missing"
test -f "$INSTALL_DIR/dist/main.js" && echo "✓ bundle" || echo "✗ bundle missing"
```

If the plugin has a webview:

```bash
find "$INSTALL_DIR/webview" -name 'index.html' | head -5
```
