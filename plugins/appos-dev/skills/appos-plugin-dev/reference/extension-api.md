# AppOS Plugin API — SDK 3.0.0 Reference

This is the namespace-by-namespace map of the `@appos.space/plugin-types`
SDK surface. For exact type signatures, read the `plugin-api/` directory
next to this file — a byte-verbatim mirror of the published npm tarball's
`dist/*.d.ts` modules (see `plugin-api/INDEX.md` for the integrity pin).
Fast lookups:

```bash
grep -rn "interface ActionsAPI" reference/plugin-api/        # a namespace's methods
grep -n "readonly" reference/plugin-api/core.d.ts            # full PluginContext member list
grep -n "CanonicalPermissionScope" reference/plugin-api/permissions.d.ts
```

For working examples read `patterns.md` in this directory and the flagship
`appos-plugin-ytdlp` (https://github.com/appos/appos-plugin-ytdlp — public;
prefer a local clone). Canonical developer docs: https://docs.appos.space.

> **Stale-README warning:** the README packed inside the published
> `@appos.space/plugin-types@3.0.0` tarball predates the 3.0.0 surface (old
> counts, old spellings). npm tarballs are immutable, so it will stay wrong
> for the whole 3.0.0 line. Trust the `dist/*.d.ts` declarations (mirrored
> here) and this reference, never the package README.

Host version: check `/Applications/AppOS.app/Contents/Info.plist` →
`CFBundleShortVersionString` (currently `1.0.0`). `minHostVersion` in
`plugin.json` compares against THAT, never against the SDK version.

## The PluginContext

`activate(ctx)` receives a `PluginContext` exposing, as of SDK 3.0.0,
43 namespaces (of which 21 core-plugin namespaces) plus 3 typed metadata
scalars:

| Metadata | Type | Notes |
|---|---|---|
| `ctx.pluginId` | `string` | e.g. `"space.appos.ytdlp"`. |
| `ctx.pluginVersion` | `string` | from `plugin.json`. |
| `ctx.hostVersion` | `string` | host `CFBundleShortVersionString`. |

These are declared on `PluginContext` in 3.0.0 — the 2.x-era "add a local
ambient declaration for them" workaround is obsolete; delete it if your
project still carries one.

**Import model:** the package's main entry ships no ambient globals.
`import type` every SDK name you reference:

```ts
import type { PluginContext, ActionExecutionContext, DependencyStatus } from '@appos.space/plugin-types';
```

SDK 3.0.1+ also ships ONE opt-in globals subpath —
`@appos.space/plugin-types/globals` — typing the host-injected `URL`
global (AppOS hosts 1.1.0+; always guard with `typeof URL === 'function'`
— see `patterns.md` §24). It augments nothing unless a tsconfig references
it; the scaffolded `src/jsc-globals.ts` declares the same surface locally.

The surface splits into two waves:

1. **The original host namespaces** — panels, files, shell, workspaces,
   menubar, and everything else that shipped with the 2.x line (interfaces
   in `plugin-api/namespaces.d.ts`).
2. **The core-plugin namespaces** — the fn-70..fn-101 platform wave:
   durable storage, credential vault, public actions, scheduler, resources,
   entities, ledger, views, sidecars, notifications, input, webhooks, LLM,
   recipes (interfaces in `plugin-api/namespaces-core-plugins.d.ts`).

### Original host namespaces

| Namespace | Interface | Purpose | Permissions required |
|---|---|---|---|
| `ctx.commands` | `CommandsAPI` | Register commands for palette + shortcuts | (none) |
| `ctx.fileOps` | `FileOpsAPI` | Read/write/watch filesystem, active dir, move/copy/delete | `filesystem.read`, `filesystem.write`, `filesystem.watch` |
| `ctx.ui` | `UIAPI` | Panels (`registerPanel`, `registerWebPanel`, `registerActivityView`), status bar, context menus, sheets, `postToWebPanel`, `onWebPanelMessage`, `pipeShellToWebPanel`, pane tabs | `ui.*` (e.g. `ui.sidebar`, `ui.webPanel`) |
| `ctx.storage` | `StorageAPI` | Legacy synchronous KV (plaintext + keychain). For durable document/KV storage use `ctx.store` | `keychain.plugin` for secure entries |
| `ctx.settings` | `SettingsAPI` | Read/watch user-configurable settings from the manifest | (none) |
| `ctx.extensionPoints` | `ExtensionPointsAPI` | Declare/contribute extension points between plugins | `interPlugin.declare`, `interPlugin.contribute` |
| `ctx.dataContracts` | `DataContractsAPI` | Expose queryable data to other plugins | `interPlugin.declare`, `interPlugin.query` |
| `ctx.interPluginEvents` | `InterPluginEventsAPI` | Legacy pub/sub between plugins (permanent alias of the typed event bus) | `interPlugin.declare`, `interPlugin.emit` |
| `ctx.smartFolders` | `SmartFoldersAPI` | Custom filter types for smart folders | `filesystem.read` |
| `ctx.preview` | `PreviewAPI` | File preview registry queries | `filesystem.read` |
| `ctx.events` | `EventsAPI` | Host events (`menubar.clicked`, `app.willQuit`, navigation) + typed event-bus topics (`declareTopic`, `emitTopic`, `subscribeTopic`, `replay`) | per-event; topics need `events.*` scopes |
| `ctx.network` | `NetworkAPI` | HTTP fetch and file download | `network.outbound` / `network.unrestricted` |
| `ctx.shell` | `ShellAPI` | Execute allowlisted shell commands (streaming via `onData`) | `shell.execute` |
| `ctx.clipboard` | `ClipboardAPI` | System clipboard + the fn-91 history/bundles engine (see below) | `clipboard.read`, `clipboard.write`, `clipboard.history.*`, `clipboard.bundles` |
| `ctx.shortcuts` | `ShortcutsAPI` | Keyboard shortcuts bound to registered commands | `ui.shortcuts` |
| `ctx.themes` | `ThemesAPI` | Register/manage color themes | `ui.themes` |
| `ctx.workspaces` | `WorkspacesAPI` | Register/apply dual-pane workspace templates | `workspaces` |
| `ctx.cache` | `CacheAPI` | Memory+SQLite cache with TTL | `cache` |
| `ctx.feedback` | `FeedbackAPI` | Toasts, HUD, alert, adaptive notify | `feedback`, `feedback.confirm` |
| `ctx.oauth` | `OAuthAPI` | OAuth 2.0 + PKCE | `oauth`, `oauth.<provider>` |
| `ctx.menubar` | `MenubarAPI` | NSStatusItem management (`register`, `setBadge`, `setContent`) | `menubar` |
| `ctx.lifecycle` | `LifecycleAPI` | Dependency status: `getDependencyStatus()`, `recheckDependencies()`, `onDependencyStatusChanged()` — all host-wired and safe to call | (none) |

### Core-plugin namespaces

The platform wave. Deep coverage first (what App Builder plugins actually
use), then the rest. Full signatures:
`grep -n "interface <Name>API" reference/plugin-api/namespaces-core-plugins.d.ts`.

#### `ctx.actions` — Public Action Fabric (fn-89)

Typed, schema-validated, policy-bearing public actions. Pipeline per
invocation: validate → permission → approve → execute → receipt. This is
the primary way a plugin exposes capabilities to the palette, to other
plugins, and to AI agents.

The published `register` signature, verbatim:

```text
register(def: ActionDefinition, handler: (exec: ActionExecutionContext) => AnyJSONValue | Promise<AnyJSONValue>): Promise<string>;
```

The handler receives a single **execution context** — NOT the raw input:

```ts
import type { ActionExecutionContext } from '@appos.space/plugin-types';

type ConvertInput = { path: string; format?: string };

const handleToken = await ctx.actions.register(
    {
        id: 'convert-file',
        title: 'Convert File',
        inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' }, format: { type: 'string' } },
            required: ['path'],
            additionalProperties: false,
        },
        visibility: ['user', 'api', 'agent'],
        approval: 'auto',
    },
    async (exec: ActionExecutionContext) => {
        // exec: { invocationId: string, source: InvocationSource, input: AnyJSONValue, sourceId?: string }
        const input = exec.input as ConvertInput;   // assertion target MUST be a `type`, not an `interface`
        return { converted: true, path: input.path };
    },
);
```

- `exec.input` is the schema-validated input (`{}` when invoked with empty
  input). Assert it to a **`type` alias** — asserting to an `interface`
  fails `TS2352` (see `migration-2.x-to-3.0.md` §5).
- `exec.source` is the `InvocationSource` union:
  `"user" | "plugin" | "agent" | "recipe" | "sequence" | "system"`.
- `exec.sourceId` carries the originating identity when known (e.g. the
  calling plugin id); the key is absent otherwise.
- `register` resolves to a **handle token** — keep it for `unregister`.

Other methods:

| Method | Purpose | Scope |
|---|---|---|
| `registerFromCommand(commandId, metadata)` | Projects an existing `ctx.commands` command into the action catalog | `actions.register` |
| `invoke(id, input, source?)` | Invokes through the full pipeline; resolves to an `ActionReceipt` | `actions.invoke` (+ `actions.invoke.agent` for source `"agent"`) |
| `all()` | Lists the action catalog (runtime-registered only on the shipped host — see below) | `actions.list` |
| `unregister(handleToken)` | Removes an executable registration | `actions.register` |

By design `all()` also returns **manifest-only** entries (declared via
`extensions[]` but with no executable handler bound yet; invoking one
surfaces `ACTION_NOT_FOUND` until `register()` binds the handler). On the
shipped host this does NOT happen — manifest `actions.definition`
contributions never reach discovery (host bug fn-163; see the caveat
under "`extensions[]`" below), so `all()` and `palette.query()` list
runtime-registered actions only. Never write code that expects to find an
unbound manifest action in `all()`. <!-- remove when fn-163 lands -->

#### `ctx.palette` — palette integration (fn-89)

`query(text, scope?)` searches the action catalog (the fn-163 caveat
above applies — runtime-registered actions only); `pin(id)` /
`unpin(id)` manage palette pins (`palette.contribute.scope`);
`history(limit?)` returns recent invocations (`palette.history`).

#### `ctx.scheduler` — job engine (fn-90)

Trigger-kind-agnostic scheduled jobs. Built-in triggers: `interval`, `cron`
(DST-safe), `notification` (event-bus), `fsEvents`, `calendar`,
`powerState`, `networkState`, `appLaunch`. All methods require
`scheduler.job.own`.

```ts
const { token, jobId } = await ctx.scheduler.scheduleJob({
    name: 'nightly-cleanup',
    trigger: { kind: 'cron', expression: '0 3 * * *' },
    action: { kind: 'action', actionId: 'clear-completed', input: {} },
    catchupStrategy: 'skip',
});
void jobId;

// Lifecycle — all keyed by the returned owner-scoped token:
await ctx.scheduler.pause(token);
await ctx.scheduler.resume(token);
const runs = await ctx.scheduler.history(token, 10);
const next = await ctx.scheduler.nextFire(token);   // ISO 8601 or null
void runs; void next;
await ctx.scheduler.cancel(token);
```

`triggerNow(token)` fires immediately through the normal dispatch pipeline
(rate limits and conditions still apply). `update(token, mutation)` mutates
a job in place.

#### `ctx.notifications` — outbound notifications (fn-97)

The single outbound notification surface. Emitters **never choose a
channel** — user-authored routing rules plus the host filter chain (quiet
hours → dedupe → rate limit → custom) decide delivery. Requires
`notifications.emit` — and because emits route through the fn-89 Invoker,
the manifest must ALSO declare `actions.invoke` and a dependency on
`space.appos.core.notifications` (the manifest validator enforces this
chain).

```ts
const handle = await ctx.notifications.emit({
    level: 'info',
    title: 'Download complete',
    body: 'video.mp4 finished downloading.',
    category: 'downloads',
});

// cancel() returns boolean UNIFORMLY: false collapses missing / foreign /
// already-terminal handles (anti-enumeration) — it never throws for those.
const cancelled = await ctx.notifications.cancel(handle.notificationId);
void cancelled;
```

`history(filter?)` reads your own delivery log (`notifications.log.read`).
`onAction(categoryId, actionId, handler)` subscribes to notification action
buttons — SYNCHRONOUS, returns a `SubscriptionHandle` (`.cancel()`).
Channel/filter contributors bind runtime handlers via
`ctx.notifications.channels.bind(...)` / `ctx.notifications.filters.register(...)`
— these require a matching manifest `extensions[]` contribution. QUIRK: the
channel unbind method is `unbindChannel(channelId)` (`unbind` collides with
an `NSObject` selector in JSExport). `.agent`-sourced emits currently fail
with `notifications:agentAttributionUnavailable` (host limitation until
fn-121).

#### `ctx.clipboard.history` / `ctx.clipboard.bundles` — clipboard engine (fn-91)

The legacy `ctx.clipboard.read()/write()` surface gained engine
sub-namespaces (typed on `ClipboardAPI` in `namespaces.d.ts`):

- `history.query(filter)` / `get(id)` / `delete(id)` / `favorite(id, flag)` /
  `tag(id, tags)` — search and curate capture history
  (`clipboard.history.read` / `clipboard.history.write`).
- `history.subscribe(handler)` — capture events; resolves to a handle with
  `cancel()` (`clipboard.history.subscribe`).
- `bundles.create/update/addClip/removeClip/list/get/delete` and
  `bundles.export(bundleId, format)` with `"markdown" | "json" | "xml" |
  "plainText"` — Context Bundles for AI-agent injection (`clipboard.bundles`).
- `paste(clipId, destinationId)` / `listDestinations()` / `ingest(kind,
  content, metadata?)` — programmatic paste + ingestion.
- Contributor sub-bridges: `transforms.register`, `rules.register`,
  `retentionPredicates.register` (executable), `sources.register` /
  `destinations.register` (declarative-only in v1). Each resolves to a
  handle with `cancel()`.

Anti-enumeration: read-shaped denials degrade (`[]` / `null`); write/export
denials throw sanitized `unknownRef`-class errors.

#### `ctx.store` — durable storage (fn-71)

Promise-shaped document + KV storage — the storage plane every core plugin
builds on. Prefer it over `ctx.storage`/`ctx.cache` for anything durable or
queryable. Scopes: `store.namespace.own`, `store.namespace.declare`,
`store.namespace.shared.read`, `store.namespace.enumerate`.

```ts
await ctx.store.declareNamespace({ name: 'myplugin:library' });
await ctx.store.put('myplugin:library', 'entry-1', { title: 'Video', favorite: false });
const doc = await ctx.store.get('myplugin:library', 'entry-1');   // AnyJSONValue | null
const hits = await ctx.store.query('myplugin:library', { favorite: true });
void doc; void hits;
await ctx.store.setKV('myplugin:library', 'lastSync', new Date().toISOString());
```

QUIRK: the import method is `importData(namespace, data)` — `import` is a
reserved word. `export(namespace)` returns base64 JSONL.

#### The rest of the platform wave (one paragraph each)

- **`ctx.vault`** (`VaultAPI`, fn-72) — credential vault. Raw material
  transits your JS isolate exactly once, at `store(kind, label, material)`
  (you supply the secret); after storage it is never re-exposed to JS —
  there is no read-back API. `store()` returns an opaque `CredentialRef`;
  `use(refId, purpose, body)` runs a scoped callback over an opaque
  handle; `buildRequest`/`injectHeader` produce server-held request ids
  for `network`, so raw tokens never return to JS. Anti-enumeration on
  unknown refs. Scopes: `vault.store`, `vault.read`, `vault.list`,
  `vault.share`, `vault.audit`, contributor `vault.*.register`.
- **`ctx.resources`** (`ResourcesAPI`, fn-92) — URI-addressable shared read
  plane (`scheduler://job/{id}`, `workspace://active`, ...). `register` a
  provider (or `beginBatch` for atomic multi-provider registration),
  `resolve(uri)` with SWR caching, `watch(uri, handler)` (200ms coalesced),
  `notifyChange(token, uri)` to signal invalidation. Scopes:
  `resources.provider.register`, `resources.read`, `resources.watch`.
- **`ctx.tokens`** (`TokensAPI`, fn-92) — dotted-path template values:
  `resolveString('Report for {{project.name}}')`, `resolveJson` preserving
  JSON types, `registerProvider(prefix, provider, resolver)`. Scopes:
  `tokens.provider.register`, `resources.read`.
- **`ctx.bundles`** (`BundlesAPI`, fn-92) — frozen-at-compose ContextBundle
  snapshots of resources + tokens: `compose`, `get` (owner-only), `hash`
  (deterministic), `elevate` (mints a 5-minute `ElevationTicket` for
  elevated resources like `vault://`), `readBlob`. Scope: `context.compose`.
  QUIRK: distinct from `ctx.clipboard.bundles` (fn-91) — same word, different
  plane.
- **`ctx.entities`** (`EntitiesAPI`, fn-93) — universal entity plane
  (`project`, `workspace`, `scheduler.job`, `clipboard.clip`,
  `clipboard.bundle`, `vault.credential`): `getType`/`listTypes`,
  `get`/`query` (operator-allowlisted envelope, cursor pagination),
  `watch`/`unwatch`, `upsert`. There is deliberately NO `delete`. Scopes:
  `entities.read`, `entities.write`, `entities.type.register`.
- **`ctx.fields`** (`FieldsAPI`, fn-93) — plugin-attached fields over
  entities: `attach`/`detach`, `listAttachments`,
  `registerComputedProvider`, `setValue`/`clearValue`/`getValue`. Field
  TYPE registration is manifest-declarative only. Scopes:
  `entities.field.attach.own`, `entities.field.attach.shared`,
  `entities.computedField.provide`.
- **`ctx.ledger`** (`LedgerAPI`, fn-94) — the forensic execution/approval
  ledger: `query`/`get`, `subscribe`/`unsubscribe`, and the ONE legal
  mutation `markKeepForever(recordId)` (one-way pin). Calls before
  activation completes reject `LEDGER_NOT_AVAILABLE`. Scopes:
  `ledger.read.own`, `ledger.read.shared`.
- **`ctx.views`** (`ViewsAPI`, fn-95) — host-rendered Saved Views over
  entities: `register(definition)`, `query(viewId)` (cached,
  single-flight), `subscribe`, `refreshNow`, `renderIntoPanel(viewId,
  panelId, target)`. QUIRK: `invokeRow` ALWAYS rejects `notSupportedV1`.
  Scopes: `views.register`, `views.read`.
- **`ctx.surfaces`** (`SurfacesAPI`, fn-95) — QUIRK: the v1 runtime bridge
  is a stub — all 3 methods reject `notAvailableForJSPlugins`. Contribute
  surfaces via the manifest `extensions[]` path instead (per-surface scopes
  `surfaces.contribute.*`).
- **`ctx.protocols`** (`ProtocolsAPI`, fn-96) — host-supervised sidecar
  subprocesses with MCP/LSP wrappers: `registerSidecar(definition)`,
  `call`/`callStreaming`, `subscribe`/`unsubscribe`, `getSidecar`
  (anti-enum read gate). First spawn is user-approved; binaries are
  SHA-256-pinned at consent. Scopes: `sidecars.definition.register`,
  `sidecars.instance.start`, `sidecars.instance.stop`,
  `sidecars.protocol.wrap`.
- **`ctx.input`** (`InputAPI`, fn-98) — inbound mirror of notifications:
  external messages → parsed intents. `onMessage`/`onIntent`/
  `onNotificationReply` (synchronous `SubscriptionHandle`s), `reply`,
  `replyToNotification(correlationId, ...)`, `recent` (hard ceiling 1000
  with `truncated` flag), contributor sub-bridges `channels`/`parsers`/
  `intents`/`auth`. QUIRK: channel unregister is `unregisterChannel`.
  Scopes: `input.subscribe.messages`, `input.subscribe.intents`,
  `input.reply`, `input.*.register`.
- **`ctx.webhook`** (`WebhookAPI`, fn-99) — bidirectional HTTPS:
  `registerRoute(spec, handler)` for inbound (handler returns a
  `WebhookHTTPResponse`), `send` (awaits the durable retry terminal —
  two-phase), `enqueue` (fire-and-forget durable), `currentPublicURL()`
  (`webhook.tunnel.read`), `deliveries(routeHandleId, limit?)`. There is NO
  `replay` on the JS bridge (admin-only). Scopes: `webhook.route.register`
  (+ `.unsigned`), `webhook.outbound.send`, `webhook.log.read`.
- **`ctx.llm`** (`LLMAPI`, fn-100) — engine-direct LLM verbs: `complete`,
  `stream` (resolves to `{ result, cancel }`), `embed`, `vision`, `agent`,
  `usage`. Contributor registries `providers`/`preprocessors`/
  `postprocessors`/`routers` — QUIRK: provider `register` is async
  (durable); the other three are SYNCHRONOUS (in-memory). Scopes: one per
  verb (`llm.complete`, `llm.stream`, `llm.embed`, `llm.vision`,
  `llm.agent`), `llm.ledger.read`, `llm.*.register`.
- **`ctx.recipes`** (`RecipesAPI`, fn-101) — author-declared multi-step
  plans: `register`, `run({ recipeRef, args? })`, `list`, `get`, and the
  `triggers` sub-bridge. Runs dispatch through the fn-89 Invoker (per-step
  receipts). Scopes: `recipes.register`, `recipes.run`.
- **`ctx.sequences`** (`SequencesAPI`, fn-101) — linear / LLM-agent
  sequence runs: `register`, `run({ sequenceRef, ... })`, `resume({ runId })`,
  `cancel({ runId })`. QUIRK: `list` and `get` ALWAYS reject
  `notSupportedV1`. Scopes: `sequences.register`, `sequences.run`.
- **`ctx.fileSystem`** (`FileSystemAPI`) — QUIRK: BOTH methods throw
  `NOT_AVAILABLE_FOR_JS_PLUGINS`; VFS/transfer-strategy providers are
  core-swift-only. Typed so the surface matches the host export.

## `extensions[]` — manifest-declarative contributions

The `extensions` array in `plugin.json` is the manifest-declarative
delivery vehicle for core-plugin extension points. Each entry requires an
`extensionPoint` (the qualified id) and carries an EP-specific payload,
conventionally under `contribution`:

```json
{
    "extensions": [
        {
            "extensionPoint": "space.appos.core.notifications:channel",
            "contribution": {
                "id": "pushover",
                "displayName": "Pushover",
                "configSchema": { "type": "object" }
            }
        },
        {
            "extensionPoint": "actions.definition",
            "contribution": {
                "id": "downloadUrl",
                "displayName": "Download Media URL",
                "inputSchema": { "type": "object", "properties": { "url": { "type": "string" } }, "required": ["url"] },
                "visibility": ["palette", "api", "agent"],
                "approval": "auto"
            }
        }
    ]
}
```

- Core-plugin EPs use qualified ids `<corePluginId>:<epLocalId>` — e.g.
  `space.appos.core.recipes-sequences:recipes.definition`,
  `space.appos.core.notifications:channel`. The fn-89 action catalog EP is
  `actions.definition`.
- The schema (`schemas/plugin-v1.json` in the plugin-sdk repo) requires
  `extensionPoint` and allows additional EP-specific properties.
- Contributions require the matching `*.register`-class permission scope
  (e.g. a `notifications.channel` contribution needs
  `notifications.channel.register`).
- Declarative-only EPs (e.g. `surfaces.contribution`, field types,
  clipboard sources/destinations) work with NO runtime call. Handler-backed
  EPs (notification channels/filters, input parsers) additionally bind
  their executable at runtime (`ctx.notifications.channels.bind(...)`, etc.).
- A fully-declarative reference: the MorningBrief recipe fixture in the
  AppOS repo — its manifest carries recipe + sequence + trigger
  contributions and its `activate` is a no-op.

> **Caveat — manifest-declared ACTIONS don't reach discovery yet (host bug
> fn-163).** An `actions.definition` contribution alone currently never
> becomes palette-visible or invokable. Pair EVERY `actions.definition`
> contribution with a runtime `ctx.actions.register(...)` or
> `ctx.actions.registerFromCommand(...)` call — dual registration, exactly
> as `appos-plugin-ytdlp` ships it. <!-- remove when fn-163 lands -->

## Catalog bundle layout

A dev tree keeps `plugin.json` at the plugin root — that is what local and
sideload installs load. Bundles published to the AppOS catalog use **AppOS
Catalog Bundle Layout v1**, which carries TWO manifests because the
catalog's submit validation and the desktop installer read different
schemas:

- `manifest.json` at the **zip root** — the catalog `manifest-v1` document
  (`schema`, `slug`, `kind`, `version`, `title`, `license`, `capabilities`,
  `permissions`, `compatibility`, `entry`; unknown keys rejected).
  Validated at publish time.
- `appos/runtime/plugin.json` — the AppOS runtime manifest (the schema this
  reference documents). Read by the desktop app at install time.

```text
space-appos-myplugin-1.0.0.zip
├── manifest.json            # catalog manifest-v1
├── appos/
│   └── runtime/
│       └── plugin.json      # AppOS runtime manifest
├── dist/
│   └── main.js              # runtime payload at the zip root
└── webview/  assets/  README.md  LICENSE  ...
```

Rules:

- **Installer resolution is root-first.** A root `plugin.json` always wins;
  otherwise the installer consults the single well-known fallback
  `appos/runtime/plugin.json` and copies it to the bundle root at install
  time ("normalize-at-install"); neither present fails the install with
  `manifestMissing`. No globbing — the fallback is one constant path.
- **Runtime-manifest paths are relative to the ZIP ROOT**, not to
  `appos/runtime/` — e.g. `"entrypoint": "dist/main.js"`.
- **Exactly one catalog-manifest candidate.** Nothing named `plugin.json`
  or `manifest.json` may exist at the zip root or one level deep except the
  single catalog manifest (submit rejects `no_manifest` /
  `ambiguous_bundle_root`). Depth 2 keeps the runtime manifest invisible to
  that scan.
- **Verification precedes manifest resolution.** SHA-256 (both install
  paths) and, on the catalog path, the publisher-verified gate + Ed25519
  signature check run before extraction.
- A dev-layout bundle (root `plugin.json`, no `manifest.json`) installs
  locally but is NOT publishable: its root `plugin.json` would be selected
  as the catalog-manifest candidate and fail `manifest-v1` validation.

## Permissions

The host recognizes 135 canonical permission scopes as of SDK 3.0.0
(`CanonicalPermissionScope` in `plugin-api/permissions.d.ts` — the complete
union, regenerated from the host's `PermissionScope.allKnown`), plus one
dynamic `oauth.<provider>` family. Only request what you use.

Families at a glance (representative scopes; the d.ts is the full list):

- **UI** — `ui.sidebar`, `ui.webPanel`, `ui.statusBar`, `ui.toolbar`,
  `ui.contextMenu`, `ui.notifications`, `ui.sheets`, `ui.shortcuts`,
  `ui.themes`, `ui.preview`, `ui.aiChat`, `ui.settings`
- **Filesystem / shell / clipboard / network** — `filesystem.read`,
  `filesystem.write`, `filesystem.watch`, `filesystem.readAll`,
  `filesystem.writeAll`, `shell.execute`, `clipboard.read`,
  `clipboard.write`, `network.outbound`, `network.unrestricted`
- **Legacy inter-plugin + app services** — `interPlugin.*`, `workspaces`,
  `cache`, `feedback`, `feedback.confirm`, `keychain.plugin`, `menubar`,
  `menubar.globalShortcut`, `oauth`
- **Event bus (fn-70)** — `events.topic.declare`, `events.emit`,
  `events.subscribe`, `events.replay`, `events.inspect`, contributor
  `events.{serializer,sink}.register`
- **Store / vault (fn-71/72)** — `store.namespace.*`,
  `store.{backend,migrator,indexer}.register`, `vault.*`
- **Actions / palette (fn-89)** — `actions.register`, `actions.invoke`,
  `actions.invoke.agent`, `actions.list`, `palette.contribute.scope`,
  `palette.history`
- **Scheduler (fn-90)** — `scheduler.job.own`, `scheduler.job.enumerate`,
  `scheduler.{trigger,condition,action}.register`
- **Clipboard engine (fn-91)** — `clipboard.history.*`,
  `clipboard.bundles`, `clipboard.*.register`
- **Context graph (fn-92)** — `resources.provider.register`,
  `resources.read`, `resources.watch`, `tokens.provider.register`,
  `context.compose`
- **Entities / ledger / views (fn-93/94/95)** — `entities.*`,
  `ledger.read.own`, `ledger.read.shared`, `views.register`, `views.read`,
  `views.layoutRenderer.register`, `surfaces.contribute.*`
- **Sidecars / notifications / input / webhook (fn-96..99)** —
  `sidecars.*`, `notifications.*`, `input.*`, `webhook.*`
- **LLM / recipes (fn-100/101)** — `llm.*`, `recipes.register`,
  `recipes.run`, `sequences.register`, `sequences.run`

### Deprecated legacy aliases

The SDK's `LegacyPermissionScope` union carries five legacy names for
compile-time compatibility, but only ONE of them is actually accepted by
the host: `network.fetch`, which the host's alias map normalizes to
`network.outbound` at manifest parse time. The other four exist only in
the TYPE union — they have no host-side entry, so declaring them grants
nothing. Never use any of the five in new plugins; migrating plugins must
REPLACE the four dead names with canonical scopes (only `network.fetch` is
merely tolerated):

| Alias | Host behavior |
|---|---|
| `network.fetch` | The one real alias — normalized to `network.outbound` at manifest parse time |
| `network` | SDK-type-only; no host-side entry, never granted. Use `network.outbound` |
| `smartFolders` | SDK-type-only; no host-side entry, never granted. Smart folders need `filesystem.read` |
| `webview` | SDK-type-only; no host-side entry, never granted. Use `ui.webPanel` |
| `shell.uncontained` | NOT declarable — the T2 uncontained tier is inferred from `filesystem.readAll`, never requested |

### `{ scope, reason }` entries

`permissions` accepts bare strings or object entries; the optional `reason`
(max 120 chars) shows as a tooltip in the approval sheet:

```json
{
    "permissions": [
        "ui.webPanel",
        { "scope": "shell.execute", "reason": "Runs yt-dlp to download media you request" },
        { "scope": "filesystem.write", "reason": "Saves downloads into your chosen folder" }
    ]
}
```

**If you declare `shell.execute`**, you MUST also declare
`"shellCommands": ["..."]` with the exact binaries the plugin invokes — the
sandbox blocks anything not in that list.

## ViewDescriptor types

The SDK defines **17 ViewDescriptor types**:

**Layout** — `vstack`, `hstack`, `scroll`, `list`, `grid`
**Content** — `text`, `label`, `image`, `remoteImage`, `badge`
**Interactive** — `button`, `listItem`, `textField`, `progress`
**Structural** — `section`, `divider`, `spacer`

Each has a `type` discriminator and a typed `properties` object (full
signatures in `plugin-api/views.d.ts`). `listItem` also supports `children`
for trailing inline columns. `menuActions` on `listItem` is a **JSON
string**, not an array — build it with `encodeMenuActions()` from
`@appos.space/view-builders`.

Notable properties:

- **`grid`** — `columns` (default 3), `spacing` (default 8)
- **`remoteImage`** — `url` (file:// only in v1), `width`, `height`,
  `cornerRadius`, `maxDimension` (default 512)
- **`textField`** — `placeholder`, `text` (initial contents), `action`
  (fires on submit). Divergence: SDK 3.0.0 (`TextFieldDescriptor` and the
  `textField()` builder) names the initial-contents property `text`, but
  the shipped 1.0.0 host reads `value` — typed `text` compiles yet
  renders empty today, while `value` fails excess-property checking. To
  seed initial contents on today's host, include BOTH keys via an
  assertion-cast properties object. <!-- collapse to `text`-only when the
  host reads `text` -->
- **`progress`** — `value` (0–1, omit for indeterminate), `label`,
  `style` (`"bar"` | `"circular"`)
- **`listItem`** — `title`, `subtitle`, `icon`, `iconColor`, `action`,
  `trailing`, `menuActions`; `MenuAction`: `{ title, icon?, action?, destructive? }`

## Plugin manifest (`plugin.json`)

Field summary (schema: `schemas/plugin-v1.json` in the plugin-sdk repo;
manifest docs: https://docs.appos.space/manifest/):

- `id` — reverse-domain (`space.appos.*` flagship, `com.community.*`
  community; `space.appos.core.*` is host-reserved)
- `name`, `version`, `runtime: "javascript"`, `entrypoint`
- `minHostVersion` — the host `CFBundleShortVersionString`, NOT the SDK
  version. Default `"1.0.0"`.
- `author`, `description`, `license`, `homepage`, `repository`
- `activation.events` — currently only `"onStartup"`
- `permissions` — strings or `{ scope, reason }` objects (see above)
- `extensions` — core-plugin EP contributions (see above)
- `extensionPoints`, `dataContracts` — legacy inter-plugin declarations
- `shellCommands` — binary allowlist when `shell.execute` is declared
- `shellDeniedPatterns` — custom regex denials, merged with built-in
  defaults (never replacing them); invalid regexes logged and skipped
- `networkDomains` — hostname allowlist when `network.outbound` is declared
- `dependencies.system[]` / `dependencies.plugins[]` — see below
- `settings[]` — user-configurable settings (`string`, `enum`, `bool`, `number`)
- `oauth.providers[]`, `menubar.icon`, `menubar.label`
- `scope` — `"app"` (default) or `"window"` (per-window instance, JS only)
- `isolation` — `"jscontext"` (default) or `"xpc"` (future)
- `categories`, `keywords` — catalog metadata

## Plugin dependencies

```json
{
    "dependencies": {
        "system": [
            {
                "name": "yt-dlp",
                "required": true,
                "check": {
                    "command": "yt-dlp",
                    "args": ["--version"],
                    "versionPattern": "(\\d{4}\\.\\d{2}\\.\\d{2})"
                },
                "minVersion": "2024.08.06",
                "installHint": "brew install yt-dlp",
                "installUrl": "https://github.com/yt-dlp/yt-dlp#installation",
                "description": "Video downloader"
            }
        ],
        "plugins": [
            { "id": "com.community.shared-utils", "minVersion": "1.0.0", "required": false }
        ]
    }
}
```

`check.command` MUST be in the `shellCommands` allowlist (otherwise status
is `"command_not_allowed"`). `versionPattern` uses one capture group. The
host probes at activation and pushes `DependencyStatus[]` via
`ctx.lifecycle.onDependencyStatusChanged`; `getDependencyStatus()` reads on
demand; `recheckDependencies()` re-probes (wire it to a "Re-check" button).
Subscribe FIRST, then do the initial read — canonical ordering from
`appos-plugin-ytdlp`.

`DependencyStatus`: `{ name, type: 'system' | 'plugin', required,
satisfied, state, installedVersion?, requiredVersion?, installHint?,
installUrl?, description?, unsatisfiedReason?, causalChain? }` with
`state: 'not_found' | 'installed' | 'installed_version_unknown' |
'permission_denied' | 'command_not_allowed'`.

## Workspaces

`ctx.workspaces.register(template)` registers a dual-pane layout; the
argument is `Partial<WorkspaceTemplate> & { id, name }` (the `source` field
is auto-stamped — do not pass it). Returns `Promise<string>` (the workspace
id). Apply via `ctx.workspaces.apply(id)` unconditionally at the end of
`activate()` — do NOT gate on a first-run cache flag (documented landmine:
"plugin installed but invisible" from the second launch on). `apply()`
resolves `false` (not an error) when no browser window is frontmost —
always add a `ctx.ui.showPaneTab()` fallback. See `patterns.md` §6.

## Menu bar

`ctx.menubar.register({ icon, label? })` creates the NSStatusItem. **You
MUST call `ctx.menubar.setContent(viewDescriptor)`** — without it, clicking
the icon shows a "No content" popover. `setBadge(count)` updates the badge
(0 clears). Subscribe to clicks via
`ctx.events.subscribe('menubar.clicked', handler)` (returns a token;
`ctx.events.unsubscribe(token)` to clean up). Drive `setBadge` +
`setContent` reactively from your state subscriber.

## Smart folders

`ctx.smartFolders.registerFilterType({ id, displayName, editorConfig?,
evaluate })` — the `evaluate` closure runs **synchronously** per item
`{ url, metadata }` in your JSC isolate; keep it cheap (build lookup Maps
on state change). Returns `Promise<string>` (id auto-prefixed
`{pluginId}.filter.`). No unregister API — filters auto-clean on
deactivation; guard late calls with a `disposed` flag.

## Cache

`ctx.cache.get(key)` returns the **deserialized** value (no `JSON.parse`).
`ctx.cache.set(key, value, { persist: true, ttl: 3600 })` — `ttl` in
seconds; default is memory-only, pass `persist: true` for durability.

## Feedback

- `ctx.feedback.toast(message, { kind })` — toast (`'info' | 'success' | 'warning' | 'error'`)
- `ctx.feedback.hud(message, { kind?, progress? })` → handle id;
  `updateHud(id, { progress?, message? })`; `dismissHud(id)`
- `ctx.feedback.alert(message, { informativeText?, buttons?, style? })` →
  0-based button index; requires `feedback.confirm`
- `ctx.feedback.systemNotification(title, message, { kind? })`
- `ctx.feedback.notify(message, { kind? })` — adaptive: focused → toast,
  unfocused → HUD, background → system notification

For routed, rule-driven notifications (user-configurable channels), use
`ctx.notifications.emit` instead — `ctx.feedback` is always-local.

## WebView panels

WebView panels render HTML/CSS/JS in a WKWebView via the `plugin-panel://`
scheme. Permission: `ui.webPanel`. Limits: max 2 WebView panels per plugin,
6 globally.

The 5 APIs on `ctx.ui` (registration/handler tokens are types-only on
the 1.0.0 host — see the disposal note below the list):

1. **`registerWebPanel(id, options)`** → typed as a registration id
   (`string`), `undefined` on the 1.0.0 host. `WebPanelOptions`:
   `title` (required), `htmlPath` (required, relative to plugin root, no
   `..`), `icon?`, `width?`, `allowNavigation?` (default false). The `id`
   is SHORT — the runtime prefixes `{pluginId}.`.
2. **`postToWebPanel(panelId, message, options?)`** — JSON message to all
   active instances (`{ instanceId }` targets one; max 1MB).
3. **`onWebPanelMessage(panelId, handler)`** → typed as a handler token
   (`string`), `undefined` on the 1.0.0 host. Envelope:
   `{ data, instanceId, windowId, paneId }`. One handler per panelId —
   re-registering replaces.
4. **`onWebPanelRequest(panelId, handler)`** → typed as a handler token
   (`string`), `undefined` on the 1.0.0 host. Handler returns a
   value or Promise (10s timeout) sent back as the `request()` result.
5. **`pipeShellToWebPanel(panelId, shellOptions)`** — spawns a process and
   streams `{ stream, data, bytesTotal }` chunks directly to the panel's
   instances; resolves with the final `ShellExecuteResult`. **Lives on
   `ctx.ui`, NOT `ctx.shell`.** Requires `ui.webPanel` + `shell.execute`;
   120s hard cap.

**Disposal.** SDK 3.0.0 TYPES `registerWebPanel` / `onWebPanelMessage` /
`onWebPanelRequest` as returning string tokens, but the shipped AppOS
1.0.0 host returns `undefined` from all three at runtime (host↔d.ts
reconciliation is a known SDK follow-up). Capture the tokens for
type-compat, but do NOT build teardown on the runtime values —
`ctx.ui.unregister(panelToken)` is `unregister(undefined)` on the 1.0.0
host, which cannot unregister the panel and may throw. `ctx.ui.unregister`
accepts only slot-based contribution ids from the other `ctx.ui`
registration kinds (structured panels, toolbar/status items), never
WebPanel registration or handler tokens — there is no handler-unregister
API either way. The host removes the panel and its handlers automatically
on plugin unload; a `disposed` flag guard is the mid-life teardown
mechanism. See `migration-2.x-to-3.0.md` §4 and `patterns.md` §6.

### WebView-side bridge (`window.twopanez`)

The host injects `window.twopanez` into every plugin WebView:

| Member | Description |
|---|---|
| `window.twopanez.send(msg)` | Fire-and-forget → `onWebPanelMessage` |
| `window.twopanez.request(msg)` | Request/response → `onWebPanelRequest`, returns a Promise |
| `window.twopanez.onMessage(fn)` | Inbound pushes from `postToWebPanel` AND `pipeShellToWebPanel` chunks |
| `window.twopanez.instanceId` | Per-WKWebView UUID (multi-instance isolation) |
| `window.twopanez.windowId` | App window id |
| `window.twopanez.paneId` | `"left"` or `"right"` |

Shell chunks arrive via `onMessage` alongside protocol messages — filter in
the bridge: chunks have `{ stream, data, bytesTotal }` and no `v`/`type`.

The published SDK does not type `window.twopanez` (WebView code is a
separate compilation world). For typed WebView TypeScript, ship a local
ambient declaration:

```ts webview
// webview/twopanez.d.ts — ship alongside your webview sources.
// The host injects window.twopanez at runtime; the SDK does not type it.
interface TwopanezBridge {
    send(message: unknown): void;
    request(message: unknown): Promise<unknown>;
    onMessage(handler: (message: unknown) => void): void;
    readonly instanceId: string;
    readonly windowId: string;
    readonly paneId: 'left' | 'right';
}
declare global {
    interface Window { readonly twopanez: TwopanezBridge; }
}
export {};
```

### CSP constraints

Content served via `plugin-panel://` has a CSP that **blocks inline
`<script>` and `<style>`**. All JS/CSS must be external files:

```html
<!-- CORRECT: external files -->
<script type="module" src="app.js"></script>
<link rel="stylesheet" href="styles.css">

<!-- WRONG: inline — blocked by CSP, WebView renders blank -->
<script>console.log('blocked')</script>
<style>body { color: red; }</style>
```

### CSS custom properties

The host injects design tokens into every plugin WebView; they update live
on theme change:

| Property | Description | Default value |
|---|---|---|
| `--twopanez-bg` | Window background | `#0D1117` |
| `--twopanez-bg-sidebar` | Sidebar background | `#0A0E14` |
| `--twopanez-bg-control` | Control background | `#1C2128` |
| `--twopanez-bg-surface` | Surface background | `#161B22` |
| `--twopanez-bg-elevated` | Elevated surface | `#262C36` |
| `--twopanez-accent` | Cyan accent | `#00D9FF` |
| `--twopanez-accent-cortex` | Magenta accent | `#BD00FF` |
| `--twopanez-accent-pulse` | Amber accent | `#FF6B35` |
| `--twopanez-accent-signal` | Green accent | `#00FF9F` |
| `--twopanez-accent-warning` | Gold warning | `#FFB800` |
| `--twopanez-accent-error` | Red error | `#FF3366` |
| `--twopanez-text` | Primary text | `#E6EDF3` |
| `--twopanez-text-secondary` | Secondary text | `#8B949E` |
| `--twopanez-text-muted` | Muted text | `#484F58` |
| `--twopanez-text-ghost` | Ghost text | `#30363D` |

```css
body {
    background-color: var(--twopanez-bg);
    color: var(--twopanez-text);
}
.button { background-color: var(--twopanez-accent); }
```

## Streaming shell output

`ctx.shell.execute()` supports an `onData` callback for real-time
streaming. The final Promise still resolves with the buffered result
(10MB truncation); `onData` sees all data including bytes beyond the
threshold. `ShellDataChunk`: `{ stream: "stdout" | "stderr", data: string,
bytesTotal: number }`.

```ts
import { urlToPath } from '@appos.space/plugin-utils';

declare const outputDir: string;
declare function updateProgress(fraction: number): void;

// Buffered (default) — T1 plugins: cwd must be within active pane roots
const activeDir = await ctx.fileOps.getActiveDirectory();
const version = await ctx.shell.execute({
    command: 'yt-dlp', args: ['--version'],
    cwd: activeDir ? urlToPath(activeDir) : undefined,
});
console.log(version.stdout.trim());

// Streaming — provide onData for real-time progress
await ctx.shell.execute({
    command: 'yt-dlp',
    args: ['--ignore-config', '--progress', '--newline', 'https://example.com/video'],
    cwd: outputDir,
    onData: (chunk) => {
        if (chunk.stream === 'stdout') {
            const match = chunk.data.match(/(\d+\.?\d*)%/);
            if (match) updateProgress(parseFloat(match[1]) / 100);
        }
    },
});
```

Chunks arrive on the plugin's serial queue; if `onData` throws, the error
is logged and streaming continues (best-effort). Order is preserved
per-stream; stdout/stderr interleaving is OS-dependent.

## Shell security tiers

| Tier | Name | When | CWD restriction | Denied patterns | Allowlist |
|---|---|---|---|---|---|
| T0 | none | No `shell.execute` declared | N/A (calls rejected) | N/A | N/A |
| T1 | contained | JS plugins with `shell.execute` but no filesystem-wide perms | CWD must be within active pane roots; `cwd` is **required** (omitting throws) | Enforced: destructive commands (`rm -rf`, `dd`, `shutdown`, ...) blocked; metacharacter patterns checked when the command is a shell interpreter | Enforced |
| T2 | uncontained | Core-swift plugins or JS with `filesystem.readAll`/`writeAll` | None | Skipped | Enforced |

All tiers enforce the `shellCommands` allowlist. `shellDeniedPatterns`
adds custom regex guards, merged with (never replacing) the built-ins.

## `@appos.space/plugin-utils` — and the `ActionHandler` name collision

Pure runtime helpers: `urlToPath`, `pathToUrl`, `fileExtension`,
`isTextFile`, `formatSize`, `formatDate`, `truncate`, `generateId`,
`simpleHash`, `debounce`, `throttle`, `createActionRouter`.

> **Disambiguation:** `plugin-utils` exports
> `type ActionHandler = (arg: string) => void | Promise<void>` — the
> handler type for `createActionRouter`, which routes **ViewDescriptor
> action strings** (`'open:entry-1'`) from panel `handler` callbacks. It is
> NOT an fn-89 public-action handler — those receive
> `(exec: ActionExecutionContext)`. Same word, two different planes; don't
> pass one where the other is expected.

## Where to find exact signatures

Read the `plugin-api/` mirror in this directory (byte-verbatim from the
published tarball; `INDEX.md` records version + integrity):

- `core.d.ts` — `PluginContext` (every namespace property + metadata)
- `namespaces.d.ts` — the original host namespace interfaces + option types
- `namespaces-core-plugins.d.ts` — the core-plugin wave interfaces
  (`ActionsAPI`, `SchedulerAPI`, `NotificationsAPI`, ...)
- `permissions.d.ts` — `CanonicalPermissionScope`, `LegacyPermissionScope`,
  `PermissionEntry`
- `views.d.ts` — the ViewDescriptor discriminated union + `MenuAction`
- `colors.d.ts` / `fonts.d.ts` / `icons.d.ts` — design-token unions

For patterns, read `patterns.md`; for 2.x migration,
`migration-2.x-to-3.0.md`.
