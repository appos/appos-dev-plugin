/**
 * API namespace interfaces — the 22 host-core namespaces.
 * Each maps to a property on PluginContext. The 21 core-plugin namespaces
 * live in namespaces-core-plugins.ts; PluginContext exposes all 43.
 *
 * @version 3.0.0
 */
import type { ViewDescriptor } from "./views";
import type { PluginFileDescriptor, DependencyStatus } from "./core";
import type { SFSymbolName } from "./icons";
/**
 * Options for command registration.
 */
export interface CommandOptions {
    /** Human-readable title for the command. */
    title: string;
    /** SF Symbol name for the command icon. */
    icon?: SFSymbolName;
    /** Keyboard shortcut string (e.g., "cmd+shift+t"). */
    shortcut?: string;
    /** Condition when the command is available (e.g., "isDirectory"). */
    condition?: string;
    /** The handler function called when the command is executed. */
    handler: () => void | Promise<void>;
}
export interface CommandsAPI {
    /**
     * Registers a command.
     *
     * The plugin passes a SHORT ID (e.g., "myCmd"). The bridge auto-prefixes
     * with `{pluginId}.` to form the full ID.
     */
    register(id: string, handlerOrOptions: (() => void | Promise<void>) | CommandOptions): void;
    /**
     * Executes a command by ID.
     *
     * Allowed targets: own commands, core commands (`space.appos.*`).
     */
    execute(id: string, args?: Record<string, unknown>): Promise<void>;
    /** Returns the calling plugin's own registered commands as short IDs. */
    getRegistered(): string[];
    /**
     * Registers a handler called after a command executes.
     * Own-namespace commands ONLY.
     */
    onCommandExecuted(id: string, handler: (details: Record<string, unknown>) => void): string;
}
/**
 * File operation types that can be hooked.
 */
export type FileOperationType = "copy" | "move" | "delete" | "rename" | "createFile" | "createDirectory" | "writeFile";
/**
 * A single operation in a `fileOps.batch()` call.
 */
export type BatchOperation = {
    type: "copy";
    sources: string[];
    dest: string;
} | {
    type: "move";
    sources: string[];
    dest: string;
} | {
    type: "delete";
    urls: string[];
    trash?: boolean;
} | {
    type: "rename";
    url: string;
    newName: string;
} | {
    type: "createDirectory";
    parentUrl: string;
    name: string;
} | {
    type: "createFile";
    parentUrl: string;
    name: string;
    contents?: string;
};
/**
 * Information passed to before/after hook handlers.
 */
export interface FileOperationEvent {
    /** The type of operation. */
    type: FileOperationType;
    /** File URL strings involved in the operation. */
    paths: string[];
    /** Whether the operation succeeded (after-hooks only). */
    success?: boolean;
    /** Error message if the operation failed (after-hooks only). */
    error?: string;
    /** New URL after rename/create operations (after-hooks only). */
    newUrl?: string;
    /** Created/target URL for createFile/createDirectory (after-hooks only). */
    url?: string;
}
/**
 * Result from a before-hook handler to cancel an operation.
 */
export interface BeforeHookResult {
    /** Reason for cancellation (shown to the user/calling plugin). */
    reason?: string;
}
/**
 * Per-operation result from `fileOps.batch()`.
 */
export interface BatchResult {
    index: number;
    success: boolean;
    error?: string;
}
/**
 * Options for `watchDirectoryWithOptions`.
 */
export interface WatchOptions {
    /** FSEventStream latency in milliseconds. Range: 0–5000. Default: 500. */
    debounceMs?: number;
    /** When false, only immediate children trigger the callback. Default: true. */
    recursive?: boolean;
}
export interface FileOpsAPI {
    /** Returns file descriptors for the active pane's selected files. */
    getSelectedFiles(): Promise<PluginFileDescriptor[]>;
    /** Returns the URL string of the active pane's current directory. */
    getActiveDirectory(): Promise<string>;
    /** Returns the URL string of the specified pane's directory. */
    getPaneDirectory(paneId: string): Promise<string>;
    /** Lists directory contents. */
    listDirectory(url: string): Promise<PluginFileDescriptor[]>;
    /** Returns metadata for a single file. */
    getFileInfo(url: string): Promise<PluginFileDescriptor>;
    /** Reads a text file. */
    readFile(url: string, encoding?: string): Promise<string>;
    /** Reads a file as a base64-encoded string. */
    readFileData(url: string): Promise<string>;
    /** Copies files to a destination directory. */
    copy(sources: string[], dest: string): Promise<void>;
    /** Moves files to a destination directory. */
    move(sources: string[], dest: string): Promise<void>;
    /** Deletes files. */
    delete(urls: string[], trash?: boolean): Promise<void>;
    /** Renames a file. Returns the new URL string. */
    rename(url: string, newName: string): Promise<string>;
    /** Creates a new directory. Returns the URL string. */
    createDirectory(parentUrl: string, name: string): Promise<string>;
    /** Creates a new file with optional initial contents. Returns the URL string. */
    createFile(parentUrl: string, name: string, contents?: string): Promise<string>;
    /** Writes text content to an existing file. */
    writeFile(url: string, contents: string, encoding?: string): Promise<void>;
    /** Executes multiple file operations as a batch. */
    batch(operations: BatchOperation[]): Promise<BatchResult[]>;
    /** Watches a directory for changes. Returns subscription ID. */
    watchDirectory(url: string, handler: (changedPaths: string[]) => void): string;
    /** Watches a directory for changes with configurable debounce and recursion. */
    watchDirectoryWithOptions(url: string, options: WatchOptions, handler: (changedPaths: string[]) => void): string;
    /** Cancels a directory watcher subscription. */
    unwatchDirectory(subscriptionId: string): void;
    /** Registers a before-operation hook. */
    onBeforeOperation(type: FileOperationType | FileOperationType[], handler: (event: FileOperationEvent) => BeforeHookResult | void): string;
    /** Registers an after-operation hook. */
    onAfterOperation(type: FileOperationType | FileOperationType[], handler: (event: FileOperationEvent) => void): string;
    /** Removes a before-hook subscription. */
    removeBeforeHook(subscriptionId: string): void;
    /** Removes an after-hook subscription. */
    removeAfterHook(subscriptionId: string): void;
}
/**
 * Options for structured panel registration.
 */
export interface PanelOptions {
    /** Display title for the panel. */
    title: string;
    /** SF Symbol name for the panel icon. */
    icon?: SFSymbolName;
    /** Target region: "sidebar" or "pane". Default: "sidebar". */
    target?: "sidebar" | "pane";
    /** Position hint: "top" or "bottom" (for sidebar). Default: "bottom". */
    position?: "top" | "bottom";
    /** JSON view descriptor for the panel content. */
    view: ViewDescriptor;
    /** Handler function invoked for interactive elements. */
    handler?: (action: string) => void | Promise<void>;
    /** Priority for ordering (100+ for plugins, lower = higher priority). */
    priority?: number;
    /**
     * Whether the panel should auto-show in a pane tab on first registration.
     * Only applies when `target` is `"pane"`. Default: `true`.
     */
    autoShow?: boolean;
}
/**
 * Options for activity bar item registration.
 */
export interface ActivityBarItemOptions {
    /** Display title for the item. */
    title: string;
    /** SF Symbol name for the item icon. */
    icon: SFSymbolName;
    /** Position hint: "top" or "bottom". Default: "bottom". */
    position?: "top" | "bottom";
    /** JSON view descriptor for the item content. */
    view?: ViewDescriptor;
    /** Handler function invoked when the item is clicked. */
    handler?: (action: string) => void | Promise<void>;
    /** Priority for ordering (100+ for plugins). */
    priority?: number;
}
/**
 * Options for structured activity view registration.
 */
export interface ActivityViewOptions {
    /** Display title for the activity view. */
    title: string;
    /** SF Symbol name for the activity icon. */
    icon: SFSymbolName;
    /** Optional badge text. */
    badge?: string;
    /** JSON view descriptor for the sidebar content. Optional when `linkedPanel` is set. */
    view?: ViewDescriptor;
    /** Handler function invoked for interactive elements within the view. */
    handler?: (action: string) => void | Promise<void>;
    /** Priority for ordering (100+ for plugins). */
    priority?: number;
    /**
     * Links this activity bar icon to a registered pane panel.
     * The value is the short panel ID (without plugin prefix).
     */
    linkedPanel?: string;
}
/**
 * Options for status bar item registration.
 */
export interface StatusBarItemOptions {
    /** Display text for the item. */
    text: string;
    /** SF Symbol name for the item icon. */
    icon?: SFSymbolName;
    /** Position hint: "left" or "right". Default: "right". */
    position?: "left" | "right";
    /** JSON view descriptor for the item content. */
    view?: ViewDescriptor;
    /** Handler function invoked when the item is clicked. */
    handler?: (action: string) => void | Promise<void>;
    /** Priority for ordering (100+ for plugins). */
    priority?: number;
}
/**
 * Options for context menu item registration.
 */
export interface ContextMenuItemOptions {
    /** Display title for the menu item. */
    title: string;
    /** SF Symbol name for the menu item icon. */
    icon?: SFSymbolName;
    /** Condition type for when to show. */
    condition?: "always" | "isDirectory" | "isFile";
    /** Handler function invoked when the item is selected. */
    handler: () => void | Promise<void>;
}
/**
 * Options for toolbar item registration.
 */
export interface ToolbarItemOptions {
    /** Display title for the item. */
    title: string;
    /** SF Symbol name for the item icon. */
    icon: SFSymbolName;
    /** Handler function invoked when the item is clicked. */
    handler: () => void | Promise<void>;
}
/**
 * Options for file row annotation registration.
 */
export interface FileRowAnnotationOptions {
    /** Display title for the annotation. */
    title?: string;
    /** SF Symbol name for the annotation icon. */
    icon?: SFSymbolName;
    /** Handler function invoked to determine annotation state for a file. */
    handler: (fileDescriptor: PluginFileDescriptor) => unknown;
}
/**
 * Configuration for `registerWebPanel()` (fn-48).
 */
export interface WebPanelOptions {
    /** Display title for the panel tab. */
    title: string;
    /** SF Symbol name for the tab icon. */
    icon?: SFSymbolName;
    /** Relative path to the HTML file within the plugin bundle. */
    htmlPath: string;
    /** Preferred width in points for the panel. */
    width?: number;
    /** Whether the WebView is allowed to navigate away from the initial page. Default: false. */
    allowNavigation?: boolean;
}
/**
 * Message envelope for WebView-to-plugin messages (fn-48).
 */
export interface WebPanelMessage {
    /** The message payload sent from the WebView. */
    data: unknown;
    /** Unique identifier for the WKWebView instance that sent the message. */
    instanceId: string;
    /** The app window containing this WebView. */
    windowId: string;
    /** Which pane the WebView is in. */
    paneId: "left" | "right";
}
/**
 * Options for showing a notification toast.
 */
export interface NotificationOptions {
    /** Notification message text. */
    message: string;
    /** Notification type. Default: "info". */
    type?: "info" | "success" | "warning" | "error";
    /** Duration in seconds before auto-dismiss. Default: 2. */
    duration?: number;
}
/**
 * Options for showing a modal sheet.
 */
export interface SheetOptions {
    /** Sheet title. */
    title: string;
    /** JSON view descriptor for the sheet content. */
    view?: ViewDescriptor;
    /** Whether the sheet is dismissable by clicking outside. Default: true. */
    dismissable?: boolean;
}
export interface UIAPI {
    /** Registers a structured panel (sidebar or pane). */
    registerPanel(id: string, options: PanelOptions): string;
    /** Updates an existing structured panel's content. */
    updatePanel(id: string, options: Partial<PanelOptions>): string;
    /** @deprecated Use `registerPanel` with `target: "sidebar"` instead. */
    registerSidebarPanel(id: string, options: PanelOptions): string;
    /** Registers an activity bar item. */
    registerActivityBarItem(id: string, options: ActivityBarItemOptions): string;
    /** Registers a structured activity sidebar view. */
    registerActivityView(id: string, options: ActivityViewOptions): string;
    /** Registers a status bar item. */
    registerStatusBarItem(id: string, options: StatusBarItemOptions): string;
    /** Unregisters an existing slot-based UI contribution. */
    unregister(tokenId: string): void;
    /** Registers a content panel. */
    showPanel(id: string, options: PanelOptions): string;
    /** Registers a context menu item. */
    registerContextMenuItem(id: string, options: ContextMenuItemOptions): string;
    /** Registers a toolbar item. */
    registerToolbarItem(id: string, options: ToolbarItemOptions): string;
    /** Registers a file row annotation provider. */
    registerFileRowAnnotation(id: string, options: FileRowAnnotationOptions): string;
    /** Registers a profile contribution. Returns a SlotToken id for `unregister`. */
    registerProfile(options: unknown): string;
    /** Shows a notification toast. */
    showNotification(options: NotificationOptions): void;
    /** Shows a modal sheet. */
    showSheet(options: SheetOptions): void;
    /** Sets the quick filter text on the active pane's file list. */
    setQuickFilter(text: string): void;
    /** Opens or focuses a pane tab that renders a previously registered panel. */
    showPaneTab(id: string, options?: {
        title?: string;
        pane?: "left" | "right";
    }): string;
    /** Closes any open pane tabs for the given panel ID across both panes. */
    hidePaneTab(id: string): string;
    /** Opens a file in an in-pane viewer tab. Returns a viewer id. */
    openInPane(url: string, options?: {
        pane?: "left" | "right";
        mode?: "view";
    }): string;
    /** Opens a terminal tab at the given working directory. Returns a viewer id. */
    openTerminal(workingDirectory: string, options?: {
        pane?: "left" | "right";
    }): string;
    /** Opens a code editor tab for the given file URL. Returns a viewer id. */
    openEditor(url: string, options?: {
        pane?: "left" | "right";
    }): string;
    /** Opens a web browser tab for the given URL. Returns a viewer id. */
    openWebView(url: string, options?: {
        pane?: "left" | "right";
    }): string;
    /** Opens a markdown preview tab for the given file URL. Returns a viewer id. */
    openMarkdownPreview(url: string, options?: {
        pane?: "left" | "right";
    }): string;
    /** Opens a new AI chat pane tab with optional prefill. Returns a viewer id. */
    openAIChat(options?: {
        pane?: "left" | "right";
        connector?: string;
        systemPrompt?: string;
        context?: string[];
    }): string;
    /** Registers a WebView panel definition. Returns a registration id. */
    registerWebPanel(id: string, options: WebPanelOptions): string;
    /** Posts a JSON message to active WebView instances of a panel. */
    postToWebPanel(panelId: string, message: unknown, options?: {
        instanceId?: string;
    }): unknown;
    /** Registers a fire-and-forget message handler for WebView messages. Returns a token. */
    onWebPanelMessage(panelId: string, handler: (message: WebPanelMessage) => void): string;
    /** Registers a request/response handler for WebView messages. Returns a token. */
    onWebPanelRequest(panelId: string, handler: (message: WebPanelMessage) => unknown | Promise<unknown>): string;
    /** Pipes shell output to WebView panel instances. */
    pipeShellToWebPanel(panelId: string, shellOptions: ShellExecuteOptions): Promise<ShellExecuteResult>;
}
/**
 * Legacy synchronous key-value storage tier.
 *
 * For durable, namespaced, Promise-shaped document/KV storage with query,
 * compaction, and export/import, use `context.store` (fn-71 `StoreAPI`) —
 * the storage plane every core plugin builds on. `storage.*` remains
 * supported for simple small values.
 */
export interface StorageAPI {
    /** Gets a value from the plugin's scoped storage. */
    get(key: string): unknown | null;
    /** Sets a value in the plugin's scoped storage. */
    set(key: string, value: unknown): void;
    /** Reads a string value from the macOS Keychain (plugin-scoped). */
    getSecure(key: string): string | null;
    /** Writes a string value to the macOS Keychain (plugin-scoped). */
    setSecure(key: string, value: string): void;
    /** Removes a keychain item (plugin-scoped). */
    deleteSecure(key: string): true | undefined;
}
export interface SettingsAPI {
    /** Gets a plugin setting value. */
    get(key: string): unknown | null;
    /** Sets a plugin setting value with full schema validation. */
    set(key: string, value: unknown): void;
    /** Returns all declared settings with stored values, manifest defaults, or null. */
    getAll(): Record<string, unknown>;
    /** Subscribes to changes on any setting. */
    onChange(handler: (key: string, newValue: unknown, oldValue: unknown) => void): string;
    /** Subscribes to changes on a specific setting key. */
    onKeyChange(key: string, handler: (newValue: unknown, oldValue: unknown) => void): string;
    /** Unsubscribes from setting changes. */
    offChange(token: string): void;
    /** Opens the settings UI for this plugin. */
    openUI(): void;
}
/**
 * Payload delivered to `fileOps.operationCompleted` subscribers.
 */
export interface FileOpCompletedPayload {
    /** The operation type. */
    type: "copy" | "move" | "delete" | "rename" | "createDirectory" | "createFile";
    /** Affected URL strings. */
    paths: string[];
    /** Whether the operation succeeded. */
    success: boolean;
    /** Error message if the operation failed; absent on success. */
    error?: string;
    /** Plugin ID that initiated the operation. */
    initiatorPluginId: string;
}
/**
 * Topic declaration spec for the fn-70 typed event bus.
 */
export interface TopicSpec {
    /** Topic name (namespaced by the declaring plugin). */
    name: string;
    /** JSON schema for event payload validation. */
    schema?: unknown;
    /** Retention policy (e.g., `{ mode: "bounded", count: 50 }`, `"session"`, `"none"`). */
    retention?: unknown;
    /** Delivery mode: "atMostOnce" | "atLeastOnce" (retry/backoff/dead-letter) | "ordered" (partitioned). */
    delivery?: "atMostOnce" | "atLeastOnce" | "ordered";
    /** Additional declaration fields. */
    [key: string]: unknown;
}
/**
 * Topic metadata row returned by `events.listTopics()`.
 */
export interface TopicInfo {
    /** Qualified topic name. */
    name: string;
    /** Declaring plugin id. */
    ownerPluginId?: string;
    /** Additional metadata fields. */
    [key: string]: unknown;
}
/**
 * Envelope delivered to `subscribeTopic` handlers and returned by `replay`.
 */
export interface EventEnvelope {
    /** Topic name. */
    topic: string;
    /** Event payload (schema-validated at emit). */
    payload: unknown;
    /** Emitting plugin id. */
    emittedBy?: string;
    /** Emit timestamp (ISO 8601). */
    ts?: string;
    /** Unique event id. */
    eventId?: string;
    /** Optional emit metadata. */
    metadata?: Record<string, unknown>;
}
/**
 * Host events (legacy pair) + the fn-70 typed event bus.
 *
 * The legacy `subscribe`/`unsubscribe` pair is a PERMANENT alias (ADR-001)
 * — it is not deprecated, but new inter-plugin messaging should use the
 * typed-bus methods, which add schema validation, retention, and delivery
 * modes. Typed-bus scopes: `events.topic.declare`, `events.emit`,
 * `events.subscribe`, `events.replay`, `events.inspect`, plus contributor
 * scopes `events.serializer.register` / `events.sink.register`.
 */
export interface EventsAPI {
    /** Subscribes to a host event. Returns subscription token. */
    subscribe(eventName: string, handler: (payload: unknown) => void): string;
    /** Cancels a host event subscription. */
    unsubscribe(token: string): void;
    /** Declares a schema-registered topic. [events.topic.declare] */
    declareTopic(spec: TopicSpec): Promise<void>;
    /** Emits a payload to a declared topic. [events.emit] */
    emitTopic(name: string, payload: unknown, metadata?: Record<string, unknown>): Promise<void>;
    /** Subscribes to a topic. Resolves to a subscription token. [events.subscribe] */
    subscribeTopic(name: string, handler: (envelope: EventEnvelope) => void): Promise<string>;
    /** Replays retained events for a topic. [events.replay] */
    replay(name: string, opts?: {
        limit?: number;
        since?: string;
    }): Promise<EventEnvelope[]>;
    /** Lists visible declared topics. [events.inspect] */
    listTopics(): Promise<TopicInfo[]>;
}
/**
 * A chunk of output data delivered via the `onData` streaming callback (fn-47).
 */
export interface ShellDataChunk {
    /** Which pipe this chunk came from. */
    stream: "stdout" | "stderr";
    /** UTF-8 decoded text content. May contain partial lines. */
    data: string;
    /** Running total of bytes received on this stream (pre-truncation). */
    bytesTotal: number;
}
/**
 * Options for `shell.execute()`.
 */
export interface ShellExecuteOptions {
    /** Command name (must be in the manifest's `shellCommands` allowlist). */
    command: string;
    /** Arguments array (default: `[]`). */
    args?: string[];
    /** Working directory (absolute POSIX path or `file://` URL). */
    cwd?: string;
    /** Timeout in seconds (default: 120, maximum: 120). */
    timeout?: number;
    /** Environment variables to merge with the host process environment. */
    env?: Record<string, string>;
    /**
     * Optional callback invoked as output data arrives from the process (fn-47).
     * Omit for the existing buffered behavior (no streaming).
     */
    onData?: (chunk: ShellDataChunk) => void;
}
/**
 * Result from `shell.execute()`.
 */
export interface ShellExecuteResult {
    /** Process exit code. */
    exitCode: number;
    /** Standard output (UTF-8). Truncated to 10MB. */
    stdout: string;
    /** Standard error (UTF-8). Truncated to 10MB. */
    stderr: string;
}
export interface ShellAPI {
    /** Execute a shell command with optional streaming output. */
    execute(options: ShellExecuteOptions): Promise<ShellExecuteResult>;
}
/** A captured clipboard history item (fn-91). */
export interface ClipItem {
    /** Clip id. */
    id: string;
    /** Content kind (e.g., "text", "image", or `custom(pluginId, typeId)` tombstones). */
    kind?: string;
    /** Inline content, when present (large payloads live behind blob refs). */
    content?: unknown;
    /** Capture timestamp (ISO 8601). */
    capturedAt?: string;
    /** User-favorite flag. */
    isFavorite?: boolean;
    /** User tags. */
    tags?: string[];
    /** Additional fields. */
    [key: string]: unknown;
}
/** A registered paste destination (fn-91). */
export interface ClipDestination {
    /** Destination id. */
    id: string;
    /** Display name. */
    name?: string;
    /** Additional fields. */
    [key: string]: unknown;
}
/** A named Context Bundle of clips for AI-agent injection (fn-91). */
export interface ClipboardContextBundle {
    /** Bundle id. */
    id: string;
    /** Bundle name. */
    name?: string;
    /** Member clip ids (missing members export as tombstones). */
    clipIds?: string[];
    /** Additional fields. */
    [key: string]: unknown;
}
/**
 * System pasteboard access plus the fn-91 Core Clipboard engine (history
 * search + Context Bundles + registration sub-bridges).
 *
 * v1 QUIRKS: `sources.register` and `destinations.register` are
 * DECLARATIVE-ONLY (metadata registration; no executable callback), and
 * `clipboard.contentType` contributions are manifest-only (no JS bridge).
 * Read-shaped cross-plugin denials degrade gracefully (`[]` / `null`);
 * write/export-shaped denials throw sanitized `unknownRef`.
 */
export interface ClipboardAPI {
    /** Reads the current clipboard string content. [clipboard.read] */
    read(): Promise<string | null>;
    /** Clears the clipboard and writes the given string. [clipboard.write] */
    write(text: string): Promise<boolean>;
    /** Pastes a history clip into a registered destination. [clipboard.history.read] */
    paste(clipId: string, destinationId: string): Promise<unknown>;
    /** Lists registered paste destinations. */
    listDestinations(): Promise<ClipDestination[]>;
    /** Ingests content into history programmatically. [clipboard.history.write] */
    ingest(kind: string, content: unknown, metadata?: Record<string, unknown>): Promise<ClipItem>;
    /** Clipboard history engine (fn-91). */
    history: {
        /** Queries history. [clipboard.history.read] */
        query(filter: unknown): Promise<ClipItem[]>;
        /** Gets a clip, or null. [clipboard.history.read] */
        get(id: string): Promise<ClipItem | null>;
        /** Subscribes to capture events. [clipboard.history.subscribe] */
        subscribe(handler: (clip: ClipItem) => void): Promise<{
            cancel(): Promise<void>;
        }>;
        /** Deletes a clip. [clipboard.history.write] */
        delete(id: string): Promise<boolean>;
        /** Sets the favorite flag. [clipboard.history.write] */
        favorite(id: string, isFavorite: boolean): Promise<void>;
        /** Replaces the tag set. [clipboard.history.write] */
        tag(id: string, tags: string[]): Promise<void>;
    };
    /** Context Bundles (fn-91). All methods require [clipboard.bundles]. */
    bundles: {
        /** Creates a bundle. */
        create(name: string): Promise<ClipboardContextBundle>;
        /** Updates a bundle. */
        update(bundle: ClipboardContextBundle): Promise<ClipboardContextBundle>;
        /** Adds a clip to a bundle. */
        addClip(bundleId: string, clipId: string, notes?: string): Promise<void>;
        /** Removes a clip from a bundle. */
        removeClip(bundleId: string, clipId: string): Promise<void>;
        /** Exports a bundle ("markdown" | "json" | "xml" | "plainText"). */
        export(bundleId: string, format: string): Promise<unknown>;
        /** Lists own bundles. */
        list(): Promise<ClipboardContextBundle[]>;
        /** Gets a bundle. */
        get(bundleId: string): Promise<ClipboardContextBundle | null>;
        /** Deletes a bundle. */
        delete(bundleId: string): Promise<void>;
    };
    /** Transform contributors. [clipboard.transform.register] */
    transforms: {
        register(definition: unknown, handler: (clip: ClipItem) => unknown): Promise<{
            cancel(): Promise<void>;
        }>;
    };
    /** Capture-rule contributors. [clipboard.rule.register] */
    rules: {
        register(definition: unknown, handler: (clip: ClipItem) => unknown): Promise<{
            cancel(): Promise<void>;
        }>;
    };
    /** Retention-predicate contributors. [clipboard.retention.predicate.register] */
    retentionPredicates: {
        register(definition: unknown, predicate: (clip: ClipItem) => boolean | Promise<boolean>): Promise<{
            cancel(): Promise<void>;
        }>;
    };
    /** Source contributors — DECLARATIVE-ONLY in v1. [clipboard.source.register] */
    sources: {
        register(definition: unknown): Promise<{
            cancel(): Promise<void>;
        }>;
    };
    /** Destination contributors — DECLARATIVE-ONLY in v1. [clipboard.destination.register] */
    destinations: {
        register(definition: unknown): Promise<{
            cancel(): Promise<void>;
        }>;
    };
}
/**
 * Options for `network.fetch()`.
 */
export interface NetworkFetchOptions {
    /** HTTP method (default: "GET"). */
    method?: string;
    /** Request headers as key-value pairs. */
    headers?: Record<string, string>;
    /** Request body string (for POST, PUT, PATCH). */
    body?: string;
}
/**
 * Response from `network.fetch()`.
 */
export interface NetworkResponse {
    /** HTTP status code (e.g., 200, 404). */
    status: number;
    /** Response headers as key-value pairs. */
    headers: Record<string, string>;
    /** Response body as a UTF-8 string. */
    body: string;
}
export interface NetworkAPI {
    /** Performs an HTTP request via URLSession. */
    fetch(url: string, options?: NetworkFetchOptions): Promise<NetworkResponse>;
    /** Downloads a URL to a local file path. Returns the destination path. */
    download(url: string, destPath: string): Promise<string>;
    /**
     * Executes a server-held URLRequest previously built by
     * `vault.buildRequest(...)` or `oauth.buildAuthenticatedRequest(...)`.
     *
     * The `requestId` is single-use; the host holds the actual request
     * (including any injected credentials) so JS never sees raw tokens.
     */
    executeRequest(requestId: string): Promise<NetworkResponse>;
}
/**
 * Options for `shortcuts.register()`.
 */
export interface ShortcutRegisterOptions {
    /** The command ID to bind the shortcut to (own-namespace only). */
    commandId: string;
    /** Key combination string (e.g., "cmd+t", "cmd+shift+n"). */
    keys: string;
    /** Optional context condition string. */
    when?: string;
}
/**
 * Registered shortcut info returned by `shortcuts.getAll()`.
 */
export interface ShortcutInfo {
    /** Unique identifier formatted as `"{pluginId}:{keys}"`. */
    shortcutId: string;
    /** The command ID this shortcut is bound to. */
    commandId: string;
    /** The key combination string. */
    keys: string;
    /** Optional `when` condition, if provided at registration. */
    when?: string;
}
export interface ShortcutsAPI {
    /** Registers a keyboard shortcut binding for an existing command. */
    register(options: ShortcutRegisterOptions): Promise<string>;
    /** Removes a shortcut binding by its shortcutId. */
    unregister(shortcutId: string): Promise<void>;
    /** Returns all shortcuts registered by the calling plugin. */
    getAll(): Promise<ShortcutInfo[]>;
}
/**
 * Options for `themes.registerTheme()`.
 */
export interface ThemeRegisterOptions {
    /** Unique theme identifier. */
    id: string;
    /** Human-readable theme name. */
    name: string;
    /** Flat mapping of design token keys to hex color strings. */
    tokens: Record<string, string>;
}
/**
 * Theme info returned by `themes.getThemeList()`.
 */
export interface ThemeInfo {
    /** Unique theme identifier. */
    id: string;
    /** Human-readable theme name. */
    name: string;
    /** Plugin ID that registered this theme. */
    pluginId: string;
}
export interface ThemesAPI {
    /** Registers a theme with the ThemeEngine. */
    registerTheme(options: ThemeRegisterOptions): Promise<void>;
    /** Returns the currently active theme ID, or null if no theme is active. */
    getActiveTheme(): Promise<string | null>;
    /** Activates a registered theme by ID, or clears the active theme. */
    setActiveTheme(themeId: string | null | undefined): Promise<void>;
    /** Returns all registered themes across all plugins. */
    getThemeList(): Promise<ThemeInfo[]>;
    /** Subscribes to theme change notifications. */
    onThemeChanged(callback: (themeId: string | null) => void): Promise<string>;
    /** Unsubscribes a theme change listener. */
    offThemeChanged(token: string): Promise<void>;
}
/**
 * Options for registering a plugin-contributed filter type.
 */
export interface RegisterFilterTypeOptions {
    /** Short filter type ID (will be prefixed with "{pluginId}.filter."). */
    id: string;
    /** Human-readable name for the filter type. */
    displayName: string;
    /** Optional editor configuration (reserved for future editor integration). */
    editorConfig?: Record<string, unknown>;
    /**
     * Synchronous evaluation function called per file during `evaluateFilter`.
     * Must return a synchronous boolean.
     */
    evaluate: (item: {
        url: string;
        metadata: Record<string, unknown>;
    }) => boolean;
}
/**
 * A smart folder descriptor as returned by `getSmartFolders()`.
 */
export interface SmartFolderDescriptor {
    id: string;
    name: string;
    icon: string;
    isBuiltIn: boolean;
    criteria: {
        query: {
            searchScope: string;
            fileTypes: string[];
            excludeHidden: boolean;
            customScopePath?: string;
            nameContains?: string;
            nameMatches?: string;
            modifiedAfter?: string;
            modifiedBefore?: string;
            modifiedWithin?: string;
            createdAfter?: string;
            createdBefore?: string;
            sizeGreaterThan?: number;
            sizeLessThan?: number;
            hasTags?: string[];
            textContent?: string;
            isFolder?: boolean;
            maxResults?: number;
        };
        sizeTierFilter?: {
            enabledTiers: string[];
        };
        gitFilter?: {
            mode: string;
        };
        typeSubSelection?: {
            useGlobalDefaults: boolean;
            categoryOverrides?: Record<string, string[]>;
        };
        declutterConfig?: {
            enabled: boolean;
            minimumScore: number;
        };
        documentExclusions?: {
            excludedExtensions: string[];
        };
    };
}
/**
 * An item submitted to `evaluateFilter`.
 */
export interface FilterEvalItem {
    /** File URL string. */
    url: string;
    /** Arbitrary metadata dictionary. */
    metadata?: Record<string, unknown>;
}
/**
 * Result entry from `evaluateFilter`.
 */
export interface FilterEvalResult {
    /** The file URL string. */
    url: string;
    /** Whether the item passed all registered evaluate callbacks. */
    matched: boolean;
}
export interface SmartFoldersAPI {
    /** Registers a plugin-contributed filter type. */
    registerFilterType(options: RegisterFilterTypeOptions): Promise<string>;
    /** Returns all defined smart folders. */
    getSmartFolders(): Promise<SmartFolderDescriptor[]>;
    /** Evaluates plugin-contributed filter types against a list of items. */
    evaluateFilter(folderId: string, items: FilterEvalItem[]): Promise<FilterEvalResult[]>;
    /** Registers a callback fired after each `evaluateFilter` call. */
    onSmartFolderEvaluated(callback: (payload: {
        folderId: string;
        resultCount: number;
    }) => void): Promise<string>;
    /** Removes a callback registered via `onSmartFolderEvaluated`. */
    offSmartFolderEvaluated(token: string): Promise<void>;
}
export interface PreviewAPI {
    /** Registers a file preview provider. CorePlugin-only in v1. */
    registerProvider(options: unknown): Promise<void>;
    /** Returns true if at least one registered provider can preview the given file. */
    canPreview(filePath: string): Promise<boolean>;
    /** Opens the file preview panel for the given file. */
    showPreview(filePath: string): Promise<void>;
    /** Returns all file extensions that have at least one registered preview provider. */
    getRegisteredTypes(): Promise<string[]>;
}
/**
 * Options for declaring an extension point.
 */
export interface ExtensionPointDeclareOptions {
    /** Human-readable description of the extension point. */
    description?: string;
    /** JSON Schema for validating contributions. */
    schema?: Record<string, unknown>;
    /** Whether multiple contributions are accepted. Default: true. */
    multiple?: boolean;
    /** Access level. Default: "public". */
    access?: "public" | "authenticated" | "restricted";
    /** Plugin IDs allowed to contribute (required for "authenticated" access). */
    allowedContributors?: string[];
}
/**
 * A contribution entry returned by `discover()`.
 */
export interface Contribution {
    /** The contribution's unique ID (UUID string). */
    id: string;
    /** The contributing plugin's ID. */
    contributorPluginId: string;
    /** The contribution data. */
    data: unknown;
    /** The contribution's priority. */
    priority: number;
}
export interface ExtensionPointsAPI {
    /** Declares a new extension point. */
    declare(id: string, options: ExtensionPointDeclareOptions): Promise<string>;
    /** Contributes to an extension point. */
    contribute(targetId: string, contribution: unknown, options?: {
        priority?: number;
    }): Promise<string>;
    /** Discovers contributions to an extension point. */
    discover(pointId: string): Promise<Contribution[]>;
    /** Removes a contribution from an extension point. */
    removeContribution(targetId: string, contributionId: string): Promise<void>;
}
/**
 * Options for exposing a data contract.
 */
export interface DataContractExposeOptions {
    /** Human-readable description of the contract. */
    description?: string;
    /** JSON Schema for the returned data. */
    schema?: Record<string, unknown>;
    /** Provider function called when the contract is queried. */
    provider: (args: unknown) => Promise<unknown>;
}
export interface DataContractsAPI {
    /** Exposes a data contract. */
    expose(contractId: string, version: number, options: DataContractExposeOptions): Promise<string>;
    /** Queries a data contract. */
    query(qualifiedContractId: string, version: number, args: unknown): Promise<unknown>;
    /** Unexposes a data contract. */
    unexpose(contractId: string, version?: number): Promise<void>;
    /** Returns available contracts from declared dependencies. */
    getAvailableContracts(): Promise<string[]>;
}
export interface InterPluginEventsAPI {
    /** Declares an inter-plugin event channel. */
    declareEvent(eventName: string, schema?: Record<string, unknown>): Promise<string>;
    /** Emits an event on a declared channel. */
    emit(eventName: string, payload: unknown): Promise<void>;
    /** Subscribes to an inter-plugin event. */
    subscribe(qualifiedEventName: string, handler: (payload: unknown) => void): Promise<string>;
    /** Unsubscribes from an inter-plugin event. */
    unsubscribe(token: string): Promise<void>;
}
export interface LifecycleAPI {
    /** Registers a handler called when a dependency becomes available. */
    onDependencyAvailable(depId: string, handler: () => void): void;
    /** Registers a handler called when a dependency becomes unavailable. */
    onDependencyUnavailable(depId: string, handler: () => void): void;
    /**
     * Returns the current status of all declared dependencies (system + plugin).
     *
     * Each entry includes installation state, version info, and satisfaction status.
     * System dependencies are probed via `check.command`; plugin dependencies are
     * resolved from the host's plugin registry.
     *
     * @returns Promise resolving to an array of dependency status objects.
     */
    getDependencyStatus(): Promise<DependencyStatus[]>;
    /**
     * Re-runs both system and plugin dependency checks and updates state.
     *
     * Call after the user installs a missing system dependency (e.g., `brew install yt-dlp`).
     * If all required deps become satisfied, the plugin transitions from degraded to active.
     * Fires `onDependencyStatusChanged` handlers if any status changed.
     *
     * @returns Promise resolving to the updated dependency status array.
     */
    recheckDependencies(): Promise<DependencyStatus[]>;
    /**
     * Registers a handler called when any dependency status changes.
     *
     * Fires on:
     * - Host-side `recheckDependencies()` (manual or SwiftUI-triggered)
     * - Plugin-side `recheckDependencies()` (JS bridge call)
     * - Dependency plugin lifecycle changes (activate, deactivate, degraded)
     *
     * @param handler - Callback receiving the full updated status array.
     * @returns A token string that can be used to identify the registration.
     */
    onDependencyStatusChanged(handler: (statuses: DependencyStatus[]) => void): string;
}
/**
 * Describes the source of a workspace template.
 */
export interface WorkspaceTemplateSource {
    /** Source type. */
    type: "builtin" | "user" | "factory" | "imported" | "plugin";
    /** Plugin ID, present only when type is "plugin". */
    pluginId?: string;
}
/**
 * A sidebar favorite item within a workspace template.
 */
export interface WorkspaceTemplateFavoriteItem {
    /** Path (may use `~` for home directory). */
    path: string;
    /** Custom display name. */
    customName?: string;
    /** Custom SF Symbol icon. */
    customIcon?: string;
    /** Sort order within the parent section. */
    sortOrder: number;
}
/**
 * A sidebar section within a workspace template.
 */
export interface WorkspaceTemplateSidebarSection {
    /** Section ID (stringified UUID). */
    id: string;
    /** Section display name. */
    name: string;
    /** SF Symbol icon name. */
    icon: string;
    /** Hex color string. */
    color?: string;
    /** Favorite items in this section. */
    items: WorkspaceTemplateFavoriteItem[];
    /** Sort order. */
    sortOrder: number;
}
/**
 * Sidebar configuration within a workspace template.
 */
export interface WorkspaceTemplateSidebarConfig {
    /** Activity view plugin panel ID. */
    activityView?: string;
    /** Custom sidebar sections. */
    sections: WorkspaceTemplateSidebarSection[];
    /** Favorite items. */
    favorites: WorkspaceTemplateFavoriteItem[];
    /** Smart folder IDs (stringified UUIDs). */
    smartFolderIds: string[];
}
/**
 * A tab slot defining one tab's content in a pane.
 */
export interface WorkspaceTemplateTabSlot {
    /** Tab content type. */
    type: "fileBrowser" | "pluginPanel" | "fileViewer" | "codeEditor" | "terminal" | "webBrowser" | "ai" | "cliChat" | "markdown" | string;
    /** File browser path (type: fileBrowser). */
    path?: string;
    /** Plugin panel ID (type: pluginPanel). */
    panelId?: string;
    /** URL string (type: fileViewer, webBrowser, markdown). */
    url?: string;
    /** File URL string (type: codeEditor). */
    fileURL?: string;
    /** Working directory (type: terminal). */
    cwd?: string;
    /** Working directory (type: cliChat). */
    workingDirectory?: string;
}
/**
 * Pane layout configuration.
 */
export interface WorkspaceTemplatePaneConfig {
    /** Tab definitions for this pane. */
    tabs: WorkspaceTemplateTabSlot[];
    /** Index of the active tab. */
    activeTab: number;
}
/**
 * A user-prompted variable resolved at apply time.
 */
export interface WorkspaceTemplateVariable {
    /** Variable type. */
    type: "promptPath" | "promptString" | "pickString";
    /** Prompt text shown to the user. */
    prompt: string;
    /** Default value. */
    default?: string;
    /** Options for pickString type. */
    options?: string[];
}
/**
 * A workspace template describing an entire window layout.
 */
export interface WorkspaceTemplate {
    /** Schema version (starts at 1). */
    schemaVersion: number;
    /** Unique identifier. */
    id: string;
    /** Human-readable display name. */
    name: string;
    /** Optional long description. */
    description?: string;
    /** SF Symbol name for the workspace icon. */
    icon?: string;
    /** Hex color string for accent tinting. */
    accentColor?: string;
    /** Author attribution. */
    author?: string;
    /** Plugin IDs this workspace depends on. */
    requires?: string[];
    /** Sidebar configuration. */
    sidebar?: WorkspaceTemplateSidebarConfig;
    /** Left pane layout. */
    leftPane?: WorkspaceTemplatePaneConfig;
    /** Right pane layout. */
    rightPane?: WorkspaceTemplatePaneConfig;
    /** User-prompted variables (keyed by variable name). */
    variables?: Record<string, WorkspaceTemplateVariable>;
    /** Where this workspace came from. */
    source: WorkspaceTemplateSource;
}
export interface WorkspacesAPI {
    /** Registers an ephemeral workspace template. */
    register(template: Partial<WorkspaceTemplate> & {
        id: string;
        name: string;
    }): Promise<string>;
    /** Lists all available workspace templates (all sources). */
    list(): Promise<WorkspaceTemplate[]>;
    /** Applies a workspace template to the current window. */
    apply(workspaceId: string): Promise<boolean>;
    /** Returns the active workspace ID for the current window. */
    getActive(): Promise<string | null>;
    /** Subscribes to workspace change events for the current window. */
    onChange(callback: (workspaceId: string | null) => void): Promise<string>;
}
/** Options for `cache.set()`. */
export interface CacheSetOptions {
    /** Time-to-live in seconds. Omit for no expiry. */
    ttl?: number;
    /** When true, writes through to SQLite disk tier. Default: memory-only. */
    persist?: boolean;
}
export interface CacheAPI {
    /** Returns the cached value, or null if missing/expired. */
    get(key: string): Promise<unknown | null>;
    /** Stores a JSON-serializable value. */
    set(key: string, value: unknown, options?: CacheSetOptions): Promise<true>;
    /** Removes a single entry. */
    remove(key: string): Promise<true>;
    /** Clears all entries for the calling plugin. */
    clear(): Promise<true>;
    /** Checks if a non-expired entry exists. */
    has(key: string): Promise<boolean>;
    /** Returns all non-expired keys for the calling plugin. */
    keys(): Promise<string[]>;
}
/** Options for toast/notify. */
export interface FeedbackToastOptions {
    /** Visual style. */
    kind?: "info" | "success" | "warning" | "error";
    /** Duration in seconds (clamped to 0.5–30s). */
    duration?: number;
}
/** Options for HUD panels. */
export interface FeedbackHudOptions {
    /** Visual style. */
    kind?: "info" | "success" | "warning" | "error";
    /** Progress value 0–1, or omit for indeterminate. */
    progress?: number;
}
/** Options for HUD updates. */
export interface FeedbackHudUpdateOptions {
    /** Updated progress value 0–1. */
    progress?: number;
    /** Updated message text. */
    message?: string;
}
/** Options for NSAlert. */
export interface FeedbackAlertOptions {
    /** Secondary message text. */
    informativeText?: string;
    /** Button labels (first is default). */
    buttons?: string[];
    /** Alert style. */
    style?: "informational" | "warning" | "critical";
}
/** Options for system notifications. */
export interface FeedbackNotificationOptions {
    /** Visual style for categorization. */
    kind?: "info" | "success" | "warning" | "error";
}
export interface FeedbackAPI {
    /** Shows a toast. */
    toast(message: string, options?: FeedbackToastOptions): Promise<boolean>;
    /** Shows a HUD panel. Returns handle ID. */
    hud(message: string, options?: FeedbackHudOptions): Promise<string>;
    /** Updates an existing HUD panel. */
    updateHud(id: string, options: FeedbackHudUpdateOptions): Promise<true>;
    /** Dismisses a HUD panel. */
    dismissHud(id: string): Promise<true>;
    /** Shows an NSAlert. Returns 0-based button index. */
    alert(message: string, options?: FeedbackAlertOptions): Promise<number>;
    /** Sends a system notification. */
    systemNotification(title: string, message: string, options?: FeedbackNotificationOptions): Promise<true>;
    /** Adaptive routing: focused->toast, unfocused->HUD, background->system. */
    notify(message: string, options?: FeedbackToastOptions): Promise<true>;
}
/** Options for `oauth.authorize()`. */
export interface OAuthAuthorizeOptions {
    /** OAuth client ID (required). */
    clientId: string;
    /** Requested scopes (must be subset of manifest-declared scopes). */
    scopes?: string[];
}
/** Token data returned from `oauth.authorize()` and `oauth.getToken()`. */
export interface OAuthTokenResult {
    /** The access token string. */
    accessToken: string;
    /** Token type (typically "Bearer"). */
    tokenType: string;
    /** Expiry timestamp in ISO 8601 format, or null if no expiry. */
    expiresAt: string | null;
    /** Granted scopes. */
    scopes: string[];
}
/**
 * Discriminated-union token result from the secure OAuth methods.
 *
 * - `mode: "direct"` — the raw token is returned inline (legacy-compatible).
 * - `mode: "vault"` — the token lives in the fn-72 Vault; JS receives an
 *   opaque handle and should use `oauth.buildAuthenticatedRequest(...)` +
 *   `network.executeRequest(...)` so the raw token never crosses into JS.
 */
export type OAuthSecureTokenResult = ({
    mode: "direct";
} & OAuthTokenResult) | {
    mode: "vault";
    /** Opaque vault handle for the stored token. */
    handleId: string;
    /** Token type (typically "Bearer"). */
    tokenType?: string;
    /** Expiry timestamp in ISO 8601 format, or null. */
    expiresAt?: string | null;
    /** Granted scopes. */
    scopes?: string[];
};
export interface OAuthAPI {
    /** Starts OAuth 2.0 + PKCE flow. Opens system browser. */
    authorize(provider: string, options: OAuthAuthorizeOptions): Promise<OAuthTokenResult>;
    /** Returns stored token, or null if not authorized / expired. */
    getToken(provider: string): Promise<OAuthTokenResult | null>;
    /** Deletes stored tokens and cancels refresh schedule. */
    revoke(provider: string): Promise<true>;
    /** Checks if a non-expired token exists. */
    isAuthorized(provider: string): Promise<boolean>;
    /**
     * Vault-aware authorize (fn-72). Returns a mode-discriminated result —
     * `"vault"` mode keeps the raw token host-side.
     */
    authorizeSecure(provider: string, options?: OAuthAuthorizeOptions): Promise<OAuthSecureTokenResult>;
    /** Vault-aware token read. Null when not authorized / expired. */
    getTokenSecure(provider: string): Promise<OAuthSecureTokenResult | null>;
    /**
     * Builds a server-held authenticated URLRequest for the provider's stored
     * token. Returns a single-use `requestId` to pass to
     * `network.executeRequest(...)`. Requires the oauth + network permissions
     * (NOT vault.* scopes); JS never sees the raw token.
     */
    buildAuthenticatedRequest(provider: string, descriptor: unknown): Promise<string>;
}
/** Options for `menubar.register()`. */
export interface MenuBarRegisterOptions {
    /** SF Symbol name for the status item icon (required). */
    icon: SFSymbolName;
    /** Optional display label next to the icon. */
    label?: string;
}
/** Options for `menubar.update()`. */
export interface MenuBarUpdateOptions {
    /** Updated SF Symbol name. */
    icon?: SFSymbolName;
    /** Updated label text. */
    label?: string;
}
/**
 * Context passed to the `menuBarOpen(context)` export when a popover opens.
 */
export interface MenuBarRenderContext {
    /** Plugin ID of the owning plugin. */
    pluginId: string;
    /** Updates the popover UI with a ViewDescriptor. */
    setContent(descriptor: ViewDescriptor): void;
    /** Dismisses the popover. */
    close(): void;
    /** Scoped cache API (omitted if plugin lacks `cache` permission). */
    cache?: Pick<CacheAPI, "get" | "set" | "remove">;
}
export interface MenubarAPI {
    /** Creates an NSStatusItem for this plugin. */
    register(options: MenuBarRegisterOptions): Promise<true>;
    /** Updates the icon and/or label. */
    update(options: MenuBarUpdateOptions): Promise<true>;
    /** Sets badge overlay count (0 clears). */
    setBadge(count: number): Promise<true>;
    /** Stores a view descriptor for the popover content. */
    setContent(descriptor: ViewDescriptor): Promise<true>;
    /** Removes the NSStatusItem. */
    remove(): Promise<true>;
}
//# sourceMappingURL=namespaces.d.ts.map