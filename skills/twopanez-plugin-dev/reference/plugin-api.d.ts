/**
 * 2Panez Plugin API Type Definitions (Phase 2b-iii)
 *
 * These types define the contract between plugins and the host application.
 * Plugins receive a `PluginContext` object in their `activate(context)` function.
 *
 * @version 2.0.0-phase2b-iii
 */

// ============================================================================
// Data Types
// ============================================================================

/**
 * Describes a file or directory visible to plugins.
 *
 * This is a bridge-specific DTO — it does NOT expose internal FileItem details
 * like icon names or sort keys. All fields are JSON-safe.
 */
interface PluginFileDescriptor {
  /** File URL as a string (e.g., "file:///Users/alice/Documents/readme.md"). */
  url: string;
  /** File name including extension (e.g., "readme.md"). */
  name: string;
  /** Whether this item is a directory. */
  isDirectory: boolean;
  /** File size in bytes, or null for directories. */
  size: number | null;
  /** Modification date in ISO 8601 format, or null if unavailable. */
  modificationDate: string | null;
  /** Whether the file is hidden. */
  isHidden: boolean;
  /** Lowercase file extension without the dot, or null for items without extension. */
  fileExtension: string | null;
}

/**
 * JSON-based view descriptor for plugin UI contributions.
 *
 * Plugins submit UI as JSON descriptors rather than arbitrary views.
 * The host maps these to a fixed set of SwiftUI component templates.
 */
interface ViewDescriptor {
  /** The type of UI element. */
  type: "text" | "image" | "hstack" | "vstack" | "button" | "section" | "divider" | "spacer" | "scroll" | "label" | "badge" | "list" | "listItem";
  /** Child descriptors for container types (hstack, vstack, section, scroll, list). */
  children?: ViewDescriptor[];
  /** 
   * Type-specific properties.
   * - `text`: `content` (string), `font` (string), `width` (number, fixed pt), `align` ("leading"|"trailing"|"center"), `mono` (boolean, .monospacedDigit()), `tooltip` (string)
   * - `button`: `title` (string), `action` (string), `width` (number, fixed pt), `tooltip` (string, shown on hover — width-constrained buttons also get hover background)
   * - `section`: `id` (string), `title` (string), `icon` (string SF symbol), `badge` (string), `isExpanded` (boolean)
   * - `scroll`: `axes` ("horizontal" | "vertical")
   * - `label`: `title` (string), `icon` (string SF symbol), `font` (string)
   * - `badge`: `text` or `content` (string), `color` (hex or system color name)
   * - `listItem`: `title` (string), `subtitle` (string), `icon` (string), `iconColor` (string), `trailing` (string), `action` (string),
   *    `menuActions` (JSON string of [{title, icon?, action, destructive?}] — native right-click context menu. Use "---" title for divider).
   *    When `children` are present, they render as fixed-width trailing columns (replacing `trailing` badge).
   *    Use text/button children with `width` set for aligned sidebar columns.
   *    Title shows native tooltip on hover for full text visibility.
   * - `spacer`: `minLength` (number)
   *
   * Column alignment example (File Stats):
   * ```json
   * { "type": "listItem", "properties": { "title": ".json", "icon": "doc" },
   *   "children": [
   *     { "type": "text", "properties": { "content": "1", "width": 36, "align": "trailing", "font": "caption", "mono": true } },
   *     { "type": "text", "properties": { "content": "(4.8%)", "width": 54, "align": "trailing", "font": "caption" } }
   *   ]
   * }
   * ```
   */
  properties?: Record<string, string | boolean | number>;
}

/**
 * Options for command registration.
 */
interface CommandOptions {
  /** Human-readable title for the command. */
  title: string;
  /** SF Symbol name for the command icon. */
  icon?: string;
  /** Keyboard shortcut string (e.g., "cmd+shift+t"). */
  shortcut?: string;
  /** Condition when the command is available (e.g., "isDirectory"). Phase 1b: stored but not evaluated. */
  condition?: string;
  /** The handler function called when the command is executed. */
  handler: () => void | Promise<void>;
}

/**
 * Options for structured panel registration.
 */
interface PanelOptions {
  /** Display title for the panel. */
  title: string;
  /** SF Symbol name for the panel icon. */
  icon?: string;
  /** Target region: "sidebar" or "pane". Default: "sidebar". */
  target?: "sidebar" | "pane";
  /** Position hint: "top" or "bottom" (for sidebar). Default: "bottom". */
  position?: "top" | "bottom";
  /** JSON view descriptor for the panel content. Accepts "view" or "content" key. */
  view: ViewDescriptor;
  /** Handler function invoked for interactive elements. */
  handler?: (action: string) => void | Promise<void>;
  /** Priority for ordering (100+ for plugins, lower = higher priority). */
  priority?: number;
}

/**
 * Options for activity bar item registration.
 */
interface ActivityBarItemOptions {
  /** Display title for the item. */
  title: string;
  /** SF Symbol name for the item icon. */
  icon: string;
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
interface ActivityViewOptions {
  /** Display title for the activity view. */
  title: string;
  /** SF Symbol name for the activity icon. */
  icon: string;
  /** Optional badge text. */
  badge?: string;
  /** JSON view descriptor for the sidebar content. */
  view: ViewDescriptor;
  /** Handler function invoked for interactive elements within the view. */
  handler?: (action: string) => void | Promise<void>;
  /** Priority for ordering (100+ for plugins). */
  priority?: number;
}

/**
 * Options for status bar item registration.
 */
interface StatusBarItemOptions {
  /** Display text for the item. */
  text: string;
  /** SF Symbol name for the item icon. */
  icon?: string;
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
interface ContextMenuItemOptions {
  /** Display title for the menu item. */
  title: string;
  /** SF Symbol name for the menu item icon. */
  icon?: string;
  /** Condition type for when to show: "always" (default), "isDirectory", "isFile". */
  condition?: "always" | "isDirectory" | "isFile";
  /** Handler function invoked when the item is selected. */
  handler: () => void | Promise<void>;
}

/**
 * Options for toolbar item registration.
 */
interface ToolbarItemOptions {
  /** Display title for the item. */
  title: string;
  /** SF Symbol name for the item icon. */
  icon: string;
  /** Handler function invoked when the item is clicked. */
  handler: () => void | Promise<void>;
}

/**
 * Options for file row annotation registration.
 */
interface FileRowAnnotationOptions {
  /** Display title for the annotation. */
  title?: string;
  /** SF Symbol name for the annotation icon. */
  icon?: string;
  /** Handler function invoked to determine annotation state for a file. */
  handler: (fileDescriptor: PluginFileDescriptor) => any;
}

/**
 * Options for showing a notification toast.
 */
interface NotificationOptions {
  /** Notification message text. */
  message: string;
  /** Notification type: "info", "success", "warning", "error". Default: "info". */
  type?: "info" | "success" | "warning" | "error";
  /** Duration in seconds before auto-dismiss. Default: 2. */
  duration?: number;
}

/**
 * Options for showing a modal sheet.
 *
 * The entire options object is converted to a view descriptor dictionary.
 * Include a "view" or "content" key with a ViewDescriptor, or pass
 * view descriptor properties directly.
 */
interface SheetOptions {
  /** Sheet title. */
  title: string;
  /** JSON view descriptor for the sheet content. */
  view?: ViewDescriptor;
  /** Whether the sheet is dismissable by clicking outside. Default: true. */
  dismissable?: boolean;
}

/**
 * Options for content panel registration.
 */
interface PanelOptions {
  /** Display title for the panel. */
  title: string;
  /** SF Symbol name for the panel icon. */
  icon?: string;
  /** Position hint: "top" or "bottom". Default: "bottom". */
  position?: "top" | "bottom";
  /** JSON view descriptor for the panel content. */
  view: ViewDescriptor;
  /** Handler function invoked for interactive elements. */
  handler?: (action: string) => void | Promise<void>;
  /** Priority for ordering (100+ for plugins). */
  priority?: number;
}

/**
 * File operation types that can be hooked.
 */
type FileOperationType =
  | "copy"
  | "move"
  | "delete"
  | "rename"
  | "createFile"
  | "createDirectory"
  | "writeFile";

/**
 * A single operation in a `fileOps.batch()` call.
 */
type BatchOperation =
  | { type: "copy"; sources: string[]; dest: string }
  | { type: "move"; sources: string[]; dest: string }
  | { type: "delete"; urls: string[]; trash?: boolean }
  | { type: "rename"; url: string; newName: string }
  | { type: "createDirectory"; parentUrl: string; name: string }
  | { type: "createFile"; parentUrl: string; name: string; contents?: string };

/**
 * Information passed to before/after hook handlers.
 *
 * The coordinator sends `{ type, paths }` for before-hooks and
 * `{ type, paths, success, error?, ...extras }` for after-hooks.
 */
interface FileOperationEvent {
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
 *
 * Phase 1b behavior: returning ANY non-null/non-undefined object cancels
 * the operation. The `reason` field is read for display purposes.
 * Return `undefined` or `null` to allow the operation to proceed.
 */
interface BeforeHookResult {
  /** Reason for cancellation (shown to the user/calling plugin). */
  reason?: string;
}

// ============================================================================
// Plugin Context API
// ============================================================================

/**
 * The main plugin context object passed to `activate(context)`.
 *
 * Provides access to all Phase 1b API namespaces: file operations,
 * commands, UI contributions, storage, and settings.
 */
interface PluginContext {
  /** Lifecycle hooks (dependency notifications). */
  readonly lifecycle: LifecycleAPI;
  /** Command registration and execution. */
  readonly commands: CommandsAPI;
  /** File system operations. */
  readonly fileOps: FileOpsAPI;
  /** UI contribution methods. */
  readonly ui: UIAPI;
  /** Scoped key-value storage. */
  readonly storage: StorageAPI;
  /** Plugin settings from manifest. */
  readonly settings: SettingsAPI;
  /** Extension point declaration and contribution (Phase 2a). */
  readonly extensionPoints: ExtensionPointsAPI;
  /** Data contract exposure and querying (Phase 2a). */
  readonly dataContracts: DataContractsAPI;
  /** Inter-plugin event channels (Phase 2a). */
  readonly interPluginEvents: InterPluginEventsAPI;
  /** Smart folder filter type registration and evaluation (fn-13 Phase 2b). */
  readonly smartFolders: SmartFoldersAPI;
  /**
   * File preview registry queries and programmatic preview triggering (fn-13 Phase 2b).
   * Note: `registerProvider` is CorePlugin-only in v1 — JS callers receive ContractValidationError.
   */
  readonly preview: PreviewAPI;
  /** Host event subscriptions (fn-11 + fn-13.5). */
  readonly events: HostEventsAPI;
  /** Network fetch and download (fn-14 Phase 2b-ii). Requires `network.outbound` or `network.unrestricted`. */
  readonly network: NetworkAPI;
  /** Shell command execution (fn-14 Phase 2b-ii). Requires `shell.execute`. */
  readonly shell: ShellAPI;
  /** System clipboard read/write (fn-14 Phase 2b-ii). Requires `clipboard.read` / `clipboard.write`. */
  readonly clipboard: ClipboardAPI;
  /** Keyboard shortcut registration (fn-15 Phase 2b-iii). Requires `ui.shortcuts`. */
  readonly shortcuts: ShortcutsAPI;
  /** Theme registration and activation (fn-15 Phase 2b-iii). Requires `ui.themes` for mutations. */
  readonly themes: ThemesAPI;
}

// ============================================================================
// Host Events API (fn-11 + fn-13.5)
// ============================================================================

/**
 * Payload delivered to `fileOps.operationCompleted` subscribers.
 *
 * Fires once per operation in a `fileOps.batch()` call (success AND failure),
 * enabling plugins to observe all outcomes without polling.
 */
interface FileOpCompletedPayload {
  /** The operation type. Note: `writeFile` is not a batch-supported type; only the listed values appear. */
  type: "copy" | "move" | "delete" | "rename" | "createDirectory" | "createFile";
  /**
   * Affected URL strings.
   *
   * **On success** — mirrors the hook-path composition:
   * - `copy`/`move`: `[...sources, destDir, ...computedPerSourceDestinations]`
   * - `delete`: `[...urls]`
   * - `rename`: `[oldUrl, newUrl]`
   * - `createDirectory`/`createFile`: `[parentUrl, createdUrl]`
   *
   * **On failure** — contains only the raw input paths (no computed destinations),
   * because the operation may have failed before any destination path was validated.
   * - `copy`/`move`: `[...sources, destDir]` (no per-source destinations)
   * - `delete`: `[...urls]`
   * - `rename`: `[oldUrl]`
   * - `createDirectory`/`createFile`: `[parentUrl]`
   */
  paths: string[];
  /** Whether the operation succeeded. */
  success: boolean;
  /** Error message if the operation failed; absent on success. */
  error?: string;
  /** Plugin ID that initiated the operation. */
  initiatorPluginId: string;
}

/**
 * Host event subscriptions (`context.events`).
 *
 * Supported events:
 *
 * | Event | Permission | Payload |
 * |-------|-----------|---------|
 * | `navigation.directoryChanged` | `filesystem.read` or `filesystem.readAll` | `{paneId, oldUrl, newUrl}` |
 * | `navigation.paneActivated` | `filesystem.read` | `{paneId}` |
 * | `selection.changed` | `filesystem.read` | `{paneId, selectedPaths}` |
 * | `smartFolder.evaluated` | `filesystem.read` | `{folderId, resultCount}` |
 * | `app.willQuit` | none | `{}` |
 * | `app.didBecomeActive` | none | `{}` |
 * | `plugin.activated` | none | `{pluginId}` |
 * | `plugin.deactivated` | none | `{pluginId}` |
 * | `fileOps.operationCompleted` | `filesystem.readAll` | `FileOpCompletedPayload` |
 */
interface HostEventsAPI {
  /**
   * Subscribes to a host event.
   * @param eventName - One of the supported event names listed above.
   * @param handler - Callback invoked with the event payload.
   * @returns Subscription token; pass to `unsubscribe()` to cancel.
   */
  subscribe(eventName: string, handler: (payload: unknown) => void): string;

  /**
   * Cancels a host event subscription.
   * @param token - Token returned by `subscribe()`.
   */
  unsubscribe(token: string): void;
}

// ============================================================================
// Lifecycle API
// ============================================================================

interface LifecycleAPI {
  /**
   * Registers a handler called when a dependency becomes available.
   * @param depId - The dependency plugin ID.
   * @param handler - Callback invoked when the dependency activates.
   */
  onDependencyAvailable(depId: string, handler: () => void): void;

  /**
   * Registers a handler called when a dependency becomes unavailable.
   * @param depId - The dependency plugin ID.
   * @param handler - Callback invoked when the dependency deactivates.
   */
  onDependencyUnavailable(depId: string, handler: () => void): void;
}

// ============================================================================
// Commands API
// ============================================================================

interface CommandsAPI {
  /**
   * Registers a command.
   *
   * The plugin passes a SHORT ID (e.g., "myCmd"). The bridge auto-prefixes
   * with `{pluginId}.` to form the full ID (e.g., "com.myplugin.myCmd").
   *
   * @param id - Short command ID (will be prefixed with plugin ID).
   * @param handlerOrOptions - Either a handler function (backward compat) or CommandOptions.
   */
  register(id: string, handlerOrOptions: (() => void | Promise<void>) | CommandOptions): void;

  /**
   * Executes a command by ID.
   *
   * Allowed targets: own commands, core commands (`com.2panez.*`).
   * Cross-plugin execution is blocked in Phase 1b.
   *
   * @param id - Command ID (short own, full own, or full core).
   * @param args - Optional arguments (reserved for future use).
   * @returns Promise that resolves when the command completes.
   */
  execute(id: string, args?: Record<string, unknown>): Promise<void>;

  /**
   * Returns the calling plugin's own registered commands as short IDs.
   * @returns Array of short command ID strings.
   */
  getRegistered(): string[];

  /**
   * Registers a handler called after a command executes.
   *
   * Own-namespace commands ONLY. Subscribing to core (`com.2panez.*`) or
   * other plugins' commands is rejected with an error.
   *
   * @param id - Short command ID (own namespace only).
   * @param handler - Callback with execution details.
   * @returns Subscription ID for cancellation.
   */
  onCommandExecuted(id: string, handler: (details: Record<string, unknown>) => void): string;
}

// ============================================================================
// File Operations API
// ============================================================================

interface FileOpsAPI {
  /**
   * Returns file descriptors for the active pane's selected files.
   * Requires: `filesystem.read`
   */
  getSelectedFiles(): Promise<PluginFileDescriptor[]>;

  /**
   * Returns the URL string of the active pane's current directory.
   * Requires: `filesystem.read`
   */
  getActiveDirectory(): Promise<string>;

  /**
   * Returns the URL string of the specified pane's directory.
   * Requires: `filesystem.read`
   * @param paneId - "left" or "right"
   */
  getPaneDirectory(paneId: string): Promise<string>;

  /**
   * Lists directory contents.
   * Requires: `filesystem.read` (pane dirs only) or `filesystem.readAll` (any path)
   * @param url - Directory URL string.
   */
  listDirectory(url: string): Promise<PluginFileDescriptor[]>;

  /**
   * Returns metadata for a single file.
   * Requires: `filesystem.read` or `filesystem.readAll`
   * @param url - File URL string.
   */
  getFileInfo(url: string): Promise<PluginFileDescriptor>;

  /**
   * Reads a text file.
   * Requires: `filesystem.read` or `filesystem.readAll`
   * @param url - File URL string.
   * @param encoding - Text encoding (e.g., "utf-8"). Default: "utf-8".
   */
  readFile(url: string, encoding?: string): Promise<string>;

  /**
   * Reads a file as a base64-encoded string.
   * Requires: `filesystem.read` or `filesystem.readAll`
   *
   * To decode in JavaScript:
   * ```js
   * const base64 = await context.fileOps.readFileData(url);
   * const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
   * ```
   *
   * @param url - File URL string.
   * @returns Base64-encoded string of the file contents.
   */
  readFileData(url: string): Promise<string>;

  /**
   * Copies files to a destination directory.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   * @param sources - Array of source file URL strings.
   * @param dest - Destination directory URL string.
   */
  copy(sources: string[], dest: string): Promise<void>;

  /**
   * Moves files to a destination directory.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   * @param sources - Array of source file URL strings.
   * @param dest - Destination directory URL string.
   */
  move(sources: string[], dest: string): Promise<void>;

  /**
   * Deletes files.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   * @param urls - Array of file URL strings to delete.
   * @param trash - If true, move to Trash; if false, permanently delete. Default: true.
   */
  delete(urls: string[], trash?: boolean): Promise<void>;

  /**
   * Renames a file.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   * @param url - File URL string to rename.
   * @param newName - The new file name.
   * @returns The new URL string after renaming.
   */
  rename(url: string, newName: string): Promise<string>;

  /**
   * Creates a new directory.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   * @param parentUrl - Parent directory URL string.
   * @param name - Name for the new directory.
   * @returns The URL string of the created directory.
   */
  createDirectory(parentUrl: string, name: string): Promise<string>;

  /**
   * Creates a new file with optional initial contents.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   * @param parentUrl - Parent directory URL string.
   * @param name - Name for the new file.
   * @param contents - Optional initial text content.
   * @returns The URL string of the created file.
   */
  createFile(parentUrl: string, name: string, contents?: string): Promise<string>;

  /**
   * Writes text content to an existing file.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   * @param url - File URL string.
   * @param contents - Text content to write.
   * @param encoding - Text encoding. Default: "utf-8".
   */
  writeFile(url: string, contents: string, encoding?: string): Promise<void>;

  /**
   * Watches a directory for changes.
   * Requires: `filesystem.watch` (pane-root containment enforced)
   * @param url - Directory URL string to watch.
   * @param handler - Callback with changed file paths.
   * @returns Subscription ID for cancellation via `unwatchDirectory`.
   */
  watchDirectory(url: string, handler: (changedPaths: string[]) => void): string;

  /**
   * Watches a directory for changes with configurable debounce and recursion.
   * Requires: `filesystem.watch` (pane-root containment enforced)
   *
   * Backward-compatible alternative to `watchDirectory` for plugins that need
   * fine-grained control over event delivery.
   *
   * @param url - Directory URL string to watch.
   * @param options - Optional configuration.
   *   - `debounceMs` — FSEventStream latency in milliseconds. Range: 0–5000.
   *     Default: 500 (0.5 s, matching `watchDirectory` behavior).
   *     200 ms is recommended for interactive plugins; 500 ms for background.
   *   - `recursive` — When `false`, only immediate children of the watched
   *     directory trigger the callback. Default: `true`.
   * @param handler - Callback with changed file paths.
   * @returns Subscription ID for cancellation via `unwatchDirectory`.
   */
  watchDirectoryWithOptions(
    url: string,
    options: { debounceMs?: number; recursive?: boolean },
    handler: (changedPaths: string[]) => void
  ): string;

  /**
   * Executes multiple file operations as a batch.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   *
   * Operations execute sequentially in array order. On individual failure,
   * execution continues (partial failure). Before/after hooks fire per
   * operation. Maximum 1000 operations per call.
   *
   * Supported operation types and their fields:
   * - `{ type: "copy",            sources: string[], dest: string }`
   * - `{ type: "move",            sources: string[], dest: string }`
   * - `{ type: "delete",          urls: string[], trash?: boolean }` (trash defaults to true)
   * - `{ type: "rename",          url: string, newName: string }`
   * - `{ type: "createDirectory", parentUrl: string, name: string }`
   * - `{ type: "createFile",      parentUrl: string, name: string, contents?: string }`
   *
   * @param operations - Array of operation descriptors.
   * @returns Array of per-operation results: `{ index, success, error? }`.
   */
  batch(
    operations: BatchOperation[]
  ): Promise<Array<{ index: number; success: boolean; error?: string }>>;

  /**
   * Registers a before-operation hook for write operations.
   * Requires: `filesystem.write` or `filesystem.writeAll`
   *
   * The initiating plugin's own hook is SKIPPED.
   * Each handler has a 2-second timeout; global 10-second budget.
   *
   * @param type - Operation type(s) to hook.
   * @param handler - Callback that may return `{ reason?: string }` (or any non-null object) to cancel.
   * @returns Subscription ID for cancellation via `removeBeforeHook`.
   */
  onBeforeOperation(
    type: FileOperationType | FileOperationType[],
    handler: (event: FileOperationEvent) => BeforeHookResult | void
  ): string;

  /**
   * Registers an after-operation hook for write operations.
   * Requires: `filesystem.read` or `filesystem.readAll`
   *
   * Fire-and-forget: no timeout, no cancellation capability.
   *
   * @param type - Operation type(s) to hook.
   * @param handler - Callback with operation result.
   * @returns Subscription ID for cancellation via `removeAfterHook`.
   */
  onAfterOperation(
    type: FileOperationType | FileOperationType[],
    handler: (event: FileOperationEvent) => void
  ): string;

  /**
   * Cancels a directory watcher subscription.
   * @param subscriptionId - ID returned by `watchDirectory`.
   */
  unwatchDirectory(subscriptionId: string): void;

  /**
   * Removes a before-hook subscription.
   * @param subscriptionId - ID returned by `onBeforeOperation`.
   */
  removeBeforeHook(subscriptionId: string): void;

  /**
   * Removes an after-hook subscription.
   * @param subscriptionId - ID returned by `onAfterOperation`.
   */
  removeAfterHook(subscriptionId: string): void;
}

// ============================================================================
// UI API
// ============================================================================

interface UIAPI {
  /**
   * Registers a structured panel (sidebar or pane).
   * Requires: `ui.sidebar`
   * @param id - Unique panel identifier.
   * @param options - Panel configuration.
   * @returns Registration ID for updates or cleanup.
   */
  registerPanel(id: string, options: PanelOptions): string;

  /**
   * Updates an existing structured panel's content.
   * Requires: `ui.sidebar`
   * @param id - The ID used during registration.
   * @param options - Partial panel configuration (usually requires just `view`).
   * @returns Registration ID.
   */
  updatePanel(id: string, options: Partial<PanelOptions>): string;

  /**
   * Registers a sidebar panel.
   * @deprecated Use `registerPanel` with `target: "sidebar"` instead.
   * Requires: `ui.sidebar`
   * @param id - Unique panel identifier.
   * @param options - Panel configuration.
   * @returns Registration ID.
   */
  registerSidebarPanel(id: string, options: PanelOptions): string;

  /**
   * Registers an activity bar item.
   * Requires: `ui.sidebar`
   * @param id - Unique item identifier.
   * @param options - Item configuration.
   * @returns SlotToken ID for cleanup.
   */
  registerActivityBarItem(id: string, options: ActivityBarItemOptions): string;

  /**
   * Registers a structured activity sidebar view.
   * Requires: `ui.sidebar`
   * @param id - Unique view identifier.
   * @param options - View configuration.
   * @returns Registration ID for updates or cleanup.
   */
  registerActivityView(id: string, options: ActivityViewOptions): string;

  /**
   * Registers a status bar item.
   * Requires: `ui.statusBar`
   * @param id - Unique item identifier.
   * @param options - Item configuration.
   * @returns SlotToken ID for cleanup.
   */
  registerStatusBarItem(id: string, options: StatusBarItemOptions): string;
  
  /**
   * Unregisters an existing slot-based UI contribution (sidebar panel, activity bar item, status bar item).
   * @param tokenId The unique token ID returned by the registration method.
   */
  unregister(tokenId: string): void;

  /**
   * Registers a content panel.
   * Requires: `ui.sidebar`
   * @param id - Unique panel identifier.
   * @param options - Panel configuration.
   * @returns SlotToken ID for cleanup.
   */
  showPanel(id: string, options: PanelOptions): string;

  /**
   * Registers a context menu item.
   * Requires: `ui.contextMenu`
   * @param id - Unique item identifier.
   * @param options - Menu item configuration.
   * @returns Registration ID for cleanup.
   */
  registerContextMenuItem(id: string, options: ContextMenuItemOptions): string;

  /**
   * Registers a toolbar item.
   * Requires: `ui.sidebar` (per fn-7 grouping)
   * @param id - Unique item identifier.
   * @param options - Toolbar item configuration.
   * @returns Registration ID for cleanup.
   */
  registerToolbarItem(id: string, options: ToolbarItemOptions): string;

  /**
   * Registers a file row annotation provider.
   * Requires: `ui.sidebar`
   * @param id - Unique annotation identifier.
   * @param options - Annotation configuration.
   * @returns Registration ID for cleanup.
   */
  registerFileRowAnnotation(id: string, options: FileRowAnnotationOptions): string;

  /**
   * Shows a notification toast.
   * Requires: `ui.notifications`
   * Fire-and-forget: no return value.
   * @param options - Notification configuration.
   */
  showNotification(options: NotificationOptions): void;

  /**
   * Shows a modal sheet.
   * Requires: `ui.sheets`
   * Fire-and-forget: no return value.
   * @param options - Sheet configuration.
   */
  showSheet(options: SheetOptions): void;

  /**
   * Sets the quick filter text on the active pane's file list.
   *
   * This activates the same filter bar as typing in the file browser.
   * Pass an empty string to clear the filter.
   *
   * No additional permission required beyond `ui.sidebar`.
   * @param text - Filter text (e.g. ".json", "readme"). Empty string clears.
   */
  setQuickFilter(text: string): void;
}

// ============================================================================
// Storage API
// ============================================================================

interface StorageAPI {
  /**
   * Gets a value from the plugin's scoped storage.
   * No permission required.
   * @param key - Storage key.
   * @returns The stored value, or null if not found.
   */
  get(key: string): unknown | null;

  /**
   * Sets a value in the plugin's scoped storage.
   * No permission required.
   * Values must be JSON-serializable. Max 1MB per value, 10MB total per plugin.
   * @param key - Storage key.
   * @param value - Value to store (must be JSON-serializable).
   */
  set(key: string, value: unknown): void;

  /**
   * Reads a string value from the macOS Keychain (plugin-scoped).
   *
   * Keychain items are stored under `kSecAttrService = "com.twopanez.plugin.{pluginId}"`.
   * Requires `keychain.plugin` permission. On error, sets `context.exception`.
   *
   * **Synchronous** (not Promise-based). Returns directly on the plugin queue.
   *
   * @param key - The keychain item key.
   * @returns The stored string, or `null` if the key does not exist.
   */
  getSecure(key: string): string | null;

  /**
   * Writes a string value to the macOS Keychain (plugin-scoped).
   *
   * Uses delete-before-add pattern to avoid macOS ACL issues with `SecItemUpdate`.
   * Requires `keychain.plugin` permission. On error, sets `context.exception`.
   * The value must be a string; non-string values set `context.exception`.
   *
   * **Synchronous** (not Promise-based). Returns directly on the plugin queue.
   *
   * @param key - The keychain item key.
   * @param value - The string value to store.
   */
  setSecure(key: string, value: string): void;

  /**
   * Removes a keychain item (plugin-scoped).
   *
   * Returns `true` if the item was deleted or did not exist (`errSecItemNotFound`).
   * On error, sets `context.exception` and returns `undefined` (never returns `false`).
   * Requires `keychain.plugin` permission.
   *
   * **Synchronous** (not Promise-based). Returns directly on the plugin queue.
   *
   * @param key - The keychain item key.
   * @returns `true` on success/not-found; `undefined` on error (with `context.exception` set).
   */
  deleteSecure(key: string): true | undefined;
}

// ============================================================================
// Settings API
// ============================================================================

interface SettingsAPI {
  /**
   * Gets a plugin setting value.
   * No permission required.
   *
   * Precedence: UserDefaults value (if set by UI) -> manifest defaultValue -> null.
   *
   * @param key - Setting key as declared in the manifest.
   * @returns The setting value, or null if not found.
   */
  get(key: string): unknown | null;
}

// ============================================================================
// Extension Points API (Phase 2a)
// ============================================================================

/**
 * Options for declaring an extension point.
 */
interface ExtensionPointDeclareOptions {
  /** Human-readable description of the extension point. */
  description?: string;
  /** JSON Schema for validating contributions. */
  schema?: Record<string, unknown>;
  /** Whether multiple contributions are accepted. Default: true. */
  multiple?: boolean;
  /** Access level: "public", "authenticated", or "restricted". Default: "public". */
  access?: "public" | "authenticated" | "restricted";
  /** Plugin IDs allowed to contribute (required for "authenticated" access). */
  allowedContributors?: string[];
}

/**
 * A contribution entry returned by `discover()`.
 */
interface Contribution {
  /** The contribution's unique ID (UUID string). */
  id: string;
  /** The contributing plugin's ID. */
  contributorPluginId: string;
  /** The contribution data. */
  data: unknown;
  /** The contribution's priority. */
  priority: number;
}

interface ExtensionPointsAPI {
  /**
   * Declares a new extension point.
   * Requires: `interPlugin.declare`
   * @param id - Local extension point ID (broker qualifies with plugin ID).
   * @param options - Declaration options.
   * @returns Promise resolving to the declaration token (UUID string).
   */
  declare(id: string, options: ExtensionPointDeclareOptions): Promise<string>;

  /**
   * Contributes to an extension point.
   * Requires: `interPlugin.contribute`
   * @param targetId - Qualified extension point ID (e.g., "com.publisher:pointId").
   * @param contribution - The contribution data (validated against schema).
   * @param options - Optional contribution options.
   * @returns Promise resolving to the contribution ID (UUID string).
   */
  contribute(
    targetId: string,
    contribution: unknown,
    options?: { priority?: number }
  ): Promise<string>;

  /**
   * Discovers contributions to an extension point.
   * Own points: use local ID. Cross-plugin: use qualified ID + dependency required.
   * @param pointId - Local or qualified extension point ID.
   * @returns Promise resolving to sorted contributions (priority ascending).
   */
  discover(pointId: string): Promise<Contribution[]>;

  /**
   * Removes a contribution from an extension point.
   * Requires: `interPlugin.contribute`
   * @param targetId - Qualified extension point ID.
   * @param contributionId - The contribution ID returned by `contribute()`.
   * @returns Promise resolving when the contribution is removed.
   */
  removeContribution(targetId: string, contributionId: string): Promise<void>;
}

// ============================================================================
// Data Contracts API (Phase 2a)
// ============================================================================

/**
 * Options for exposing a data contract.
 */
interface DataContractExposeOptions {
  /** Human-readable description of the contract. */
  description?: string;
  /** JSON Schema for the returned data. */
  schema?: Record<string, unknown>;
  /** Provider function called when the contract is queried. */
  provider: (args: unknown) => Promise<unknown>;
}

interface DataContractsAPI {
  /**
   * Exposes a data contract.
   * Requires: `interPlugin.declare`
   * @param contractId - Local contract ID (broker qualifies with plugin ID).
   * @param version - Contract version (positive integer).
   * @param options - Exposure options including provider function.
   * @returns Promise resolving to the contract token (UUID string).
   */
  expose(
    contractId: string,
    version: number,
    options: DataContractExposeOptions
  ): Promise<string>;

  /**
   * Queries a data contract.
   * Requires: `interPlugin.query`
   * @param qualifiedContractId - Qualified contract ID (e.g., "com.provider:contractId").
   * @param version - Requested version.
   * @param args - Arguments passed to the provider function.
   * @returns Promise resolving to the provider's returned data.
   */
  query(
    qualifiedContractId: string,
    version: number,
    args: unknown
  ): Promise<unknown>;

  /**
   * Unexposes a data contract.
   * Requires: `interPlugin.declare`
   * @param contractId - Local contract ID.
   * @param version - Specific version to remove (omit to remove all versions).
   * @returns Promise resolving when the contract is removed.
   */
  unexpose(contractId: string, version?: number): Promise<void>;

  /**
   * Returns available contracts from declared dependencies.
   * No permission required.
   * @returns Promise resolving to an array of qualified contract ID strings.
   */
  getAvailableContracts(): Promise<string[]>;
}

// ============================================================================
// Inter-Plugin Events API (Phase 2a)
// ============================================================================

interface InterPluginEventsAPI {
  /**
   * Declares an inter-plugin event channel.
   * Requires: `interPlugin.declare`
   * @param eventName - Local event name (broker qualifies with plugin ID).
   * @param schema - Optional JSON Schema for event payloads.
   * @returns Promise resolving to the event token (UUID string).
   */
  declareEvent(eventName: string, schema?: Record<string, unknown>): Promise<string>;

  /**
   * Emits an event on a declared channel.
   * Requires: `interPlugin.emit`
   * @param eventName - Local event name.
   * @param payload - Event payload (validated against schema).
   * @returns Promise resolving when delivery completes.
   */
  emit(eventName: string, payload: unknown): Promise<void>;

  /**
   * Subscribes to an inter-plugin event.
   * Requires: dependency declaration on the publisher.
   * @param qualifiedEventName - Qualified event name (e.g., "com.publisher:eventName").
   * @param handler - Callback invoked with event payload.
   * @returns Promise resolving to the subscription token.
   */
  subscribe(
    qualifiedEventName: string,
    handler: (payload: unknown) => void
  ): Promise<string>;

  /**
   * Unsubscribes from an inter-plugin event.
   * @param token - Subscription token returned by `subscribe()`.
   * @returns Promise resolving when unsubscribed.
   */
  unsubscribe(token: string): Promise<void>;
}

// ============================================================================
// Smart Folders API (fn-13 Phase 2b)
// ============================================================================

/**
 * Options for registering a plugin-contributed filter type.
 */
interface RegisterFilterTypeOptions {
  /** Short filter type ID (will be prefixed with "{pluginId}.filter."). */
  id: string;
  /** Human-readable name for the filter type. */
  displayName: string;
  /**
   * Optional editor configuration.
   * v1: accepted but currently ignored (reserved for future editor integration).
   */
  editorConfig?: Record<string, unknown>;
  /**
   * Synchronous evaluation function called per file during `evaluateFilter`.
   * Receives `{ url: string, metadata: Record<string, unknown> }`.
   * Return `true` to include the item, `false` to exclude it.
   *
   * **Must return a synchronous boolean.** The bridge validates `typeof result === "boolean"`;
   * non-boolean returns (including Promises, objects, or numbers) are treated as unmatched
   * and logged as a contract violation. Returning a Promise does NOT cause awaiting.
   *
   * **JSCore timeout limitation**: JSCore does not support preemption. If this callback
   * blocks or spins indefinitely, the host's plugin queue (and Promise settlement) will
   * also wait indefinitely. The "5 second per file" limit is a **behavioral contract**
   * on plugin authors — the host cannot enforce it as a hard timeout. Callbacks that
   * run I/O or long loops will stall the entire plugin runtime.
   */
  evaluate: (item: { url: string; metadata: Record<string, unknown> }) => boolean;
}

/**
 * A smart folder descriptor as returned by `getSmartFolders()`.
 *
 * `criteria` exposes the full fixed-schema configuration for all filter types.
 * `criteria.query` contains core Spotlight query fields; optional filter
 * sub-objects (`sizeTierFilter`, `gitFilter`, etc.) are present only when that
 * filter is configured on the folder.
 */
interface SmartFolderDescriptor {
  id: string;
  name: string;
  icon: string;
  isBuiltIn: boolean;
  criteria: {
    /** Core Spotlight query parameters. */
    query: {
      searchScope: string;
      fileTypes: string[];
      excludeHidden: boolean;
      customScopePath?: string;
      nameContains?: string;
      nameMatches?: string;
      modifiedAfter?: string;   // ISO 8601
      modifiedBefore?: string;  // ISO 8601
      modifiedWithin?: string;
      createdAfter?: string;    // ISO 8601
      createdBefore?: string;   // ISO 8601
      sizeGreaterThan?: number; // bytes
      sizeLessThan?: number;    // bytes
      hasTags?: string[];
      textContent?: string;
      isFolder?: boolean;
      maxResults?: number;
    };
    /** Multi-select size tier filter; absent if not configured. */
    sizeTierFilter?: { enabledTiers: string[] };
    /** Git repository filter; absent if not configured. */
    gitFilter?: { mode: string };
    /** Per-folder type sub-selection overrides; absent if not configured. */
    typeSubSelection?: {
      useGlobalDefaults: boolean;
      categoryOverrides?: Record<string, string[]>;
    };
    /** Declutter score configuration; absent if not configured. */
    declutterConfig?: { enabled: boolean; minimumScore: number };
    /** Document extension exclusion filter; absent if not configured. */
    documentExclusions?: { excludedExtensions: string[] };
  };
}

/**
 * An item submitted to `evaluateFilter`.
 */
interface FilterEvalItem {
  /** File URL string (must be within current pane roots unless `filesystem.readAll` is granted). */
  url: string;
  /** Arbitrary metadata dictionary. */
  metadata?: Record<string, unknown>;
}

/**
 * Result entry from `evaluateFilter`.
 */
interface FilterEvalResult {
  /** The file URL string. */
  url: string;
  /** Whether the item passed all registered evaluate callbacks. */
  matched: boolean;
}

/**
 * Smart folder filter type registration and evaluation API (fn-13 Phase 2b).
 *
 * **v1 scope**: `registerFilterType` registers metadata in `FilterTypeRegistry`.
 * `evaluateFilter` is a utility API — plugins call it directly after retrieving
 * items from the host. Host-driven integration (SmartFolderService calling plugin
 * hooks automatically) is deferred to a future epic.
 */
interface SmartFoldersAPI {
  /**
   * Registers a plugin-contributed filter type in `FilterTypeRegistry`.
   * Requires: `filesystem.read`
   * @param options - Filter type options including id, displayName, and evaluate function.
   * @returns Promise resolving to the namespaced filter type ID ("{pluginId}.filter.{id}").
   */
  registerFilterType(options: RegisterFilterTypeOptions): Promise<string>;

  /**
   * Returns all defined smart folders.
   * Requires: `filesystem.read`
   * @returns Promise resolving to an array of smart folder descriptors.
   */
  getSmartFolders(): Promise<SmartFolderDescriptor[]>;

  /**
   * Evaluates plugin-contributed filter types against a list of items.
   *
   * All item URLs are validated for pane-root containment before evaluation begins;
   * the first out-of-scope URL rejects the entire call with `PATH_OUT_OF_SCOPE`
   * (bypassed for plugins with `filesystem.readAll`).
   *
   * **5-second limit is a behavioral contract** (see `RegisterFilterTypeOptions.evaluate`).
   * JSCore cannot be preempted; the host cannot enforce a hard timeout.
   *
   * Requires: `filesystem.read`
   * @param folderId - ID of the smart folder being evaluated.
   * @param items - Items to evaluate. All must have a parseable `file://` URL.
   *   Malformed items or missing urls reject the entire call with `CONTRACT_VALIDATION`.
   * @returns Promise resolving to evaluation results.
   */
  evaluateFilter(folderId: string, items: FilterEvalItem[]): Promise<FilterEvalResult[]>;

  /**
   * Registers a callback fired after each `evaluateFilter` call.
   * No permission required.
   * @param callback - Called with `{ folderId: string, resultCount: number }`.
   * @returns Promise resolving to an unsubscribe token.
   */
  onSmartFolderEvaluated(callback: (payload: { folderId: string; resultCount: number }) => void): Promise<string>;

  /**
   * Removes a callback registered via `onSmartFolderEvaluated`.
   * No permission required.
   * @param token - Token returned by `onSmartFolderEvaluated`.
   * @returns Promise resolving when the callback is removed.
   */
  offSmartFolderEvaluated(token: string): Promise<void>;
}

// ============================================================================
// Preview API (fn-13 Phase 2b)
// ============================================================================

/**
 * File preview registry queries and programmatic preview triggering (fn-13 Phase 2b).
 *
 * **v1 scope**: `registerProvider` is CorePlugin-only. JS callers receive
 * `ContractValidationError` — `NSView` cannot cross the JSC bridge boundary.
 * `canPreview`, `showPreview`, and `getRegisteredTypes` are fully functional for JS plugins.
 *
 * Permission summary:
 * - `registerProvider` → `ui.preview`
 * - `canPreview` → `filesystem.read`
 * - `showPreview` → `filesystem.read`
 * - `getRegisteredTypes` → none
 */
interface PreviewAPI {
  /**
   * Registers a file preview provider in `FilePreviewRegistry`.
   *
   * **CorePlugin-only in v1.** JS callers receive `ContractValidationError` because
   * `NSView` cannot be returned across the JSC bridge.
   *
   * Requires: `ui.preview`
   * @param options - Provider registration options. Shape is CorePlugin-internal; JS callers always get an error.
   * @returns JS plugins: always rejects in v1 with ContractValidationError. CorePlugins register via Swift `registerPreviewProvider(_:)` instead.
   */
  registerProvider(options: unknown): Promise<void>;

  /**
   * Returns `true` if at least one registered provider can preview the given file.
   *
   * Each registered provider's `canPreview` is called with a 2-second per-provider timeout.
   * Returns `false` if no provider handles the file type or all providers time out.
   *
   * Requires: `filesystem.read`
   * @param filePath - Absolute file path or `file://` URL string.
   * @returns Promise resolving to `true` if a provider can handle the file.
   */
  canPreview(filePath: string): Promise<boolean>;

  /**
   * Opens the file preview panel for the given file using the best registered provider.
   *
   * Falls back to the system QuickLook panel if no plugin provider matches.
   * In v1, JS-registered provider entries are ignored by `FilePreviewRegistry.bestProvider(for:)`
   * (skipped during resolution, treated as no-match), so the QuickLook fallback is used.
   *
   * Requires: `filesystem.read`
   * @param filePath - Absolute file path or `file://` URL string.
   * @returns Promise resolving when the panel is opened (or fallback triggered).
   */
  showPreview(filePath: string): Promise<void>;

  /**
   * Returns all file extensions that have at least one registered preview provider.
   *
   * Extensions are lowercase without a leading dot (e.g., `["md", "markdown", "txt"]`).
   *
   * No permission required.
   * @returns Promise resolving to an array of extension strings.
   */
  getRegisteredTypes(): Promise<string[]>;
}

// ============================================================================
// Network API (fn-14 Phase 2b-ii)
// ============================================================================

/**
 * Options for `network.fetch()`.
 *
 * All fields are optional. When omitted, defaults to a GET request with no
 * additional headers or body.
 */
interface NetworkFetchOptions {
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
interface NetworkResponse {
  /** HTTP status code (e.g., 200, 404). */
  status: number;
  /** Response headers as key-value pairs. */
  headers: Record<string, string>;
  /** Response body as a UTF-8 string. */
  body: string;
}

/**
 * Network API (`context.network`).
 *
 * Provides URLSession-based HTTP fetching and file downloading.
 *
 * **Security model:**
 * - HTTPS enforced for non-localhost URLs (even with `network.unrestricted`).
 * - Domain whitelisting: `network.outbound` requires the URL host to match a
 *   domain in the manifest's `networkDomains` array. `network.unrestricted`
 *   bypasses the domain check (but not HTTPS enforcement).
 * - Redirect validation: every HTTP redirect is re-checked against HTTPS
 *   enforcement and the domain allowlist.
 * - DNS rebinding protection: redirects to private/loopback IPs (10.*, 172.16-31.*,
 *   192.168.*, 127.*, 169.254.*, ::1, fe80::*) are blocked.
 * - Concurrency: maximum 10 simultaneous network requests per plugin.
 *
 * Requires: `network.outbound` or `network.unrestricted`
 */
interface NetworkAPI {
  /**
   * Performs an HTTP request via URLSession.
   *
   * @param url - The request URL (must be HTTPS for non-localhost).
   * @param options - Optional fetch options (method, headers, body).
   * @returns Promise resolving to `{ status, headers, body }`.
   */
  fetch(url: string, options?: NetworkFetchOptions): Promise<NetworkResponse>;

  /**
   * Downloads a URL to a local file path.
   *
   * The destination must be an absolute POSIX path or `file://` URL within a
   * pane root (or allowed by `filesystem.writeAll`). Existing files at the
   * destination are overwritten.
   *
   * @param url - The URL to download (must be HTTPS for non-localhost).
   * @param destPath - Absolute POSIX path or `file://` URL for the destination.
   * @returns Promise resolving to the destination POSIX path string.
   */
  download(url: string, destPath: string): Promise<string>;
}

// ============================================================================
// Shell API (fn-14 Phase 2b-ii)
// ============================================================================

/**
 * Options for `shell.execute()`.
 */
interface ShellExecuteOptions {
  /**
   * Command name (must be in the manifest's `shellCommands` allowlist).
   * This is the executable name, not a path (e.g., `"git"`, `"node"`).
   * Resolved via `/usr/bin/env`.
   */
  command: string;

  /**
   * Arguments array (default: `[]`).
   * Each element is passed as a separate argv entry. No shell interpolation.
   */
  args?: string[];

  /**
   * Working directory (optional).
   * Absolute POSIX path or `file://` URL. Validated against pane roots
   * unless `filesystem.readAll` or `filesystem.writeAll` is granted.
   */
  cwd?: string;

  /**
   * Timeout in seconds (default: 120, maximum: 120).
   * After timeout: SIGTERM is sent, then SIGKILL after 5 seconds if
   * the process is still running.
   */
  timeout?: number;

  /**
   * Environment variables to merge with the host process environment.
   * Plugin values override host values. When `command === "git"`,
   * `GIT_TERMINAL_PROMPT=0` is always injected (overrides plugin env).
   */
  env?: Record<string, string>;
}

/**
 * Result from `shell.execute()`.
 */
interface ShellExecuteResult {
  /** Process exit code. */
  exitCode: number;
  /** Standard output (UTF-8). Truncated to 10MB with `[TRUNCATED]` marker. */
  stdout: string;
  /** Standard error (UTF-8). Truncated to 10MB with `[TRUNCATED]` marker. */
  stderr: string;
}

/**
 * Shell API (`context.shell`).
 *
 * Provides Foundation.Process-based shell command execution.
 *
 * **Security model:**
 * - Command whitelisting: only commands listed in the manifest's `shellCommands`
 *   array are permitted.
 * - Arguments are passed as an array to `/usr/bin/env` (no shell interpolation).
 * - Git terminal prompt suppression: `GIT_TERMINAL_PROMPT=0` injected for git.
 * - Timeout: 120 seconds max; SIGTERM + 5-second grace period then SIGKILL.
 * - Concurrency: maximum 5 simultaneous shell processes per plugin.
 * - Process tracking: active processes tracked in `PluginRuntimeHandle` for
 *   cleanup on plugin deactivation.
 * - Output truncation: stdout/stderr capped at 10MB each.
 *
 * **Known limitation:** `Process.terminate()` only signals the direct child.
 * Sub-processes spawned by the command are NOT killed and may orphan.
 *
 * Requires: `shell.execute`
 */
interface ShellAPI {
  /**
   * Executes a shell command.
   *
   * @param options - Execution options (command, args, cwd, timeout, env).
   * @returns Promise resolving to `{ exitCode, stdout, stderr }`.
   */
  execute(options: ShellExecuteOptions): Promise<ShellExecuteResult>;
}

// ============================================================================
// Clipboard API (fn-14 Phase 2b-ii)
// ============================================================================

/**
 * Clipboard API (`context.clipboard`).
 *
 * Provides system clipboard read/write via `NSPasteboard.general`.
 * All pasteboard access is dispatched to the main thread.
 *
 * **macOS 15.4+ note:** Starting with macOS 15.4, programmatic clipboard reads
 * trigger a system-level privacy alert. There is no workaround -- plugins
 * requesting `clipboard.read` may cause OS-level permission prompts.
 *
 * Requires: `clipboard.read` for read, `clipboard.write` for write.
 */
interface ClipboardAPI {
  /**
   * Reads the current clipboard string content.
   *
   * Requires: `clipboard.read`
   * @returns Promise resolving to the clipboard string, or `null` if the
   *          clipboard does not contain string data.
   */
  read(): Promise<string | null>;

  /**
   * Clears the clipboard and writes the given string.
   *
   * Uses `clearContents()` before `setString()` per standard macOS pasteboard
   * convention.
   *
   * Requires: `clipboard.write`
   * @param text - The string to write to the clipboard.
   * @returns Promise resolving to `true` on success (false is exceptionally rare).
   */
  write(text: string): Promise<boolean>;
}

// ============================================================================
// Shortcuts API (fn-15 Phase 2b-iii)
// ============================================================================

/**
 * Options for `shortcuts.register()`.
 */
interface ShortcutRegisterOptions {
  /**
   * The command ID to bind the shortcut to.
   * Must be a command already registered by this plugin (own-namespace only).
   */
  commandId: string;

  /**
   * Key combination string (e.g., `"cmd+t"`, `"cmd+shift+n"`, `"ctrl+option+s"`).
   *
   * **Format**: Modifier names joined by `+`, followed by the key name.
   * At least one modifier is required (bare keys are reserved for inline handlers).
   *
   * **Modifiers**: `cmd`/`command`, `shift`, `opt`/`option`/`alt`, `ctrl`/`control`.
   * **Special keys**: `delete`, `backspace`, `return`/`enter`, `escape`/`esc`, `tab`,
   * `space`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`, `f1`-`f12`.
   */
  keys: string;

  /**
   * Optional context condition string (stored but not evaluated in Phase 1).
   */
  when?: string;
}

/**
 * Registered shortcut info returned by `shortcuts.getAll()`.
 */
interface ShortcutInfo {
  /** Unique identifier formatted as `"{pluginId}:{keys}"`. */
  shortcutId: string;
  /** The command ID this shortcut is bound to. */
  commandId: string;
  /** The key combination string. */
  keys: string;
  /** Optional `when` condition, if provided at registration. */
  when?: string;
}

/**
 * Shortcuts API (`context.shortcuts`).
 *
 * Provides keyboard shortcut registration with first-registered-wins conflict
 * resolution and reserved key protection.
 *
 * **Conflict model:**
 * - First-registered wins — duplicate key bindings rejected with `SHORTCUT_CONFLICT`.
 * - Reserved shortcuts (inline `KeyboardHandler` keys) are always rejected.
 * - Core command shortcuts (registered in `CommandRegistry`) are also rejected.
 * - At least one modifier key is required (bare keys are reserved for inline handlers).
 *
 * **Own-command enforcement:** Plugins can only bind shortcuts to their own registered
 * commands. Attempting to bind to a core or another plugin's command is rejected.
 *
 * **Deactivation:** All plugin shortcuts are removed from `CommandRegistry` when the
 * plugin is deactivated or the `ui.shortcuts` permission is revoked.
 *
 * Requires: `ui.shortcuts`
 */
interface ShortcutsAPI {
  /**
   * Registers a keyboard shortcut binding for an existing command.
   *
   * @param options - Registration options (commandId, keys, optional when condition).
   * @returns Promise resolving to the `shortcutId` string on success.
   */
  register(options: ShortcutRegisterOptions): Promise<string>;

  /**
   * Removes a shortcut binding by its shortcutId.
   *
   * Does NOT remove the command itself — only the key binding.
   *
   * @param shortcutId - The shortcut identifier returned by `register()`.
   * @returns Promise resolving to `undefined` on success.
   */
  unregister(shortcutId: string): Promise<void>;

  /**
   * Returns all shortcuts registered by the calling plugin.
   *
   * No permission required (read-only introspection of own shortcuts).
   *
   * @returns Promise resolving to an array of `ShortcutInfo` objects.
   */
  getAll(): Promise<ShortcutInfo[]>;
}

// ============================================================================
// Themes API (fn-15 Phase 2b-iii)
// ============================================================================

/**
 * Options for `themes.registerTheme()`.
 */
interface ThemeRegisterOptions {
  /** Unique theme identifier (e.g., `"dark-synapse"`, `"ocean-breeze"`). */
  id: string;
  /** Human-readable theme name. */
  name: string;
  /**
   * Flat mapping of design token keys to hex color strings.
   *
   * Token keys are hierarchical dot-separated names (e.g., `"sidebar.background"`,
   * `"text.primary"`, `"accent.synapse"`). Values must be valid 6- or 8-character
   * hex color strings (e.g., `"#FF5733"`, `"#FF573380"`).
   *
   * Unknown token keys are silently ignored by the host; malformed hex values
   * fall back to the host's default color for that token.
   */
  tokens: Record<string, string>;
}

/**
 * Theme info returned by `themes.getThemeList()`.
 */
interface ThemeInfo {
  /** Unique theme identifier. */
  id: string;
  /** Human-readable theme name. */
  name: string;
  /** Plugin ID that registered this theme. */
  pluginId: string;
}

/**
 * Themes API (`context.themes`).
 *
 * Provides theme registration and activation with a flat `DesignTokenMap` model.
 *
 * **One active theme at a time** — `setActiveTheme` replaces the current theme;
 * passing `null`/`undefined` clears the active theme (reverts to host defaults).
 *
 * **Per-plugin limit:** Maximum 10 registered themes per plugin.
 *
 * **Duplicate ID rejection:** Registering a theme with an already-taken ID is
 * rejected with `INVALID_ARGUMENT`.
 *
 * **Deactivation:** All plugin themes are unregistered from `ThemeEngine` when the
 * plugin is deactivated or the `ui.themes` permission is revoked. If the active
 * theme was owned by the deactivated plugin, it reverts to `null` (no active theme).
 *
 * **Persistence:** The active theme ID is persisted to UserDefaults and restored
 * on app launch.
 *
 * Requires: `ui.themes` for `registerTheme` and `setActiveTheme`.
 * No permission required for `getActiveTheme`, `getThemeList`, `onThemeChanged`.
 */
interface ThemesAPI {
  /**
   * Registers a theme with the ThemeEngine.
   *
   * Requires `ui.themes` permission.
   *
   * @param options - Theme definition (id, name, tokens).
   * @returns Promise resolving to `undefined` on success.
   */
  registerTheme(options: ThemeRegisterOptions): Promise<void>;

  /**
   * Returns the currently active theme ID, or `null` if no theme is active.
   *
   * No permission required (read-only).
   *
   * @returns Promise resolving to the active theme ID string, or `null`.
   */
  getActiveTheme(): Promise<string | null>;

  /**
   * Activates a registered theme by ID, or clears the active theme.
   *
   * Pass `null` or `undefined` to clear the active theme (revert to host defaults).
   *
   * Requires `ui.themes` permission.
   *
   * @param themeId - The theme ID to activate, or `null`/`undefined` to clear.
   * @returns Promise resolving to `undefined` on success.
   */
  setActiveTheme(themeId: string | null | undefined): Promise<void>;

  /**
   * Returns all registered themes across all plugins.
   *
   * Each entry contains metadata only (no token values — those are internal).
   * No permission required (read-only, public).
   *
   * @returns Promise resolving to an array of `ThemeInfo` objects.
   */
  getThemeList(): Promise<ThemeInfo[]>;

  /**
   * Subscribes to theme change notifications.
   *
   * The callback is invoked whenever the active theme changes (including to `null`).
   * No permission required (observation is read-only).
   *
   * @param callback - Function called with the new active theme ID (or `null`).
   * @returns Promise resolving to a token string for unsubscription.
   */
  onThemeChanged(callback: (themeId: string | null) => void): Promise<string>;

  /**
   * Unsubscribes a theme change listener.
   *
   * @param token - The token returned by `onThemeChanged()`.
   * @returns Promise resolving to `undefined` on success.
   */
  offThemeChanged(token: string): Promise<void>;
}

// ============================================================================
// Error Codes (fn-14 + fn-15 additions)
// ============================================================================

/**
 * Additional error codes for fn-14 and fn-15 APIs.
 *
 * These appear as `err.code` on rejected Promises or `context.exception`.
 *
 * | Code | Source |
 * |------|--------|
 * | `SHELL_EXECUTION_ERROR` | `shell.execute()` — process launch failure |
 * | `KEYCHAIN_ACCESS_ERROR` | `storage.getSecure/setSecure/deleteSecure` — SecItem failure (via `context.exception`, not Promise) |
 * | `NETWORK_DOMAIN_DENIED` | `network.fetch/download` — domain not in allowlist |
 * | `RESOURCE_LIMIT_EXCEEDED` | Any API — per-plugin concurrency/resource limit reached (e.g., 10 themes per plugin) |
 * | `PERMISSION_DENIED` | Any gated API — missing required permission scope |
 * | `SHORTCUT_CONFLICT` | `shortcuts.register()` — key combo conflicts with existing binding or reserved shortcut |
 * | `INVALID_ARGUMENT` | Various APIs — invalid or missing required parameters |
 */

// ============================================================================
// Plugin Entry Points
// ============================================================================

/**
 * Plugin activation function. Called by the host when the plugin is loaded.
 * @param context - The plugin context providing access to all APIs.
 */
declare function activate(context: PluginContext): void | Promise<void>;

/**
 * Plugin deactivation function. Called by the host before the plugin is unloaded.
 * Optional: if not defined, the host proceeds with cleanup.
 */
declare function deactivate(): void | Promise<void>;
