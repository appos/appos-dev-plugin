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

## Further reading

- **`plugin-api.d.ts`** in this directory — consolidated type definitions
- **`extension-api.md`** in this directory — namespace-by-namespace overview
- **`~/Documents/GitHub/AppOS/appos-plugin-ytdlp/`** — every pattern above, live in production
- **`~/Documents/GitHub/AppOS/plugin-sdk/packages/`** — the SDK source (plugin-types, plugin-utils, view-builders)
