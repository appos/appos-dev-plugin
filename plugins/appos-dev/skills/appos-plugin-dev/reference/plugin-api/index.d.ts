/**
 * @appos.space/plugin-types — Type definitions for the AppOS Plugin API
 *
 * Version: 3.0.1
 *
 * Usage (module imports; the ONE exception is the opt-in globals subpath
 * `@appos.space/plugin-types/globals`, which declares the host-injected
 * `URL` global only in compilations that reference it — this main entry
 * ships no ambient globals):
 *   import type { PluginContext, ViewDescriptor } from "@appos.space/plugin-types";
 *   // JSC plugin entry files may additionally opt in:
 *   //   /// <reference types="@appos.space/plugin-types/globals" />
 */
export * from "./core";
export * from "./views";
export * from "./namespaces";
export * from "./namespaces-core-plugins";
export * from "./permissions";
export * from "./colors";
export * from "./fonts";
export * from "./icons";
//# sourceMappingURL=index.d.ts.map