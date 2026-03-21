---
allowed-tools: [Bash, Read, Grep]
description: Build the current 2Panez plugin with esbuild
---

# Build the current 2Panez plugin

Build the plugin in the current directory (or the nearest parent containing plugin.json).

## 1. Find the plugin root

Look for `plugin.json` in the current directory or parent directories:

```bash
# Find plugin.json starting from cwd
dir="$(pwd)"
while [ "$dir" != "/" ]; do
    if [ -f "$dir/plugin.json" ]; then
        echo "$dir"
        break
    fi
    dir="$(dirname "$dir")"
done
```

If no plugin.json is found, report an error and suggest running `/twopanez-dev:new-plugin` first.

## 2. Read the manifest

Read `plugin.json` to confirm this is a 2Panez plugin (should have `"runtime": "javascript"` and `"entrypoint": "dist/main.js"`).

## 3. Build with esbuild

```bash
cd "{plugin-root}"
mkdir -p dist
npx esbuild src/main.ts --bundle --format=iife --target=es2020 --outfile=dist/main.js
```

**Critical**: The format MUST be `iife`, not `esm`. ESM bundles will not load in JavaScriptCore.

## 4. Validate the bundle

Check that the compiled bundle contains the required entry points:

```bash
grep -q "globalThis" "{plugin-root}/dist/main.js" && echo "OK: globalThis exports found" || echo "ERROR: Missing globalThis.activate/deactivate"
```

## 5. Report results

Show the build output and bundle size. If the build failed, show the error and suggest fixes.
