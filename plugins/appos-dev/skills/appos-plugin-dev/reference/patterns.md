# Patterns — canonical AppOS plugin shapes

Working patterns extracted from the flagship `appos-plugin-ytdlp`
(https://github.com/appos/appos-plugin-ytdlp — public; prefer a local
clone, or raw files from
`https://raw.githubusercontent.com/appos/appos-plugin-ytdlp/main/<path>`),
updated to the SDK 3.0.0 surface. Where ytdlp's shipped source still
predates 3.0.0 (it pins the 2.4 line — its own migration is tracked), the
snippet here shows the 3.0.0-correct form; the *structure* still mirrors
the shipped plugin. Snippets stub external helpers with `declare` lines so
each block stands alone — replace the stubs with your real modules.
Fallback docs: https://docs.appos.space.

## 1. Entry point + disposables

**File**: `src/main.ts`

The canonical activate/deactivate shape. Push every disposer into
`disposables[]` as it's created; drain in reverse on deactivate.

```ts
import type { PluginContext } from '@appos.space/plugin-types';

// These live in sibling modules (src/state.ts, src/panels/*.ts, ...):
declare function initState(ctx: PluginContext): Promise<void>;
declare function initPaths(ctx: PluginContext): Promise<void>;
declare function registerDownloadPanel(ctx: PluginContext): Promise<() => void>;
declare function registerLibraryPanel(ctx: PluginContext): Promise<() => void>;
declare function registerWorkspace(ctx: PluginContext): Promise<() => void>;
declare function registerMenubar(ctx: PluginContext): Promise<() => void>;
declare function flushState(): void;

const disposables: Array<() => void | Promise<void>> = [];

async function activate(ctx: PluginContext): Promise<void> {
    console.log(`[${ctx.pluginId}] activating`);   // metadata scalars are typed in 3.0.0

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

**Why globalThis and not ESM export**: the IIFE bundle runs the entire file
once; the host reads `globalThis.activate` and `globalThis.deactivate`
after evaluation. ESM exports disappear inside the IIFE closure.

## 2. Public action with execution context (fn-89)

**File**: `src/actions/register-actions.ts`

The 3.0.0 action contract: the handler receives ONE argument — an
`ActionExecutionContext` — and reads the validated payload via
`exec.input`. Declare the input shape as a **`type` alias** (an
`interface` fails the `exec.input as X` assertion with TS2352).

```ts
import type { ActionExecutionContext, PluginContext } from '@appos.space/plugin-types';

type DownloadUrlInput = { url: string; format?: string };

declare function enqueueDownload(url: string, format?: string): Promise<string[]>;

export async function registerActions(ctx: PluginContext): Promise<() => Promise<void>> {
    const token = await ctx.actions.register(
        {
            id: 'downloadUrl',
            title: 'Download Media URL',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    format: { type: 'string', enum: ['best', 'mp4', 'mp3'] },
                },
                required: ['url'],
                additionalProperties: false,
            },
            outputSchema: {
                type: 'object',
                properties: {
                    enqueuedIds: { type: 'array', items: { type: 'string' } },
                },
                required: ['enqueuedIds'],
            },
            visibility: ['api', 'agent', 'automation'],
            approval: 'auto',
        },
        async (exec: ActionExecutionContext) => {
            const input = exec.input as DownloadUrlInput;
            const url = input.url.trim();
            if (!/^https?:\/\//.test(url)) {
                throw new Error('Invalid media URL');
            }
            const enqueuedIds = await enqueueDownload(url, input.format);
            if (enqueuedIds.length === 0) {
                // Fail the receipt with an actionable message.
                throw new Error('URL was not enqueued — check plugin settings.');
            }
            return { enqueuedIds };
        },
    );
    return async () => { await ctx.actions.unregister(token); };
}
```

**Key points**:
- `exec.input` is the schema-validated payload — the handler NEVER receives
  the raw input as its parameter. `exec` also carries `invocationId`,
  `source` (the `InvocationSource` union: `"user" | "plugin" | "agent" |
  "recipe" | "sequence" | "system"`), and optional `sourceId`.
- Throwing fails the invocation receipt with your message — throw
  actionable errors, not raw internals.
- `visibility: ['agent']` makes the action available to AI agents as a
  tool; write `inputSchema` descriptions as if an LLM will read them (it
  will).
- `register` resolves to a handle token — keep it for `unregister` in your
  dispose path.

## 3. `extensions[]` + runtime dual registration (fn-163 workaround)

**Files**: `plugin.json` + `src/main.ts`

Declare actions in the manifest so they are visible in catalogs and
manifest scans — AND bind the executable at runtime. Manifest-declared
actions currently never reach discovery on their own (host bug fn-163), so
ship BOTH, exactly as `appos-plugin-ytdlp` does.
<!-- remove when fn-163 lands -->

```json
{
    "extensions": [
        {
            "extensionPoint": "actions.definition",
            "contribution": {
                "id": "clear-completed",
                "displayName": "Clear Completed Downloads",
                "inputSchema": { "type": "object" },
                "visibility": ["palette", "automation"],
                "approval": "auto"
            }
        }
    ]
}
```

```ts
// Runtime side of the dual registration. For palette-style actions that
// already exist as commands, project the command into the action catalog:
ctx.commands.register('clear-completed', async () => {
    // ... clear the queue ...
});
const actionToken = await ctx.actions.registerFromCommand('clear-completed', {
    title: 'Clear Completed Downloads',
    visibility: ['user', 'automation'],
});
void actionToken; // thread into disposables
```

For input-bearing actions, the runtime half is a full
`ctx.actions.register(def, handler)` (pattern 2) whose `def` mirrors the
manifest contribution. Other extension points (notification channels,
recipes/sequences definitions, surface contributions) do NOT need this
workaround — their manifest path works; only ACTION definitions do.

## 4. Notification emit with routing-first mindset (fn-97)

**File**: `src/notify.ts`

`ctx.notifications.emit` never picks a channel — the user's routing rules
and the host filter chain decide delivery. Manifest prerequisites (the
validator enforces this chain): `notifications.emit` + `actions.invoke`
permissions AND a dependency on `space.appos.core.notifications`.

```json
{
    "permissions": ["notifications.emit", "actions.invoke"],
    "dependencies": {
        "plugins": [
            { "id": "space.appos.core.notifications", "required": true }
        ]
    }
}
```

```ts
import type { PluginContext } from '@appos.space/plugin-types';

export async function notifyDownloadComplete(ctx: PluginContext, filename: string): Promise<void> {
    try {
        const handle = await ctx.notifications.emit({
            level: 'info',
            title: 'Download complete',
            body: `${filename} finished downloading.`,
            category: 'downloads',
            metadata: { filename },
        });
        void handle.notificationId; // keep if you may cancel() later
    } catch (err) {
        // Notifications are best-effort UX — never let emit failure break
        // the operation that triggered it.
        const name = err instanceof Error ? err.constructor.name : 'unknown';
        console.error(`[notify] emit failed (${name})`);
    }
}
```

**Key points**:
- Set a stable `category` — users route on it (`downloads`, `errors`, ...).
- `cancel(notificationId)` returns `boolean` uniformly (`false` collapses
  missing/foreign/terminal — anti-enumeration); it does not throw for those.
- Use `ctx.feedback.toast/hud` for always-local, in-app feedback;
  `ctx.notifications.emit` for user-routable events (may leave the machine
  via webhook channels).

## 5. Scheduled job owning its lifecycle (fn-90)

**File**: `src/maintenance.ts`

Schedule on activation, cancel on dispose. All methods take the
owner-scoped `token` returned by `scheduleJob`. Requires
`scheduler.job.own`.

```ts
import type { PluginContext } from '@appos.space/plugin-types';

export async function scheduleNightlySweep(ctx: PluginContext): Promise<() => Promise<void>> {
    const { token } = await ctx.scheduler.scheduleJob({
        name: 'nightly-sweep',
        trigger: { kind: 'cron', expression: '0 3 * * *' },   // DST-safe cron
        action: { kind: 'action', actionId: 'clear-completed', input: {} },
        catchupStrategy: 'skip',   // don't replay missed windows on relaunch
    });

    return async () => {
        try { await ctx.scheduler.cancel(token); } catch { /* already gone */ }
    };
}
```

**Key points**:
- The `action.actionId` must be a registered fn-89 action (pattern 2/3) —
  the scheduler dispatches through the action pipeline, so receipts,
  rate limits, and approval policy all apply.
- `catchupStrategy`: `'skip'` | `'runOnce'` | `'runAll'` — choose
  explicitly; `'runAll'` after a week offline can flood.
- `triggerNow(token)` is the debug/"Run now" path — same dispatch pipeline.
- `history(token, limit?)` + `nextFire(token)` power a status UI cheaply.

## 6. WebView panel registration

**File**: `src/panels/download-panel.ts`

```ts
import type { PluginContext, WebPanelMessage } from '@appos.space/plugin-types';

type PanelInboundMessage = { v: 1; type: string };

// src/types/webview-messages.ts (pattern 7):
declare function parseInbound(data: unknown): PanelInboundMessage | null;
declare function handle(ctx: PluginContext, msg: PanelInboundMessage, envelope: WebPanelMessage): Promise<void>;

export function registerDownloadPanel(ctx: PluginContext): () => void {
    let disposed = false;

    const panelToken = ctx.ui.registerWebPanel('download', {
        title: 'Downloads',
        icon: 'arrow.down.circle',
        htmlPath: 'webview/download/index.html',
        allowNavigation: false,
    });
    void panelToken; // typed as string, but undefined on the 1.0.0 host — see key points

    const messageToken = ctx.ui.onWebPanelMessage('download', (envelope) => {
        if (disposed) return;
        const msg = parseInbound(envelope.data);
        if (!msg) return;

        Promise.resolve().then(() => handle(ctx, msg, envelope)).catch((err) => {
            const name = err instanceof Error ? err.constructor.name : 'unknown';
            console.error(`[download] Handler "${msg.type}" failed (${name})`);
        });
    });
    void messageToken; // no handler-unregister API — see key points below

    return () => {
        disposed = true; // host removes the panel + handler on plugin unload
    };
}
```

**Key points**:
- Per the SDK 3.0.0 types, `registerWebPanel` returns a registration-token
  string (2.x hid it) — but the shipped AppOS 1.0.0 host returns
  `undefined` from it at runtime (host↔d.ts reconciliation is a known SDK
  follow-up). Do NOT build teardown on the runtime value: at deactivation
  it would call `ctx.ui.unregister(undefined)`, which cannot unregister
  the panel and may throw. The host removes the panel automatically on
  plugin unload; the `disposed` flag is the mid-life teardown mechanism.
- `onWebPanelMessage` / `onWebPanelRequest` tokens are `undefined` on the
  1.0.0 host too, and the host exposes NO handler-unregister API either
  way — `ctx.ui.unregister` takes only slot-based contribution ids
  (panels, toolbar items, status bar items), never handler tokens. One
  handler per panelId — re-registering replaces the previous handler.
- Wrap every handler in `Promise.resolve().then(...).catch(...)` so sync
  throws and async rejections land in the same error path.
- Never log raw `err.message` — it may contain URLs, credentials, or user
  input. Log the error constructor name only.

## 7. Typed message protocol

**File**: `src/types/webview-messages.ts`

```ts
export type QueueEntry = {
    id: string;
    url: string;
    status: 'queued' | 'active' | 'complete' | 'failed';
};
export type ProbeMetadata = { title: string; durationSeconds?: number };

export type PanelInboundMessage =
    | { v: 1; type: 'probe-url'; probeId: string; url: string }
    | { v: 1; type: 'queue-download'; requestId: string; url: string; format: string }
    | { v: 1; type: 'request-state' };

export type PanelOutboundMessage =
    | { v: 1; type: 'state-update'; queue: QueueEntry[] }
    | { v: 1; type: 'probe-result'; probeId: string; metadata: ProbeMetadata }
    | { v: 1; type: 'enqueue-ack'; requestId: string; ok: boolean; error?: string };

export function parseInbound(data: unknown): PanelInboundMessage | null {
    if (typeof data !== 'object' || data === null) return null;
    const m = data as Record<string, unknown>;
    if (m.v !== 1) return null;
    // Validate EVERY variant's required fields before the cast. Checking
    // only `v` + `typeof type === 'string'` is NOT enough: it would accept
    // { v: 1, type: 'queue-download' } and hand downstream code a message
    // with requestId/url/format missing — violating the untrusted-input
    // contract these messages arrive under.
    switch (m.type) {
        case 'probe-url':
            if (typeof m.probeId !== 'string' || typeof m.url !== 'string') return null;
            break;
        case 'queue-download':
            if (typeof m.requestId !== 'string' || typeof m.url !== 'string' ||
                typeof m.format !== 'string') return null;
            break;
        case 'request-state':
            break; // no fields beyond the discriminator
        default:
            return null; // unknown type — reject, no fallthrough
    }
    return data as PanelInboundMessage;
}
```

Always version with `v: 1` and correlate request/response with a unique ID
(`probeId`, `requestId`). WebView panels can have multiple instances —
responses broadcast via `postToWebPanel` fan out to all of them, so
without correlation IDs, responses get cross-applied.

## 8. Throttled broadcast with JSC fallback

**File**: `src/panels/download-panel.ts`

```ts
declare const state: { getQueue(): unknown[] };

// NonNullable because JSC may not inject timers — the guard below narrows
let throttleTimer: ReturnType<NonNullable<typeof setTimeout>> | undefined;
let lastBroadcast = 0;

function broadcastQueue(): void {
    if (typeof setTimeout !== 'function' || typeof clearTimeout !== 'function') {
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

void broadcastQueue;
```

**Why not use `throttle` from `@appos.space/plugin-utils`**: it calls
`setTimeout` unconditionally. JSC may not inject timers, so roll a version
that degrades to synchronous broadcasts. The 100ms target gives ~10 Hz
updates — the sweet spot for progress UIs.

## 9. pipeShellToWebPanel wrapper

**File**: `src/services/downloader.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';

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
        console.error('[downloader] yt-dlp failed (YtDlpExit)');
        // Never log result.stderr raw — may contain URLs
    }
}

void runYtDlp;
```

**Gotchas**:
- `pipeShellToWebPanel` lives on `ctx.ui`, NOT `ctx.shell` (stale docs are wrong)
- 120s hard cap; long jobs need resume loops with `--continue`
- `cwd` must be absolute and tilde-expanded; T1 sandbox rejects relative paths and `~`
- Always pass `--ignore-config` or the tool's equivalent
- Chunks broadcast to ALL live instances of the panel, and this cannot be
  filtered: the chunk is `{ stream, data, bytesTotal }` — it carries no
  instance identifier (`envelope.instanceId` exists only on
  WebView→plugin messages, not on outbound chunks). If you need
  per-instance isolation, don't use `pipeShellToWebPanel` — run the
  command with `ctx.shell.execute({ onData })` and forward chunks
  yourself via `ctx.ui.postToWebPanel(panelId, msg, { instanceId })`

## 10. Workspace template registration

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

    // Note: registration only. Apply is done unconditionally at the END of
    // activate(), NOT here, NOT gated on a first-run cache flag.
    // No explicit unregister needed — ephemeral templates clean on deactivation.
    return () => {};
}
```

Then, at the end of `activate()`:

```ts
declare const WORKSPACE_ID: string;

// Step N (last): apply workspace so the user sees the UI immediately.
// activate() runs once per host launch, so this is effectively once-per-launch.
//
// IMPORTANT: apply() resolves false (not an error) when no browser window
// is focused — e.g. when the plugin first activates from the Settings
// sheet. Always fall back to showPaneTab() so the user sees something.
try {
    const applied = await ctx.workspaces.apply(WORKSPACE_ID);
    if (!applied) {
        try { ctx.ui.showPaneTab('download', { title: 'Downloads', pane: 'left' }); } catch { /* ok */ }
    }
} catch (err) {
    console.warn('[my-plugin] workspaces.apply on activation failed:', err);
}
```

> **DO NOT use an `applyIfFirstRun(ctx)` / `cache.get('initialized')` gate.**
>
> Gating workspace apply behind a cache flag is the #1 cause of "plugin
> installed but no UI is visible". On first launch it works; on every
> subsequent launch the user is left in whatever workspace they were in
> before, with no reliable way to discover the plugin's panels. Apply
> unconditionally in `activate()` and move on.

**Panel-open commands**: `ctx.ui.showPaneTab(panelId, options?)` focuses an
existing tab or creates one. Use `workspaces.apply()` first when the
command depends on the full dual-pane layout:

```ts
declare const WORKSPACE_ID: string;

ctx.commands.register('open-download-panel', {
    title: 'Open yt-dlp Downloader',
    handler: async () => {
        try { await ctx.workspaces.apply(WORKSPACE_ID); } catch (err) { console.warn(err); }
        try { ctx.ui.showPaneTab('download', { title: 'Downloads', pane: 'left' }); } catch { /* workspace apply already surfaced it */ }
    },
});
```

**Note**: `ctx.cache.get` returns the **deserialized** value (no
JSON.parse). Pass `persist: true` for durability across restarts.

## 11. Menubar registration with popover content

**File**: `src/menubar/menubar.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';
import { vstack, section, listItem, button } from '@appos.space/view-builders';

declare const state: { getQueue(): unknown[]; subscribe(listener: () => void): () => void };
declare const WORKSPACE_ID: string;

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

    let unsubscribed = false;
    let clickToken: string | undefined;
    let unsubscribeQueue: (() => void) | undefined;

    // Transactional init: register() already succeeded, so any failure in
    // the steps below must remove the status item before rethrowing —
    // otherwise this function rejects and leaves a dangling menu bar item
    // nobody holds a disposer for.
    try {
        await ctx.menubar.setContent(buildPopoverContent());

        // ctx.events.subscribe returns a string token, not a disposer
        clickToken = ctx.events.subscribe('menubar.clicked', async () => {
            if (unsubscribed) return;
            try { await ctx.workspaces.apply(WORKSPACE_ID); } catch { /* may not exist yet */ }
            try { ctx.ui.showPaneTab('download', { title: 'Downloads', pane: 'left' }); } catch { /* ok */ }
        });

        // Update badge AND popover content as queue changes
        unsubscribeQueue = state.subscribe(() => {
            const count = state.getQueue().length;
            void ctx.menubar.setBadge(count > 0 ? count : 0);
            ctx.menubar.setContent(buildPopoverContent()).catch(() => {});
        });
    } catch (err) {
        unsubscribed = true;
        if (clickToken !== undefined) ctx.events.unsubscribe(clickToken);
        unsubscribeQueue?.();
        await ctx.menubar.remove().catch(() => { /* best effort */ });
        throw err;
    }

    return () => {
        unsubscribed = true;
        if (clickToken !== undefined) ctx.events.unsubscribe(clickToken);
        unsubscribeQueue?.();
        ctx.menubar.remove().catch(() => { /* ignore */ });
    };
}
```

**Popover content is mandatory**: without `setContent()`, the popover says
"No content" — `register()` + `setBadge()` + `menubar.clicked` all work
fine without it, so it's easy to miss. Update it reactively alongside
`setBadge()`.

**Transactional init**: if any step fails after `register` succeeds, call
`remove()` in the catch (as the example above does) so the menu bar
doesn't leak a dangling item — a rejected init means the caller never
receives the disposer, so nothing else will ever clean it up.

## 12. Smart folder filter with closure capture

**File**: `src/smart-folders/filters.ts`

```ts
import type { PluginContext } from '@appos.space/plugin-types';

type LibraryState = {
    favorites: Array<{ url: string }>;
    subscribe(listener: () => void): () => void;
};

export async function registerFilters(ctx: PluginContext, state: LibraryState): Promise<() => void> {
    let favoritesByUrl: Map<string, boolean> = new Map();

    const rebuild = () => {
        favoritesByUrl = new Map<string, boolean>(state.favorites.map((f) => [f.url, true]));
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

**Why synchronous `evaluate`**: smart folder filters are called once per
file during directory traversal. They must be cheap and cannot await.
Build a lookup structure (Map, Set) on state change and capture it in the
closure. The callback receives `{ url, metadata }` — nothing else.

## 13. Dependency status handling

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
void depToken;
// Note: no matching unsubscribe API exists for lifecycle tokens yet;
// the subscription auto-cleans on plugin deactivation.
```

`ctx.lifecycle.getDependencyStatus()` and
`ctx.lifecycle.recheckDependencies()` are host-wired and safe to call —
`appos-plugin-ytdlp` uses both in production (the initial
`getDependencyStatus()` read happens after subscribing; the panels call
`recheckDependencies()` from their "Re-check" buttons). Subscribe FIRST,
then read, so no update can slip between the read and the subscription.

If a required dependency is missing, show a "degraded banner" in the
webview with the install hint. Don't refuse to load the plugin — the host
already handles hard failures.

## 14. Settings read with fallback

```ts
import type { PluginContext } from '@appos.space/plugin-types';
import { urlToPath } from '@appos.space/plugin-utils';

async function getOutputDir(ctx: PluginContext): Promise<string> {
    const raw = ctx.settings.get('outputDir');
    if (typeof raw === 'string' && raw.length > 0) return raw;
    // Fall back to active pane directory
    const activeDir = await ctx.fileOps.getActiveDirectory();
    if (activeDir) return urlToPath(activeDir);
    throw new Error('outputDir setting is required when no active directory');
}

void getOutputDir;
```

`ctx.settings.get(key)` returns `unknown` — always check the type before
using the value. Prefer explicit defaults in code over relying on the
manifest `default` field (which also works, but is a weaker guarantee).

## 15. Handler action routing (ViewDescriptor)

For ViewDescriptor-based panels, use short semantic action prefixes:

```ts
declare function refresh(): void;
declare function addSelected(): void;
declare function activateEntry(id: string): void;
declare function openFile(id: string): void;
declare function revealInFinder(id: string): void;
declare function removeItem(id: string): void;

const handler = (action: string): void => {
    if (action === 'refresh') refresh();
    if (action === 'add-selected') addSelected();
    if (action.startsWith('select:')) activateEntry(action.substring(7));
    if (action.startsWith('open:')) openFile(action.substring(5));
    if (action.startsWith('reveal:')) revealInFinder(action.substring(7));
    if (action.startsWith('remove:')) removeItem(action.substring(7));
};

void handler;
```

**Don't repeat the noun**: `"remove:"` is better than `"remove-collection:"`.
The handler already knows its context. (This `(action: string) => ...`
handler is the `ActionHandler` shape from `@appos.space/plugin-utils` — a
ViewDescriptor action-string router, unrelated to fn-89 action handlers.)

## 16. menuActions on listItem

```ts
import type { ListItemDescriptor, MenuAction } from '@appos.space/plugin-types';
import { encodeMenuActions } from '@appos.space/view-builders';

declare const item: { url: string; name: string; subtitle: string };

const menu: MenuAction[] = [
    { title: 'Open', icon: 'doc', action: `open:${item.url}` },
    { title: 'Reveal in Finder', icon: 'folder', action: `reveal:${item.url}` },
    { title: '---' },                         // divider
    { title: 'Remove', icon: 'trash', action: `remove:${item.url}`, destructive: true },
];

const row: ListItemDescriptor = {
    type: 'listItem',
    properties: {
        title: item.name,
        subtitle: item.subtitle,
        icon: 'doc.fill',
        action: `select:${item.url}`,
        menuActions: encodeMenuActions(menu),  // MUST be a JSON STRING
    },
};

void row;
```

**Key rules**:
- `menuActions` is a **JSON string** — build it with `encodeMenuActions()`
  (or `JSON.stringify(menu)`, identical output)
- Dividers are plain objects with `title: '---'`
- Destructive actions get `destructive: true` and are placed last
- Always ship `menuActions` on every listable item — the single most
  important UX pattern for plugin authors

## 17. Build script (canonical)

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

**Invoked as**: `npm run build` or `node build.mjs`. The esbuild API
beats `npx esbuild ...`: cleaner watch mode, works across platforms.

## 18. tsconfig (mandatory flags)

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
        "types": [],
        "lib": ["ES2022"]
    },
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

**`verbatimModuleSyntax: true` is mandatory** — without it TypeScript
emits runtime `require`/`import` calls for the type-only
`@appos.space/plugin-types` and the plugin silently fails to activate.

**`lib` has no `DOM`** — JSC has no `document`/`window`, no browser
`fetch` (use `ctx.network.fetch`), no guaranteed timers, and `URL` only on
hosts that inject it (AppOS 1.1.0+).
**`types` is pinned `[]`** so a later `@types/node` install cannot inject
`process`/Node timer globals that typecheck yet throw in JSC. Ship a
`src/jsc-globals.ts` `declare global` module (matched by
`"include": ["src/**/*.ts"]`) declaring the runtime's real globals:

```ts
// src/jsc-globals.ts — JSC plugin-runtime ambient globals. A `declare
// global` .ts MODULE, not a .d.ts: skipLibCheck skips every .d.ts (even
// project-owned), so corruption silently degrades to error-`any`; a
// .ts module is always checked. JSC ships a native console; the host
// injects NO timers — `| undefined` typing makes an unguarded
// setTimeout(...) a TS2722 error while a
// `typeof setTimeout === 'function'`-narrowed call compiles.
export {};

declare global {
    var console: {
        log(...args: unknown[]): void;
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
        debug(...args: unknown[]): void;
        trace(...args: unknown[]): void;
    };
    var setTimeout: ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => number) | undefined;
    var clearTimeout: ((id: number | undefined) => void) | undefined;
    var setInterval: ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => number) | undefined;
    var clearInterval: ((id: number | undefined) => void) | undefined;
    // URL — hosts 1.1.0+ inject a Foundation-bridged URL (immutable v1 subset;
    // searchParams THROWS — parse url.search manually). Typed `| undefined`
    // (older hosts / kill switch / menu-bar contexts lack it): unguarded
    // `new URL(...)` is a TS18048 error; a `typeof URL === 'function'` guard
    // compiles (usage: §24). Same surface as the SDK 3.0.1+ opt-in
    // `@appos.space/plugin-types/globals` subpath — on a >=3.0.1 pin you may
    // set tsconfig `types` to that subpath and DELETE this URL block
    // (keeping both double-declares URL).
    interface URL {
        readonly href: string;
        readonly protocol: string;
        readonly hostname: string;
        readonly host: string;
        readonly port: string;
        readonly pathname: string;
        readonly search: string;
        readonly hash: string;
        readonly origin: string;
        readonly username: string;
        readonly password: string;
        toString(): string;
        toJSON(): string;
    }
    interface URLConstructor {
        new (url: string | URL, base?: string | URL): URL;
        canParse(url: string | URL, base?: string | URL): boolean;
        readonly prototype: URL;
    }
    var URL: URLConstructor | undefined;
}
```

Browser globals in `src/` now fail typecheck (`document` → TS2584,
`window`/`fetch` → TS2304), unguarded `setTimeout(...)` / `new URL(...)`
fail (TS2722 / TS18048), and `typeof`-guarded calls compile (guarded URL
usage: §24). DOM belongs only in the WebView-side `tsconfig.webview.json`
(`webview-panels` skill; `skipLibCheck: false` keeps the
project-owned `webview/twopanez.d.ts` checked).

## 19. Deploy (rsync with --delete-excluded)

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

**Critical**: `--delete-excluded` removes files added to the exclude list
after a previous deploy. Without it, a file you excluded today but copied
yesterday stays on the destination forever.

## 20. minHostVersion landmine

```json
{
    "id": "space.appos.ytdlp",
    "version": "1.0.0",
    "minHostVersion": "1.0.0"
}
```

**ALWAYS** default `minHostVersion` to `"1.0.0"`. The host compares this
against its `CFBundleShortVersionString` (currently `1.0.0`), NOT the SDK
package version. Setting `minHostVersion` to the SDK's version number
because you saw it in `@appos.space/plugin-types/package.json` will cause
the host's dependency resolver to silently reject the plugin before it
reaches the Settings → Plugins sheet. No error dialog, no log entry you'll
think to check.

To verify the actual host version:

```bash
defaults read /Applications/AppOS.app/Contents/Info.plist CFBundleShortVersionString
```

## 21. WebView panel with plugin-to-webview messaging

**Full plugin structure** showing `plugin.json` + `src/main.ts` +
`webview/main/` with external JS/CSS (CSP-compliant).

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
let disposed = false;

async function activate(ctx: PluginContext): Promise<void> {
    // Register with SHORT id — runtime auto-prefixes to {pluginId}.main-panel
    const panelToken = ctx.ui.registerWebPanel('main-panel', {
        title: 'My Tools',
        icon: 'wrench',
        htmlPath: 'webview/main/index.html',
        allowNavigation: false,
    });
    void panelToken; // typed as string, but undefined on the 1.0.0 host — see pattern 6
    // Host removes panel + handlers on unload; `disposed` handles mid-life
    // teardown. Do NOT push ctx.ui.unregister(panelToken) — that is
    // unregister(undefined) on the 1.0.0 host and may throw (pattern 6).
    disposables.push(() => { disposed = true; });

    // SECURITY: messages are SEMANTIC intents, never shell-shaped — the
    // plugin hardcodes command + argv per intent. NEVER forward a command
    // or argv array from webview input into ctx.shell.execute.
    const messageToken = ctx.ui.onWebPanelMessage('main-panel', (envelope) => {
        if (disposed) return;
        if (typeof envelope.data !== 'object' || envelope.data === null) return;
        const raw = envelope.data as Record<string, unknown>;
        if (raw.v !== 1 || typeof raw.type !== 'string') return;

        if (raw.type === 'show-version') {
            Promise.resolve().then(() => showVersion(ctx)).catch((err) => {
                const name = err instanceof Error ? err.constructor.name : 'unknown';
                console.error(`[mytools] showVersion failed (${name})`);
            });
        }
        // Unknown message types are dropped — no generic fallthrough.
    });
    void messageToken; // no handler-unregister API (pattern 6)

    const requestToken = ctx.ui.onWebPanelRequest('main-panel', async (envelope) => {
        if (disposed) return { v: 1, type: 'error', message: 'plugin disposed' };
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
    void requestToken; // no handler-unregister API (pattern 6)
}

// One function per intent: command + argv are HARDCODED here, never taken
// from the webview message.
async function showVersion(ctx: PluginContext): Promise<void> {
    if (disposed) return; // re-check: dispatch is async, disposal may have raced
    // T1 plugins must use cwd within active pane roots
    const activeDir = await ctx.fileOps.getActiveDirectory();
    const cwd = activeDir ? urlToPath(activeDir) : undefined;
    if (!cwd) return;  // no active directory — cannot run

    ctx.ui.postToWebPanel('main-panel', { v: 1, type: 'started' });

    const result = await ctx.shell.execute({
        command: 'mytool',          // fixed binary (must be in shellCommands)
        args: ['--version'],        // fixed argv for this intent
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
/* Host-injected design tokens — update live on theme change */
body {
    margin: 0;
    padding: 16px;
    background-color: var(--twopanez-bg);
    color: var(--twopanez-text);
}

#output {
    background: var(--twopanez-bg-surface);
    font-family: 'SF Mono', monospace;
    white-space: pre-wrap;
}

button {
    background: var(--twopanez-accent);
    color: var(--twopanez-bg);
}
```

### webview/main/app.js

```js webview
// Strict checkJs-clean; requires webview/twopanez.d.ts (extension-api.md).
/** @typedef {{ v: number, type: string, [key: string]: unknown }} ProtocolMessage */

const output = document.getElementById('output');
const runBtn = document.getElementById('run');
if (!output || !runBtn) throw new Error('missing #output/#run');

// Receive protocol messages from plugin via postToWebPanel
window.twopanez.onMessage((data) => {
    const msg = /** @type {Partial<ProtocolMessage> | null} */ (data);
    if (typeof msg !== 'object' || msg === null || msg.v !== 1 || typeof msg.type !== 'string') return;
    if (msg.type === 'started') output.textContent = '';
    if (msg.type === 'output' && typeof msg.data === 'string') output.textContent += msg.data;
    if (msg.type === 'finished') output.textContent += `\n[exit ${msg.exitCode}]`;
});

runBtn.addEventListener('click', () => {
    // Fire-and-forget SEMANTIC intent — the plugin decides what to execute.
    window.twopanez.send({ v: 1, type: 'show-version' });
});

// Request/response example
async function checkStatus() {
    const result = await window.twopanez.request({ v: 1, type: 'get-status' });
    console.log('Plugin status:', result);
}
checkStatus();
```

**Key points:**
- Register the SHORT id `main-panel` — runtime auto-prefixes to
  `{pluginId}.main-panel`
- **WebView messages are semantic intents** (`show-version`), never
  shell-shaped (`{ command, args }`) — the plugin hardcodes command + argv
  per intent, so webview input can never steer `ctx.shell.execute`
- All JS and CSS are external files (CSP blocks inline `<script>` and
  `<style>`)
- WebView `.js` is checked by the strict `checkJs` `tsconfig.webview.json`
  (`webview-panels` skill): ship the `window.twopanez` ambient declaration
  from `extension-api.md` ("WebView-side bridge") as `webview/twopanez.d.ts`,
  JSDoc-narrow payloads, null-check elements — as in `app.js` above
- `window.twopanez.send()` / `.request()` go webview→plugin;
  `.onMessage()` receives `postToWebPanel` pushes
- With `pipeShellToWebPanel`, shell chunks arrive via `onMessage`
  alongside protocol messages — filter on `msg.stream` (§22)

## 22. Streaming shell to WebView pipe (pipeShellToWebPanel)

For real-time CLI output in a WebView, `ctx.ui.pipeShellToWebPanel()`
streams chunks directly to the WebView, bypassing the plugin's JS thread
(no manual `onData` + `postToWebPanel`).

### src/main.ts

```ts
import type { PluginContext } from '@appos.space/plugin-types';

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

void runWithPipe;
```

### webview/output/app.js

```js webview
// Strict checkJs-clean; requires webview/twopanez.d.ts (extension-api.md).
/** @typedef {{ stream: 'stdout' | 'stderr', data: string, bytesTotal: number }} ShellChunk */
/** @typedef {{ v: number, type: string, [key: string]: unknown }} ProtocolMessage */

const terminal = document.getElementById('terminal');
if (!terminal) throw new Error('missing #terminal');

window.twopanez.onMessage((data) => {
    const msg = /** @type {Partial<ShellChunk & ProtocolMessage> | null} */ (data);
    if (typeof msg !== 'object' || msg === null) return;
    // Shell chunks (ShellChunk shape above) have no protocol envelope
    if (msg.stream === 'stdout' || msg.stream === 'stderr') {
        const span = document.createElement('span');
        span.className = msg.stream;
        span.textContent = msg.data ?? '';
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

**Critical gotchas** — §9's list applies verbatim: method is on `ctx.ui`
NOT `ctx.shell`, 120s hard cap (resume loops for long jobs), absolute
tilde-expanded `cwd`, always `--ignore-config`, and chunks fan out to ALL
panel instances with no instance identifier (per-instance isolation needs
§9's manual `ctx.shell.execute({ onData })` path).

## 23. Dependency-aware manifest

Declare system dependencies so the host auto-checks them at activation and
reports status to your UI.

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
    void depToken;

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

void activate;
```

**Key points:**
- `check.command` MUST be in `shellCommands` allowlist — otherwise the
  status is `"command_not_allowed"`
- `versionPattern` uses one capture group to extract the version string
- `shellDeniedPatterns` are custom regexes merged with built-in defaults
  (never replacing them)
- Subscribe to `onDependencyStatusChanged` BEFORE the initial
  `getDependencyStatus()` read — canonical ordering from
  `appos-plugin-ytdlp`
- `recheckDependencies()` re-probes on demand (both APIs are host-wired;
  ytdlp calls them in production)

## 24. Guarded URL parsing (host-injected Foundation-bridged `URL`)

**File**: `src/services/validate.ts`

AppOS hosts 1.1.0+ inject a native `URL` global — Foundation-bridged
(macOS `URL(string:)`, RFC 3986), NOT a WHATWG polyfill.
Guard EVERY use, exactly like the timer guard in §8: older hosts never had
it, users can switch it off (`appos.jsc.urlGlobal.disabled`), and menu-bar
contexts do not carry it in v1 — `minHostVersion` removes only the
older-host reason for absence.

```ts
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isValidMediaUrl(raw: string): boolean {
    if (typeof URL !== 'function') {
        // Older host / kill switch / menu-bar context: URL is absent.
        // Fail CLOSED for security-shaped checks like this one, or
        // hand-parse when the feature must work without URL.
        return false;
    }
    // canParse never throws (unlike the constructor), so probe first.
    if (!URL.canParse(raw)) return false;
    const u = new URL(raw);
    return ALLOWED_PROTOCOLS.has(u.protocol) && u.hostname.length > 0;
}

void isValidMediaUrl;
```

**Key points:**
- `typeof URL === 'function'` before EVERY use — same contract as the
  timer guard (§8); the §18 ambient `| undefined` typing turns an
  unguarded `new URL(...)` into a compile error, not a runtime surprise.
- **Parse coherence**: `u.hostname` is lowercased and is the exact host
  string entering the host's security normalizers — plugin-side URL
  validation parses identically to host-side enforcement.
- `URL.canParse(input, base?)` returns a boolean and NEVER throws;
  `new URL(...)` throws a real `TypeError`
  (`e instanceof TypeError === true`) on unparseable input, and on
  scheme-less/scheme-relative input lacking a valid absolute `base`
  (`new URL('/api', 'https://x.test')` resolves); a bad `base` throws
  first.
- Instances are immutable (readonly accessors; assignment is a
  sloppy-mode no-op). `String(u)`, template literals, and
  `JSON.stringify(u)` all yield `u.href`.
- **No `searchParams` in v1** — the getter THROWS a `TypeError`; parse
  `u.search` manually (`decodeURIComponent` throws `URIError` on
  malformed percent sequences, so wrap it in try/catch).
- Pinned Foundation-vs-WHATWG divergences (intended — do not "fix"):
  default ports are RETAINED (`https://x:443/` keeps port `"443"`), an
  empty path stays `""` (not `"/"`), and IPv6 hostnames come WITHOUT
  brackets while `host`/`origin` re-bracket them (`https://[::1]:8443/x`
  → hostname `"::1"`, host `"[::1]:8443"`, origin `"https://[::1]:8443"`).
  (The `%3A` → `%253A` double-encode is `URLComponents.queryItems`-only;
  `href` round-trips preserve pre-encoded query values verbatim.)

## Further reading

- **`plugin-api/`** in this directory — byte-verbatim mirror of the
  published `@appos.space/plugin-types` d.ts modules (see its `INDEX.md`)
- **`extension-api.md`** in this directory — namespace-by-namespace
  overview, `extensions[]`, permissions, catalog bundle layout
- **`migration-2.x-to-3.0.md`** in this directory — SDK 2.x → 3.0.0
  break classes
- **https://github.com/appos/appos-plugin-ytdlp** — the flagship plugin,
  live in production
- **https://github.com/appos/plugin-sdk** — SDK source (plugin-types,
  plugin-utils, view-builders, manifest schema)
- **https://docs.appos.space** — canonical AppOS plugin developer docs
