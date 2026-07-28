/**
 * Core-plugin namespaces added in host waves fn-70 .. fn-101 (+ fn-118).
 *
 * Generated against the host's Swift JSExport protocols (ground truth:
 * `Sources/TwoPanez/Services/Plugins/PluginContextBridge.swift`
 * `PluginContextExport` and the per-plugin bridge files). The host's own
 * `plugin-api.d.ts` has known drift (fn-150) — the Swift protocols win.
 *
 * All Promise-returning methods reject with sanitized errors; the platform
 * anti-enumeration convention applies throughout: read-shaped denials
 * degrade (`[]` / `null` / `false` / `unknownRef`), mutation-shaped denials
 * throw sanitized errors.
 *
 * @version 3.0.0
 * @since host 1.0.0 (AppOS launch baseline)
 */
/** Any JSON-serializable value crossing the JS ⇄ Swift bridge. */
export type AnyJSONValue = null | boolean | number | string | AnyJSONValue[] | {
    [key: string]: AnyJSONValue;
};
/** A cancellable registration returned by `.register(...)`-style methods. */
export interface CancellableRegistration {
    /** Cancels/unregisters this contribution. */
    cancel(): Promise<void>;
}
/** Synchronous subscription handle returned by `on*`-style methods. */
export interface SubscriptionHandle {
    /** Cancels the subscription. */
    cancel(): void;
}
/**
 * Reference to a blob held by a plugin-scoped BlobStore (fn-91 pattern).
 * Payloads above the owner store's inline threshold live in sidecar files.
 */
export interface BlobRef {
    /** Opaque blob reference id. */
    refId: string;
    /** Owning plugin id (blob is read THROUGH the owner's BlobStore). */
    ownerPluginId?: string;
    /** Content hash, when known. */
    hash?: string;
    /** Byte size, when known. */
    size?: number;
}
/** Namespace declaration spec for `store.declareNamespace`. */
export interface StoreNamespaceSpec {
    /** Namespace name (e.g., "myplugin:cache"). */
    name: string;
    /** Optional JSON schema for documents in this namespace. */
    schema?: AnyJSONValue;
    /** Retention/compaction hints. */
    retention?: AnyJSONValue;
}
/**
 * Durable, Promise-shaped document + KV storage (fn-71). This is the storage
 * plane every core plugin builds on. `context.storage` remains the legacy
 * synchronous KV tier.
 *
 * Scopes: `store.namespace.own`, `store.namespace.declare`,
 * `store.namespace.shared.read`, `store.namespace.enumerate`, plus
 * contributor scopes `store.{backend,migrator,indexer}.register`.
 *
 * @since fn-71
 */
export interface StoreAPI {
    /** Declares (or re-declares idempotently) a namespace. */
    declareNamespace(spec: StoreNamespaceSpec): Promise<void>;
    /** Upserts a document by id. */
    put(namespace: string, id: string, doc: AnyJSONValue): Promise<void>;
    /** Gets a document by id, or null. */
    get(namespace: string, id: string): Promise<AnyJSONValue | null>;
    /** Deletes a document by id. */
    delete(namespace: string, id: string): Promise<void>;
    /** Queries documents in a namespace. */
    query(namespace: string, query: AnyJSONValue): Promise<AnyJSONValue[]>;
    /** Sets a KV entry. */
    setKV(namespace: string, key: string, value: AnyJSONValue): Promise<void>;
    /** Gets a KV entry, or null. */
    getKV(namespace: string, key: string): Promise<AnyJSONValue | null>;
    /** Deletes a KV entry. */
    deleteKV(namespace: string, key: string): Promise<void>;
    /** Lists KV keys, optionally filtered by prefix. */
    listKV(namespace: string, prefix?: string): Promise<string[]>;
    /** Compacts a namespace. */
    compact(namespace: string): Promise<void>;
    /** Exports a namespace as base64 JSONL. */
    export(namespace: string): Promise<string>;
    /**
     * Imports namespace data previously produced by `export()`.
     *
     * QUIRK: the JS method name is `importData` (NOT `import` — reserved word).
     */
    importData(namespace: string, data: string): Promise<void>;
}
/** Opaque credential reference. Raw material never crosses into JS. */
export interface CredentialRef {
    /** Opaque reference id. */
    refId: string;
    /** Credential kind (e.g., "bearer", "apiKey", "oauth"). */
    kind?: string;
    /** Human label. */
    label?: string;
}
/**
 * Credential vault (fn-72). Anti-enumeration applies on `use(ref:)` —
 * unknown refs collapse to a sanitized error.
 *
 * Scopes: `vault.store`, `vault.read`, `vault.list`, `vault.share`,
 * `vault.audit`, plus contributor scopes
 * `vault.{type,bridge,rotator}.register` and `vault.policy.contribute`.
 *
 * @since fn-72
 */
export interface VaultAPI {
    /** Stores credential material; returns an opaque ref. [vault.store] */
    store(kind: string, label: string, material: AnyJSONValue): Promise<CredentialRef>;
    /** Finds credential refs by kind/label/source. [vault.list] */
    find(kind?: string, label?: string, source?: string): Promise<CredentialRef[]>;
    /** Uses a credential inside a scoped callback. [vault.read] */
    use<T>(refId: string, purpose: string, body: (handle: unknown) => T | Promise<T>): Promise<T>;
    /**
     * Builds a server-held URLRequest from a credential handle. Returns a
     * single-use `requestId` for `network.executeRequest` — JS never sees the
     * raw token.
     */
    buildRequest(handleId: string, descriptor: AnyJSONValue): Promise<string>;
    /**
     * Injects an auth header into a server-held request. Returns a NEW
     * requestId; the old one is consumed.
     */
    injectHeader(handleId: string, requestId: string, headerName: string, scheme: string): Promise<string>;
    /** Rotates credential material behind a ref. */
    rotate(refId: string): Promise<void>;
    /** Revokes a credential ref. */
    revoke(refId: string): Promise<void>;
}
/** Typed, schema-validated public action definition (fn-89). */
export interface ActionDefinition {
    /** Local action id (qualified as `<pluginId>:<id>` platform-wide). */
    id: string;
    /** Human title for palette display. */
    title?: string;
    /** JSON schema for input validation. */
    inputSchema?: AnyJSONValue;
    /** JSON schema for output. */
    outputSchema?: AnyJSONValue;
    /** Visibility sources (e.g., "user", "api", "agent", "automation"). */
    visibility?: string[];
    /** Approval policy ("auto" | "user" | "dangerous"). */
    approval?: string;
    /** Keyboard shortcut auto-bound into the command registry. */
    shortcut?: string;
    /** Additional metadata. */
    [key: string]: AnyJSONValue | undefined;
}
/** Receipt persisted for every action invocation (fn-89 pipeline). */
export interface ActionReceipt {
    /** Receipt id. */
    receiptId: string;
    /** Qualified action id. */
    actionId: string;
    /** Invocation outcome. */
    outcome: string;
    /** Additional receipt fields. */
    [key: string]: AnyJSONValue | undefined;
}
/**
 * Source that initiated an action invocation (fn-89). Mirrors the host's
 * canonical `InvocationSource` union.
 */
export type InvocationSource = "user" | "plugin" | "agent" | "recipe" | "sequence" | "system";
/**
 * Execution context passed as the SINGLE argument to an action handler
 * registered via `actions.register(...)` (fn-89). Mirrors exactly the
 * object the host constructs per invocation: the validated `input` plus
 * invocation metadata. Deliberately has NO index signature — the host
 * passes only these fields, so unknown-property access is a type error.
 */
export interface ActionExecutionContext {
    /** Unique id (UUID string) for this invocation. */
    invocationId: string;
    /** What initiated the invocation. */
    source: InvocationSource;
    /** Validated action input (`{}` when the action was invoked with empty input). */
    input: AnyJSONValue;
    /** Originating identity when known (e.g. calling plugin id); key absent otherwise. */
    sourceId?: string;
}
/**
 * Public Action Fabric (fn-89): validate → permission → approve → execute →
 * receipt.
 *
 * NOTE: `all()` may return manifest-only entries (badged "manifest only")
 * that surface `ACTION_NOT_FOUND` on invoke until the executable handler
 * binds via `register()`.
 *
 * @since fn-89
 */
export interface ActionsAPI {
    /**
     * Registers an executable action. Returns a handle token. [actions.register]
     *
     * The handler is invoked with a single {@link ActionExecutionContext}
     * argument carrying the validated `input` plus invocation metadata
     * (`invocationId`, `source`, optional `sourceId`) — NOT the raw input
     * value. Read the action input via `exec.input`.
     */
    register(def: ActionDefinition, handler: (exec: ActionExecutionContext) => AnyJSONValue | Promise<AnyJSONValue>): Promise<string>;
    /** Projects an existing command into the action catalog. [actions.register] */
    registerFromCommand(commandId: string, metadata: Partial<ActionDefinition>): Promise<string>;
    /**
     * Invokes an action through the full pipeline.
     * [actions.invoke; source "agent" additionally requires actions.invoke.agent]
     */
    invoke(id: string, input: AnyJSONValue, source?: string): Promise<ActionReceipt>;
    /** Lists merged executable + manifest-declared actions. [actions.list] */
    all(): Promise<ActionDefinition[]>;
    /** Unregisters by handle token. [actions.register] */
    unregister(handleToken: string): Promise<void>;
}
/**
 * Command palette integration for public actions (fn-89).
 * @since fn-89
 */
export interface PaletteAPI {
    /** Queries the merged action catalog. [actions.list] */
    query(text: string, scope?: string): Promise<ActionDefinition[]>;
    /** Pins an action in the palette. [palette.contribute.scope] */
    pin(id: string): Promise<boolean>;
    /** Unpins an action. */
    unpin(id: string): Promise<boolean>;
    /** Returns recent palette invocations. [palette.history] */
    history(limit?: number): Promise<Array<{
        qualifiedId: string;
        timestamp: string;
    }>>;
}
/** Result row from `scheduler.history` / `scheduler.triggerNow`. */
export interface SchedulerRunResult {
    /** Run outcome. */
    outcome: string;
    /** Fire timestamp (ISO 8601). */
    firedAt?: string;
    /** Additional run fields. */
    [key: string]: AnyJSONValue | undefined;
}
/**
 * Trigger-kind-agnostic job engine (fn-90). Built-in triggers: interval,
 * cron (DST-safe), notification (event-bus), fsEvents, calendar, powerState,
 * networkState, appLaunch, plus declarative custom trigger kinds.
 *
 * All methods require `scheduler.job.own`.
 *
 * @since fn-90
 */
export interface SchedulerAPI {
    /** Schedules a job. Returns an owner-scoped token + job id. */
    scheduleJob(spec: AnyJSONValue): Promise<{
        token: string;
        jobId: string;
    }>;
    /** Cancels (removes) a job. */
    cancel(token: string): Promise<void>;
    /** Pauses a job. */
    pause(token: string): Promise<void>;
    /** Resumes a paused job. */
    resume(token: string): Promise<void>;
    /** Mutates a job in place. */
    update(token: string, mutation: AnyJSONValue): Promise<void>;
    /** Returns recent run history. */
    history(token: string, limit?: number): Promise<SchedulerRunResult[]>;
    /** Next wall-clock fire time (ISO 8601), or null. */
    nextFire(token: string): Promise<string | null>;
    /** Fires the job immediately through the normal dispatch pipeline. */
    triggerNow(token: string): Promise<SchedulerRunResult>;
}
/** A URI-addressable structured document (`<scheme>://<opaque-path>`). */
export interface ResourceDocument {
    /** Canonical URI. */
    uri: string;
    /** Document payload. */
    data: AnyJSONValue;
    /** Additional envelope fields (etag, fetchedAt, ...). */
    [key: string]: AnyJSONValue | undefined;
}
/** Resource provider descriptor (may contain `{placeholder}` patterns). */
export interface ResourceDescriptor {
    /** URI or URI pattern (e.g., "scheduler://job/{id}"). */
    uri: string;
    /** Access tier ("public" | "elevated"). */
    access?: string;
    /** Additional descriptor fields. */
    [key: string]: AnyJSONValue | undefined;
}
/** Transactional batch registration handle from `resources.beginBatch()`. */
export interface ResourceBatchHandle {
    /** Stages a provider registration inside the batch. */
    install(descriptor: ResourceDescriptor, resolver: (uri: string) => AnyJSONValue | Promise<AnyJSONValue>): Promise<void>;
    /** Commits all staged registrations atomically. */
    commit(): Promise<void>;
    /** Rolls back the batch. */
    rollback(): Promise<void>;
}
/**
 * Shared read plane for AppOS state (fn-92).
 * @since fn-92
 */
export interface ResourcesAPI {
    /** Registers a resource provider. Returns a provider token. [resources.provider.register] */
    register(descriptor: ResourceDescriptor, resolver: (uri: string) => AnyJSONValue | Promise<AnyJSONValue>): Promise<string>;
    /** Unregisters a provider by token. */
    unregister(token: string): Promise<void>;
    /** Begins a transactional multi-provider registration batch. [resources.provider.register] */
    beginBatch(): Promise<ResourceBatchHandle>;
    /** Resolves a URI to a document (SWR cache + single-flight). [resources.read] */
    resolve(uri: string, opts?: AnyJSONValue): Promise<ResourceDocument>;
    /** Watches a URI (200ms coalesced). Returns a watch token. [resources.watch] */
    watch(uri: string, handler: (doc: ResourceDocument) => void, opts?: AnyJSONValue): Promise<string>;
    /** Cancels a watch. */
    unwatch(token: string): Promise<void>;
    /** Lists registered resource descriptors. [resources.read] */
    list(opts?: AnyJSONValue): Promise<ResourceDescriptor[]>;
    /** Signals that a provider-owned URI changed. */
    notifyChange(token: string, uri: string): Promise<void>;
}
/** Mixed-template token value from `tokens.resolveJson`. */
export type TokenValue = AnyJSONValue;
/**
 * Dotted-path token providers + template resolution (fn-92), e.g.
 * `{{project.name}}`.
 * @since fn-92
 */
export interface TokensAPI {
    /** Registers a token provider for a dotted prefix. [tokens.provider.register] */
    registerProvider(prefix: string, provider: AnyJSONValue, resolver: (path: string) => AnyJSONValue | Promise<AnyJSONValue>): Promise<string>;
    /** Unregisters a token provider by token. */
    unregisterProvider(token: string): Promise<void>;
    /** Resolves `{{a.b.c}}` templates inside a string. [resources.read] */
    resolveString(template: string, opts?: AnyJSONValue): Promise<string>;
    /** Resolves a template preserving JSON types per the mixed-template contract. [resources.read] */
    resolveJson(template: string, opts?: AnyJSONValue): Promise<TokenValue>;
}
/** Frozen-at-compose snapshot of resources + tokens (fn-92). */
export interface ComposedContextBundle {
    /** Bundle id. */
    bundleId: string;
    /** Deterministic content hash spanning resources + tokens + metadata. */
    hash: string;
    /** Additional bundle fields. */
    [key: string]: AnyJSONValue | undefined;
}
/** Opaque elevation ticket (5-minute expiry; revoked on plugin deactivate). */
export interface ElevationTicket {
    /** Ticket id (UUID). */
    id: string;
}
/**
 * ContextBundle composition (fn-92).
 *
 * QUIRK: `context.bundles` is the fn-92 ContextBundle namespace — DISTINCT
 * from `context.clipboard.bundles` (fn-91 clipboard bundles).
 *
 * @since fn-92
 */
export interface BundlesAPI {
    /** Composes a frozen bundle. [context.compose] */
    compose(spec: AnyJSONValue): Promise<ComposedContextBundle>;
    /** Gets an owned bundle (owner-only; cross-plugin reads return null). */
    get(bundleId: string, opts?: AnyJSONValue): Promise<ComposedContextBundle | null>;
    /** Computes the deterministic bundle hash. */
    hash(bundle: AnyJSONValue): Promise<string>;
    /** Mints an elevation ticket for elevated resources (e.g., vault://). */
    elevate(spec: AnyJSONValue): Promise<ElevationTicket>;
    /** Reads a blob referenced by a bundle. */
    readBlob(refId: string, opts?: AnyJSONValue): Promise<{
        dataBase64: string;
    } | null>;
}
/** Entity record with persisted + computed field overlay. */
export interface EntityRecord {
    /** Entity type (e.g., "project", "scheduler.job"). */
    entityType: string;
    /** Entity id. */
    entityId: string;
    /** Field values. */
    fields?: Record<string, AnyJSONValue>;
    /** Additional record fields. */
    [key: string]: AnyJSONValue | undefined;
}
/** Paged result of `entities.query`. */
export interface EntityQueryResult {
    /** Matching records. */
    records: EntityRecord[];
    /** Pagination cursor, or null. */
    cursor?: string | null;
}
/**
 * Universal entity-resolution plane (fn-93). 6 v1 entity types plus
 * plugin-attached fields.
 *
 * NOTE: There is deliberately NO `delete` method (AD-FN93-50).
 *
 * @since fn-93
 */
export interface EntitiesAPI {
    /** Gets an entity type definition, or null. [entities.read] */
    getType(entityType: string): Promise<AnyJSONValue | null>;
    /** Lists entity type definitions. [entities.read] */
    listTypes(opts?: AnyJSONValue): Promise<AnyJSONValue[]>;
    /** Gets a single entity record, or null. [entities.read] */
    get(entityType: string, entityId: string, opts?: AnyJSONValue): Promise<EntityRecord | null>;
    /** Runs a v1 query envelope (operator-allowlisted, depth-capped). [entities.read] */
    query(query: AnyJSONValue): Promise<EntityQueryResult>;
    /** Watches an entity type. Returns a token. [entities.read] */
    watch(entityType: string, handler: (change: AnyJSONValue) => void, opts?: AnyJSONValue): Promise<string>;
    /** Cancels a watch. */
    unwatch(token: string): Promise<void>;
    /** Upserts an entity record. [entities.write] */
    upsert(entityType: string, partialRecord: Partial<EntityRecord>): Promise<EntityRecord>;
}
/**
 * Plugin-attached fields over fn-93 entities. Field TYPE registration is
 * declarative-only (manifest) per AD-FN93-51 — there is no
 * `fields.registerType`.
 *
 * @since fn-93
 */
export interface FieldsAPI {
    /** Lists field type definitions. [entities.read] */
    listTypes(opts?: AnyJSONValue): Promise<AnyJSONValue[]>;
    /** Attaches a field to an entity type. Returns an attachment token. [entities.field.attach.own] */
    attach(attachment: AnyJSONValue): Promise<string>;
    /** Detaches by token. */
    detach(token: string): Promise<void>;
    /** Lists field attachments for a type. [entities.read] */
    listAttachments(entityType: string, opts?: AnyJSONValue): Promise<AnyJSONValue[]>;
    /** Registers a computed-field provider. [entities.computedField.provide] */
    registerComputedProvider(provider: AnyJSONValue): Promise<string>;
    /** Sets a persisted field value. [entities.write] */
    setValue(entityType: string, entityId: string, fieldId: string, value: AnyJSONValue): Promise<void>;
    /** Clears a persisted field value. [entities.write] */
    clearValue(entityType: string, entityId: string, fieldId: string): Promise<void>;
    /** Gets a field value (persisted or computed), or null. [entities.read] */
    getValue(entityType: string, entityId: string, fieldId: string): Promise<AnyJSONValue | null>;
}
/** Immutable forensic execution record. */
export interface ExecutionRecord {
    /** Record id. */
    recordId: string;
    /** Record kind / source category. */
    kind?: string;
    /** Additional record fields (outcome, risk class, approval, artifacts...). */
    [key: string]: AnyJSONValue | undefined;
}
/**
 * Durable forensic record + approval ledger (fn-94).
 *
 * No bridge-level scope precheck — access is enforced row-level by the
 * cross-plugin gate. Anti-enum: read denials degrade to `[]`/`null`;
 * `markKeepForever` on unknown/foreign rows throws sanitized `unknownRef`.
 * Calls before plugin activation completes reject `LEDGER_NOT_AVAILABLE`.
 *
 * Scopes: `ledger.read.own`, `ledger.read.shared`.
 *
 * @since fn-94
 */
export interface LedgerAPI {
    /** Queries ledger records. */
    query(filter: AnyJSONValue): Promise<{
        records: ExecutionRecord[];
        nextScanCursor: AnyJSONValue | null;
    }>;
    /** Gets one record, or null. */
    get(recordId: string): Promise<ExecutionRecord | null>;
    /** Subscribes to matching new records. Returns a subscription id. */
    subscribe(filter: AnyJSONValue, handler: (record: ExecutionRecord) => void): Promise<string>;
    /** Cancels a subscription. */
    unsubscribe(subscriptionId: string): Promise<void>;
    /** One-way pin: sets `keepForever` (nil → true; never reversible). */
    markKeepForever(recordId: string): Promise<void>;
}
/** Saved-view definition over fn-93 entities. */
export interface SavedViewDefinition {
    /** View id. */
    viewId?: string;
    /** Entity query backing the view. */
    query?: AnyJSONValue;
    /** Layout kind (4 descriptor renderers + host-native "table"). */
    layout?: string;
    /** Additional definition fields. */
    [key: string]: AnyJSONValue | undefined;
}
/**
 * Host-rendered Saved Views (fn-95).
 * @since fn-95
 */
export interface ViewsAPI {
    /** Registers a saved view. Returns viewId. [views.register] */
    register(definition: SavedViewDefinition): Promise<string>;
    /** Unregisters a saved view. [views.register] */
    unregisterSavedView(viewId: string): Promise<void>;
    /** Lists saved views. [views.read] */
    list(filter?: AnyJSONValue): Promise<SavedViewDefinition[]>;
    /** Gets a saved view, or null. [views.read] */
    get(viewId: string): Promise<SavedViewDefinition | null>;
    /** Resolves the view's query (cached, single-flight). [views.read] */
    query(viewId: string): Promise<AnyJSONValue>;
    /** Subscribes to view refreshes. Returns a token. [views.read] */
    subscribe(viewId: string, callback: (result: AnyJSONValue) => void): Promise<string>;
    /** Cancels a subscription. */
    unsubscribe(token: string): Promise<void>;
    /** Forces a refresh now. [views.read] */
    refreshNow(viewId: string): Promise<void>;
    /** Renders a saved view into a registered panel. Returns panelId. [views.read] */
    renderIntoPanel(viewId: string, panelId: string, target: string): Promise<string>;
    /**
     * QUIRK: v1 stub — ALWAYS rejects `notSupportedV1` (VS-12). Row-action
     * invocation is deferred to v2.
     */
    invokeRow(viewId: string, rowId: string, actionId: string): Promise<never>;
}
/** A surface contribution row (fn-95). */
export interface SurfaceContribution {
    /** Target surface id ("sidebar.top" | "sidebar.bottom" | "pane.dashboard" | "status.left"). */
    surfaceId?: string;
    /** Additional contribution fields. */
    [key: string]: AnyJSONValue | undefined;
}
/**
 * Surface contributions (fn-95).
 *
 * QUIRK: the v1 RUNTIME bridge is a stub — all 3 methods reject
 * `notAvailableForJSPlugins`. The manifest-tier `surfaces.contribution`
 * extension-point path works end-to-end; declare contributions in
 * `plugin.json` `extensions[]` instead.
 *
 * Per-surface scopes: `surfaces.contribute.{sidebar.top, sidebar.bottom,
 * pane.dashboard, status.left}`.
 *
 * @since fn-95
 */
export interface SurfacesAPI {
    /** Rejects in v1 — use the manifest extensions[] path. */
    contribute(contribution: SurfaceContribution): Promise<string>;
    /** Rejects in v1. */
    withdraw(handleId: string): Promise<void>;
    /** Rejects in v1. */
    list(surfaceId?: string): Promise<SurfaceContribution[]>;
}
/**
 * Host-managed supervised subprocesses with stdio / jsonrpc-stdio framing
 * and MCP / LSP wrappers (fn-96). Sidecars run as native non-sandboxed
 * processes (Independent/Developer ID distribution only).
 *
 * @since fn-96
 */
export interface ProtocolsAPI {
    /** Registers a sidecar definition. Returns definitionId. [sidecars.definition.register] */
    registerSidecar(definition: AnyJSONValue): Promise<string>;
    /** Unregisters a sidecar definition. */
    unregisterSidecar(definitionId: string): Promise<void>;
    /** Gets a sidecar snapshot, or null (unified anti-enum read gate). */
    getSidecar(definitionId: string): Promise<AnyJSONValue | null>;
    /** Calls a sidecar method. [sidecars.instance.start] */
    call(sidecarId: string, method: string, params: AnyJSONValue, options?: AnyJSONValue): Promise<AnyJSONValue>;
    /** Streaming call — `onChunk` fires per chunk; promise resolves with the final result. */
    callStreaming(sidecarId: string, method: string, params: AnyJSONValue, onChunk: (chunk: AnyJSONValue) => void, options?: AnyJSONValue): Promise<AnyJSONValue>;
    /** Subscribes to a sidecar event. */
    subscribe(sidecarId: string, eventName: string, handler: (event: AnyJSONValue) => void): Promise<{
        subscriptionToken: string;
    }>;
    /** Cancels a sidecar event subscription. */
    unsubscribe(subscriptionToken: string): Promise<void>;
}
/** Handle returned from `notifications.emit`. */
export interface NotificationHandle {
    /** Notification id. */
    notificationId: string;
    /** Additional handle fields. */
    [key: string]: AnyJSONValue | undefined;
}
/**
 * Single outbound notification surface (fn-97). Emitters NEVER choose a
 * channel — user-authored routing rules + the filter chain decide delivery.
 *
 * `emit` / `cancel` / `history` are routed through the fn-89 Invoker.
 *
 * @since fn-97
 */
export interface NotificationsAPI {
    /**
     * Emits a typed notification. [notifications.emit]
     * NOTE: `.agent`-sourced emits fail with
     * `notifications:agentAttributionUnavailable` until fn-121 ships.
     */
    emit(input: AnyJSONValue): Promise<NotificationHandle>;
    /**
     * Cancels by notification id.
     * QUIRK (AD-FN97-57): returns boolean UNIFORMLY — `false` collapses
     * missing / foreign-emitter / already-terminal handles; never throws
     * `unknownNotificationHandle` in v1.
     */
    cancel(notificationId: string): Promise<boolean>;
    /** Reads own delivery history. [notifications.log.read] */
    history(filter?: AnyJSONValue): Promise<AnyJSONValue[]>;
    /**
     * Subscribes to notification action button invocations (SYNCHRONOUS
     * per AD-FN97-85; filtered per-emitter by the host bridge).
     * [notifications.action.register]
     */
    onAction(categoryId: string, actionId: string, handler: (invocation: AnyJSONValue) => void): SubscriptionHandle;
    /** Channel contributor sub-bridge (requires manifest `notifications.channel` contribution). */
    channels: {
        /** Binds the runtime handler for a manifest-declared channel. [notifications.channel.register] */
        bind(channelId: string, handler: (delivery: AnyJSONValue) => AnyJSONValue | Promise<AnyJSONValue>): unknown;
        /**
         * Unbinds a channel handler. [notifications.channel.register]
         * QUIRK: named `unbindChannel` — `unbind` collides with
         * `NSObject.unbind(_:)` selector in JSExport.
         */
        unbindChannel(channelId: string): unknown;
    };
    /** Filter contributor sub-bridge (requires manifest `notifications.filter` contribution). */
    filters: {
        /** Registers a filter evaluator. [notifications.filter.register] */
        register(filterId: string, evaluator: (notification: AnyJSONValue) => AnyJSONValue | Promise<AnyJSONValue>): unknown;
        /** Unregisters a filter. [notifications.filter.register] */
        unregister(filterId: string): unknown;
    };
}
/**
 * Inbound mirror of fn-97 (fn-98): external messages → IngressPipeline →
 * parsed intents → handlers. Promise methods route through the fn-89
 * Invoker; read-shaped denials are timing-padded (50ms ± 10%).
 *
 * @since fn-98
 */
export interface InputAPI {
    /** Subscribes to inbound messages on an own channel (SYNC handle). [input.subscribe.messages] */
    onMessage(channelId: string, handler: (message: AnyJSONValue) => void): SubscriptionHandle;
    /** Subscribes to own-registered intents (SYNC handle). [input.subscribe.intents] */
    onIntent(intentId: string, handler: (intent: AnyJSONValue) => void): SubscriptionHandle;
    /** Subscribes to notification replies (SYNC handle). [input.subscribe.messages] */
    onNotificationReply(handler: (reply: AnyJSONValue) => void): SubscriptionHandle;
    /** Recent messages (hard ceiling 1000 with `truncated` flag). [input.subscribe.messages] */
    recent(channelId: string, filter?: AnyJSONValue): Promise<AnyJSONValue>;
    /** Replies to an inbound message. [input.reply] */
    reply(handle: AnyJSONValue, body: AnyJSONValue, attachments?: BlobRef[]): Promise<AnyJSONValue>;
    /** Replies correlated to an outbound notification. [input.reply] */
    replyToNotification(correlationId: string, body: AnyJSONValue, attachments?: BlobRef[]): Promise<AnyJSONValue>;
    /** Lists visible channels. [input.subscribe.messages] */
    listChannels(): Promise<AnyJSONValue[]>;
    /** Seeds the reply map for free-form correlation. [input.reply] */
    recordOutboundForReplyMap(params: AnyJSONValue): Promise<AnyJSONValue>;
    /** Delivers ingress for an owned channel. [input.channel.register] */
    deliverIngress(params: AnyJSONValue): Promise<AnyJSONValue>;
    /** Channel contributor sub-bridge. */
    channels: {
        /** Registers a channel definition + handlers. [input.channel.register] */
        register(definition: AnyJSONValue, handlers: AnyJSONValue): Promise<AnyJSONValue>;
        /**
         * Unregisters a channel definition. [input.channel.register]
         * QUIRK: named `unregisterChannel` (mirrors the fn-97 `unbindChannel`
         * JSExport selector-clash pattern).
         */
        unregisterChannel(channelDefId: string): Promise<AnyJSONValue>;
    };
    /** Parser contributor sub-bridge. */
    parsers: {
        /** Registers a parser. [input.parser.register] */
        register(parserId: string, parseFn: (message: AnyJSONValue) => AnyJSONValue | Promise<AnyJSONValue>): Promise<AnyJSONValue>;
        /** Unregisters a parser. [input.parser.register] */
        unregister(parserId: string): Promise<AnyJSONValue>;
    };
    /** Intent contributor sub-bridge. */
    intents: {
        /** Registers an intent handler. [input.intent.register] */
        register(intentId: string, handler: (intent: AnyJSONValue) => void | Promise<void>): Promise<AnyJSONValue>;
        /** Unregisters an intent. [input.intent.register] */
        unregister(intentId: string): Promise<AnyJSONValue>;
    };
    /** Auth-strategy contributor sub-bridge. */
    auth: {
        /** Registers an auth strategy. [input.auth.register] */
        register(authId: string, strategy: AnyJSONValue): Promise<AnyJSONValue>;
        /** Unregisters an auth strategy. [input.auth.register] */
        unregister(authId: string): Promise<AnyJSONValue>;
    };
}
/** Inbound HTTP response an inbound route handler may return. */
export interface WebhookHTTPResponse {
    /** HTTP status code. */
    status: number;
    /** Response headers. */
    headers?: Record<string, string>;
    /** Response body. */
    body?: string;
}
/**
 * Bidirectional HTTPS webhook surface (fn-99/fn-118). Engine-direct ingress
 * (NOT routed through the fn-89 Invoker). There is NO `replay` on the JS
 * bridge — replay is admin-only (AD-FN99-05).
 *
 * @since fn-99
 */
export interface WebhookAPI {
    /**
     * Registers an inbound route. Handler may return a sync
     * WebhookHTTPResponse or a Promise of one.
     * [webhook.route.register; unsigned routes additionally need
     * webhook.route.register.unsigned]
     */
    registerRoute(spec: AnyJSONValue, handler: (request: AnyJSONValue) => WebhookHTTPResponse | Promise<WebhookHTTPResponse>): Promise<string>;
    /** Unregisters a route (owner-scoped; missing/foreign collapse to WEBHOOK_UNKNOWN_ROUTE_ID). */
    unregisterRoute(handleId: string): Promise<void>;
    /**
     * Sends an outbound webhook, awaiting the eventual durable retry terminal
     * (two-phase). [webhook.outbound.send]
     */
    send(request: AnyJSONValue): Promise<AnyJSONValue>;
    /** Enqueues durable outbound delivery. Returns an outgoingHandleId. [webhook.outbound.send] */
    enqueue(request: AnyJSONValue): Promise<string>;
    /** Current tunnel status/public URL (never null). [webhook.tunnel.read, fn-118] */
    currentPublicURL(): Promise<AnyJSONValue>;
    /** Delivery log rows for an owned/granted route. [webhook.log.read] */
    deliveries(routeHandleId: string, limit?: number): Promise<AnyJSONValue[]>;
}
/**
 * Engine-direct LLM verbs + contributor registries (fn-100). Permission is
 * enforced at facade ingress; audit rides lifecycle events + durable usage
 * rows (no action receipts for LLM verbs in v1).
 *
 * QUIRK: the JS surface exposes `providers` / `preprocessors` /
 * `postprocessors` / `routers` sub-objects; the Swift export flattens these
 * to `registerProvider` etc. Preprocessor/postprocessor/router `register`
 * are SYNCHRONOUS (in-memory binding); provider `register` is async
 * (durable persistence).
 *
 * @since fn-100
 */
export interface LLMAPI {
    /** Completion. [llm.complete] */
    complete(params: AnyJSONValue): Promise<AnyJSONValue>;
    /** Streaming completion — resolves to a result + cancel pair. [llm.stream] */
    stream(params: AnyJSONValue): Promise<{
        result: AnyJSONValue;
        cancel: () => void;
    }>;
    /** Embeddings. [llm.embed] */
    embed(params: AnyJSONValue): Promise<number[][]>;
    /** Vision completion. [llm.vision] */
    vision(params: AnyJSONValue): Promise<AnyJSONValue>;
    /** Agent loop. [llm.agent] */
    agent(params: AnyJSONValue): Promise<AnyJSONValue>;
    /** Usage report. [llm.ledger.read] */
    usage(params: {
        forPlugin?: string;
        range?: AnyJSONValue;
    }): Promise<AnyJSONValue>;
    /** Provider contributor registry. */
    providers: {
        /** [llm.provider.register] — async (durable). */
        register(spec: AnyJSONValue): Promise<{
            id: string;
        }>;
        unregister(params: {
            id: string;
        }): Promise<void>;
    };
    /** Preprocessor contributor registry. */
    preprocessors: {
        /** [llm.preprocessor.register] — SYNC (in-memory). */
        register(spec: AnyJSONValue): {
            id: string;
        };
        unregister(params: {
            id: string;
        }): Promise<void>;
    };
    /** Postprocessor contributor registry. */
    postprocessors: {
        /** [llm.postprocessor.register] — SYNC (in-memory). */
        register(spec: AnyJSONValue): {
            id: string;
        };
        unregister(params: {
            id: string;
        }): Promise<void>;
    };
    /** Router contributor registry. */
    routers: {
        /** [llm.router.register] — SYNC (in-memory). */
        register(params: {
            rule: AnyJSONValue;
        }): {
            id: string;
        };
        unregister(params: {
            id: string;
        }): Promise<void>;
    };
}
/**
 * Author-declared multi-step plans (fn-101), dispatched through the fn-89
 * Invoker with caller-declared scopes.
 * @since fn-101
 */
export interface RecipesAPI {
    /** Registers a recipe definition. [recipes.register] */
    register(spec: AnyJSONValue): Promise<AnyJSONValue>;
    /** Unregisters by ref or handle. [recipes.register] */
    unregister(refOrHandle: AnyJSONValue): Promise<void>;
    /** Runs a recipe. Returns a run handle. [recipes.run] */
    run(params: {
        recipeRef: string;
        args?: AnyJSONValue;
        options?: AnyJSONValue;
    }): Promise<AnyJSONValue>;
    /** Lists visible recipes (no scope required). */
    list(params?: {
        filter?: AnyJSONValue;
    }): Promise<{
        recipes: AnyJSONValue[];
    }>;
    /** Gets a recipe definition, or null (no scope required). */
    get(refOrParams: AnyJSONValue): Promise<{
        recipe: AnyJSONValue | null;
    }>;
    /** User-trigger contributor sub-bridge. */
    triggers: {
        /** Registers a recipe trigger contribution. */
        register(contribution: AnyJSONValue): Promise<AnyJSONValue>;
        /** Unregisters a trigger. */
        unregister(key: string): Promise<void>;
    };
}
/**
 * Sequence (linear / LLM-agent multi-step) runs (fn-101).
 * @since fn-101
 */
export interface SequencesAPI {
    /** Registers a sequence definition. [sequences.register] */
    register(spec: AnyJSONValue): Promise<AnyJSONValue>;
    /** Unregisters by ref or handle. [sequences.register] */
    unregister(refOrHandle: AnyJSONValue): Promise<void>;
    /** Runs a sequence. Returns a run handle. [sequences.run] */
    run(params: {
        sequenceRef: string;
        args?: AnyJSONValue;
        options?: AnyJSONValue;
    }): Promise<AnyJSONValue>;
    /** Resumes a paused/awaiting run. [sequences.run] */
    resume(params: {
        runId: string;
    }): Promise<AnyJSONValue>;
    /** Cancels a run. [sequences.run] */
    cancel(params: {
        runId: string;
    }): Promise<void>;
    /** QUIRK: v1 reserved — ALWAYS rejects `notSupportedV1`. */
    list(): Promise<never>;
    /** QUIRK: v1 reserved — ALWAYS rejects `notSupportedV1`. */
    get(refOrParams: AnyJSONValue): Promise<never>;
}
/**
 * Virtual filesystem / transfer-strategy provider registration.
 *
 * QUIRK: BOTH methods throw `NOT_AVAILABLE_FOR_JS_PLUGINS` for JavaScript
 * plugins — this namespace is only functional for core-swift plugins. It is
 * typed here so the surface matches the host export.
 */
export interface FileSystemAPI {
    /** Core-swift only; throws for JS plugins. */
    registerProvider(config: AnyJSONValue): undefined;
    /** Core-swift only; throws for JS plugins. */
    registerTransferStrategyProvider(config: AnyJSONValue): undefined;
}
//# sourceMappingURL=namespaces-core-plugins.d.ts.map