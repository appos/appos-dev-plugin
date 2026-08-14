/**
 * All valid permission scopes.
 *
 * Regenerated from the host's `PermissionScope.allKnown` set in
 * `Sources/TwoPanez/Services/Plugins/PluginManifest.swift` (135 canonical
 * scopes as of waves fn-70 .. fn-101 + fn-118), plus the dynamic
 * `oauth.<provider>` family and a small set of legacy aliases kept for
 * backward compatibility.
 *
 * @version 3.0.0
 */
/**
 * Canonical permission scopes recognized by the host.
 */
export type CanonicalPermissionScope = "ui.sidebar" | "ui.statusBar" | "ui.toolbar" | "ui.contextMenu" | "ui.notifications" | "ui.sheets" | "ui.shortcuts" | "ui.themes" | "ui.preview" | "ui.aiChat" | "ui.webPanel" | "ui.settings" | "filesystem.read" | "filesystem.write" | "filesystem.watch" | "filesystem.readAll" | "filesystem.writeAll" | "shell.execute" | "clipboard.read" | "clipboard.write" | "clipboard.history.read" | "clipboard.history.subscribe" | "clipboard.history.write" | "clipboard.bundles" | "clipboard.contentType.register" | "clipboard.source.register" | "clipboard.transform.register" | "clipboard.destination.register" | "clipboard.rule.register" | "clipboard.retention.predicate.register" | "network.outbound" | "network.unrestricted" | "keychain.plugin" | "interPlugin.declare" | "interPlugin.contribute" | "interPlugin.query" | "interPlugin.emit" | "workspaces" | "cache" | "feedback" | "feedback.confirm" | "oauth" | "menubar" | "menubar.globalShortcut" | "events.topic.declare" | "events.emit" | "events.subscribe" | "events.replay" | "events.inspect" | "events.serializer.register" | "events.sink.register" | "store.namespace.own" | "store.namespace.declare" | "store.namespace.shared.read" | "store.namespace.enumerate" | "store.backend.register" | "store.migrator.register" | "store.indexer.register" | "vault.store" | "vault.read" | "vault.list" | "vault.share" | "vault.audit" | "vault.type.register" | "vault.bridge.register" | "vault.rotator.register" | "vault.policy.contribute" | "actions.register" | "actions.invoke" | "actions.invoke.agent" | "actions.list" | "palette.contribute.scope" | "palette.history" | "scheduler.job.own" | "scheduler.job.enumerate" | "scheduler.trigger.register" | "scheduler.condition.register" | "scheduler.action.register" | "resources.provider.register" | "resources.read" | "resources.watch" | "tokens.provider.register" | "context.compose" | "entities.type.register" | "entities.read" | "entities.write" | "entities.field.attach.own" | "entities.field.attach.shared" | "entities.computedField.provide" | "ledger.read.own" | "ledger.read.shared" | "views.register" | "views.read" | "views.layoutRenderer.register" | "surfaces.contribute.sidebar.top" | "surfaces.contribute.sidebar.bottom" | "surfaces.contribute.pane.dashboard" | "surfaces.contribute.status.left" | "sidecars.definition.register" | "sidecars.instance.start" | "sidecars.instance.stop" | "sidecars.protocol.wrap" | "notifications.emit" | "notifications.channel.register" | "notifications.filter.register" | "notifications.action.register" | "notifications.log.read" | "input.subscribe.messages" | "input.subscribe.intents" | "input.reply" | "input.channel.register" | "input.parser.register" | "input.intent.register" | "input.auth.register" | "webhook.route.register" | "webhook.route.register.unsigned" | "webhook.outbound.send" | "webhook.log.read" | "webhook.tunnel.read" | "webhook.tunnel.register" | "webhook.signer.register" | "llm.complete" | "llm.stream" | "llm.embed" | "llm.vision" | "llm.agent" | "llm.ledger.read" | "llm.provider.register" | "llm.preprocessor.register" | "llm.postprocessor.register" | "llm.router.register" | "recipes.register" | "recipes.run" | "sequences.register" | "sequences.run" | `oauth.${string}`;
/**
 * Legacy alias scopes accepted for backward compatibility but NOT present in
 * the host's canonical `PermissionScope.allKnown` set.
 *
 * - `"network.fetch"` is normalized to `"network.outbound"` by the host's
 *   `PermissionScope.aliases` map at manifest parse time.
 * - `"network"`, `"smartFolders"`, and `"webview"` are historical SDK-only
 *   names with no host-side entry; prefer the canonical scopes.
 * - `"shell.uncontained"` is NOT a declarable scope — the T2 uncontained
 *   shell tier is inferred from `filesystem.readAll` (fn-46), never declared.
 *
 * @deprecated Use the canonical scopes from {@link CanonicalPermissionScope}.
 */
export type LegacyPermissionScope = "network" | "network.fetch" | "shell.uncontained" | "smartFolders" | "webview";
/**
 * All permission scopes accepted in `plugin.json` `permissions`.
 *
 * Canonical scopes (host `PermissionScope.allKnown`) plus deprecated legacy
 * aliases. New plugins should only use canonical scopes.
 */
export type PermissionScope = CanonicalPermissionScope | LegacyPermissionScope;
/**
 * A single permission entry in object form.
 *
 * The host parses `permissions` from either `string[]` (bare scopes) or
 * `{ scope, reason }[]` objects. The optional `reason` (max 120 chars) is
 * shown as a tooltip in the approval sheet and settings UI.
 */
export interface PermissionEntry {
    /** The permission scope string (e.g., "filesystem.read"). */
    scope: PermissionScope;
    /** Optional brief reason why this permission is needed (max 120 chars). */
    reason?: string;
}
//# sourceMappingURL=permissions.d.ts.map