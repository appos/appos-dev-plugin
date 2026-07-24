# Patterns — from appos-plugin-ytdlp

Working patterns extracted from the flagship `appos-plugin-ytdlp` (https://github.com/appos/appos-plugin-ytdlp). Every snippet here is shipped in a real plugin — when in doubt, open the source file referenced at the top of each section.

## 1. Entry point + disposables

**File**: `src/main.ts`

The canonical activate/deactivate shape. Push every disposer into `disposables[]` as it's created; drain in reverse on deactivate.

```ts
import type { PluginContext } from '@appos.space/plugin-types';
import { registerDownloadPanel } from './panels/download-panel.js';
import { registerLibraryPanel } from './panels/library-panel.js';

const disposables: Array<() => void | Promise<void>> = [];

async function activate(ctx: PluginContext): Promise<void> {
    // ctx.pluginId is runtime-injected; see extension-api.md ambient declaration
    console.log(`[${ctx.pluginId}] activating`);

    await initState(ctx);
    await initPaths(ctx);

    disposables.push(await registerDownloadPanel(ctx));
    disposables.push(await registerLibraryPanel(ctx));
    disposables.push(await registerWorkspace(ctx));
    disposables.push(await registerMenubar(ctx));
    const quitToken = ctx.events.subscribe('app.willQuit', flushState);
    disposables.push(() => ctx.events.unsubscribe(quitToken));

    console.log(`[${ctx.pluginId}] ready`);
}

async function deactivate(): Promise<void> {
    while (disposables.length > 0) {
        const d = disposables.pop();
        try {
            await d?.();
        } catch (err) {
            const name = err instanceof Error ? err.constructor.name : 'unknown';
            console.error(`[plugin] Dispose error (${name})`);
        }
    }
}

(globalThis as unknown as { activate: typeof activate }).activate = activate;
(globalThis as unknown as { deactivate: typeof deactivate }).deactivate = deactivate;
```

**Why globalThis and not ESM export**: the IIFE bundle runs the entire file once; the host reads `globalThis.activate` and `globalThis.deactivate` after evaluation. ESM exports disappear inside the IIFE closure.

## 2. WebView panel registration

**File**: `src/panels/download-panel.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';
import { parseInbound } from '../types/webview-messages.js';

export function registerDownloadPanel(ctx: PluginContext): () => void {
    let disposed = false;

    ctx.ui.registerWebPanel('download', {
        title: 'Downloads',
        icon: 'arrow.down.circle',
        htmlPath: 'webview/download/index.html',
        allowNavigation: false,
    });

    ctx.ui.onWebPanelMessage('download', (envelope) => {
        if (disposed) return;
        const msg = parseInbound(envelope.data);
        if (!msg) return;

        Promise.resolve().then(() => handle(ctx, msg, envelope)).catch((err) => {
            const name = err instanceof Error ? err.constructor.name : 'unknown';
            console.error(`[download] Handler "${msg.type}" failed (${name})`);
        });
    });

    return () => { disposed = true; };
}
```

**Key points**:
- `onWebPanelMessage` has no disposer; use a `disposed` flag inside the handler closure
- Wrap every handler in `Promise.resolve().then(...).catch(...)` so sync throws and async rejections both land in the same error path
- Never log raw `err.message` — it may contain URLs, credentials, or user input. Log the error constructor name only.

## 3. Typed message protocol

**File**: `src/types/webview-messages.ts`

```ts
export type PanelInboundMessage =
    | { v: 1; type: 'probe-url'; probeId: string; url: string }
    | { v: 1; type: 'queue-download'; requestId: string; url: string; format: string }
    | { v: 1; type: 'request-state' };

export type PanelOutboundMessage =
    | { v: 1; type: 'state-update'; queue: QueueEntry[] }
    | { v: 1; type: 'probe-result'; probeId: string; metadata: Metadata }
    | { v: 1; type: 'enqueue-ack'; requestId: string; ok: boolean; error?: string };

export function parseInbound(data: unknown): PanelInboundMessage | null {
    if (typeof data !== 'object' || data === null) return null;
    const m = data as Record<string, unknown>;
    if (m.v !== 1 || typeof m.type !== 'string') return null;
    // Per-type shape validation can go here...
    return data as PanelInboundMessage;
}
```

Always version with `v: 1` and correlate request/response with a unique ID (`probeId`, `requestId`). WebView panels can have multiple instances — responses broadcast via `postToWebPanel` fan out to all of them, so without correlation IDs, responses get cross-applied.

## 4. Throttled broadcast with JSC fallback

**File**: `src/panels/download-panel.ts`

```ts
let throttleTimer: ReturnType<typeof setTimeout> | undefined;
let lastBroadcast = 0;

function broadcastQueue(): void {
    if (typeof setTimeout !== 'function') {
        // JSC may not inject timers — fall back to synchronous
        ctx.ui.postToWebPanel('download', {
            v: 1, type: 'queue-update', entries: [...state.getQueue()],
        });
        return;
    }
    const now = Date.now();
    const remaining = 100 - (now - lastBroadcast);
    clearTimeout(throttleTimer);
    if (remaining <= 0) {
        lastBroadcast = now;
        ctx.ui.postToWebPanel('download', {
            v: 1, type: 'queue-update', entries: [...state.getQueue()],
        });
    } else {
        throttleTimer = setTimeout(() => {
            lastBroadcast = Date.now();
            ctx.ui.postToWebPanel('download', {
                v: 1, type: 'queue-update', entries: [...state.getQueue()],
            });
        }, remaining);
    }
}
```

**Why not use `throttle` from `@appos.space/plugin-utils`**: it calls `setTimeout` unconditionally. JSC may not inject timers, so roll a version that degrades to synchronous broadcasts. The 100ms target gives ~10 Hz updates — the sweet spot for progress UIs.

## 5. pipeShellToWebPanel wrapper

**File**: `src/services/downloader.ts`

```ts
async function runYtDlp(ctx: PluginContext, url: string, outputDir: string): Promise<void> {
    const result = await ctx.ui.pipeShellToWebPanel('download', {
        command: 'yt-dlp',
        args: [
            '--ignore-config',               // block ambient user config from injecting flags
            '--newline',
            '--progress-template', '[progress]%(progress)j',
            '-o', '%(title)s [%(id)s].%(ext)s',
            url,
        ],
        cwd: outputDir,                      // MUST be absolute, tilde-expanded
        timeout: 119,                        // host caps at 120s
    });

    if (result.exitCode !== 0) {
        const errName = 'YtDlpExit';
        console.error(`[downloader] yt-dlp failed (${errName})`);
        // Never log result.stderr raw — may contain URLs
    }
}
```

**Gotchas**:
- `pipeShellToWebPanel` lives on `ctx.ui`, NOT `ctx.shell` (stale docs are wrong)
- 120s hard cap; long jobs need resume loops with `--continue`
- `cwd` must be absolute and tilde-expanded; T1 sandbox rejects relative paths and `~`
- Always pass `--ignore-config` or the tool's equivalent
- Chunks fan out to all panel instances; filter with `envelope.instanceId` if you need per-instance isolation

## 6. Workspace template registration

**File**: `src/workspace/template.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';

export const WORKSPACE_ID = 'ytdlp-workspace';

export async function registerWorkspace(ctx: PluginContext): Promise<() => void> {
    // register() returns Promise<string> (the workspace ID)
    // source is auto-stamped by register() — do not pass it manually
    await ctx.workspaces.register({
        schemaVersion: 1,
        id: WORKSPACE_ID,
        name: 'Downloads',
        icon: 'arrow.down.circle',
        leftPane: {
            tabs: [
                { type: 'pluginPanel', panelId: 'download' },
                { type: 'terminal' },
            ],
            activeTab: 0,
        },
        rightPane: {
            tabs: [
                { type: 'pluginPanel', panelId: 'library' },
                { type: 'fileBrowser' },
                { type: 'webBrowser' },
            ],
            activeTab: 0,
        },
    });

    // Note: workspace registration only. Apply is done unconditionally at the
    // end of activate(), NOT here, NOT gated on a first-run cache flag.
    // No explicit unregister needed — ephemeral templates clean on deactivation.
    return () => {};
}
```

Then, at the end of `activate()`:

```ts
// Step N (last): apply workspace so the user sees the UI immediately.
// activate() runs once per host launch, so this is effectively once-per-launch.
// The user can still switch workspaces manually after activation and we won't
// override them again until next launch.
//
// IMPORTANT: apply() returns false (not an error) when no browser window is
// focused — e.g. when the plugin first activates from the Settings sheet.
// Always fall back to showPaneTab() so the user sees something.
try {
    const applied = await ctx.workspaces.apply(WORKSPACE_ID);
    if (!applied) {
        // No browser window was frontmost (Settings was focused, etc.)
        try { ctx.ui.showPaneTab('download', { title: 'Downloads', pane: 'left' }); } catch { /* ok */ }
    }
} catch (err) {
    console.warn('[my-plugin] workspaces.apply on activation failed:', err);
}
```

> **DO NOT use an `applyIfFirstRun(ctx)` / `cache.get('initialized')` gate.**
>
> Gating workspace apply behind a cache flag is the #1 cause of "plugin installed but no UI is visible". On first launch it works; on every subsequent launch the user is left in whatever workspace they were in before, with no reliable way to discover the plugin's panels. Apply unconditionally in `activate()` and move on.

**Panel-open commands**: `ctx.ui.showPaneTab(panelId, options?)` focuses an existing tab if present, or creates a new tab if none exists. Use `workspaces.apply()` before `showPaneTab` when the command depends on the full dual-pane layout:

```ts
ctx.commands.register('open-download-panel', {
    title: 'Open yt-dlp Downloader',
    handler: async () => {
        try { await ctx.workspaces.apply(WORKSPACE_ID); } catch (err) { console.warn(err); }
        try { ctx.ui.showPaneTab('download', { title: 'Downloads', pane: 'left' }); } catch { /* workspace apply already surfaced it */ }
    },
});
```

**Note**: `ctx.cache.get` returns the **deserialized** value (no JSON.parse). Pass `persist: true` for durability across restarts.

## 7. Menubar registration with popover content

**File**: `src/menubar/menubar.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';
import { vstack, section, listItem, button } from '@appos.space/view-builders';

export async function registerMenubar(ctx: PluginContext): Promise<() => void> {
    await ctx.menubar.register({ icon: 'arrow.down.circle' });

    // REQUIRED: populate the popover — without this, clicking shows "No content"
    function buildPopoverContent() {
        const count = state.getQueue().length;
        return vstack([
            section('Downloads', { icon: 'arrow.down.circle', badge: String(count) }, [
                listItem('Active downloads', { icon: 'arrow.down', subtitle: `${count} in progress` }),
            ]),
            button('Open Dashboard', { action: 'open-dashboard' }),
        ]);
    }
    await ctx.menubar.setContent(buildPopoverContent());

    let unsubscribed = false;
    // ctx.events.subscribe returns a string token, not a disposer
    const clickToken = ctx.events.subscribe('menubar.clicked', async () => {
        if (unsubscribed) return;
        try { await ctx.workspaces.apply(WORKSPACE_ID); } catch { /* may not exist yet */ }
        try { ctx.ui.showPaneTab('download', { title: 'Downloads', pane: 'left' }); } catch { /* workspace apply already surfaced it */ }
    });

    // Update badge AND popover content as queue changes
    const unsubscribeQueue = state.subscribe(() => {
        const count = state.getQueue().length;
        ctx.menubar.setBadge(count > 0 ? count : 0);
        ctx.menubar.setContent(buildPopoverContent()).catch(() => {});
    });

    return () => {
        unsubscribed = true;
        ctx.events.unsubscribe(clickToken);
        unsubscribeQueue();
        ctx.menubar.remove().catch(() => { /* ignore */ });
    };
}
```

**Popover content is mandatory**: the host shows a popover when the menubar icon is clicked. Without `setContent()`, it says "No content". Always call `setContent()` after `register()` and update it reactively alongside `setBadge()`.

**Transactional init**: if any step fails after `register` succeeds, call `remove()` in the catch so the menu bar doesn't leak a dangling item on activation failure.

## 8. Smart folder filter with closure capture

**File**: `src/smart-folders/filters.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';

export async function registerFilters(ctx: PluginContext, state: State): Promise<() => void> {
    let favoritesByUrl: Map<string, boolean> = new Map();

    const rebuild = () => {
        favoritesByUrl = new Map(state.favorites.map((f) => [f.url, true]));
    };
    rebuild();

    const unsubState = state.subscribe(rebuild);

    let disposed = false;
    // registerFilterType returns Promise<string> (the namespaced filter type ID)
    // There is no unregister API — filters auto-clean on plugin deactivation
    await ctx.smartFolders.registerFilterType({
        id: 'ytdlp-favorites',
        displayName: 'Favorites',
        evaluate: (item: { url: string; metadata: Record<string, unknown> }) => {
            if (disposed) return false;
            return favoritesByUrl.has(item.url);
        },
    });

    return () => {
        disposed = true;
        unsubState();
        // No unregisterFilterType — the disposed flag guards late calls
    };
}
```

**Why synchronous `evaluate`**: smart folder filters are called once per file during directory traversal. They must be cheap and cannot await. Build a lookup structure (Map, Set) on state change and capture it in the closure. The callback receives `{ url: string, metadata: Record<string, unknown> }` — NOT a `PluginFileDescriptor`.

## 9. Dependency status handling

**File**: `src/main.ts`

```ts
// onDependencyStatusChanged returns a string token (not a disposer function)
const depToken = ctx.lifecycle.onDependencyStatusChanged((statuses) => {
    const ytDlp = statuses.find((s) => s.name === 'yt-dlp');
    const ffmpeg = statuses.find((s) => s.name === 'ffmpeg');

    ctx.ui.postToWebPanel('download', {
        v: 1, type: 'dependency-status',
        ytDlp: ytDlp?.satisfied ?? false,
        ffmpeg: ffmpeg?.satisfied ?? false,
        ytDlpVersion: ytDlp?.installedVersion,
        installHint: ytDlp?.installHint,
    });
});
// Note: no matching unsubscribe API exists for lifecycle tokens yet;
// the subscription auto-cleans on plugin deactivation.
```

`ctx.lifecycle.getDependencyStatus()` and `ctx.lifecycle.recheckDependencies()` are host-wired and safe to call — `appos-plugin-ytdlp` uses both in production (`src/main.ts` does the initial `getDependencyStatus()` read after subscribing; the panels call `recheckDependencies()` from their "Re-check" buttons). Subscribe FIRST, then read, so no update can slip between the read and the subscription.

If a required dependency is missing, show a "degraded banner" in the webview with the install hint. Don't refuse to load the plugin — the host already handles hard failures.

## 10. Settings read with fallback

```ts
async function getOutputDir(ctx: PluginContext): Promise<string> {
    const raw = ctx.settings.get('outputDir');
    if (typeof raw === 'string' && raw.length > 0) return raw;
    // Fall back to active pane directory
    const activeDir = await ctx.fileOps.getActiveDirectory();
    if (activeDir) return urlToPath(activeDir);
    throw new Error('outputDir setting is required when no active directory');
}
```

`ctx.settings.get(key)` returns `unknown` — always check the type before using the value. Prefer explicit defaults in code over relying on the manifest `default` field (which also works, but is a weaker guarantee).

## 11. Handler action routing (ViewDescriptor)

For ViewDescriptor-based panels (not used in ytdlp, but valid for simpler plugins), use short semantic action prefixes:

```ts
handler: (action: string) => {
    if (action === 'refresh') refresh();
    if (action === 'add-selected') addSelected();
    if (action.startsWith('select:')) activate(action.substring(7));
    if (action.startsWith('open:')) openFile(action.substring(5));
    if (action.startsWith('reveal:')) revealInFinder(action.substring(7));
    if (action.startsWith('remove:')) removeItem(action.substring(7));
}
```

**Don't repeat the noun**: `"remove:"` is better than `"remove-collection:"`. The handler already knows its context.

## 12. menuActions on listItem

```ts
const menu: MenuAction[] = [
    { title: 'Open', icon: 'doc', action: `open:${item.url}` },
    { title: 'Reveal in Finder', icon: 'folder', action: `reveal:${item.url}` },
    { title: '---' },                         // divider
    { title: 'Remove', icon: 'trash', action: `remove:${item.url}`, destructive: true },
];

const listItem: ListItemDescriptor = {
    type: 'listItem',
    properties: {
        title: item.name,
        subtitle: item.subtitle,
        icon: 'doc.fill',
        action: `select:${item.url}`,
        menuActions: JSON.stringify(menu),    // MUST be a JSON STRING
    },
};
```

**Key rules**:
- `menuActions` is a **JSON string**, always `JSON.stringify()` the array
- Dividers are plain objects with `title: '---'`
- Destructive actions get `destructive: true` and are placed last
- Always ship `menuActions` on every listable item — this is the single most important UX pattern for plugin authors

## 13. Build script (canonical)

**File**: `build.mjs`

```js
import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: 'dist/main.js',
    sourcemap: true,
    logLevel: 'info',
};

if (isWatch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await build(buildOptions);
}
```

**Invoked as**: `npm run build` or `node build.mjs`. The esbuild API wins over `npx esbuild ...` because watch mode is cleaner and the script survives across platforms.

## 14. tsconfig (mandatory flags)

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "noEmit": true,
        "verbatimModuleSyntax": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "lib": ["ES2020", "DOM"]
    },
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

**`verbatimModuleSyntax: true` is mandatory** for any plugin importing from `@appos.space/plugin-types`. Without it, TypeScript emits runtime `require` / `import` calls that look up a non-existent module in the bundler. The plugin silently fails to activate.

## 15. Deploy (rsync with --delete-excluded)

```bash
rsync -av --delete --delete-excluded \
    --exclude='.DS_Store' \
    --exclude='.git/' \
    --exclude='.github/' \
    --exclude='node_modules/' \
    --exclude='src/' \
    --exclude='scripts/' \
    --exclude='*.test.ts' \
    --exclude='tsconfig.json' \
    --exclude='build.mjs' \
    --exclude='package.json' \
    --exclude='package-lock.json' \
    --exclude='*.md' \
    --exclude='SPEC.md' \
    --exclude='.mcp.json' \
    --exclude='.flow/' \
    --exclude='.claude/' \
    "$PLUGIN_ROOT/" "$INSTALL_DIR/"
```

**Critical**: `--delete-excluded` removes files added to the exclude list after a previous deploy. Without it, a file you excluded today but copied yesterday stays on the destination forever. The first time you add `.mcp.json` to the exclude list, you need `--delete-excluded` for it to actually disappear from the install directory.

## 16. minHostVersion landmine

```json
{
    "id": "space.appos.ytdlp",
    "version": "1.0.0",
    "minHostVersion": "1.0.0"
}
```

**ALWAYS** default `minHostVersion` to `"1.0.0"`. The host compares this against its `CFBundleShortVersionString` (currently `1.0.0`), NOT the SDK package version (`2.4.x`). Setting `minHostVersion` to `"2.4.0"` because you saw that number in `@appos.space/plugin-types/package.json` will cause `DependencyResolver.swift` to silently reject the plugin before it reaches the Settings → Plugins sheet. No error dialog, no log entry you'll think to check.

To verify the actual host version:

```bash
defaults read /Applications/AppOS.app/Contents/Info.plist CFBundleShortVersionString
```

## 17. WebView panel with plugin-to-webview messaging

**Full plugin structure** showing `plugin.json` + `src/main.ts` + `webview/main/` with external JS/CSS (CSP-compliant).

### plugin.json

```json
{
    "id": "space.appos.mytools",
    "name": "My Tools",
    "version": "1.0.0",
    "runtime": "javascript",
    "entrypoint": "dist/main.js",
    "minHostVersion": "1.0.0",
    "activation": { "events": ["onStartup"] },
    "permissions": ["ui.webPanel", "shell.execute", "filesystem.read", "cache", "feedback"],
    "shellCommands": ["mytool"]
}
```

### src/main.ts

```ts
import type { PluginContext } from '@appos.space/plugin-types';
import { urlToPath } from '@appos.space/plugin-utils';

const disposables: Array<() => void | Promise<void>> = [];

async function activate(ctx: PluginContext): Promise<void> {
    // Register with SHORT id — runtime auto-prefixes to {pluginId}.main-panel
    ctx.ui.registerWebPanel('main-panel', {
        title: 'My Tools',
        icon: 'wrench',
        htmlPath: 'webview/main/index.html',
        allowNavigation: false,
    });

    ctx.ui.onWebPanelMessage('main-panel', (envelope) => {
        if (typeof envelope.data !== 'object' || envelope.data === null) return;
        const raw = envelope.data as Record<string, unknown>;
        if (raw.v !== 1 || typeof raw.type !== 'string') return;

        if (raw.type === 'run-command') {
            if (typeof raw.command !== 'string') return;
            const args = Array.isArray(raw.args) ? raw.args.filter((a): a is string => typeof a === 'string') : [];
            Promise.resolve().then(() => runCommand(ctx, raw.command as string, args)).catch((err) => {
                const name = err instanceof Error ? err.constructor.name : 'unknown';
                console.error(`[mytools] runCommand failed (${name})`);
            });
        }
    });

    ctx.ui.onWebPanelRequest('main-panel', async (envelope) => {
        if (typeof envelope.data !== 'object' || envelope.data === null) {
            return { v: 1, type: 'error', message: 'invalid payload' };
        }
        const raw = envelope.data as Record<string, unknown>;
        if (raw.v !== 1 || typeof raw.type !== 'string') {
            return { v: 1, type: 'error', message: 'unsupported protocol version' };
        }
        if (raw.type === 'get-status') {
            return { v: 1, type: 'status', ready: true };
        }
        return { v: 1, type: 'error', message: 'unknown request' };
    });
}

async function runCommand(ctx: PluginContext, command: string, args: string[]): Promise<void> {
    // T1 plugins must use cwd within active pane roots
    const activeDir = await ctx.fileOps.getActiveDirectory();
    const cwd = activeDir ? urlToPath(activeDir) : undefined;
    if (!cwd) return;  // no active directory — cannot run

    ctx.ui.postToWebPanel('main-panel', { v: 1, type: 'started' });

    const result = await ctx.shell.execute({
        command,
        args,
        cwd,
        onData: (chunk) => {
            ctx.ui.postToWebPanel('main-panel', {
                v: 1, type: 'output',
                stream: chunk.stream,
                data: chunk.data,
            });
        },
    });

    ctx.ui.postToWebPanel('main-panel', {
        v: 1, type: 'finished',
        exitCode: result.exitCode,
    });
}

async function deactivate(): Promise<void> {
    while (disposables.length) {
        const d = disposables.pop();
        try { await d?.(); } catch (err) { console.error('[plugin] Dispose error:', err); }
    }
}

;(globalThis as any).activate = activate;
;(globalThis as any).deactivate = deactivate;
```

### webview/main/index.html

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="output"></div>
    <button id="run">Run</button>
    <script type="module" src="app.js"></script>
</body>
</html>
```

### webview/main/styles.css

```css
body {
    margin: 0;
    padding: 16px;
    background-color: var(--twopanez-bg);
    color: var(--twopanez-text);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

#output {
    background: var(--twopanez-bg-surface);
    border-radius: 8px;
    padding: 12px;
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    min-height: 200px;
    overflow-y: auto;
}

button {
    background: var(--twopanez-accent);
    color: var(--twopanez-bg);
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    margin-top: 12px;
    cursor: pointer;
}
```

### webview/main/app.js

```js
const output = document.getElementById('output');
const runBtn = document.getElementById('run');

// Receive protocol messages from plugin via postToWebPanel
window.twopanez.onMessage((msg) => {
    if (typeof msg !== 'object' || msg === null || msg.v !== 1) return;
    if (msg.type === 'started') output.textContent = '';
    if (msg.type === 'output') output.textContent += msg.data;
    if (msg.type === 'finished') {
        output.textContent += `\n[exit ${msg.exitCode}]`;
    }
});

runBtn.addEventListener('click', () => {
    // Fire-and-forget message to plugin
    window.twopanez.send({ v: 1, type: 'run-command', command: 'mytool', args: ['--version'] });
});

// Request/response example
async function checkStatus() {
    const result = await window.twopanez.request({ v: 1, type: 'get-status' });
    console.log('Plugin status:', result);
}
checkStatus();
```

**Key points:**
- Register the SHORT id `main-panel` — runtime auto-prefixes to `{pluginId}.main-panel`
- All JS and CSS are external files (CSP blocks inline `<script>` and `<style>`)
- Use `window.twopanez.send()` / `.request()` for webview-to-plugin communication
- Use `window.twopanez.onMessage()` to receive pushes from plugin via `postToWebPanel`
- If also using `pipeShellToWebPanel`, shell chunks (`{ stream, data, bytesTotal }`) arrive via `onMessage` alongside protocol messages — filter by presence of `msg.stream`

## 18. Streaming shell to WebView pipe (pipeShellToWebPanel)

For real-time CLI output in a WebView, use `ctx.ui.pipeShellToWebPanel()` instead of manual `onData` + `postToWebPanel`. The host streams chunks directly to the WebView, bypassing the plugin's JS thread.

### src/main.ts

```ts
async function runWithPipe(ctx: PluginContext, url: string, outputDir: string): Promise<void> {
    // Chunks go directly to the WebView — no onData needed
    const result = await ctx.ui.pipeShellToWebPanel('output', {
        command: 'yt-dlp',
        args: ['--ignore-config', '--newline', '--progress', url],
        cwd: outputDir,      // MUST be absolute, tilde-expanded (T1 sandbox)
        timeout: 119,        // host hard-caps at 120s; leave headroom
    });

    // Send final status via postToWebPanel (chunks only carry raw output)
    ctx.ui.postToWebPanel('output', {
        v: 1,
        type: 'finished',
        exitCode: result.exitCode,
    });
}
```

### webview/output/app.js

```js
const terminal = document.getElementById('terminal');

window.twopanez.onMessage((msg) => {
    // Shell chunks: { stream: "stdout"|"stderr", data: string, bytesTotal: number }
    if (msg.stream) {
        const span = document.createElement('span');
        span.className = msg.stream === 'stderr' ? 'stderr' : 'stdout';
        span.textContent = msg.data;
        terminal.appendChild(span);
        terminal.scrollTop = terminal.scrollHeight;
        return;
    }
    // Protocol messages from postToWebPanel
    if (msg.v === 1 && msg.type === 'finished') {
        terminal.textContent += `\n[Process exited with code ${msg.exitCode}]`;
    }
});
```

**Critical gotchas:**
- Method is `ctx.ui.pipeShellToWebPanel`, NOT `ctx.shell.pipeShellToWebPanel`
- 120s hard cap — long-running jobs need a resume loop with `--continue`-style flags
- `cwd` must be an absolute expanded path (no `~`) — T1 sandbox rejects relative paths
- Always pass `--ignore-config` or equivalent to neutralize ambient user config
- Chunks fan out to ALL instances of the panel; use `window.twopanez.instanceId` for per-instance filtering if needed

## 19. Dependency-aware manifest

Declare system dependencies so the host auto-checks them at activation and reports status to your UI.

### plugin.json

```json
{
    "id": "space.appos.imagetools",
    "name": "Image Tools",
    "version": "1.0.0",
    "runtime": "javascript",
    "entrypoint": "dist/main.js",
    "minHostVersion": "1.0.0",
    "activation": { "events": ["onStartup"] },
    "permissions": ["ui.webPanel", "shell.execute", "cache", "feedback"],
    "shellCommands": ["convert", "ffmpeg"],
    "shellDeniedPatterns": ["\\bsudo\\b"],
    "dependencies": {
        "system": [
            {
                "name": "ImageMagick",
                "required": true,
                "check": {
                    "command": "convert",
                    "args": ["--version"],
                    "versionPattern": "ImageMagick (\\d+\\.\\d+\\.\\d+)"
                },
                "minVersion": "7.0.0",
                "installHint": "brew install imagemagick",
                "installUrl": "https://imagemagick.org/script/download.php",
                "description": "Image conversion and manipulation"
            },
            {
                "name": "ffmpeg",
                "required": false,
                "check": {
                    "command": "ffmpeg",
                    "args": ["-version"],
                    "versionPattern": "ffmpeg version (\\d+\\.\\d+)"
                },
                "installHint": "brew install ffmpeg",
                "description": "Video/audio processing (optional, enables GIF export)"
            }
        ],
        "plugins": [
            {
                "id": "com.community.shared-utils",
                "minVersion": "1.0.0",
                "required": false
            }
        ]
    }
}
```

### src/main.ts (dependency status handling)

```ts
import type { PluginContext, DependencyStatus } from '@appos.space/plugin-types';

async function activate(ctx: PluginContext): Promise<void> {
    // Subscribe early so you never miss the initial status push at activation.
    // onDependencyStatusChanged returns a string token (NOT a disposer function).
    // No unsubscribe API exists yet — the host auto-cleans on plugin deactivation.
    const depToken = ctx.lifecycle.onDependencyStatusChanged((statuses) => {
        updateDependencyBanner(ctx, statuses);
    });

    // Initial on-demand read AFTER subscribing (subscribe-first ordering).
    // recheckDependencies() forces a re-probe — wire it to a "Re-check" button
    // so users can recover after installing a missing CLI.
    const initial = await ctx.lifecycle.getDependencyStatus();
    updateDependencyBanner(ctx, initial);
}

function updateDependencyBanner(ctx: PluginContext, statuses: DependencyStatus[]): void {
    const missing = statuses.filter((s) => s.required && !s.satisfied);
    if (missing.length > 0) {
        ctx.ui.postToWebPanel('main-panel', {
            v: 1,
            type: 'dependency-status',
            missing: missing.map((s) => ({
                name: s.name,
                installHint: s.installHint,
                installUrl: s.installUrl,
            })),
        });
    }
}
```

**Key points:**
- `check.command` MUST be in `shellCommands` allowlist — otherwise the status is `"command_not_allowed"`
- `versionPattern` uses one capture group to extract the version string from stdout
- `shellDeniedPatterns` are custom regexes merged with built-in defaults (never replacing them)
- Subscribe to `onDependencyStatusChanged` BEFORE the initial `getDependencyStatus()` read — canonical ordering from `appos-plugin-ytdlp`
- `recheckDependencies()` re-probes on demand (both APIs are host-wired; ytdlp calls them in production)

## Further reading

- **`plugin-api.d.ts`** in this directory — consolidated type definitions
- **`extension-api.md`** in this directory — namespace-by-namespace overview
- **https://github.com/appos/appos-plugin-ytdlp** — every pattern above, live in production
- **https://github.com/appos/plugin-sdk** (`packages/`) — the SDK source (plugin-types, plugin-utils, view-builders)
- **https://docs.appos.space** — the canonical AppOS plugin developer docs
