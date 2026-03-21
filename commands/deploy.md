---
allowed-tools: [Bash, Read]
description: Deploy the current 2Panez plugin to the local plugins directory
---

# Deploy the current 2Panez plugin

Deploy the built plugin to `~/Library/Application Support/com.twopanez/plugins/`.

## 1. Find and read plugin.json

Locate `plugin.json` in the current directory or parent directories. Read it to get the plugin ID.

## 2. Verify the build exists

Check that `dist/main.js` exists. If not, suggest running `/twopanez-dev:build` first.

## 3. Deploy

```bash
PLUGIN_ID="{id-from-plugin.json}"
INSTALL_DIR="$HOME/Library/Application Support/com.twopanez/plugins/$PLUGIN_ID"
mkdir -p "$INSTALL_DIR"
rsync -a --delete \
    --exclude='.DS_Store' \
    --exclude='node_modules' \
    --exclude='.git' \
    "{plugin-root}/" "$INSTALL_DIR/"
```

## 4. Confirm

Report the deployment path and remind the user to restart 2Panez to load the updated plugin.

```
Deployed {plugin-name} to:
  ~/Library/Application Support/com.twopanez/plugins/{plugin-id}/

Restart 2Panez to load the updated plugin.
```
