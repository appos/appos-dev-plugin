/**
 * @appos.space/plugin-types — consolidated type definitions for the AppOS Plugin API
 *
 * Version: 2.4.0-fn50
 *
 * This is a snapshot of the declaration files from @appos.space/plugin-types for
 * offline reference inside the twopanez-dev plugin. For the live version, see
 * ~/Documents/GitHub/AppOS/plugin-sdk/packages/plugin-types/dist/.
 *
 * Usage in a plugin:
 *     import type { PluginContext, ViewDescriptor } from '@appos.space/plugin-types';
 *
 * IMPORTANT: @appos.space/plugin-types is declaration-only. Your tsconfig.json
 * must set `verbatimModuleSyntax: true` to prevent TypeScript from emitting
 * runtime imports for these types.
 */


// ============================================================
// core.d.ts
// ============================================================

/**
 * Core plugin types — lifecycle, context, manifest.
 *
 * @version 2.4.0-fn50
 */


/**
 * The main plugin context object passed to `activate(context)`.
 *
 * Provides access to all 22 API namespaces plus read-only metadata
 * about the plugin and host environment.
 */
export interface PluginContext {
    /** Unique plugin identifier (e.g., "com.example.my-plugin"). */
    readonly pluginId: string;
    /** Semantic version of this plugin (from plugin.json). */
    readonly pluginVersion: string;
    /** Semantic version of the host application. */
    readonly hostVersion: string;
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
    /** Extension point declaration and contribution. */
    readonly extensionPoints: ExtensionPointsAPI;
    /** Data contract exposure and querying. */
    readonly dataContracts: DataContractsAPI;
    /** Inter-plugin event channels. */
    readonly interPluginEvents: InterPluginEventsAPI;
    /** Smart folder filter type registration and evaluation. */
    readonly smartFolders: SmartFoldersAPI;
    /** File preview registry queries and programmatic preview triggering. */
    readonly preview: PreviewAPI;
    /** Host event subscriptions. */
    readonly events: EventsAPI;
    /** Network fetch and download. Requires `network.outbound` or `network.unrestricted`. */
    readonly network: NetworkAPI;
    /** Shell command execution. Requires `shell.execute`. */
    readonly shell: ShellAPI;
    /** System clipboard read/write. Requires `clipboard.read` / `clipboard.write`. */
    readonly clipboard: ClipboardAPI;
    /** Keyboard shortcut registration. Requires `ui.shortcuts`. */
    readonly shortcuts: ShortcutsAPI;
    /** Theme registration and activation. Requires `ui.themes` for mutations. */
    readonly themes: ThemesAPI;
    /** Workspace template management (fn-40). Requires `workspaces`. */
    readonly workspaces: WorkspacesAPI;
    /** Plugin cache with memory + disk tiers and TTL (fn-41). Requires `cache`. */
    readonly cache: CacheAPI;
    /** Toast, HUD, confirmation, and progress feedback (fn-41). Requires `feedback`. */
    readonly feedback: FeedbackAPI;
    /** OAuth 2.0 + PKCE authorization (fn-41). Requires `oauth`. */
    readonly oauth: OAuthAPI;
    /** Menu bar NSStatusItem management (fn-41). Requires `menubar`. */
    readonly menubar: MenubarAPI;
}
/**
 * Classifies a dependency as either a system binary or another plugin.
 */
export type DependencyType = "system" | "plugin";
/**
 * The resolved installation state of a single dependency.
 *
 * - `"not_found"` — Binary or plugin not found on the system.
 * - `"installed"` — Found with a detected version string (see `installedVersion`).
 * - `"installed_version_unknown"` — Found but version could not be detected.
 * - `"permission_denied"` — The `shell.execute` permission was not granted.
 * - `"command_not_allowed"` — The `check.command` is not in `shellCommands` allowlist.
 */
export type InstallationState = "not_found" | "installed" | "installed_version_unknown" | "permission_denied" | "command_not_allowed";
/**
 * The resolved status of a single declared dependency (system or plugin).
 *
 * Returned by `lifecycle.getDependencyStatus()` and
 * `lifecycle.recheckDependencies()`. Matches the Swift `DependencyStatus`
 * struct with custom Codable flattening of `InstallationState`.
 */
export interface DependencyStatus {
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
/**
 * How to probe for a system binary dependency.
 */
export interface SystemDependencyCheck {
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
export interface SystemDependency {
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
export interface ManifestPluginDependency {
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
export type PluginDependency = ManifestPluginDependency;
/**
 * Dependencies section of `plugin.json`.
 *
 * Plugins declare system binary and/or plugin dependencies here.
 * The host resolves these at activation time and reports status via
 * `lifecycle.getDependencyStatus()`.
 */
export interface PluginDependencies {
    /** System binary dependencies (e.g., yt-dlp, ffmpeg). */
    system?: SystemDependency[];
    /** Plugin dependencies (other AppOS plugins). */
    plugins?: PluginDependency[];
}
/**
 * Plugin manifest shape — corresponds to the `plugin.json` file
 * that every plugin must include.
 */
export interface PluginManifest {
    /** Unique reverse-domain plugin identifier (e.g., "com.example.my-plugin"). */
    id: string;
    /** Human-readable plugin name. */
    name: string;
    /** Semantic version string. */
    version: string;
    /** Runtime engine; currently only "javascript" is supported. */
    runtime: "javascript";
    /** Path to the main entry file relative to the plugin root. */
    entrypoint: string;
    /** Minimum host version required (semver). */
    minHostVersion?: string;
    /** Plugin author name or organization. */
    author?: string;
    /** Short description of the plugin. */
    description?: string;
    /** SPDX license identifier. */
    license?: string;
    /** Activation events that trigger plugin loading. */
    activation?: {
        events: ActivationEvent[];
    };
    /** Permission scopes requested by the plugin. */
    permissions?: PermissionScope[];
    /** Shell commands the plugin is allowed to execute. */
    shellCommands?: string[];
    /** Regex patterns for denied shell commands (fn-46). Evaluated before allowlist. */
    shellDeniedPatterns?: string[];
    /** Network domains the plugin is allowed to access. */
    networkDomains?: string[];
    /** System and plugin dependencies (fn-50). */
    dependencies?: PluginDependencies;
    /** User-configurable settings declared by the plugin. */
    settings?: SettingDefinition[];
    /** OAuth provider declarations for the plugin. */
    oauth?: {
        providers: OAuthProviderDeclaration[];
    };
    /** Menu bar status item configuration (fn-41). */
    menubar?: {
        icon: string;
        label?: string;
        globalShortcut?: string;
    };
    /** Plugin homepage URL. */
    homepage?: string;
    /** Plugin Store categories. */
    categories?: string[];
    /** Search keywords for discoverability. */
    keywords?: string[];
}
/** Events that can trigger plugin activation. */
export type ActivationEvent = "onStartup";
/**
 * Declares a user-configurable setting in the plugin manifest.
 *
 * The host validates values against type, enum membership, and numeric min/max
 * constraints before persisting.
 */
export interface SettingDefinition {
    /** Setting key used in `settings.get()` / `settings.set()`. */
    key: string;
    /** Human-readable label shown in the settings UI. */
    label: string;
    /** Value type: bool, number, enum (pick from options), or string. */
    type: "bool" | "number" | "enum" | "string";
    /** Default value when no user preference is stored. */
    default?: unknown;
    /** Valid options for "enum" type settings. */
    options?: unknown[];
    /** Minimum value for "number" type settings. */
    min?: number;
    /** Maximum value for "number" type settings. */
    max?: number;
}
/**
 * Declares an OAuth provider in the plugin manifest.
 *
 * Providers must be declared in `manifest.oauth.providers[]` and require
 * both `oauth` and `oauth.{id}` permissions.
 */
export interface OAuthProviderDeclaration {
    /** Provider identifier (e.g., "github", "google"). */
    id: string;
    /** OAuth scopes to request during authorization. */
    scopes: string[];
    /** Human-readable reason shown in the permission consent dialog. */
    reason?: string;
}
/**
 * Describes a file or directory visible to plugins.
 *
 * This is a bridge-specific DTO — it does NOT expose internal FileItem details
 * like icon names or sort keys. All fields are JSON-safe.
 */
export interface PluginFileDescriptor {
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
//# sourceMappingURL=core.d.ts.map

// ============================================================
// views.d.ts
// ============================================================

/**
 * ViewDescriptor system — typed UI tree definitions.
 *
 * The discriminated union on `type` ensures compile-time validation
 * of widget types and their required properties.
 */



export interface ViewDescriptorBase {
    id?: string;
}
export interface VStackDescriptor extends ViewDescriptorBase {
    type: "vstack";
    children: ViewDescriptor[];
    properties?: {
        spacing?: number;
    };
}
export interface HStackDescriptor extends ViewDescriptorBase {
    type: "hstack";
    children: ViewDescriptor[];
    properties?: {
        spacing?: number;
    };
}
export interface ScrollDescriptor extends ViewDescriptorBase {
    type: "scroll";
    children: ViewDescriptor[];
    properties?: {
        axes?: "horizontal" | "vertical";
    };
}
export interface ListDescriptor extends ViewDescriptorBase {
    type: "list";
    children: ViewDescriptor[];
}
export interface GridDescriptor extends ViewDescriptorBase {
    type: "grid";
    children: ViewDescriptor[];
    properties?: {
        columns?: number;
        spacing?: number;
    };
}
export interface SectionDescriptor extends ViewDescriptorBase {
    type: "section";
    children: ViewDescriptor[];
    properties: {
        title: string;
        icon?: SFSymbolName;
        badge?: string;
        isExpanded?: boolean;
        id?: string;
    };
}
export interface TextDescriptor extends ViewDescriptorBase {
    type: "text";
    properties: {
        content: string;
        font?: PluginFont;
        width?: number;
        align?: "leading" | "trailing" | "center";
        mono?: boolean;
        tooltip?: string;
    };
}
export interface LabelDescriptor extends ViewDescriptorBase {
    type: "label";
    properties: {
        title: string;
        icon?: SFSymbolName;
        font?: PluginFont;
    };
}
export interface ImageDescriptor extends ViewDescriptorBase {
    type: "image";
    properties: {
        systemName: SFSymbolName;
    };
}
export interface BadgeDescriptor extends ViewDescriptorBase {
    type: "badge";
    properties: {
        text?: string;
        content?: string;
        color?: PluginColor;
    };
}
export interface ButtonDescriptor extends ViewDescriptorBase {
    type: "button";
    properties: {
        title: string;
        action: string;
        tooltip?: string;
        width?: number;
    };
}
export interface ListItemDescriptor extends ViewDescriptorBase {
    type: "listItem";
    children?: ViewDescriptor[];
    properties: {
        title: string;
        subtitle?: string;
        icon?: SFSymbolName;
        iconColor?: PluginColor;
        action?: string;
        trailing?: string;
        menuActions?: string;
    };
}
export interface MenuAction {
    title: string;
    icon?: SFSymbolName;
    action?: string;
    destructive?: boolean;
}
export interface DividerDescriptor extends ViewDescriptorBase {
    type: "divider";
}
export interface SpacerDescriptor extends ViewDescriptorBase {
    type: "spacer";
    properties?: {
        minLength?: number;
    };
}
export interface TextFieldDescriptor extends ViewDescriptorBase {
    type: "textField";
    properties: {
        placeholder?: string;
        text?: string;
        action?: string;
    };
}
export interface ProgressDescriptor extends ViewDescriptorBase {
    type: "progress";
    properties?: {
        value?: number;
        label?: string;
        style?: "bar" | "circular";
    };
}
export interface RemoteImageDescriptor extends ViewDescriptorBase {
    type: "remoteImage";
    properties: {
        url: string;
        width?: number;
        height?: number;
        cornerRadius?: number;
        maxDimension?: number;
    };
}
export type ViewDescriptor = VStackDescriptor | HStackDescriptor | ScrollDescriptor | ListDescriptor | GridDescriptor | SectionDescriptor | TextDescriptor | LabelDescriptor | ImageDescriptor | BadgeDescriptor | ButtonDescriptor | ListItemDescriptor | DividerDescriptor | SpacerDescriptor | TextFieldDescriptor | ProgressDescriptor | RemoteImageDescriptor;
export type ViewDescriptorType = ViewDescriptor["type"];
//# sourceMappingURL=views.d.ts.map

// ============================================================
// namespaces.d.ts
// ============================================================

/**
 * API namespace interfaces — all 22 namespaces.
 * Each maps to a property on PluginContext.
 *
 * @version 2.4.0-fn50
 */



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
    /** Opens a file in an in-pane viewer tab. */
    openInPane(url: string, options?: {
        pane?: "left" | "right";
        mode?: "view";
    }): void;
    /** Opens a terminal tab at the given working directory. */
    openTerminal(workingDirectory: string, options?: {
        pane?: "left" | "right";
    }): void;
    /** Opens a code editor tab for the given file URL. */
    openEditor(url: string, options?: {
        pane?: "left" | "right";
    }): void;
    /** Opens a web browser tab for the given URL. */
    openWebView(url: string, options?: {
        pane?: "left" | "right";
    }): void;
    /** Opens a markdown preview tab for the given file URL. */
    openMarkdownPreview(url: string, options?: {
        pane?: "left" | "right";
    }): void;
    /** Opens a new AI chat pane tab with optional prefill. */
    openAIChat(options?: {
        pane?: "left" | "right";
        connector?: string;
        systemPrompt?: string;
        context?: string[];
    }): void;
    /** Registers a WebView panel definition. */
    registerWebPanel(id: string, options: WebPanelOptions): void;
    /** Posts a JSON message to active WebView instances of a panel. */
    postToWebPanel(panelId: string, message: unknown, options?: {
        instanceId?: string;
    }): void;
    /** Registers a fire-and-forget message handler for WebView messages. */
    onWebPanelMessage(panelId: string, handler: (message: WebPanelMessage) => void): void;
    /** Registers a request/response handler for WebView messages. */
    onWebPanelRequest(panelId: string, handler: (message: WebPanelMessage) => unknown | Promise<unknown>): void;
    /** Pipes shell output to WebView panel instances. */
    pipeShellToWebPanel(panelId: string, shellOptions: ShellExecuteOptions): Promise<ShellExecuteResult>;
}
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
export interface EventsAPI {
    /** Subscribes to a host event. Returns subscription token. */
    subscribe(eventName: string, handler: (payload: unknown) => void): string;
    /** Cancels a host event subscription. */
    unsubscribe(token: string): void;
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
export interface ClipboardAPI {
    /** Reads the current clipboard string content. */
    read(): Promise<string | null>;
    /** Clears the clipboard and writes the given string. */
    write(text: string): Promise<boolean>;
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
export interface OAuthAPI {
    /** Starts OAuth 2.0 + PKCE flow. Opens system browser. */
    authorize(provider: string, options: OAuthAuthorizeOptions): Promise<OAuthTokenResult>;
    /** Returns stored token, or null if not authorized / expired. */
    getToken(provider: string): Promise<OAuthTokenResult | null>;
    /** Deletes stored tokens and cancels refresh schedule. */
    revoke(provider: string): Promise<true>;
    /** Checks if a non-expired token exists. */
    isAuthorized(provider: string): Promise<boolean>;
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

// ============================================================
// permissions.d.ts
// ============================================================

/**
 * All valid permission scopes (33 scopes).
 */
export type PermissionScope = "ui.sidebar" | "ui.statusBar" | "ui.contextMenu" | "ui.notifications" | "ui.sheets" | "ui.shortcuts" | "ui.themes" | "ui.preview" | "ui.aiChat" | "ui.webPanel" | "filesystem.read" | "filesystem.write" | "filesystem.watch" | "filesystem.readAll" | "filesystem.writeAll" | "shell.execute" | "shell.uncontained" | "clipboard.read" | "clipboard.write" | "network" | "network.outbound" | "network.fetch" | "network.unrestricted" | "keychain.plugin" | "interPlugin.declare" | "interPlugin.contribute" | "interPlugin.query" | "interPlugin.emit" | "workspaces" | "cache" | "feedback" | "feedback.confirm" | "oauth" | `oauth.${string}` | "menubar" | "menubar.globalShortcut" | "smartFolders" | "webview";
//# sourceMappingURL=permissions.d.ts.map

// ============================================================
// colors.d.ts
// ============================================================

/**
 * Valid color values for ViewDescriptor properties.
 * System colors, semantic colors, design tokens, and hex strings.
 */
/** System colors (AppKit NSColor) */
export type SystemColor = "systemRed" | "systemOrange" | "systemYellow" | "systemGreen" | "systemBlue" | "systemPurple" | "systemPink" | "systemTeal" | "systemIndigo" | "systemBrown" | "systemMint" | "systemCyan" | "red" | "orange" | "yellow" | "green" | "blue" | "purple";
/** Semantic colors */
export type SemanticColor = "primary" | "secondary" | "tertiary";
/** AppOS design tokens */
export type DesignTokenColor = "ux_synapse" | "ux_cortex" | "ux_pulse" | "ux_signal" | "ux_warning" | "ux_error" | "ux_success" | "ux_info";
/** Hex color string (e.g. "#FF5733") */
export type HexColor = `#${string}`;
/** All valid color values */
export type PluginColor = SystemColor | SemanticColor | DesignTokenColor | HexColor;
//# sourceMappingURL=colors.d.ts.map

// ============================================================
// fonts.d.ts
// ============================================================

/**
 * Valid font values for ViewDescriptor text/label properties.
 * Maps to SwiftUI Font enum.
 */
export type PluginFont = "largeTitle" | "title" | "title2" | "title3" | "headline" | "subheadline" | "body" | "callout" | "footnote" | "caption" | "caption2";
//# sourceMappingURL=fonts.d.ts.map

// ============================================================
// icons.d.ts
// ============================================================

/**
 * Common SF Symbol names used by plugins.
 *
 * This is a curated subset — SF Symbols has 5000+ icons.
 * The full enum will be auto-generated from the SF Symbols catalog.
 * Any valid SF Symbol name is accepted at runtime; this type
 * provides autocomplete for the most common ones.
 */
export type SFSymbolName = "doc" | "doc.fill" | "doc.on.doc" | "doc.on.clipboard" | "doc.text" | "doc.text.fill" | "doc.richtext" | "folder" | "folder.fill" | "folder.badge.plus" | "arrow.left" | "arrow.right" | "arrow.up" | "arrow.down" | "arrow.up.forward.app" | "arrow.triangle.branch" | "arrow.clockwise" | "arrow.counterclockwise" | "plus" | "minus" | "xmark" | "checkmark" | "pencil" | "pencil.line" | "trash" | "trash.fill" | "square.and.arrow.up" | "square.and.arrow.down" | "sidebar.left" | "sidebar.right" | "rectangle.split.2x1" | "tray" | "tray.fill" | "tray.2.fill" | "sparkles" | "star" | "star.fill" | "heart" | "heart.fill" | "bolt" | "bolt.fill" | "flame" | "flame.fill" | "hand.wave" | "puzzlepiece.extension" | "play" | "play.fill" | "pause" | "pause.fill" | "stop" | "stop.fill" | "forward" | "backward" | "gear" | "gearshape" | "terminal" | "hammer" | "gauge.medium" | "chart.bar" | "chart.line.uptrend.xyaxis" | "envelope" | "message" | "bell" | "bell.fill" | (string & {});
//# sourceMappingURL=icons.d.ts.map