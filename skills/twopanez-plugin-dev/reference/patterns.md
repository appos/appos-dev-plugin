# Patterns — from appos-plugin-ytdlp

Working patterns extracted from the flagship `~/Documents/GitHub/AppOS/appos-plugin-ytdlp/`. Every snippet here is shipped in a real plugin — when in doubt, open the source file referenced at the top of each section.

## 1. Entry point + disposables

**File**: `src/main.ts`

The canonical activate/deactivate shape. Push every disposer into `disposables[]` as it's created; drain in reverse on deactivate.

```ts
import type { PluginContext } from '@appos.space/plugin-types';
import { registerDownloadPanel } from './panels/download-panel.js';
import { registerLibraryPanel } from './panels/library-panel.js';

const disposables: Array<() => void | Promise<void>> = [];

async function activate(ctx: PluginContext): Promise<void> {
    console.log(`[${ctx.pluginId}] activating`);

    await initState(ctx);
    await initPaths(ctx);

    disposables.push(await registerDownloadPanel(ctx));
    disposables.push(await registerLibraryPanel(ctx));
    disposables.push(await registerWorkspace(ctx));
    disposables.push(await registerMenubar(ctx));
    disposables.push(ctx.events.subscribe('app.willQuit', flushState));

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

export function registerWorkspace(ctx: PluginContext): () => void {
    const disposer = ctx.workspaces.register({
        id: WORKSPACE_ID,
        name: 'Downloads',
        icon: 'arrow.down.circle',
        source: { type: 'plugin', pluginId: ctx.pluginId },
        layout: {
            left: {
                panels: [
                    { type: 'pluginPanel', pluginId: ctx.pluginId, panelId: 'download' },
                    { type: 'terminal' },
                ],
            },
            right: {
                panels: [
                    { type: 'pluginPanel', pluginId: ctx.pluginId, panelId: 'library' },
                    { type: 'fileBrowser' },
                    { type: 'webBrowser' },
                ],
            },
        },
    });

    // Note: workspace registration only. Apply is done unconditionally at the
    // end of activate(), NOT here, NOT gated on a first-run cache flag.
    return disposer;
}
```

Then, at the end of `activate()`:

```ts
// Step N (last): apply workspace so the user sees the UI immediately.
// activate() runs once per 2Panez launch, so this is effectively once-per-launch.
// The user can still switch workspaces manually after activation and we won't
// override them again until next launch.
try {
    await ctx.workspaces.apply(WORKSPACE_ID);
} catch (err) {
    console.warn('[my-plugin] workspaces.apply on activation failed:', err);
}
```

> **DO NOT use an `applyIfFirstRun(ctx)` / `cache.get('initialized')` gate.**
>
> Gating workspace apply behind a cache flag is the #1 cause of "plugin installed but no UI is visible". On first launch it works; on every subsequent launch the user is left in whatever workspace they were in before, with no reliable way to discover the plugin's panels. The workspace dropdown is easy to miss, the command palette requires knowing exact names, and `ctx.ui.showPaneTab` only focuses existing tabs so panel-open commands silently fail in other workspaces. Apply unconditionally in `activate()` and move on.

**Panel-open commands must apply the workspace first** — `ctx.ui.showPaneTab(panelId, ...)` only focuses an existing tab; it will NOT create a panel in a workspace that doesn't have one:

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

## 7. Menubar registration with transactional rollback

**File**: `src/menubar/menubar.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';

export async function registerMenubar(ctx: PluginContext): Promise<() => void> {
    await ctx.menubar.register({ icon: 'arrow.down.circle' });

    let unsubscribed = false;
    const unsubscribe = ctx.events.subscribe('menubar.clicked', async () => {
        if (unsubscribed) return;
        await ctx.ui.focusPanel('download').catch(() => { /* panel may not exist yet */ });
    });

    // Update badge as queue size changes
    const unsubscribeQueue = state.subscribe(() => {
        const count = state.getQueue().length;
        ctx.menubar.setBadge(count > 0 ? String(count) : '');
    });

    return () => {
        unsubscribed = true;
        unsubscribe();
        unsubscribeQueue();
        ctx.menubar.remove().catch(() => { /* ignore */ });
    };
}
```

**Transactional init**: if any step fails after `register` succeeds, call `remove()` in the catch so the menu bar doesn't leak a dangling item on activation failure.

## 8. Smart folder filter with closure capture

**File**: `src/smart-folders/filters.ts`

```ts
import type { PluginContext, PluginFileDescriptor } from '@appos.space/plugin-types';

export function registerFilters(ctx: PluginContext, state: State): () => void {
    let favoritesByUrl: Map<string, boolean> = new Map();

    const rebuild = () => {
        favoritesByUrl = new Map(state.favorites.map((f) => [f.url, true]));
    };
    rebuild();

    const unsubState = state.subscribe(rebuild);

    let disposed = false;
    const disposeFilter = ctx.smartFolders.registerFilterType({
        id: 'ytdlp-favorites',
        name: 'Favorites',
        icon: 'star.fill',
        evaluate: (file: PluginFileDescriptor) => {
            if (disposed) return false;
            return favoritesByUrl.has(file.url);
        },
    });

    return () => {
        disposed = true;
        unsubState();
        disposeFilter();
    };
}
```

**Why synchronous `evaluate`**: smart folder filters are called once per file during directory traversal. They must be cheap and cannot await. Build a lookup structure (Map, Set) on state change and capture it in the closure.

## 9. Dependency status handling

**File**: `src/main.ts`

```ts
disposables.push(ctx.lifecycle.onDependencyStatusChanged((statuses) => {
    const ytDlp = statuses.find((s) => s.name === 'yt-dlp');
    const ffmpeg = statuses.find((s) => s.name === 'ffmpeg');

    ctx.ui.postToWebPanel('download', {
        v: 1, type: 'dependency-status',
        ytDlp: ytDlp?.satisfied ?? false,
        ffmpeg: ffmpeg?.satisfied ?? false,
        ytDlpVersion: ytDlp?.installedVersion,
        installHint: ytDlp?.installHint,
    });
}));

// Initial snapshot at activation
const statuses = await ctx.lifecycle.getDependencyStatus();
// ...update UI accordingly
```

If a required dependency is missing, show a "degraded banner" in the webview with the install hint. Don't refuse to load the plugin — the host already handles hard failures.

## 10. Settings read with fallback

```ts
function getOutputDir(ctx: PluginContext): string {
    const raw = ctx.settings.get<string>('outputDir');
    if (typeof raw === 'string' && raw.length > 0) return raw;
    return `${ctx.pluginId}-default`;
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

**ALWAYS** default `minHostVersion` to `"1.0.0"`. The host compares this against its `CFBundleShortVersionString` (currently `1.7.0`), NOT the SDK package version (`2.4.x`). Setting `minHostVersion` to `"2.4.0"` because you saw that number in `@appos.space/plugin-types/package.json` will cause `DependencyResolver.swift` to silently reject the plugin before it reaches the Settings → Plugins sheet. No error dialog, no log entry you'll think to check.

To verify the actual host version:

```bash
defaults read /Applications/2Panez.app/Contents/Info.plist CFBundleShortVersionString
```

## 17. WebView panel with message bridge

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
    "permissions": ["ui.webPanel", "shell.execute", "cache", "feedback", "webview"],
    "shellCommands": ["mytool"]
}
```

### src/main.ts

```ts
import type { PluginContext } from '@appos.space/plugin-types';

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
        const msg = envelope.data;
        if (typeof msg !== 'object' || msg === null || msg.v !== 1) return;

        if (msg.type === 'run-command') {
            runCommand(ctx, msg.command, msg.args);
        }
    });

    ctx.ui.onWebPanelRequest('main-panel', async (envelope) => {
        const msg = envelope.data;
        if (msg?.type === 'get-status') {
            return { v: 1, type: 'status', ready: true };
        }
        return { v: 1, type: 'error', message: 'unknown request' };
    });
}

async function runCommand(ctx: PluginContext, command: string, args: string[]): Promise<void> {
    ctx.ui.postToWebPanel('main-panel', { v: 1, type: 'started' });

    const result = await ctx.shell.execute({
        command,
        args,
        cwd: '/tmp',
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

// Receive messages from plugin (postToWebPanel + pipeShellToWebPanel chunks)
window.twopanez.onMessage((msg) => {
    if (msg.stream) {
        // Shell chunk from pipeShellToWebPanel — has {stream, data, bytesTotal}
        output.textContent += msg.data;
        return;
    }
    // Protocol message from postToWebPanel — has {v, type, ...}
    if (msg.v === 1) {
        if (msg.type === 'started') output.textContent = '';
        if (msg.type === 'output') output.textContent += msg.data;
        if (msg.type === 'finished') {
            output.textContent += `\n[exit ${msg.exitCode}]`;
        }
    }
});

runBtn.addEventListener('click', () => {
    // Fire-and-forget message to plugin
    window.twopanez.send({ v: 1, type: 'run-command', command: 'mytool', args: ['--version'] });
});

// Request/response example
async function checkStatus() {
    const result = await window.twopanez.request({ type: 'get-status' });
    console.log('Plugin status:', result);
}
checkStatus();
```

**Key points:**
- Register the SHORT id `main-panel` — runtime auto-prefixes to `{pluginId}.main-panel`
- All JS and CSS are external files (CSP blocks inline `<script>` and `<style>`)
- Use `window.twopanez.send()` / `.request()` for webview-to-plugin communication
- Use `window.twopanez.onMessage()` to receive pushes from plugin + shell chunks
- Shell chunks (`{ stream, data, bytesTotal }`) lack `v`/`type` — filter them in the bridge

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
    "permissions": ["ui.webPanel", "shell.execute", "cache", "feedback", "webview"],
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
    // Subscribe BEFORE first status check so you never miss an in-flight update
    disposables.push(ctx.lifecycle.onDependencyStatusChanged((statuses) => {
        updateDependencyBanner(ctx, statuses);
    }));

    // Note: getDependencyStatus() and recheckDependencies() are defined in
    // plugin-api.d.ts but runtime support is deferred — do NOT call them yet.
    // The host pushes initial status via onDependencyStatusChanged at activation.
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
- Subscribe to `onDependencyStatusChanged` BEFORE reading status — canonical ordering from `appos-plugin-ytdlp`
- `getDependencyStatus()` and `recheckDependencies()` are types only, runtime deferred — do NOT call these APIs yet

## Further reading

- **`plugin-api.d.ts`** in this directory — consolidated type definitions
- **`extension-api.md`** in this directory — namespace-by-namespace overview
- **`~/Documents/GitHub/AppOS/appos-plugin-ytdlp/`** — every pattern above, live in production
- **`~/Documents/GitHub/AppOS/plugin-sdk/packages/`** — the SDK source (plugin-types, plugin-utils, view-builders)
