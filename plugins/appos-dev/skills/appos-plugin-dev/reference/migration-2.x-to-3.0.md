# Migrating AppOS plugins: SDK 2.x → 3.0.0

<!--
  Version stamp: written against @appos.space/plugin-types@3.0.0
  (published 2026-07-28). EXPIRY: delete this guide when the 4.0 line ships.

  This file is HUMAN-FACING migration material. It is deliberately NOT
  compiled into the plugin-factory context (the factory authors new plugins
  and must never see pre-3.0 spellings). It is the single sanctioned home
  for pre-3.0 identifiers in this repo: verify-knowledge.mjs exempts it
  from the stale-identifier denylist and count checks, but still
  TYPE-CHECKS its `ts` fences — every "after" example below compiles
  against the pinned 3.0.0 package; legacy "before" examples are tagged
  `ts no-verify`.
-->

`@appos.space/plugin-types` 3.0.0 is the breaking sync to the AppOS 1.0.0
host surface. A 2.4.x plugin usually keeps *running* unchanged (the host
runtime did not remove the legacy bridge surface), but it stops *compiling*
against 3.0.0 — and two behavioral contracts changed shape. There are six
break classes. Work through them in order.

## TL;DR checklist

1. Rename every namespace type to its `<Name>API` spelling (table below).
2. Import every SDK type — 3.0.0 ships **no ambient globals**.
3. Action handlers now receive an **execution context** — read input via `exec.input`.
4. `registerWebPanel` / `onWebPanelMessage` / `onWebPanelRequest` return **string tokens** — capture them (panel ids are disposable via `ctx.ui.unregister`; handler tokens are diagnostics-only).
5. Change `interface` → `type` for anything you assert `exec.input` (or other `AnyJSONValue`) to.
6. Bump dependency pins `^2.4.0` → `^3.0.0` — and ignore the stale README inside the 3.0.0 tarball.

---

## 1. The rename rule (apply this FIRST)

**Every namespace interface is now `<Name>API`.** The 2.x-era
`Plugin<Name>API` and `<Name>Namespace` spellings are gone — there are no
deprecated aliases, the old names simply do not exist in 3.0.0, so every
reference is a hard `TS2304` / `TS2305` error.

| 2.x spelling | 3.0.0 spelling |
|---|---|
| `PluginCacheAPI` | `CacheAPI` |
| `PluginFeedbackAPI` | `FeedbackAPI` |
| `PluginOAuthAPI` | `OAuthAPI` |
| `PluginMenuBarAPI` | `MenubarAPI` |
| `HostEventsAPI` | `EventsAPI` |
| `ActionsNamespace` (and every other `<Name>Namespace`) | `ActionsAPI` (that namespace's `<Name>API`) |

Before (2.x):

```ts no-verify
import type { PluginCacheAPI, HostEventsAPI } from '@appos.space/plugin-types';

function wireCache(cache: PluginCacheAPI, events: HostEventsAPI): void {
    // ...
}
```

After (3.0.0):

```ts
import type { CacheAPI, EventsAPI } from '@appos.space/plugin-types';

function wireCache(cache: CacheAPI, events: EventsAPI): void {
    // ...
}
```

Mechanical fix: grep your `src/` for `Plugin[A-Z]\w*API`, `HostEventsAPI`,
and `\w+Namespace` and rename per the table. If a name isn't in the table,
check the 3.0.0 exports: `grep -n "export interface" reference/plugin-api/namespaces.d.ts`.

## 2. No ambient globals — import everything

2.x builds commonly leaned on a triple-slash reference or a copied global
d.ts, so `PluginContext` (and friends) resolved without imports, and some
scaffolds declared `activate` ambiently:

```ts no-verify
/// <reference types="@appos.space/plugin-types" />

declare function activate(ctx: PluginContext): Promise<void>;
```

3.0.0 is a plain ESM declaration package: **nothing is ambient**. The
failure signal is `TS2304: Cannot find name 'PluginContext'` (or any other
SDK type name) the moment you compile. Fix: `import type` every SDK name
you mention, and keep assigning your entry points onto `globalThis` (that
part is a host runtime contract, not a type-level one — unchanged):

```ts
import type { PluginContext } from '@appos.space/plugin-types';

async function activate(ctx: PluginContext): Promise<void> {
    // ...
}

async function deactivate(): Promise<void> {
    // ...
}

;(globalThis as any).activate = activate;
;(globalThis as any).deactivate = deactivate;
```

Keep `verbatimModuleSyntax: true` in tsconfig (unchanged from 2.x): the
package is declaration-only, so value-position imports of it must never
survive to the bundler.

## 3. Action handlers receive an execution context

The fn-89 action fabric is the reason 3.0.0 exists. In the published 3.0.0
contract, the handler you pass to `ctx.actions.register(def, handler)` is
invoked with a single `ActionExecutionContext` argument — the validated
input plus invocation metadata — NOT the raw input value:

```ts no-verify
// 2.x-era shape: handler received the raw input value directly
await ctx.actions.register(def, async (input) => {
    const url = (input as { url: string }).url;   // ← input WAS the payload
    return { ok: true, url };
});
```

This break is **source-breaking-but-runtime-correcting**: an untyped
`(input) => ...` handler still compiles at the call site (the parameter is
contextually typed as `ActionExecutionContext`), but at runtime that
parameter has always been the execution context on AppOS 1.0.0 hosts — so
2.x-typed code that treated it as the payload was reading the wrong object.
Explicitly-typed legacy handlers (e.g. `(input: DownloadUrlInput) => ...`)
fail loudly with `TS2345` instead. Either way, the fix is the same — read
the payload via `exec.input`:

```ts
import type { ActionExecutionContext } from '@appos.space/plugin-types';

type DownloadUrlInput = { url: string; format?: string };

await ctx.actions.register(
    { id: 'downloadUrl', title: 'Download Media URL' },
    async (exec: ActionExecutionContext) => {
        // exec = { invocationId, source, input, sourceId? }
        const input = exec.input as DownloadUrlInput;
        return { enqueued: true, url: input.url };
    },
);
```

`exec.source` is the `InvocationSource` union
(`"user" | "plugin" | "agent" | "recipe" | "sequence" | "system"`) — use it
when an action must behave differently for agent-driven invocations.

## 4. WebPanel registrations now return string tokens

In 2.x the d.ts typed `registerWebPanel`, `onWebPanelMessage`, and
`onWebPanelRequest` as `void`, so no 2.x code captured their results:

```ts no-verify
// 2.x: nothing to capture (typed void)
ctx.ui.registerWebPanel('download', { title: 'Downloads', htmlPath: 'webview/download/index.html' });
ctx.ui.onWebPanelMessage('download', handleMessage);
```

3.0.0 types what the host actually returns: a `string`. This is
**silently non-breaking at runtime** — your old code keeps working — but
the two token kinds have DIFFERENT disposal semantics:

- `registerWebPanel` returns a **slot-based registration id**. Uncaptured,
  the panel registration cannot be disposed deterministically and leaks
  across deactivate/activate cycles. Capture it and thread
  `ctx.ui.unregister(panelToken)` into your disposable tracking.
- `onWebPanelMessage` / `onWebPanelRequest` return **handler tokens** with
  NO unregister path — `ctx.ui.unregister` accepts only slot-based
  contribution ids (panels, toolbar/status items), not handler tokens.
  Capture them for identification/debugging; actual disposal is a
  `disposed` flag guard inside the handler closure plus host cleanup on
  plugin deactivation. (One handler per panelId — re-registering replaces
  the previous one.)

```ts
const disposables: Array<() => void | Promise<void>> = [];

const panelToken = ctx.ui.registerWebPanel('download', {
    title: 'Downloads',
    htmlPath: 'webview/download/index.html',
});
disposables.push(() => ctx.ui.unregister(panelToken)); // slot id → disposable

let disposed = false;
const messageToken = ctx.ui.onWebPanelMessage('download', (envelope) => {
    if (disposed) return;               // the real disposal mechanism
    // envelope: { data, instanceId, windowId, paneId }
});
void messageToken;                      // diagnostics only — no unregister API
disposables.push(() => { disposed = true; });
```

## 5. `interface` → `type` for `exec.input` assertion targets

`exec.input` is typed `AnyJSONValue`. A TypeScript **type alias** object
type gets an implicit index signature, so `exec.input as MyInput` is a
legal assertion. An **interface** does not — asserting to one fails with
`TS2352` because the compiler can't see the interface as JSON-compatible.

This is exactly the break `appos-plugin-ytdlp` hits at
`src/actions/register-actions.ts` under 3.0.0, where its input shape is
declared as an interface:

```ts no-verify
interface DownloadUrlInput {           // ← interface: no implicit index signature
    url: string;
    format?: string;
}

const input = exec.input as DownloadUrlInput;
// error TS2352: Conversion of type 'AnyJSONValue' to type 'DownloadUrlInput'
// may be a mistake because neither type sufficiently overlaps with the other.
```

Fix — declare JSON-shaped inputs as `type` aliases:

```ts
import type { ActionExecutionContext } from '@appos.space/plugin-types';

type DownloadUrlInput = {
    url: string;
    format?: string;
};

declare const exec: ActionExecutionContext;
const input = exec.input as DownloadUrlInput; // ✓ compiles
```

Do NOT paper over it with `exec.input as unknown as DownloadUrlInput` —
that silences every future shape drift too. The one-word `interface` →
`type` change is the correct fix (functionally identical for plain data
shapes).

## 6. Dependency pins — and the stale tarball README

Bump every `@appos.space/*` pin from the 2.x line to the 3.x line in
`package.json`:

```json
{
    "devDependencies": {
        "@appos.space/plugin-types": "^3.0.0"
    },
    "dependencies": {
        "@appos.space/plugin-utils": "^3.0.0",
        "@appos.space/view-builders": "^3.0.0"
    }
}
```

(2.x pins looked like `"@appos.space/plugin-types": "^2.4.0"` — grep your
manifest for `^2.` under `@appos.space/`.)

**Known issue:** the README packed inside the published
`@appos.space/plugin-types@3.0.0` tarball is stale — it predates the 3.0.0
surface (old namespace/permission counts, and it demos APIs under old
spellings). npm packages are immutable, so it stays that way for the whole
3.0.0 line. Trust the `dist/*.d.ts` type declarations (mirrored
byte-verbatim in `reference/plugin-api/` here), not the package README.

---

## What did NOT change

Do not "migrate" these — they are live host contracts, identical in 2.x
and 3.0.0:

- `window.twopanez` WebView bridge (`send` / `request` / `onMessage` /
  `instanceId` / `windowId` / `paneId`) and the `--twopanez-*` CSS custom
  properties. The `twopanez` spelling is the wire contract; renaming it in
  code breaks every panel.
- The install path `~/Library/Application Support/AppOS/plugins/<plugin-id>/`.
- `globalThis.activate` / `globalThis.deactivate` entry points (IIFE, es2020).
- `minHostVersion` semantics: it is compared against the HOST app version
  (`1.0.0`), never the SDK version. Setting it to `"3.0.0"` because you saw
  that in the SDK is the same landmine as `"2.4.0"` was.
- The 17-type `ViewDescriptor` union and `@appos.space/view-builders`
  helper names.
