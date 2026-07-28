---
name: webview-panels
description: >
  Build rich WebView panels for AppOS plugins — the canonical approach for plugins
  that need streaming progress, media playback, complex forms, or HTML-based UI.
  Use this skill when building or designing a panel registered with registerWebPanel,
  when working with pipeShellToWebPanel for CLI→UI streaming, or when the user is
  editing files under webview/. Triggers on: "registerWebPanel", "postToWebPanel",
  "onWebPanelMessage", "pipeShellToWebPanel", "plugin-panel:// scheme", "shell chunks",
  "window.twopanez", "bridge.js", "webview CSP". Also use PROACTIVELY when the user
  is wiring messages between plugin main.ts and a webview panel.
---

# AppOS WebView Panel Authoring

WebView panels are the rich-UI surface for AppOS plugins. You ship HTML/CSS/JS inside the plugin bundle, the host loads it via `plugin-panel://` into a WKWebView, and you communicate with it over a message protocol. This is the approach used by the flagship `appos-plugin-ytdlp` plugin and is the right tool when ViewDescriptor-based native panels are too limiting.

**Use a WebView panel when you need any of:**
- Streaming progress indicators updated 10+ Hz
- Media playback (video, audio)
- Complex interactive forms (URL paste → probe → select formats → queue)
- Custom layouts that SwiftUI would make painful
- Real-time CLI output piped directly into the UI

**Use ViewDescriptor instead when:**
- The panel is a static or low-frequency list of items
- You need native menu integration (`menuActions` on `listItem`)
- You want the panel to feel indistinguishable from the host's own sidebar panels
- The content is simple enough that SwiftUI handles it naturally

You can mix both in the same plugin — each panel registration picks its own rendering.

## Panel limit

**Maximum 2 WebView panels per plugin, 6 globally.** Plan accordingly. If you need more surfaces, use view switching inside a single panel (tabs, routing) or fall back to ViewDescriptor-based panels.

## The four pieces

Every WebView panel has four moving parts:

1. **Registration** (`ctx.ui.registerWebPanel`) — tells the host the panel exists, with title/icon/htmlPath.
2. **HTML bundle** (`webview/<panel>/index.html` + CSS/JS) — shipped with the plugin, loaded via `plugin-panel://`.
3. **Inbound handler** (`ctx.ui.onWebPanelMessage`) — receives messages sent from the webview via `window.twopanez.send()`.
4. **Outbound push** (`ctx.ui.postToWebPanel`) — sends messages from the plugin to the webview.

Optionally a fifth piece for CLI-wrapping plugins:

5. **Shell streaming** (`ctx.ui.pipeShellToWebPanel`) — spawns a child process and streams chunks directly to the webview, bypassing plugin main.ts entirely for the data path.

## Registration

```ts
// SDK 3.0.0 types registerWebPanel as returning a registration-token string.
const panelToken = ctx.ui.registerWebPanel('download', {
    title: 'Downloads',
    icon: 'arrow.down.circle',      // SF Symbol name
    htmlPath: 'webview/download/index.html',
    allowNavigation: false,          // Default false; keep it false for security
    width: 320,                      // Optional preferred width
});
```

**`htmlPath` is resolved relative to the plugin root at runtime.** This means:
- Your `webview/` tree MUST ship with the installed plugin — do NOT exclude it from the deploy rsync.
- Use a subdirectory per panel (`webview/download/`, `webview/library/`) plus a shared directory (`webview/shared/`) for the bridge and common styles.

Call `registerWebPanel` exactly once per panel. Calling it again with the same ID is undefined behavior — use `postToWebPanel` to update content reactively instead.

## Webview folder layout

Canonical layout (from `appos-plugin-ytdlp`):

```
webview/
├── download/
│   ├── index.html
│   ├── styles.css
│   ├── form.js       # URL form + probe
│   ├── queue.js      # active downloads list
│   └── switch.js     # tab switching logic
├── library/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── shared/
    ├── styles.css    # shared theme tokens
    ├── bridge.js     # wraps window.twopanez
    ├── messages.js   # message envelope factories + type guards
    ├── ui-helpers.js # DOM helpers
    └── degraded-banner.js  # dependency-missing banner component
```

## Content Security Policy

The WKWebView serving `plugin-panel://` enforces a strict CSP that blocks:
- Inline `<script>` tags
- Inline `<style>` tags
- Inline event handlers (`onclick="..."`)
- Dynamic code execution (`Function()`, string-based timer callbacks, etc.)

**Everything must be external.** Load JS as ES modules:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="../shared/styles.css">
    <link rel="stylesheet" href="./styles.css">
</head>
<body>
    <div id="app"></div>
    <script type="module" src="./form.js"></script>
    <script type="module" src="./queue.js"></script>
</body>
</html>
```

Module paths are relative to the HTML file. ES modules work because WKWebView's module loader is separate from JSC.

## The bridge (`window.twopanez`)

The host injects `window.twopanez` at document start, before any module runs. Its shape:

```ts no-verify
// Shape sketch (not compile-checked): window.twopanez is a host-injected global
// that the published @appos.space/plugin-types package does not type.
window.twopanez = {
    send(msg: object): void;            // Fire-and-forget → onWebPanelMessage
    request(msg: object): Promise<any>; // Request/response → onWebPanelRequest
    onMessage(fn: (data: unknown) => void): void;  // Inbound from postToWebPanel
    readonly instanceId: string;        // Per-WKWebView UUID
    readonly windowId: string;          // App window ID
    readonly paneId: 'left' | 'right';  // Which pane this webview is in
};
```

Note: `window.twopanez` is not typed by the published SDK package; webview-side TypeScript may adopt a local ambient declaration for it in a future revision of this skill.

Wrap it in a thin `shared/bridge.js` module so panel scripts don't depend on the raw global and can be tested in isolation. Pattern from the ytdlp plugin:

```js
// webview/shared/bridge.js
const PROTOCOL_VERSION = 1;
const _messageListeners = [];
const _shellListeners = [];

function isShellChunk(data) {
    return typeof data === 'object' && data !== null
        && 'stream' in data && 'data' in data && !('v' in data);
}

if (window.twopanez) {
    window.twopanez.onMessage((data) => {
        if (isShellChunk(data)) {
            for (const fn of [..._shellListeners]) {
                try { fn(data); } catch (e) { console.error('[bridge] shell listener error:', e); }
            }
            return;
        }
        if (typeof data !== 'object' || data === null || data.v !== PROTOCOL_VERSION || typeof data.type !== 'string') {
            console.warn('[bridge] Dropped malformed inbound');
            return;
        }
        for (const fn of [..._messageListeners]) {
            try { fn(data); } catch (e) { console.error('[bridge] listener error:', e); }
        }
    });
}

export const bridge = {
    send(message) { window.twopanez?.send(message); },
    onMessage(handler) {
        _messageListeners.push(handler);
        return () => { const i = _messageListeners.indexOf(handler); if (i !== -1) _messageListeners.splice(i, 1); };
    },
    onShellChunk(handler) {
        _shellListeners.push(handler);
        return () => { const i = _shellListeners.indexOf(handler); if (i !== -1) _shellListeners.splice(i, 1); };
    },
    getContext() {
        if (!window.twopanez) return null;
        return {
            instanceId: window.twopanez.instanceId,
            windowId: window.twopanez.windowId,
            paneId: window.twopanez.paneId,
        };
    },
};
```

**Why split shell chunks from protocol messages**: `pipeShellToWebPanel` emits chunks through the same `onMessage` pipe, but chunks have shape `{ stream, data, bytesTotal }` — no `v` or `type`. Your protocol handler shouldn't see them, and your shell-output handler shouldn't see protocol messages. The bridge routes them into separate listener buckets.

## Message protocol

Version every message and discriminate by `type`. This lets you evolve the protocol safely.

```ts
// types/webview-messages.ts (shared between plugin main.ts and webview)

// Domain payload types — define these for your plugin
export type QueueEntry = { id: string; url: string; progress: number };
export type Format = { id: string; label: string };
export type Metadata = Record<string, unknown>;

export type PanelInboundMessage =
    | { v: 1; type: 'probe-url'; probeId: string; url: string }
    | { v: 1; type: 'queue-download'; requestId: string; url: string; format: string; quality: string }
    | { v: 1; type: 'cancel-download'; id: string }
    | { v: 1; type: 'request-state' };

export type PanelOutboundMessage =
    | { v: 1; type: 'state-update'; queue: QueueEntry[] }
    | { v: 1; type: 'probe-result'; probeId: string; metadata: Metadata; formats: Format[] }
    | { v: 1; type: 'enqueue-ack'; requestId: string; ok: boolean; count: number; error?: string };

export function parseInbound(data: unknown): PanelInboundMessage | null {
    if (typeof data !== 'object' || data === null) return null;
    const m = data as Record<string, unknown>;
    if (m.v !== 1 || typeof m.type !== 'string') return null;
    // Per-type shape validation...
    return data as PanelInboundMessage;
}
```

**Always correlate request/response with a unique ID.** WebView panels can have multiple instances (one per open pane tab across windows). Messages broadcast via `postToWebPanel` fan out to ALL instances — without correlation IDs, a response to instance A will be applied by instances B and C as well. The ytdlp plugin uses `probeId`, `requestId`, `previewId` for this.

### Plugin-side handler with narrowing

```ts
import type { PluginContext } from '@appos.space/plugin-types';

type PanelInboundMessage =
    | { v: 1; type: 'probe-url'; probeId: string; url: string }
    | { v: 1; type: 'queue-download'; requestId: string; url: string; format: string };
declare function parseInbound(data: unknown): PanelInboundMessage | null;
declare function handleProbe(ctx: PluginContext, probeId: string, url: string): void;
declare function handleEnqueue(ctx: PluginContext, msg: PanelInboundMessage): void;

// SDK 3.0.0 types onWebPanelMessage as returning a registration-token string.
const messageToken = ctx.ui.onWebPanelMessage('download', (envelope) => {
    // envelope.data is unknown — never trust it directly
    const msg = parseInbound(envelope.data);
    if (!msg) return;  // parseInbound logs redacted summary

    switch (msg.type) {
        case 'probe-url': {
            handleProbe(ctx, msg.probeId, msg.url);
            break;
        }
        case 'queue-download': {
            handleEnqueue(ctx, msg);
            break;
        }
        // ...
    }
});
```

### Plugin-side push

```ts
declare const state: { getQueue(): unknown[] };

ctx.ui.postToWebPanel('download', {
    v: 1,
    type: 'queue-update',
    entries: state.getQueue(),
});
```

Pass `{ instanceId }` in the options to target a single WebView instance instead of broadcasting:

```ts
import type { WebPanelMessage } from '@appos.space/plugin-types';
declare const envelope: WebPanelMessage;
declare const msg: { v: 1; type: string };

ctx.ui.postToWebPanel('download', msg, { instanceId: envelope.instanceId });
```

## Throttled broadcasts

For rapidly-changing state like download progress, throttle broadcasts to the webview so you don't spam it with hundreds of messages per second. The ytdlp plugin broadcasts `queue-update` at 10 Hz (100ms throttle):

```ts
declare const state: { getQueue(): unknown[] };

let throttleTimer: ReturnType<typeof setTimeout> | undefined;
let lastBroadcast = 0;

function broadcastQueue(): void {
    if (typeof setTimeout !== 'function') {
        // JSC may not have timers — fall back to sync broadcast on every change
        ctx.ui.postToWebPanel('download', { v: 1, type: 'queue-update', entries: [...state.getQueue()] });
        return;
    }
    const now = Date.now();
    const remaining = 100 - (now - lastBroadcast);
    clearTimeout(throttleTimer);
    if (remaining <= 0) {
        lastBroadcast = now;
        ctx.ui.postToWebPanel('download', { v: 1, type: 'queue-update', entries: [...state.getQueue()] });
    } else {
        throttleTimer = setTimeout(() => {
            lastBroadcast = Date.now();
            ctx.ui.postToWebPanel('download', { v: 1, type: 'queue-update', entries: [...state.getQueue()] });
        }, remaining);
    }
}
```

**Why not use `throttle` from `@appos.space/plugin-utils`**: it calls `setTimeout` unconditionally. JSC runtimes may not inject timers, so roll a version that degrades to synchronous broadcasts.

## pipeShellToWebPanel (the superpower)

For CLI wrappers (yt-dlp, ffmpeg, git, etc.), this routes child process output directly to the webview without ever passing through plugin main.ts. The plugin just awaits the final result:

```ts
// Plugin side
declare const url: string;
declare const outputDir: string;  // absolute, tilde-expanded

const result = await ctx.ui.pipeShellToWebPanel('download', {
    command: 'yt-dlp',
    args: ['--ignore-config', '--newline', '--progress-template', '[progress]%(progress)j', url],
    cwd: outputDir,           // absolute path required
    timeout: 119,             // host caps at 120s
});
// result.exitCode, result.stdout (final), result.stderr (final)
```

```js
// Webview side — receives chunks via bridge.onShellChunk
bridge.onShellChunk((chunk) => {
    // chunk: { stream: 'stdout' | 'stderr', data: string, bytesTotal: number }
    if (chunk.stream === 'stdout') {
        const line = chunk.data;
        if (line.startsWith('[progress]')) {
            const json = line.slice('[progress]'.length);
            updateProgressBar(JSON.parse(json));
        } else if (line.startsWith('[download]')) {
            updateProgressLine(line);
        }
    } else {
        appendStderr(chunk.data);
    }
});
```

**Gotchas with pipeShellToWebPanel:**
- Lives on `ctx.ui`, **NOT** `ctx.shell`. This is a common mistake — stale docs say `ctx.shell.pipeShellToWebPanel`, that's wrong.
- Hard 120-second timeout. Use resume loops with `--continue` / `--continue-at` flags for jobs that exceed this.
- `cwd` must be an absolute, tilde-expanded path. T1 sandbox rejects relative paths and `~`.
- Always pass `--ignore-config` (or the tool's equivalent) so ambient user config can't inject flags.
- Chunks fan out to every instance of the panel — if the user has the panel open in two panes, both see the same chunks. Filter with `envelope.instanceId` if you need isolation.
- The child process is killed if the plugin deactivates. Cancellation from the UI requires your plugin to call `ctx.shell.processes.terminate(pid)` — but only the direct child dies; subprocesses (ffmpeg spawned by yt-dlp) orphan.

## Multi-instance isolation

A panel can have multiple live instances — one per open pane tab per window. This matters for:

- **Correlation**: Responses broadcast via `postToWebPanel` reach every instance. Always tag responses with a per-request ID the initiator will recognize and others will ignore.
- **Shell chunks**: All instances see the same `pipeShellToWebPanel` output. If only one instance initiated the command, the others should ignore it. Filter on `instanceId` from the bridge context.
- **State**: Every instance independently holds DOM state. When a new instance opens, it should `send({ type: 'request-state' })` and the plugin should push a full state snapshot.

## Initial state handshake

Because webviews can open at any time and panels outlive page loads, every panel script should request state on load:

```js
// form.js
import { bridge } from '../shared/bridge.js';

document.addEventListener('DOMContentLoaded', () => {
    bridge.onMessage((msg) => {
        if (msg.type === 'state-update') applyState(msg);
        else if (msg.type === 'queue-update') applyQueue(msg);
        // ...
    });
    // Ask for initial snapshot
    bridge.send({ v: 1, type: 'request-state' });
});
```

```ts
// Plugin side
declare const state: { emitStateUpdate(): void };

const formHandlers = {
    'request-state': () => state.emitStateUpdate(),
    // ...
};
```

## Error handling in handlers

Wrap every handler in try/catch and post a fallback error response so the webview's UI recovers visibly:

```ts
type PanelInboundMessage = { v: 1; type: string; requestId?: string };
declare const parsed: PanelInboundMessage;
declare function handler(msg: PanelInboundMessage): void | Promise<void>;

Promise.resolve().then(() => handler(parsed)).catch((err) => {
    const errName = err instanceof Error ? err.constructor.name : 'unknown';
    console.error(`[plugin] Handler "${parsed.type}" failed (${errName})`);
    // Never log raw error — may contain URLs, credentials, or user input
    if (parsed.type === 'queue-download') {
        ctx.ui.postToWebPanel('download', {
            v: 1, type: 'enqueue-ack',
            requestId: parsed.requestId,
            ok: false, count: 0,
            error: 'Internal error during enqueue',
        });
    }
});
```

**Never put raw `err.message` into log output or broadcast to the webview** — it may contain user URLs, proxy credentials, or custom CLI args. Log the error class name only.

## Cleanup

Per the SDK 3.0.0 types, `onWebPanelMessage` (like `registerWebPanel`) returns a registration-token string. Capture it — but do NOT build teardown on its runtime value: the shipped 1.0.0 host returns `undefined` from both calls at runtime (host↔d.ts reconciliation is a known SDK follow-up), and it removes panels and message handlers automatically on plugin unload. For mid-life teardown, use a `disposed` flag to no-op incoming messages; re-calling `onWebPanelMessage` for the same panel replaces the previous handler:

```ts
declare let throttleTimer: ReturnType<typeof setTimeout> | undefined;
declare function unsubscribeQueue(): void;

let disposed = false;

const messageToken = ctx.ui.onWebPanelMessage('download', (envelope) => {
    if (disposed) return;
    // ...
});

// Disposer — push into your disposables[] in activate()
const dispose = () => {
    disposed = true;
    if (typeof clearTimeout === 'function' && throttleTimer !== undefined) {
        clearTimeout(throttleTimer);
    }
    unsubscribeQueue();  // disposer from state.subscribe()
};
```

The host unregisters the panel on plugin unload — you don't need to call anything to remove it.

## Canonical reference

Every pattern in this skill is implemented in `appos-plugin-ytdlp`. Prefer a local clone; otherwise fetch raw files from `https://raw.githubusercontent.com/appos/appos-plugin-ytdlp/main/<path>` (the repo is public as of AppOS launch), or fall back to https://docs.appos.space. When in doubt, read:

- `src/panels/download-panel.ts` — message routing, throttled broadcasts, error handling, multi-instance correlation
- `src/panels/library-panel.ts` — simpler panel for comparison
- `src/types/webview-messages.ts` — typed discriminated union + `parseInbound` validator
- `webview/shared/bridge.js` — the canonical bridge with shell-chunk split
- `webview/download/form.js` + `queue.js` — real webview code consuming the bridge
- `src/services/downloader.ts` — the `pipeShellToWebPanel` caller site
