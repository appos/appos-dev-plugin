/**
 * 2Panez Plugin API Type Definitions (Phase 2b-iii)
 *
 * These types define the contract between plugins and the host application.
 * Plugins receive a `PluginContext` object in their `activate(context)` function.
 *
 * @version 2.4.0-fn50
 *
 * Note: WindowSnapshot includes a reserved `plugins: []` field for future
 * per-window plugin state persistence (fn-33). Plugin authors should not
 * depend on workspace persistence until the API is stabilized.
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
  type: "text" | "image" | "hstack" | "vstack" | "button" | "section" | "divider" | "spacer" | "scroll" | "label" | "badge" | "list" | "listItem" | "textField" | "progress" | "remoteImage" | "grid";
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
   * - `progress`: `value` (number 0.0-1.0, omit for indeterminate), `label` (string), `style` ("bar" | "circular", default: "bar")
   * - `remoteImage`: `url` (string, file:// only in Phase 1), `width` (number), `height` (number), `cornerRadius` (number), `maxDimension` (number, default 512 — max pixel size for downsampling)
   * - `grid`: `columns` (number, default 3), `spacing` (number, default 8). Children render as grid items in a LazyVGrid with flexible columns
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
  /**
   * Whether the panel should auto-show in a pane tab on first registration.
   * Only applies when `target` is `"pane"`. Subsequent content updates
   * (re-calling `registerPanel` with the same ID) do NOT auto-show.
   * Default: `true`.
   */
  autoShow?: boolean;
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
  /**
   * JSON view descriptor for the sidebar content.
   * Optional when `linkedPanel` is set — the activity bar icon opens a pane
   * tab instead of (or in addition to) showing sidebar content.
   */
  view?: ViewDescriptor;
  /** Handler function invoked for interactive elements within the view. */
  handler?: (action: string) => void | Promise<void>;
  /** Priority for ordering (100+ for plugins). */
  priority?: number;
  /**
   * Links this activity bar icon to a registered pane panel.
   * When set, clicking the icon opens or focuses the linked panel
   * in a pane tab instead of switching the sidebar.
   *
   * The value is the short panel ID (without plugin prefix).
   * It is automatically qualified with `{pluginId}.` at runtime.
   *
   * If the linked panel is not yet registered when clicked, a warning
   * is logged and the click is a no-op.
   *
   * @example
   * ```js
   * context.ui.registerPanel("my-pane", {
   *   title: "My Pane",
   *   target: "pane",
   *   view: { type: "text", properties: { content: "Hello" } }
   * });
   * context.ui.registerActivityView("my-activity", {
   *   title: "My Plugin",
   *   icon: "puzzlepiece",
   *   linkedPanel: "my-pane"
   * });
   * ```
   */
  linkedPanel?: string;
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
// Dependency Management Types (fn-50)
// ============================================================================

/**
 * Classifies a dependency as either a system binary or another plugin.
 */
type DependencyType = "system" | "plugin";

/**
 * The resolved installation state of a single dependency.
 *
 * - `"not_found"` — Binary or plugin not found on the system.
 * - `"installed"` — Found with a detected version string (see `installedVersion`).
 * - `"installed_version_unknown"` — Found but version could not be detected.
 * - `"permission_denied"` — The `shell.execute` permission was not granted.
 * - `"command_not_allowed"` — The `check.command` is not in `shellCommands` allowlist.
 */
type InstallationState =
  | "not_found"
  | "installed"
  | "installed_version_unknown"
  | "permission_denied"
  | "command_not_allowed";

/**
 * The resolved status of a single declared dependency (system or plugin).
 *
 * Returned by `lifecycle.getDependencyStatus()` and
 * `lifecycle.recheckDependencies()`. Matches the Swift `DependencyStatus`
 * struct with custom Codable flattening of `InstallationState`.
 */
interface DependencyStatus {
  /** Human-readable name of the dependency. */
  name: string;
  /** Whether this is a system binary or plugin dependency. */
  type: DependencyType;
  /** Whether this dependency is required for the plugin to function. */
  required: boolean;
  /** Whether the dependency constraint is fully satisfied. */
  satisfied: boolean;
  /** The resolved installation state. */
  state: InstallationState;
  /** Detected version string. Present only when `state === "installed"`. */
  installedVersion?: string;
  /** Minimum version constraint from the manifest. Undefined when no `minVersion` declared. */
  requiredVersion?: string;
  /** Human-readable install hint (e.g., "brew install yt-dlp"). */
  installHint?: string;
  /** URL to installation instructions. */
  installUrl?: string;
  /** Human-readable description of the dependency's purpose. */
  description?: string;
  /** Reason why the dependency is unsatisfied. Present only when `satisfied === false`. */
  unsatisfiedReason?: string;
  /** Causal chain for transitive dependencies. Present for required transitive deps (e.g., `["required by com.foo.bar"]`). */
  causalChain?: string[];
}

// ============================================================================
// Dependency Manifest Types (fn-50)
// ============================================================================

/**
 * How to probe for a system binary dependency.
 */
interface SystemDependencyCheck {
  /** Command name to execute (first argv element). */
  command: string;
  /** Arguments passed after the command. */
  args?: string[];
  /** Regex with one capture group to extract the version from stdout. */
  versionPattern?: string;
}

/**
 * A declared dependency on a system binary (e.g., yt-dlp, ffmpeg, git).
 *
 * Declared in the `dependencies.system` array of `plugin.json`.
 * The host runs `check.command` + `check.args` at activation time to probe
 * binary presence. Requires `shell.execute` permission and `shellCommands`
 * allowlist entry for the `check.command`.
 */
interface SystemDependency {
  /** Human-readable name of the dependency (e.g., "yt-dlp"). */
  name: string;
  /** Probe configuration for detecting the binary. */
  check: SystemDependencyCheck;
  /** Minimum version constraint string. */
  minVersion?: string;
  /** Whether this dependency is required. Default: `true`. */
  required?: boolean;
  /** Human-readable install hint (e.g., "brew install yt-dlp"). */
  installHint?: string;
  /** URL to installation instructions. Must start with `https://` or `http://`. */
  installUrl?: string;
  /** Human-readable description of the dependency's purpose. */
  description?: string;
}

/**
 * A declared dependency on another plugin.
 *
 * Declared in the `dependencies.plugins` array of `plugin.json`.
 */
interface ManifestPluginDependency {
  /** The plugin ID of the dependency (e.g., "com.community.shared-utils"). */
  id: string;
  /** Minimum version constraint (semver). */
  minVersion?: string;
  /** Whether this dependency is required. Default: `true`. */
  required?: boolean;
}

/**
 * A declared dependency on another plugin (alias for ManifestPluginDependency).
 *
 * This alias matches the spec/API naming convention. The full name
 * `ManifestPluginDependency` disambiguates from the internal Swift
 * `PluginDependency` struct which uses different field semantics.
 */
type PluginDependency = ManifestPluginDependency;

/**
 * Dependencies section of `plugin.json`.
 *
 * Plugins declare system binary and/or plugin dependencies here.
 * The host resolves these at activation time and reports status via
 * `lifecycle.getDependencyStatus()`.
 */
interface PluginDependencies {
  /** System binary dependencies (e.g., yt-dlp, ffmpeg). */
  system?: SystemDependency[];
  /** Plugin dependencies (other 2Panez plugins). */
  plugins?: PluginDependency[];
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
  /** Workspace template management (fn-40). Requires `workspaces`. */
  readonly workspaces: WorkspacesAPI;
  /** Plugin cache with memory + disk tiers and TTL (fn-41). Requires `cache`. */
  readonly cache: PluginCacheAPI;
  /** Toast, HUD, confirmation, and progress feedback (fn-41). Requires `feedback`. */
  readonly feedback: PluginFeedbackAPI;
  /** OAuth 2.0 + PKCE authorization (fn-41). Requires `oauth`. */
  readonly oauth: PluginOAuthAPI;
  /** Menu bar NSStatusItem management (fn-41). Requires `menubar`. */
  readonly menubar: PluginMenuBarAPI;
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
 * | `navigation.directoryChanged` | `filesystem.read` or `filesystem.readAll` | `{paneId, oldUrl, newUrl, windowId?}` |
 * | `navigation.paneActivated` | `filesystem.read` | `{paneId, windowId?}` |
 * | `selection.changed` | `filesystem.read` | `{paneId, selectedPaths, windowId?}` |
 * | `smartFolder.evaluated` | `filesystem.read` | `{folderId, resultCount, windowId?}` |
 * | `app.willQuit` | none | `{}` |
 * | `app.didBecomeActive` | none | `{}` |
 * | `plugin.activated` | none | `{pluginId}` |
 * | `plugin.deactivated` | none | `{pluginId}` |
 * | `fileOps.operationCompleted` | `filesystem.readAll` | `FileOpCompletedPayload` |
 * | `oauth.tokenRefreshed` | `oauth` | `{pluginId, provider}` |
 * | `oauth.tokenRevoked` | `oauth` | `{pluginId, provider}` |
 * | `menubar.clicked` | `menubar` | `{pluginId}` |
 * | `menubar.popoverOpened` | `menubar` | `{pluginId}` |
 * | `menubar.popoverClosed` | `menubar` | `{pluginId}` |
 * | `store.pluginInstalled` | none | `{pluginId, version}` |
 * | `store.pluginUpdated` | none | `{pluginId, fromVersion, toVersion}` |
 * | `store.pluginUninstalled` | none | `{pluginId}` |
 *
 * **Window scoping (fn-32):** Per-window events (`navigation.*`, `selection.*`, `smartFolder.*`)
 * include an optional `windowId` (UUID string) identifying the source window. Plugins receive
 * events from ALL windows — filter by `windowId` if needed. `windowId` is `undefined` for
 * app-wide events and may be `undefined` during the transition period.
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

  /**
   * Opens or focuses a pane tab that renders a previously registered panel.
   *
   * If the panel is already open in either pane, the existing tab is focused
   * and its pane is activated (de-duplication). Otherwise a new tab is created
   * in the target pane.
   *
   * No additional permission required — the panel must already be registered
   * via `registerPanel` (which requires `ui.sidebar`).
   *
   * @param id - Short panel identifier (without plugin prefix). Automatically
   *   qualified with `{pluginId}.` at runtime.
   * @param options - Optional configuration for the new tab.
   * @param options.title - Override title for the tab (default: panel title from registry).
   * @param options.pane - Target pane: `"left"`, `"right"`, or omit for active pane.
   * @returns The short panel ID (same as the `id` argument).
   */
  showPaneTab(id: string, options?: { title?: string; pane?: "left" | "right" }): string;

  /**
   * Closes any open pane tabs for the given panel ID across both panes.
   *
   * If the closed tab was the last tab in a pane, a fallback file browser
   * tab is created automatically.
   *
   * No additional permission required — the panel must already be registered
   * via `registerPanel` (which requires `ui.sidebar`).
   *
   * @param id - Short panel identifier (without plugin prefix). Automatically
   *   qualified with `{pluginId}.` at runtime.
   * @returns The short panel ID (same as the `id` argument).
   */
  hidePaneTab(id: string): string;

  /**
   * Opens a file in an in-pane viewer tab.
   *
   * Supports images (PNG, JPEG, SVG, GIF), PDFs, and text/source code files.
   * Unknown file types show a placeholder with "Open with Default App" button.
   * Directories are automatically converted to file browser tabs.
   *
   * **Permission**: Requires `filesystem.read` or `filesystem.readAll`.
   * - `filesystem.read`: file must be within current pane roots (containment check).
   * - `filesystem.readAll`: bypasses pane-root containment.
   *
   * **De-duplication**: If a viewer tab for the same file URL already exists
   * in either pane, focuses the existing tab instead of creating a duplicate.
   *
   * @param url - A `file://` URL string pointing to the file. Non-file URLs
   *   are rejected with a JS error.
   * @param options - Optional configuration.
   * @param options.pane - Target pane: `"left"`, `"right"`, or omit for active pane.
   * @param options.mode - Reserved for future use. Currently only `"view"` is supported.
   */
  openInPane(url: string, options?: { pane?: "left" | "right"; mode?: "view" }): void;

  /**
   * Opens a terminal tab at the given working directory.
   *
   * The terminal runs an interactive shell (zsh) rooted at the specified directory.
   * Supports tab completion, ANSI colors, and cursor movement.
   *
   * **Permission**: Requires `filesystem.read` or `filesystem.readAll`.
   * - `filesystem.read`: directory must be within current pane roots (containment check).
   * - `filesystem.readAll`: bypasses pane-root containment.
   *
   * **De-duplication**: If a terminal tab for the same working directory already
   * exists in either pane, focuses the existing tab instead of creating a duplicate.
   *
   * @param workingDirectory - A `file://` URL string pointing to a directory.
   *   Non-file URLs or non-directory paths are rejected with a JS error.
   * @param options - Optional configuration.
   * @param options.pane - Target pane: `"left"`, `"right"`, or omit for active pane.
   */
  openTerminal(workingDirectory: string, options?: { pane?: "left" | "right" }): void;

  /**
   * Opens a code editor tab for the given file URL.
   *
   * Uses Monaco editor with syntax highlighting, line numbers, and save support.
   * Files larger than 5 MB open a warning view instead of the Monaco editor.
   *
   * **Permission**: Requires `filesystem.read` or `filesystem.readAll`.
   * - `filesystem.read`: file must be within current pane roots (containment check).
   * - `filesystem.readAll`: bypasses pane-root containment.
   *
   * **De-duplication**: If an editor tab for the same file URL already exists
   * in either pane, focuses the existing tab instead of creating a duplicate.
   *
   * @param url - A `file://` URL string pointing to the file. Non-file URLs
   *   are rejected with a JS error.
   * @param options - Optional configuration.
   * @param options.pane - Target pane: `"left"`, `"right"`, or omit for active pane.
   */
  openEditor(url: string, options?: { pane?: "left" | "right" }): void;

  /**
   * Opens a web browser tab for the given URL.
   *
   * Embeds a WKWebView with a compact navigation toolbar (URL bar, back/forward/reload).
   * Supports `http://`, `https://`, and `file://` URLs.
   *
   * **Permission (scheme-based):**
   * - `http://` / `https://` — no special permission required (foreground UI action).
   * - `file://` — requires `filesystem.read` or `filesystem.readAll`.
   *   - `filesystem.read`: file must be within current pane roots (containment check).
   *   - `filesystem.readAll`: bypasses pane-root containment.
   *   - File must exist and must not be a directory.
   * - Other schemes are rejected with a JS error.
   *
   * **De-duplication**: If a browser tab for the same canonical URL already exists
   * in either pane (checking live navigated URL, not just initial URL), focuses the
   * existing tab instead of creating a duplicate.
   *
   * @param url - A URL string (`http://`, `https://`, or `file://`).
   * @param options - Optional configuration.
   * @param options.pane - Target pane: `"left"`, `"right"`, or omit for active pane.
   */
  openWebView(url: string, options?: { pane?: "left" | "right" }): void;

  /**
   * Opens a markdown preview tab for the given file URL.
   *
   * Renders markdown as styled HTML in a WKWebView with live file watching.
   * Supports headings, paragraphs, lists, code blocks, tables, blockquotes,
   * links, images, and inline formatting. System light/dark theme via CSS.
   *
   * **Permission**: Requires `filesystem.read` or `filesystem.readAll`.
   * - `filesystem.read`: file must be within current pane roots (containment check).
   * - `filesystem.readAll`: bypasses pane-root containment.
   *
   * **De-duplication**: If a markdown preview tab for the same file URL already
   * exists in either pane, focuses the existing tab instead of creating a duplicate.
   *
   * @param url - A `file://` URL string pointing to a markdown file. Non-file URLs
   *   are rejected with a JS error.
   * @param options - Optional configuration.
   * @param options.pane - Target pane: `"left"`, `"right"`, or omit for active pane.
   */
  openMarkdownPreview(url: string, options?: { pane?: "left" | "right" }): void;

  /**
   * Opens a new AI chat pane tab with optional prefill.
   *
   * **Permission**: `ui.aiChat`
   *
   * **Prefill-only**: This method sets up the AI chat pane with the given
   * connector, system prompt, and file context, but does NOT auto-send.
   * The user must manually press Send. This prevents plugins from triggering
   * unbounded API costs.
   *
   * Plugins never have access to the AI API key.
   *
   * **Connector validation**: The `connector` option is validated via
   * `AIConnectorRegistry.isKnownConnector` (not `isReady`). The pane opens
   * even if the API key is not configured, showing the setup flow.
   *
   * **Context files**: Each `file://` URL in the `context` array requires
   * `filesystem.read` permission with pane-root containment (or `filesystem.readAll`).
   * Files must exist, must not be directories, must be text-like (UTType
   * conforming to `.text` or `.sourceCode`), and must contain valid UTF-8.
   * Each file is capped at 100KB.
   *
   * @param options - Optional configuration.
   * @param options.pane - Target pane: `"left"`, `"right"`, or omit for active pane.
   * @param options.connector - Connector ID (e.g., `"claude-api"`). Defaults to the
   *   registry default if omitted.
   * @param options.systemPrompt - System prompt to prefill in the chat session.
   * @param options.context - Array of `file://` URL strings to attach as context.
   */
  openAIChat(options?: {
    pane?: "left" | "right";
    connector?: string;
    systemPrompt?: string;
    context?: string[];
  }): void;

  // ---- fn-48: WebView Panel API ----

  /**
   * Registers a WebView panel definition.
   *
   * **Synchronous** — registers the panel metadata; WKWebView instances are
   * created lazily when pane tabs are opened.
   *
   * **Permission**: `ui.webPanel`
   *
   * **Limits**: 2 web panels per plugin, 6 total across all plugins.
   *
   * @param id - Short panel identifier (auto-prefixed with `{pluginId}.`).
   * @param options - Panel configuration.
   *
   * @example
   * ```javascript
   * context.ui.registerWebPanel("output", {
   *   title: "Build Output",
   *   icon: "terminal",
   *   htmlPath: "panels/output.html",
   * });
   * ```
   *
   * @since 1.6.0
   */
  registerWebPanel(id: string, options: WebPanelOptions): void;

  /**
   * Posts a JSON message to active WebView instances of a panel.
   *
   * Broadcasts to all instances by default. Pass `options.instanceId` to
   * target a specific instance. Messages are delivered via
   * `window.twopanez._emit(data)` in the WebView.
   *
   * **Permission**: `ui.webPanel`
   *
   * Maximum message size: 1MB. Messages exceeding this are rejected.
   *
   * @param panelId - Short panel identifier (auto-prefixed with `{pluginId}.`).
   * @param message - JSON-serializable data to send.
   * @param options - Optional targeting.
   *
   * @since 1.6.0
   */
  postToWebPanel(panelId: string, message: any, options?: { instanceId?: string }): void;

  /**
   * Registers a fire-and-forget message handler for messages sent from the
   * WebView via `window.twopanez.send(data)`.
   *
   * The handler receives a {@link WebPanelMessage} envelope.
   * Only one handler per panelId; calling again replaces the previous handler.
   *
   * **Permission**: `ui.webPanel`
   *
   * @param panelId - Short panel identifier (auto-prefixed with `{pluginId}.`).
   * @param handler - Callback invoked on the plugin queue with the message envelope.
   *
   * @since 1.6.0
   */
  onWebPanelMessage(panelId: string, handler: (message: WebPanelMessage) => void): void;

  /**
   * Registers a request/response handler for messages sent from the WebView
   * via `window.twopanez.request(data)`.
   *
   * The handler receives a {@link WebPanelMessage} envelope and must return
   * a value or a Promise. If a Promise is returned, it is awaited with a 10s
   * timeout. The resolved value is sent back to the WebView as the return
   * value of `window.twopanez.request()`.
   *
   * Only one handler per panelId; calling again replaces the previous handler.
   *
   * **Permission**: `ui.webPanel`
   *
   * @param panelId - Short panel identifier (auto-prefixed with `{pluginId}.`).
   * @param handler - Callback that returns a value or Promise.
   *
   * @since 1.6.0
   */
  onWebPanelRequest(panelId: string, handler: (message: WebPanelMessage) => any | Promise<any>): void;

  /**
   * Convenience method that pipes shell output to WebView panel instances.
   *
   * Executes a shell command (same as `context.shell.execute()`) and forwards
   * each `onData` chunk to all instances of the given panel via
   * `window.twopanez._emit(chunk)`. Returns the final `ShellExecuteResult`
   * as a Promise.
   *
   * **Permission**: `ui.webPanel` + `shell.execute`
   *
   * @param panelId - Short panel identifier (auto-prefixed with `{pluginId}.`).
   * @param shellOptions - Shell execution options (same as `shell.execute()`).
   * @returns The final shell execution result.
   *
   * @example
   * ```javascript
   * const result = await context.ui.pipeShellToWebPanel("output", {
   *   command: "make",
   *   args: ["build"],
   *   cwd: projectRoot,
   * });
   * ```
   *
   * @since 1.6.0
   */
  pipeShellToWebPanel(panelId: string, shellOptions: ShellExecuteOptions): Promise<ShellExecuteResult>;
}

// ============================================================================
// WebView Panel Types (fn-48)
// ============================================================================

/**
 * Configuration for `registerWebPanel()`.
 *
 * @since 1.6.0
 */
interface WebPanelOptions {
  /** Display title for the panel tab. */
  title: string;

  /** SF Symbol name for the tab icon. */
  icon?: string;

  /**
   * Relative path to the HTML file within the plugin bundle.
   * Must not be absolute or contain `..`.
   */
  htmlPath: string;

  /**
   * Preferred width in points for the panel.
   * Currently stored for future floating/popover use — pane tabs use the pane's full width.
   */
  width?: number;

  /**
   * Whether the WebView is allowed to navigate away from the initial page.
   * Default: `false`.
   */
  allowNavigation?: boolean;
}

/**
 * CSS Custom Properties injected into WebView panels.
 *
 * The host automatically injects CSS custom properties into every plugin WebView
 * `<style>` block (inside `<head>`, with the CSP nonce). These map to the app's
 * design system colors and are updated at runtime when the active theme changes.
 *
 * Available properties on `:root`:
 * - `--twopanez-bg` — Window background (#0D1117)
 * - `--twopanez-bg-sidebar` — Sidebar background (#0A0E14)
 * - `--twopanez-bg-control` — Control background (#1C2128)
 * - `--twopanez-bg-surface` — Surface background (#161B22)
 * - `--twopanez-bg-elevated` — Elevated surface (#262C36)
 * - `--twopanez-accent` — Cyan accent (#00D9FF)
 * - `--twopanez-accent-cortex` — Magenta accent (#BD00FF)
 * - `--twopanez-accent-pulse` — Amber accent (#FF6B35)
 * - `--twopanez-accent-signal` — Green accent (#00FF9F)
 * - `--twopanez-accent-warning` — Gold warning (#FFB800)
 * - `--twopanez-accent-error` — Red error (#FF3366)
 * - `--twopanez-text` — Primary text (#E6EDF3)
 * - `--twopanez-text-secondary` — Secondary text (#8B949E)
 * - `--twopanez-text-muted` — Muted text (#484F58)
 * - `--twopanez-text-ghost` — Ghost text (#30363D)
 *
 * Plugin-registered themes can override these values via `themes.registerTheme()`.
 * Updates are pushed by replacing the contents of the injected
 * `<style id="twopanez-theme">` element — no page reload needed.
 * The style element carries the CSP nonce so updates are CSP-compliant.
 *
 * @example
 * ```css
 * body {
 *   background-color: var(--twopanez-bg);
 *   color: var(--twopanez-text);
 * }
 * .button { background-color: var(--twopanez-accent); }
 * ```
 *
 * @since 1.6.0
 */

/**
 * Message envelope for WebView-to-plugin messages.
 *
 * Received by `onWebPanelMessage` and `onWebPanelRequest` handlers.
 *
 * @since 1.6.0
 */
interface WebPanelMessage {
  /** The message payload sent from the WebView. */
  data: any;

  /** Unique identifier for the WKWebView instance that sent the message. */
  instanceId: string;

  /** The app window containing this WebView. */
  windowId: string;

  /** Which pane the WebView is in. */
  paneId: "left" | "right";
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
   * Keychain items are stored under `kSecAttrService = "space.appos.plugin.{pluginId}"`.
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

  /**
   * Sets a plugin setting value with full schema validation.
   * No permission required (plugins always read/write own settings).
   *
   * Validates: key exists in manifest, type matches, enum membership, numeric min/max.
   * Throws on validation failure (never coerces).
   *
   * @param key - Setting key as declared in the manifest.
   * @param value - The value to set. Must match the declared type.
   * @throws Error if key is undeclared or value fails validation.
   */
  set(key: string, value: unknown): void;

  /**
   * Returns all declared settings with stored values, manifest defaults, or null.
   * No permission required.
   *
   * @returns Record mapping each declared key to its effective value.
   */
  getAll(): Record<string, unknown>;

  /**
   * Subscribes to changes on any setting.
   * Handler fires when any setting changes (UI, programmatic set(), or reset-to-defaults).
   *
   * @param handler - Called with (key, newValue, oldValue) on change.
   * @returns Token string for unsubscribing via offChange().
   */
  onChange(handler: (key: string, newValue: unknown, oldValue: unknown) => void): string;

  /**
   * Subscribes to changes on a specific setting key.
   * Handler fires only when the specified key changes.
   *
   * @param key - The setting key to watch.
   * @param handler - Called with (newValue, oldValue) on change.
   * @returns Token string for unsubscribing via offChange().
   */
  onKeyChange(key: string, handler: (newValue: unknown, oldValue: unknown) => void): string;

  /**
   * Unsubscribes from setting changes.
   * Removes both the JS handler and the internal observer.
   *
   * @param token - Token returned by onChange() or onKeyChange().
   */
  offChange(token: string): void;

  /**
   * Opens the settings UI for this plugin.
   *
   * If the plugin has registered sidebar panel(s), opens the inline settings popover.
   * Otherwise, opens the global Settings window to the Plugins tab.
   */
  openUI(): void;
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
   * Working directory.
   * Absolute POSIX path or `file://` URL. Validated against pane roots
   * unless `filesystem.readAll` or `filesystem.writeAll` is granted.
   *
   * **Required for T1 (contained) plugins** — omitting `cwd` when the plugin
   * has shell tier T1 (no `filesystem.readAll`/`filesystem.writeAll`) will
   * throw a sandbox violation. T2 plugins may omit it.
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

  /**
   * Optional callback invoked as output data arrives from the process.
   *
   * When provided, chunks are delivered in real-time as the process writes
   * to stdout/stderr. The final Promise still resolves with the full buffered
   * result (subject to 10MB truncation), but `onData` sees all data including
   * bytes beyond the truncation threshold.
   *
   * Chunks arrive on the plugin's serial queue. If `onData` throws, the error
   * is logged but the process continues — streaming is best-effort.
   *
   * Omit `onData` for the existing buffered behavior (no streaming).
   *
   * @example
   * ```javascript
   * await context.shell.execute({
   *   command: "yt-dlp",
   *   args: ["--progress", "--newline", url],
   *   onData: (chunk) => {
   *     if (chunk.stream === "stdout") {
   *       const match = chunk.data.match(/(\d+\.?\d*)%/);
   *       if (match) updateProgress(parseFloat(match[1]) / 100);
   *     }
   *   }
   * });
   * ```
   *
   * @since 1.5.0
   */
  onData?: (chunk: ShellDataChunk) => void;
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
 * A chunk of output data delivered via the `onData` streaming callback.
 *
 * Chunks arrive on the plugin's serial queue. Order is preserved per-stream
 * but stdout/stderr interleaving is OS-dependent.
 *
 * @since 1.5.0
 */
interface ShellDataChunk {
  /** Which pipe this chunk came from. */
  stream: "stdout" | "stderr";
  /** UTF-8 decoded text content. May contain partial lines. */
  data: string;
  /** Running total of bytes received on this stream (pre-truncation). */
  bytesTotal: number;
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
 * **Shell tiers (fn-46):**
 * - T0 (none): No `shell.execute` declared. Shell calls rejected.
 * - T1 (contained): JS plugins with `shell.execute` but no filesystem-wide perms.
 *   CWD must be within active pane roots. `cwd` is **required** (omitting throws).
 *   Denied patterns enforced: destructive commands (rm -rf, dd, shutdown, etc.)
 *   are blocked. Shell metacharacter patterns ($(), backticks, pipe-to-shell) are
 *   only checked when the command is a shell interpreter (sh, bash, zsh, etc.) --
 *   for other commands, argv is passed directly without shell evaluation.
 * - T2 (uncontained): Core-swift plugins or JS with `filesystem.readAll`/`writeAll`.
 *   No CWD restriction. Denied patterns skipped. Allowlist still enforced.
 *
 * **Denied patterns:**
 * Plugins may declare `shellDeniedPatterns: string[]` in plugin.json to add
 * custom regex guards (merged with defaults, never replacing them). Invalid
 * regexes are logged and skipped at parse time.
 *
 * **Known limitation:** `Process.terminate()` only signals the direct child.
 * Sub-processes spawned by the command are NOT killed and may orphan.
 *
 * Requires: `shell.execute`
 */
interface ShellAPI {
  /**
   * Execute a shell command with optional streaming output.
   *
   * Returns a Promise resolving to the complete result after the process exits.
   * If `options.onData` is provided, output chunks are also delivered in real-time
   * as the process writes to stdout/stderr.
   *
   * @param options - Command, arguments, and optional streaming callback.
   * @returns Complete result with exitCode, stdout, and stderr.
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
// Workspace Templates API (fn-40)
// ============================================================================

/**
 * Describes the source of a workspace template.
 */
interface WorkspaceTemplateSource {
  /** Source type: builtin, user, factory, imported, or plugin. */
  type: "builtin" | "user" | "factory" | "imported" | "plugin";
  /** Plugin ID, present only when type is "plugin". */
  pluginId?: string;
}

/**
 * A sidebar favorite item within a workspace template.
 */
interface WorkspaceTemplateFavoriteItem {
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
interface WorkspaceTemplateSidebarSection {
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
interface WorkspaceTemplateSidebarConfig {
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
 *
 * The `type` field determines which associated field is present.
 */
interface WorkspaceTemplateTabSlot {
  /** Tab content type. Unknown types are preserved as `unsupported`. */
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
interface WorkspaceTemplatePaneConfig {
  /** Tab definitions for this pane. */
  tabs: WorkspaceTemplateTabSlot[];
  /** Index of the active tab. */
  activeTab: number;
}

/**
 * A user-prompted variable resolved at apply time.
 */
interface WorkspaceTemplateVariable {
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
 *
 * Templates define sidebar configuration, pane layouts, and variables.
 * Plugin-registered templates are ephemeral (in-memory only, removed on unload).
 *
 * The full shape is accepted by `register()` and returned by `list()`.
 * Plugins may provide partial templates (metadata-only) or full layouts.
 */
interface WorkspaceTemplate {
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
  /** Where this workspace came from. Automatically stamped by `register()`. */
  source: WorkspaceTemplateSource;
}

/**
 * Workspace management API (fn-40). All methods require `workspaces` permission.
 *
 * Plugin-registered workspaces are ephemeral — they exist only while the plugin is loaded.
 * The `register()` method automatically stamps `source` as `{ type: "plugin", pluginId }`,
 * ignoring any caller-supplied source field.
 *
 * **Window targeting:**
 * - Window-scoped plugins: `apply`, `getActive`, `onChange` operate on the bound window.
 * - App-scoped plugins: these methods target the currently focused window.
 * - `list` and `register` are window-independent (operate on the shared repository).
 */
interface WorkspacesAPI {
  /**
   * Registers an ephemeral workspace template.
   *
   * The `source` field is automatically set to the calling plugin — any caller-supplied
   * source is ignored. The workspace exists only while the plugin is loaded.
   *
   * @param template - Workspace template object (must have `id` and `name`).
   * @returns Promise resolving to the workspace ID string.
   */
  register(template: Partial<WorkspaceTemplate> & { id: string; name: string }): Promise<string>;

  /**
   * Lists all available workspace templates (all sources).
   *
   * @returns Promise resolving to an array of workspace templates.
   */
  list(): Promise<WorkspaceTemplate[]>;

  /**
   * Applies a workspace template to the current window.
   *
   * Uses silent mode (no interactive prompts). For plugin-initiated apply,
   * dirty-tab review is skipped.
   *
   * @param workspaceId - The ID of the workspace to apply.
   * @returns Promise resolving to `true` on success, `false` on failure.
   */
  apply(workspaceId: string): Promise<boolean>;

  /**
   * Returns the active workspace ID for the current window.
   *
   * @returns Promise resolving to the workspace ID string, or `null` if none is active.
   */
  getActive(): Promise<string | null>;

  /**
   * Subscribes to workspace change events for the current window.
   *
   * The callback receives the new active workspace ID (or `null` when cleared).
   *
   * @param callback - Function called with the new workspace ID or null.
   * @returns Promise resolving to a subscription token string.
   */
  onChange(callback: (workspaceId: string | null) => void): Promise<string>;
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
// Plugin Cache API (fn-41)
// ============================================================================

/** Options for `cache.set()`. */
interface CacheSetOptions {
  /** Time-to-live in seconds. Omit for no expiry. */
  ttl?: number;
  /** When true, writes through to SQLite disk tier. Default: memory-only. */
  persist?: boolean;
}

/**
 * Hybrid memory + SQLite cache with per-plugin isolation.
 *
 * Requires `cache` permission. All values must be JSON-serializable.
 * Disk tier enforces 50 MB/plugin and 200 MB global quotas.
 */
interface PluginCacheAPI {
  /** Returns the cached value, or `null` if missing/expired. */
  get(key: string): Promise<unknown | null>;
  /** Stores a JSON-serializable value. */
  set(key: string, value: unknown, options?: CacheSetOptions): Promise<true>;
  /** Removes a single entry. */
  remove(key: string): Promise<true>;
  /** Clears all entries for the calling plugin. */
  clear(): Promise<true>;
  /** Checks if a non-expired entry exists (distinguishes stored null from missing). */
  has(key: string): Promise<boolean>;
  /** Returns all non-expired keys for the calling plugin. */
  keys(): Promise<string[]>;
}

// ============================================================================
// Plugin Feedback API (fn-41)
// ============================================================================

/** Options for toast/notify. */
interface FeedbackToastOptions {
  /** Visual style. */
  kind?: "info" | "success" | "warning" | "error";
  /** Duration in seconds (clamped to 0.5–30s). */
  duration?: number;
}

/** Options for HUD panels. */
interface FeedbackHudOptions {
  /** Visual style. */
  kind?: "info" | "success" | "warning" | "error";
  /** Progress value 0–1, or omit for indeterminate. */
  progress?: number;
}

/** Options for HUD updates. */
interface FeedbackHudUpdateOptions {
  /** Updated progress value 0–1. */
  progress?: number;
  /** Updated message text. */
  message?: string;
}

/** Options for NSAlert. */
interface FeedbackAlertOptions {
  /** Secondary message text. */
  informativeText?: string;
  /** Button labels (first is default). */
  buttons?: string[];
  /** Alert style. */
  style?: "informational" | "warning" | "critical";
}

/** Options for system notifications. */
interface FeedbackNotificationOptions {
  /** Visual style for categorization. */
  kind?: "info" | "success" | "warning" | "error";
}

/**
 * Toast, HUD, alert, and system notification feedback.
 *
 * - `feedback` permission: toast, hud, notify, systemNotification
 * - `feedback.confirm` permission: alert (blocking modal)
 */
interface PluginFeedbackAPI {
  /** Always shows a toast. */
  toast(message: string, options?: FeedbackToastOptions): Promise<boolean>;
  /** Always shows a HUD panel. Returns handle ID. */
  hud(message: string, options?: FeedbackHudOptions): Promise<string>;
  /** Updates an existing HUD panel. */
  updateHud(id: string, options: FeedbackHudUpdateOptions): Promise<true>;
  /** Dismisses a HUD panel. */
  dismissHud(id: string): Promise<true>;
  /** Always shows an NSAlert. Returns 0-based button index. */
  alert(message: string, options?: FeedbackAlertOptions): Promise<number>;
  /** Always sends a system notification. */
  systemNotification(title: string, message: string, options?: FeedbackNotificationOptions): Promise<true>;
  /** Adaptive routing: focused→toast, unfocused→HUD, background→system. */
  notify(message: string, options?: FeedbackToastOptions): Promise<true>;
}

// ============================================================================
// Plugin OAuth API (fn-41)
// ============================================================================

/** Options for `oauth.authorize()`. */
interface OAuthAuthorizeOptions {
  /** OAuth client ID (required). */
  clientId: string;
  /** Requested scopes (must be subset of manifest-declared scopes). */
  scopes?: string[];
}

/** Token data returned from `oauth.authorize()` and `oauth.getToken()`. */
interface OAuthTokenResult {
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
 * OAuth 2.0 + PKCE authorization.
 *
 * Requires `oauth` + `oauth.{provider}` permissions.
 * Providers must be declared in `manifest.oauth.providers[]`.
 */
interface PluginOAuthAPI {
  /** Starts OAuth 2.0 + PKCE flow. Opens system browser. */
  authorize(provider: string, options: OAuthAuthorizeOptions): Promise<OAuthTokenResult>;
  /** Returns stored token, or null if not authorized / expired. */
  getToken(provider: string): Promise<OAuthTokenResult | null>;
  /** Deletes stored tokens and cancels refresh schedule. */
  revoke(provider: string): Promise<true>;
  /** Checks if a non-expired token exists. */
  isAuthorized(provider: string): Promise<boolean>;
}

// ============================================================================
// Plugin Menu Bar API (fn-41)
// ============================================================================

/** Options for `menubar.register()` and `menubar.update()`. */
interface MenuBarRegisterOptions {
  /** SF Symbol name for the status item icon (required for register). */
  icon: string;
  /** Optional display label next to the icon. */
  label?: string;
}

/** Options for `menubar.update()`. */
interface MenuBarUpdateOptions {
  /** Updated SF Symbol name. */
  icon?: string;
  /** Updated label text. */
  label?: string;
}

/**
 * Context passed to the `menuBarOpen(context)` export when a popover opens.
 *
 * The `cache` field is only present when the plugin has `cache` permission.
 */
interface MenuBarRenderContext {
  /** Plugin ID of the owning plugin. */
  pluginId: string;
  /** Updates the popover UI with a ViewDescriptor. */
  setContent(descriptor: ViewDescriptor): void;
  /** Dismisses the popover. */
  close(): void;
  /** Scoped cache API (omitted if plugin lacks `cache` permission). */
  cache?: Pick<PluginCacheAPI, "get" | "set" | "remove">;
}

/**
 * Menu bar NSStatusItem management.
 *
 * Requires `menubar` permission. One status item per plugin.
 */
interface PluginMenuBarAPI {
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

/**
 * Menu bar popover open handler. Called when the plugin's NSStatusItem
 * popover opens. Optional: if not defined, host uses the stored content descriptor.
 *
 * @param context - Render context with scoped APIs (cache, if permitted).
 */
declare function menuBarOpen(context: MenuBarRenderContext): void | Promise<void>;
