/**
 * Core plugin types — lifecycle, context, manifest.
 *
 * @version 3.0.0
 */
import type { PermissionScope, PermissionEntry } from "./permissions";
import type { CommandsAPI, FileOpsAPI, UIAPI, StorageAPI, SettingsAPI, EventsAPI, ShellAPI, ClipboardAPI, NetworkAPI, ShortcutsAPI, ThemesAPI, SmartFoldersAPI, PreviewAPI, ExtensionPointsAPI, DataContractsAPI, InterPluginEventsAPI, LifecycleAPI, WorkspacesAPI, CacheAPI, FeedbackAPI, OAuthAPI, MenubarAPI } from "./namespaces";
import type { AnyJSONValue, StoreAPI, VaultAPI, ActionsAPI, PaletteAPI, SchedulerAPI, ResourcesAPI, TokensAPI, BundlesAPI, EntitiesAPI, FieldsAPI, LedgerAPI, ViewsAPI, SurfacesAPI, ProtocolsAPI, NotificationsAPI, InputAPI, WebhookAPI, LLMAPI, RecipesAPI, SequencesAPI, FileSystemAPI } from "./namespaces-core-plugins";
/**
 * The main plugin context object passed to `activate(context)`.
 *
 * Provides access to all 43 API namespaces plus read-only metadata
 * about the plugin and host environment. Mirrors the host's
 * `PluginContextExport` (Swift JSExport — ground truth).
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
    /** Durable Promise-shaped document/KV store (fn-71). Requires `store.*`. */
    readonly store: StoreAPI;
    /** Credential vault (fn-72). Requires `vault.*`. */
    readonly vault: VaultAPI;
    /** Public Action Fabric (fn-89). Requires `actions.*`. */
    readonly actions: ActionsAPI;
    /** Command palette integration for public actions (fn-89). */
    readonly palette: PaletteAPI;
    /** Job scheduling engine (fn-90). Requires `scheduler.job.own`. */
    readonly scheduler: SchedulerAPI;
    /** URI-addressable resource read plane (fn-92). Requires `resources.*`. */
    readonly resources: ResourcesAPI;
    /** Dotted-path token providers + template resolution (fn-92). */
    readonly tokens: TokensAPI;
    /**
     * ContextBundle composition (fn-92). Requires `context.compose`.
     * NOTE: distinct from `clipboard.bundles` (fn-91).
     */
    readonly bundles: BundlesAPI;
    /** Entity resolution plane (fn-93). Requires `entities.*`. */
    readonly entities: EntitiesAPI;
    /** Plugin-attached entity fields (fn-93). Requires `entities.*`. */
    readonly fields: FieldsAPI;
    /** Execution / approval ledger reads (fn-94). Requires `ledger.read.*`. */
    readonly ledger: LedgerAPI;
    /** Host-rendered Saved Views (fn-95). Requires `views.*`. */
    readonly views: ViewsAPI;
    /** Surface contributions (fn-95). Runtime methods reject in v1 — use manifest `extensions[]`. */
    readonly surfaces: SurfacesAPI;
    /** Protocol sidecar subprocesses (fn-96). Requires `sidecars.*`. */
    readonly protocols: ProtocolsAPI;
    /** Outbound notifications (fn-97). Requires `notifications.*`. */
    readonly notifications: NotificationsAPI;
    /** Inbound input channels (fn-98). Requires `input.*`. */
    readonly input: InputAPI;
    /** Bidirectional webhook gateway (fn-99/fn-118). Requires `webhook.*`. */
    readonly webhook: WebhookAPI;
    /** LLM provider verbs + contributor registries (fn-100). Requires `llm.*`. */
    readonly llm: LLMAPI;
    /** Recipe definitions + runs (fn-101). Requires `recipes.*`. */
    readonly recipes: RecipesAPI;
    /** Sequence definitions + runs (fn-101). Requires `sequences.*`. */
    readonly sequences: SequencesAPI;
    /** Filesystem/transfer-strategy provider stub — core-swift only; throws for JS plugins. */
    readonly fileSystem: FileSystemAPI;
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
 * A declared contribution to an extension point (fn-12 typed array).
 *
 * This is the manifest delivery vehicle for every wave-6b–8b declarative
 * contribution: `actions.definition` (fn-89), `scheduler.triggerKind` /
 * `scheduler.condition` (fn-90), clipboard EPs (fn-91), `entities.*` EPs
 * (fn-93), `ledger.artifactPreview` / `ledger.redactionRule` (fn-94),
 * `views.savedView` + `surfaces.contribution` (fn-95), `sidecars.definition`
 * (fn-96), `notifications.{channel,filter,route,action}` (fn-97),
 * `input.{channel,parser,intent,auth}` (fn-98), LLM provider/pre/post/router
 * contributions (fn-100), and `recipes.definition` / `sequences.definition` /
 * `recipes.trigger` (fn-101).
 */
export interface PluginExtensionContribution {
    /** Qualified extension point id (e.g., "space.appos.core.notifications:channel"). */
    extensionPoint: string;
    /** Contribution payload — shape is defined per extension point. */
    [key: string]: AnyJSONValue | undefined;
}
/**
 * A keyboard shortcut declared in the manifest for auto-registration.
 * Requires `ui.shortcuts` permission; silently skipped if not granted.
 */
export interface ManifestShortcut {
    /** Short command ID (auto-prefixed with `{pluginId}.` during registration). */
    commandId: string;
    /** Shortcut key string (e.g., "cmd+shift+t"). */
    keys: string;
    /** Optional condition string. */
    when?: string;
}
/** A permission entry: bare scope string or `{ scope, reason }` object. */
export type ManifestPermission = PermissionScope | PermissionEntry;
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
    /**
     * Runtime engine. Third-party plugins use "javascript"; "core-swift" is
     * reserved for host-bundled core plugins.
     */
    runtime: "javascript" | "core-swift";
    /**
     * Path to the main entry file relative to the plugin root.
     * Required for "javascript" runtime; absent for "core-swift" plugins.
     */
    entrypoint?: string;
    /** Minimum host version required (semver). Host launch baseline is 1.0.0. */
    minHostVersion?: string;
    /** Plugin author name or organization. */
    author?: string;
    /** Short description of the plugin. */
    description?: string;
    /** SPDX license identifier. */
    license?: string;
    /** Repository URL. */
    repository?: string;
    /** Activation events that trigger plugin loading. */
    activation?: {
        events: ActivationEvent[];
    };
    /**
     * Permission scopes requested by the plugin. Each entry is either a bare
     * scope string or a `{ scope, reason }` object (reason ≤ 120 chars, shown
     * in the approval sheet).
     */
    permissions?: ManifestPermission[];
    /** Dynamic capabilities dictionary. */
    capabilities?: Record<string, AnyJSONValue>;
    /** Extension points declared by this plugin. */
    extensionPoints?: AnyJSONValue[];
    /** Data contracts declared by this plugin. */
    dataContracts?: AnyJSONValue[];
    /**
     * Extension contributions (fn-12 typed array) — the manifest-declarative
     * tier for core-plugin extension points. See {@link PluginExtensionContribution}.
     */
    extensions?: PluginExtensionContribution[];
    /** Manifest-declared keyboard shortcuts, auto-registered at activation. */
    shortcuts?: ManifestShortcut[];
    /**
     * Plugin scope: "window" (per-window instance) or "app" (single shared
     * instance, default). Core-swift plugins always behave as "app".
     */
    scope?: "window" | "app";
    /**
     * Isolation mechanism: "jscontext" (in-process, default) or "xpc"
     * (reserved for future sandboxed XPC isolation; parsed but not enforced).
     */
    isolation?: "jscontext" | "xpc";
    /** Shell commands the plugin is allowed to execute. */
    shellCommands?: string[];
    /**
     * Allowed shell commands for core-plugin `shellExecute` enforcement
     * (core-swift only). Absent/empty = deny-all.
     */
    allowedShellCommands?: string[];
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