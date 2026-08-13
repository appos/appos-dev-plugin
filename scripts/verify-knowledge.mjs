#!/usr/bin/env node
/**
 * verify-knowledge.mjs — fn-165.1 (R2): the F1 knowledge-drift gate.
 *
 * Verifies that every TEACHING surface in this repo agrees with the PUBLISHED
 * @appos.space/plugin-types package pinned in package.json + package-lock.json
 * (installed via `npm ci`). Grep-based API checking false-greens on this
 * corpus (all 2.4-era `ctx.<ns>.<method>` call shapes survived the 3.0.0
 * major); this gate therefore TYPE-CHECKS fenced code instead of grepping it.
 *
 * ── Scan matrix (three tiers, hardcoded below in SCAN_MATRIX) ──────────────
 *  (a) TEACHING sources — full scan (denylist + fence type-check + count
 *      strings): plugins/appos-dev/skills/**, plugins/appos-dev/agents/**,
 *      plugins/appos-dev/commands/**, README.md, CLAUDE.md,
 *      .claude-plugin/*.json. The bundled d.ts mirror files
 *      (reference/plugin-api/*.d.ts) are EXEMPT from text scans — they are
 *      byte-verbatim published artifacts validated by
 *      scripts/check-sdk-freshness.sh; only the mirror's INDEX.md is scanned.
 *  (b) reference/migration-2.x-to-3.0.md — fence type-check + count-string
 *      check (NO denylist). This file is the single sanctioned home for
 *      pre-3.0 identifiers, so it is denylist-EXEMPT; its legacy "before"
 *      fences carry the `no-verify` opt-out tag so only the "after" fences
 *      compile. Count strings ARE checked (the guide's "What did NOT
 *      change" section asserts live surface, e.g. the ViewDescriptor union
 *      cardinality); a legacy before-count in prose takes the per-line
 *      `<!-- count-ok -->` exemption.
 *  (c) plugins/appos-dev/compiled/** — EXCLUDED entirely. The compiled
 *      factory context's concatenated d.ts fence is deliberately not valid
 *      TypeScript, and the artifacts are generated from already-scanned
 *      sources. They are validated by the fn-165.4 freshness manifests +
 *      byte comparisons, NOT by this script (scanning them would deadlock
 *      fn-165.2/.3 gate-green against fn-165.4's regeneration ordering).
 *
 * ── Fence conventions ──────────────────────────────────────────────────────
 *  - Both CommonMark fence forms are recognized: backtick (```) AND tilde
 *    (~~~) runs of >= 3, closed by a run of the SAME character at least as
 *    long as the opener. The two are not interchangeable — inside an open
 *    tilde fence a backtick run is literal content, and vice versa. Openers
 *    and closers tolerate at most 3 spaces of indentation (per container
 *    level) — a 4-space-indented ```-run is an indented code line / fence
 *    content, never an opener or closer. Indentation is measured in COLUMNS
 *    per CommonMark §2.2 (a tab advances to the next multiple-of-4 tab stop),
 *    which for fence lines coincides with the character-wise ` {0,3}` bound:
 *    any tab in the leading run lands at column >= 4, so a tab-led ```-run is
 *    >= 4 columns and rejected either way. A fence
 *    left unclosed at EOF extends through end of input per CommonMark and IS
 *    compiled like any other fence (emit-at-EOF, not fail — matches what
 *    every renderer shows readers).
 *  - CommonMark container prefixes are supported: a fence may open inside
 *    blockquotes (`> ```ts`, nested `> > ```ts`) and/or list items
 *    (`- ```ts`, ordered `1. ```ts`), composed in any nesting order
 *    (`> - ```ts`). Container state is carried ACROSS lines: a container
 *    opened on an earlier line stays open, so a fence on a CONTINUATION line
 *    of a list item is recognized even when the item's content column is >= 4
 *    (e.g. `10. Step ten` followed by a 4-space-indented ```ts — the raw
 *    indentation alone would fail the ` {0,3}` opener bound, but the open
 *    item's content column is stripped first). Open containers persist per
 *    CommonMark: blank lines stay inside a list item (but end a blockquote,
 *    whose `>` marker is required on every line); a non-blank line short of
 *    a list content column ends the container UNLESS a paragraph is open and
 *    the line cannot start a new block (lazy continuation — approximated by
 *    testing the interrupters that matter here: fence lines, list/blockquote
 *    markers, ATX headings, thematic breaks). The opener's container-token
 *    sequence is recorded with the open fence and stripped from contained
 *    lines: blockquote tokens
 *    require their `>` marker on every line; list tokens require indentation
 *    to the item's CONTENT COLUMN (marker width + following spaces), measured
 *    in columns per §2.2 (tabs expand to 4-column stops) and stripped by the
 *    characters covering that column — a tab straddling the boundary is
 *    consumed and its remainder re-emitted as spaces (CommonMark's
 *    partial-tab rule) — except blank lines, which stay inside the item (and
 *    the fence) per CommonMark. A contained line missing a required marker,
 *    or a non-blank line short of a list content column, ends the container —
 *    and the fence — at that line (fenced blocks have no lazy continuation);
 *    the content collected up to that point is still compiled, mirroring the
 *    unclosed-at-EOF rule, and the line is reprocessed in normal flow.
 *  - Fences tagged `ts` / `typescript` are compiled as ISOLATED ES MODULES
 *    against the pinned package — each fence in its OWN ts.Program, so the
 *    isolation is structural: a `declare global` augmentation or ambient
 *    `declare module` in one fence can never leak into another fence's
 *    compile (a snippet that omits its required local ambient declaration
 *    fails here exactly as it fails when copied out alone). The lib + SDK
 *    d.ts SourceFiles are parsed once via a shared memoized CompilerHost, so
 *    per-fence programs stay cheap. The package's MAIN ENTRY ships no
 *    ambient globals (SDK 3.0.1 adds ONE opt-in `/globals` subpath, never
 *    auto-included — deliberately NOT referenced here; the synthesized
 *    runtime-globals d.ts below declares its own copy of that surface), so
 *    a fence must `import type { ... } from "@appos.space/plugin-types"` for
 *    any type NAME it references — exactly like real plugin source. The
 *    exact-pinned sibling packages `@appos.space/plugin-utils` and
 *    `@appos.space/view-builders` are also installed, so fences may import
 *    them too. Relative imports (`./panels/foo.js`) are unresolvable by
 *    construction — multi-file example fences are fragments and take
 *    `no-verify`. `window.twopanez` is NOT typed by the published package;
 *    WebView-side fences teach a local ambient declaration (or take
 *    `no-verify`).
 *  - TWO compile environments. The DEFAULT models the documented
 *    JavaScriptCore plugin runtime: lib.es2022 plus a verifier-synthesized
 *    ambient d.ts declaring ONLY the globals the host runtime genuinely
 *    provides — `console` (JSC's JSContext ships a native console; the host
 *    injects none), the timer quartet `setTimeout` / `clearTimeout` /
 *    `setInterval` / `clearInterval` typed `| undefined` (the host injects NO
 *    timers; the teaching contract is "guard with `typeof setTimeout ===
 *    'function'`", and the optional typing makes an UNGUARDED timer call a
 *    type error while a narrowed call compiles), and an optional-typed
 *    `URL` (`URLConstructor | undefined` — AppOS hosts 1.1.0+ inject a
 *    Foundation-bridged `URL` global, fn-182, but older hosts, the
 *    `appos.jsc.urlGlobal.disabled` kill switch, and menu-bar raw
 *    JSContexts lack it; the teaching contract is "guard with `typeof URL
 *    === 'function'`", and an UNGUARDED `new URL(...)` is a type error,
 *    TS18048, while a narrowed call compiles). NO lib.dom: `document`,
 *    `window`, browser `fetch` (plugins use `ctx.network.fetch`), etc. now
 *    FAIL in plugin-runtime fences instead of false-greening against browser
 *    globals that do not exist at runtime. Genuinely WebView-side fences opt
 *    in with the `webview` flag (```ts webview — same annotation style as
 *    `no-verify`) and compile with lib.es2022 + lib.dom instead. Doc-path
 *    defaulting (webview-panels/** → DOM) was measured on this corpus and
 *    REJECTED: every compiled ts fence in the webview teaching docs is
 *    plugin-SIDE code (the WebView-side snippets there are js/html fences,
 *    which do not compile untagged), so a path default would have exempted
 *    exactly the fences that teach the JSC timer guard.
 *  - WebView-side JS fences may additionally opt in with ```js webview:
 *    they compile as strict-checkJs `.js` (allowJs + checkJs + lib.dom, no
 *    SDK preamble — `declare` is illegal in .js) against the CANONICAL
 *    webview/twopanez.d.ts ambient EXTRACTED at verify time from
 *    extension-api.md § "WebView-side bridge" (one source of truth — the
 *    webview-panels SKILL.md duplicate is pinned byte-identical, so a
 *    member rename in the taught declaration re-checks every js-webview
 *    fence instead of compiling against a stale hardcoded copy),
 *    mirroring the tsconfig.webview.json program the webview-panels skill
 *    prescribes
 *    (include: webview/**, strict, checkJs). This exists so canonical
 *    panel-script examples (patterns.md §21 app.js) cannot regress into
 *    code that fails the very `npm run typecheck` wiring the docs mandate.
 *    Untagged js fences remain invisible to this gate.
 *  - A preamble is injected ahead of each fence:
 *        import type * as __sdk from "@appos.space/plugin-types";
 *        declare const ctx: __sdk.PluginContext;
 *    (the `ctx` line is skipped when the fence itself binds `ctx` at top
 *    level), so bare `ctx.<ns>.<method>(...)` call snippets compile without
 *    boilerplate. The namespace alias `__sdk` cannot collide with fence
 *    imports.
 *  - Opt-out: tag the fence `ts no-verify` (or `typescript no-verify`) for
 *    intentional fragments / legacy "before" examples. Use sparingly — an
 *    opted-out fence is invisible to this gate.
 *  - Count-string suppression: a line containing `<!-- count-ok -->` is
 *    exempt from count-string checking (for legitimately different counts,
 *    e.g. "this example declares 2 permissions").
 *
 * ── Checks ─────────────────────────────────────────────────────────────────
 *  1. exported-name-set diff — the mirror's index.d.ts export set must be
 *     IDENTICAL to the installed package's (names added/removed reported).
 *  2. SDK declaration health — every d.ts of the mirror AND the installed
 *     dists of all three pinned packages compiles as ONE program with
 *     skipLibCheck: FALSE and the plugin-runtime lib set (es2022, no DOM).
 *     The per-fence programs (check 3) keep skipLibCheck: true for speed,
 *     which would silently SUPPRESS a semantic error inside a published
 *     declaration — an unresolved referenced type degrades to error-any and
 *     dependent fences still compile — so this dedicated program is what
 *     actually guarantees the SDK surface the fences compile against is
 *     healthy (and, as a side effect, proves the SDK types need no browser
 *     globals). Measured cost on this corpus: ~0.2s.
 *  3. fence type-check — every non-opted-out ts fence in tiers (a)+(b)
 *     compiles clean (tsc 5.9.3, strict, noEmit; ONE Program PER FENCE so
 *     ambient/global declarations cannot leak between examples; diagnostics
 *     mapped back to the markdown file + line). Diagnostics attributed to a
 *     NON-fence file
 *     (installed SDK d.ts, another imported module, lib) or to no file at
 *     all (options/global) are NOT discarded — each distinct one is
 *     reported once as a "dependency diagnostic" / "global diagnostic"
 *     finding (no markdown line mapping). With skipLibCheck: true these
 *     per-fence programs only surface STRUCTURAL dependency failures
 *     (module resolution, malformed syntax); SEMANTIC declaration errors
 *     are check 2's job.
 *  4. stale-identifier denylist — tier (a) text must not contain pre-3.0
 *     identifiers (PluginCacheAPI, HostEventsAPI, *Namespace spellings,
 *     ambient `declare function activate`, 2.4.0-fn50, com.twopanez/plugins,
 *     "22 namespaces" / "34 permissions", triple-slash types reference, ...).
 *  5. count-string consistency — numeric surface claims in tiers (a)+(b)
 *     ("N namespaces", "N permission scopes", "N exported types",
 *     "N ViewDescriptor types" / "N view types", plus the hyphenated
 *     singular forms "N-scope" / "N-namespace", ...) must match the truth
 *     DERIVED from the mirror at run time.
 *
 * ── Usage / exit contract ──────────────────────────────────────────────────
 *   node scripts/verify-knowledge.mjs             # run the full gate
 *   node scripts/verify-knowledge.mjs --counts D  # print derived surface
 *                                                 # counts for d.ts dir D as
 *                                                 # JSON (used by
 *                                                 # check-sdk-freshness.sh)
 *   exit 0 — all checks green
 *   exit 1 — one or more findings (each printed as file:line: message)
 *   exit 2 — environment/config error (missing node_modules, missing mirror)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIRROR_DIR = "plugins/appos-dev/skills/appos-plugin-dev/reference/plugin-api";
const PKG_NAME = "@appos.space/plugin-types";
const INSTALLED_DIST = path.join(REPO_ROOT, "node_modules", PKG_NAME, "dist");

/** Three-tier scan matrix — see header. Paths are repo-root-relative. */
const SCAN_MATRIX = {
  teaching: [
    "plugins/appos-dev/skills",
    "plugins/appos-dev/agents",
    "plugins/appos-dev/commands",
    "README.md",
    "CLAUDE.md",
    ".claude-plugin",
  ],
  migrationGuide: "plugins/appos-dev/skills/appos-plugin-dev/reference/migration-2.x-to-3.0.md",
  excluded: ["plugins/appos-dev/compiled"],
};

/** Stale pre-3.0 identifiers/markers. `re` matched per line of tier-(a) text. */
const DENYLIST = [
  { name: "PluginCacheAPI", re: /\bPluginCacheAPI\b/ },
  { name: "PluginFeedbackAPI", re: /\bPluginFeedbackAPI\b/ },
  { name: "PluginOAuthAPI", re: /\bPluginOAuthAPI\b/ },
  { name: "PluginMenuBarAPI", re: /\bPluginMenuBarAPI\b/ },
  { name: "HostEventsAPI", re: /\bHostEventsAPI\b/ },
  { name: "*Namespace type spelling (pre-rename)", re: /\b[A-Z][A-Za-z]*Namespace\b/ },
  { name: "ambient `declare function activate` (never ambient — assign to globalThis; the SDK main entry ships no ambient globals)", re: /declare\s+function\s+activate\b/ },
  { name: "2.4.0-fn50 version marker", re: /2\.4\.0-fn50/ },
  {
    // Scaffold dependency pins on the 2.x SDK line. Deliberately anchored to
    // the dependency-string shape so minHostVersion-landmine prose that cites
    // "2.4.0" as a WRONG value keeps compiling docs without tripping this.
    name: "2.x SDK dependency pin (scaffolds must pin the 3.x line)",
    re: /"@appos\.space\/[a-z-]+":\s*"[~^]?2\./,
  },
  { name: "legacy install path com.twopanez/plugins", re: /com\.twopanez\/plugins/ },
  { name: "stale count '22 namespaces'", re: /\b22\s+namespaces\b/i },
  { name: "stale count '34 permissions'", re: /\b34\s+permissions\b/i },
  {
    name: "triple-slash types reference (removed by SDK PR #5; use module imports)",
    re: /\/\/\/\s*<reference\s+types="@appos\.space\/plugin-types"/,
  },
];

/**
 * Numeric surface claims checked against derived truth. Ordered — first
 * matching pattern wins for a given match position. Patterns are deliberately
 * narrow (SDK-surface phrasings); use `<!-- count-ok -->` on a line to exempt
 * a legitimately different count.
 */
const COUNT_PATTERNS = [
  { label: "core-plugin namespaces", re: /(\d+)[\s-]+core-plugin\s+namespaces/gi, key: "corePluginNamespaces" },
  { label: "API namespaces", re: /(\d+)[\s-]+(?:API\s+)?namespaces\b/gi, key: "namespaces" },
  // Hyphenated SINGULAR compound-adjective form ("43-namespace API surface").
  // The plural hyphenated form ("43-namespaces") is already caught by the
  // `[\s-]+` separator in the pattern above.
  { label: "namespaces (hyphenated N-namespace)", re: /(\d+)-namespace\b/gi, key: "namespaces" },
  { label: "legacy aliases", re: /(\d+)[\s-]+legacy\s+alias(?:es)?\b/gi, key: "legacyAliases" },
  { label: "permission scopes", re: /(\d+)[\s-]+(?:canonical\s+)?permission\s+scopes\b/gi, key: "canonicalScopes" },
  { label: "permissions", re: /(\d+)[\s-]+permissions\b/gi, key: "canonicalScopes" },
  // Hyphenated SINGULAR compound-adjective form — protects the README's
  // primary claim "135-scope canonical permission model", which none of the
  // phrase-suffix patterns above reach.
  { label: "permission scopes (hyphenated N-scope)", re: /(\d+)-scope\b/gi, key: "canonicalScopes" },
  { label: "exported types", re: /(\d+)[\s-]+exported\s+type(?:s)?\b/gi, key: "exportedTypes" },
  // Metadata scalars (r12): deriveCounts() derives metadataScalars, but no
  // pattern checked the teaching claim in extension-api.md ("3 typed metadata
  // scalars") — an SDK adding a scalar would regenerate mirror + INDEX while
  // that prose stayed green-and-stale. `scalars` is OPTIONAL in the first
  // pattern because the extension-api.md claim wraps mid-phrase ("… 3 typed
  // metadata\nscalars:") and this scan is line-based — the pattern must match
  // the line-final "3 typed metadata" form.
  { label: "typed metadata scalars", re: /(\d+)[\s-]+typed\s+metadata(?:\s+scalars?)?\b/gi, key: "metadataScalars" },
  { label: "metadata scalars", re: /(\d+)[\s-]+metadata\s+scalars?\b/gi, key: "metadataScalars" },
  // Remaining derived counts advertised with a numeral anywhere in tier (a)
  // (r12 sweep): the INDEX surface line's "1 dynamic `oauth.<provider>` scope
  // family" (generated, but hand-edit-guardable) and validate.md's summed
  // "140 permission strings" (135 canonical + 5 legacy — the sum is computed
  // onto `truth` below, NOT in deriveCounts, so the `--counts` JSON contract
  // consumed by check-sdk-freshness.sh surface_line() is unchanged).
  { label: "dynamic scope families", re: /(\d+)[\s-]+dynamic\s+(?:`[^`]+`\s+)?scope\s+famil(?:y|ies)\b/gi, key: "dynamicScopeFamilies" },
  { label: "permission strings (canonical + legacy)", re: /(\d+)[\s-]+permission\s+strings\b/gi, key: "allPermissionStrings" },
  // ViewDescriptor union cardinality (r13): deriveCounts() counts the
  // discriminated union's members from the mirror's views.d.ts. Tier-(a)
  // phrasings today: "17 ViewDescriptor types" (SKILL.md, extension-api.md,
  // viewdescriptor-builder agent), "17 view types" (plugin-architect agent,
  // README), and the "All 17 types" heading (viewdescriptor-authoring SKILL).
  // A bare "N types" pattern is deliberately NOT used — prose like
  // "SDK 3.0.0 types registerWebPanel as ..." would match its trailing "0".
  { label: "ViewDescriptor types", re: /(\d+)[\s-]+ViewDescriptor\s+types?\b/gi, key: "viewDescriptorTypes" },
  { label: "ViewDescriptor types (hyphenated N-type)", re: /(\d+)-type\s+`?ViewDescriptor`?\b/gi, key: "viewDescriptorTypes" },
  { label: "view types", re: /(\d+)[\s-]+view\s+types\b/gi, key: "viewDescriptorTypes" },
  { label: "ViewDescriptor types (\"All N types\")", re: /\ball\s+(\d+)\s+types\b/gi, key: "viewDescriptorTypes" },
];

// ───────────────────────────────────────────────────────────────────────────
// Derived truth from a d.ts directory (mirror or tarball dist/).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Structural scalar-vs-namespace classification for PluginContext members.
 *
 * The metadata scalars (`pluginId`, `pluginVersion`, `hostVersion`) were
 * previously a hardcoded three-name whitelist — the last hand-maintained
 * assumption in this derivation. Had a future SDK added another readonly
 * metadata scalar, the whitelist would have counted it as an API namespace,
 * and because INDEX generation (surface_line in check-sdk-freshness.sh) and
 * count verification both consume the same deriveCounts() result, the wrong
 * counts would have stayed green. Classify instead by the STRUCTURAL property
 * visible in the d.ts itself: a scalar's declared type resolves to a
 * primitive/literal (`string`, a literal union, or a type alias thereof); a
 * namespace's type resolves to an interface declared in the same d.ts dir
 * (LifecycleAPI, ShellAPI, ...). Alias resolution walks the dir's own
 * `type X = ...` declarations so an aliased scalar still classifies as a
 * scalar. Anything unclassifiable THROWS (fail closed, matching the missing-
 * PluginContext throw below) — a silent guess in either direction is exactly
 * the drift this gate exists to prevent.
 *
 * Deliberately declaration-TEXT analysis, not the ts compiler API:
 * deriveCounts() backs the `--counts` mode consumed by check-sdk-freshness.sh
 * surface_line(), which must run with node alone (before/without `npm ci`, so
 * typescript may not be installed — see the "--counts" block below, which
 * intentionally exits ahead of the typescript import).
 */
const PRIMITIVE_TYPE_KEYWORDS = new Set(["string", "number", "boolean", "bigint", "symbol", "undefined", "null"]);
const isLiteralTypeAtom = (t) => /^["'`]/.test(t) || /^-?\d/.test(t) || t === "true" || t === "false";

/** Line-anchored so prose mentions of "interface"/"type" in doc comments don't register. */
const INTERFACE_DECL_RE = /^[ \t]*(?:export[ \t]+)?(?:declare[ \t]+)?interface[ \t]+(\w+)/gm;
const TYPE_ALIAS_DECL_RE = /^[ \t]*(?:export[ \t]+)?(?:declare[ \t]+)?type[ \t]+(\w+)[ \t]*(?:<[^>=]*>)?[ \t]*=\s*([^;]+);/gm;

function collectTypeDecls(dtsDir) {
  const decls = new Map(); // name -> { kind: "interface" } | { kind: "alias", rhs: string }
  for (const f of fs.readdirSync(dtsDir).sort()) {
    if (!f.endsWith(".d.ts")) continue;
    const src = fs.readFileSync(path.join(dtsDir, f), "utf8");
    for (const m of src.matchAll(INTERFACE_DECL_RE)) decls.set(m[1], { kind: "interface" });
    for (const m of src.matchAll(TYPE_ALIAS_DECL_RE)) {
      if (!decls.has(m[1])) decls.set(m[1], { kind: "alias", rhs: m[2] });
    }
  }
  return decls;
}

/** @returns {"scalar" | "namespace" | "unknown"} */
function classifyMemberType(typeText, decls, depth = 0) {
  if (depth > 16) return "unknown"; // alias cycle / pathological nesting
  const t = typeText.trim();
  const parts = t.split("|").map((s) => s.trim()).filter((s) => s !== "");
  if (parts.length > 1) {
    const kinds = parts.map((p) => classifyMemberType(p, decls, depth + 1));
    if (kinds.every((k) => k === "scalar")) return "scalar";
    if (kinds.every((k) => k === "namespace")) return "namespace";
    return "unknown";
  }
  if (PRIMITIVE_TYPE_KEYWORDS.has(t) || isLiteralTypeAtom(t)) return "scalar";
  if (/^[A-Za-z_$][\w$]*$/.test(t)) {
    const decl = decls.get(t);
    if (!decl) return "unknown"; // not declared anywhere in the d.ts dir
    return decl.kind === "interface" ? "namespace" : classifyMemberType(decl.rhs, decls, depth + 1);
  }
  return "unknown";
}

function deriveCounts(dtsDir) {
  const core = fs.readFileSync(path.join(dtsDir, "core.d.ts"), "utf8");
  const ctxBody = core.match(/export interface PluginContext \{([\s\S]*?)\n\}/);
  if (!ctxBody) throw new Error(`PluginContext not found in ${dtsDir}/core.d.ts`);
  const typeDecls = collectTypeDecls(dtsDir);
  const members = [...ctxBody[1].matchAll(/readonly (\w+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
  const scalars = [];
  let namespaceCount = 0;
  for (const [name, typeText] of members) {
    const kind = classifyMemberType(typeText, typeDecls);
    if (kind === "scalar") scalars.push(name);
    else if (kind === "namespace") namespaceCount += 1;
    else {
      throw new Error(
        `unclassifiable PluginContext member \`${name}: ${typeText}\` in ${dtsDir}/core.d.ts — ` +
        "neither a primitive/literal (metadata scalar) nor a type declared in the d.ts dir " +
        "(API namespace); extend classifyMemberType in scripts/verify-knowledge.mjs",
      );
    }
  }

  const coreImport = core.match(/import type \{([^}]+)\} from "\.\/namespaces-core-plugins"/);
  const corePluginNamespaces = coreImport
    ? coreImport[1].split(",").map((s) => s.trim()).filter((n) => /API$/.test(n)).length
    : 0;

  const perms = fs.readFileSync(path.join(dtsDir, "permissions.d.ts"), "utf8");
  const canon = perms.match(/export type CanonicalPermissionScope = ([^;]+);/);
  if (!canon) throw new Error(`CanonicalPermissionScope not found in ${dtsDir}/permissions.d.ts`);
  // Permission-union parsing (r14): count by SHAPE-VALIDATING every
  // `|`-separated member instead of grepping one quote style. Both TS
  // string-literal quote styles are semantically identical, and a published
  // SDK reformat from double to single quotes previously made these matchers
  // silently derive canonicalScopes: 0 / legacyAliases: 0 — `--update` would
  // then regenerate a wrong INDEX surface line and the gate would report
  // misleading count drift instead of accepting the refresh. Fail CLOSED on
  // any member that is not a quoted literal (or, where allowed, a backtick
  // template family like `oauth.${string}`): a partial parse miscounts, and
  // a silent miscount is exactly the drift this gate exists to prevent. The
  // throw matches the ViewDescriptor-union precedent below (non-zero exit in
  // both the full gate and `--counts` mode).
  const parseLiteralUnion = (unionText, what, allowTemplates) => {
    const members = unionText.split("|").map((s) => s.trim()).filter((s) => s !== "");
    if (members.length === 0) {
      throw new Error(
        `empty ${what} union in ${dtsDir}/permissions.d.ts — the declaration matched but no members parsed; ` +
        "extend parseLiteralUnion in scripts/verify-knowledge.mjs",
      );
    }
    let quoted = 0;
    let template = 0;
    for (const m of members) {
      if (/^"[^"]*"$/.test(m) || /^'[^']*'$/.test(m)) quoted += 1;
      else if (allowTemplates && /^`[^`]*`$/.test(m)) template += 1;
      else {
        throw new Error(
          `unparseable ${what} union member \`${m}\` in ${dtsDir}/permissions.d.ts — not a quoted string ` +
          `literal${allowTemplates ? " or backtick template family" : ""}; ` +
          "extend parseLiteralUnion in scripts/verify-knowledge.mjs",
        );
      }
    }
    return { quoted, template };
  };
  const canonCounts = parseLiteralUnion(canon[1], "CanonicalPermissionScope", true);
  const fixedScopes = canonCounts.quoted;
  const templateFamilies = canonCounts.template;
  const legacy = perms.match(/export type LegacyPermissionScope = ([^;]+);/);
  // Legacy aliases are fixed strings by definition — a template family there
  // is new surface shape and must throw, not silently skew the alias count.
  const legacyAliases = legacy ? parseLiteralUnion(legacy[1], "LegacyPermissionScope", false).quoted : 0;

  // ViewDescriptor union cardinality (r13): teaching claims carry the union's
  // member count as a numeral ("17 ViewDescriptor types", "17 view types",
  // "All 17 types") but nothing derived it — an SDK adding an 18th descriptor
  // would regenerate the mirror while the prose stayed green-and-stale. Count
  // the discriminated union's members structurally from views.d.ts (same
  // declaration-text style as the rest of deriveCounts — the "--counts runs
  // without typescript" constraint above applies here too). Fail CLOSED on an
  // unparseable union shape: every member must be a bare identifier; a future
  // parenthesized/generic/inline-object member throws instead of miscounting.
  const views = fs.readFileSync(path.join(dtsDir, "views.d.ts"), "utf8");
  const vdUnion = views.match(/export type ViewDescriptor = ([^;]+);/);
  if (!vdUnion) throw new Error(`ViewDescriptor union not found in ${dtsDir}/views.d.ts`);
  const vdMembers = vdUnion[1].split("|").map((s) => s.trim()).filter((s) => s !== "");
  if (vdMembers.length === 0 || !vdMembers.every((n) => /^[A-Za-z_$][\w$]*$/.test(n))) {
    throw new Error(
      `unparseable ViewDescriptor union in ${dtsDir}/views.d.ts — members [${vdMembers.join(", ")}] ` +
      "are not all bare identifiers; extend the union parsing in deriveCounts (scripts/verify-knowledge.mjs)",
    );
  }

  return {
    namespaces: namespaceCount,
    metadataScalars: scalars.length,
    corePluginNamespaces,
    canonicalScopes: fixedScopes,
    dynamicScopeFamilies: templateFamilies,
    legacyAliases,
    // NEW key appended r13. Safe for the `--counts` consumer: surface_line()
    // in check-sdk-freshness.sh extracts SPECIFIC keys via `node -pe`, never
    // the raw JSON string, so the INDEX.md surface line is byte-unchanged.
    viewDescriptorTypes: vdMembers.length,
  };
}

// `--counts <dir>` mode: print derived counts as JSON (no typescript needed).
{
  const idx = process.argv.indexOf("--counts");
  if (idx !== -1) {
    const dir = process.argv[idx + 1];
    if (!dir || !fs.existsSync(dir)) {
      console.error(`[verify-knowledge] ERROR --counts requires an existing d.ts directory (got: ${dir})`);
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(deriveCounts(dir)));
    process.exit(0);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Environment checks (exit 2 on failure).
// ───────────────────────────────────────────────────────────────────────────

const mirrorAbs = path.join(REPO_ROOT, MIRROR_DIR);
if (!fs.existsSync(path.join(mirrorAbs, "index.d.ts"))) {
  console.error(`[verify-knowledge] ERROR mirror missing: ${MIRROR_DIR}/index.d.ts (run scripts/check-sdk-freshness.sh --update)`);
  process.exit(2);
}
if (!fs.existsSync(path.join(INSTALLED_DIST, "index.d.ts"))) {
  console.error(`[verify-knowledge] ERROR ${PKG_NAME} not installed — run \`npm ci\` first`);
  process.exit(2);
}

let ts;
try {
  ts = (await import("typescript")).default;
} catch {
  console.error("[verify-knowledge] ERROR typescript not installed — run `npm ci` first");
  process.exit(2);
}

const findings = [];
const report = (file, line, msg) => findings.push(`${file}${line ? `:${line}` : ""}: ${msg}`);

// ───────────────────────────────────────────────────────────────────────────
// File discovery per tier.
// ───────────────────────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(REPO_ROOT, p);
const isExcluded = (relPath) => SCAN_MATRIX.excluded.some((ex) => relPath === ex || relPath.startsWith(ex + "/"));
const migrationRel = SCAN_MATRIX.migrationGuide;
const isMirrorDts = (relPath) => relPath.startsWith(MIRROR_DIR + "/") && relPath.endsWith(".d.ts");

const teachingFiles = []; // tier (a): .md + .json — full scan
for (const root of SCAN_MATRIX.teaching) {
  const abs = path.join(REPO_ROOT, root);
  if (!fs.existsSync(abs)) continue;
  const files = fs.statSync(abs).isDirectory() ? walk(abs) : [abs];
  for (const f of files) {
    const r = rel(f);
    if (isExcluded(r) || r === migrationRel || isMirrorDts(r)) continue;
    if (/\.(md|json)$/.test(r)) teachingFiles.push(r);
  }
}
teachingFiles.sort();

const migrationExists = fs.existsSync(path.join(REPO_ROOT, migrationRel));
const fenceFiles = [...teachingFiles.filter((f) => f.endsWith(".md")), ...(migrationExists ? [migrationRel] : [])];

// ───────────────────────────────────────────────────────────────────────────
// Check 1 — exported-name-set diff (mirror vs installed package).
// ───────────────────────────────────────────────────────────────────────────

function exportedNames(indexDts) {
  const program = ts.createProgram([indexDts], {
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(indexDts);
  const symbol = checker.getSymbolAtLocation(sf);
  if (!symbol) throw new Error(`no module symbol for ${indexDts}`);
  return new Set(checker.getExportsOfModule(symbol).map((s) => s.name));
}

const mirrorNames = exportedNames(path.join(mirrorAbs, "index.d.ts"));
const installedNames = exportedNames(path.join(INSTALLED_DIST, "index.d.ts"));
const onlyMirror = [...mirrorNames].filter((n) => !installedNames.has(n)).sort();
const onlyInstalled = [...installedNames].filter((n) => !mirrorNames.has(n)).sort();
if (onlyMirror.length || onlyInstalled.length) {
  report(MIRROR_DIR, null,
    `exported-name-set diff vs installed ${PKG_NAME}: ` +
    `mirror-only=[${onlyMirror.join(", ")}] installed-only=[${onlyInstalled.join(", ")}]`);
}

const truth = { ...deriveCounts(mirrorAbs), exportedTypes: mirrorNames.size };
// Summed phrasing "N permission strings" (validate.md advertises the total the
// current schema enum carries: canonical + legacy). Computed here rather than
// in deriveCounts so the `--counts` JSON shape stays byte-stable for
// check-sdk-freshness.sh surface_line().
truth.allPermissionStrings = truth.canonicalScopes + truth.legacyAliases;

// ───────────────────────────────────────────────────────────────────────────
// Check 2 — SDK declaration health (skipLibCheck: FALSE).
//
// The per-fence programs below run with skipLibCheck: true for speed, which
// suppresses semantic checking INSIDE every .d.ts. A published declaration
// with a semantic error (e.g. an unresolved referenced type) would therefore
// never surface there — the broken member degrades to error-any and fences
// that use it still compile, false-greening an unhealthy SDK. This dedicated
// program restores the guarantee: every d.ts of the mirror and the installed
// dists of all three pinned packages is a ROOT of one skipLibCheck: false
// compile. Lib set is the plugin-runtime one (es2022, NO DOM) — the published
// SDK types are consumed from the JSC plugin runtime and must not require
// browser globals (WebView code is a separate compilation world the package
// deliberately does not type). Proven empirically: a fixture d.ts with an
// unresolved type produces 0 diagnostics under the fence options and TS2304
// under these. Measured cost: ~0.2s on this corpus.
// ───────────────────────────────────────────────────────────────────────────

{
  const declDirs = [
    mirrorAbs,
    INSTALLED_DIST,
    path.join(REPO_ROOT, "node_modules", "@appos.space/plugin-utils", "dist"),
    path.join(REPO_ROOT, "node_modules", "@appos.space/view-builders", "dist"),
  ];
  const declRoots = [];
  for (const dir of declDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (f.endsWith(".d.ts")) declRoots.push(path.join(dir, f));
    }
  }
  const declProgram = ts.createProgram(declRoots, {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts"], // plugin-runtime lib set — SDK types must not need DOM
  });
  const declSeen = new Set();
  for (const diag of ts.getPreEmitDiagnostics(declProgram)) {
    const msg = ts.flattenDiagnosticMessageText(diag.messageText, " ");
    const file = diag.file ? path.relative(REPO_ROOT, diag.file.fileName) : "(global)";
    const line = diag.file ? diag.file.getLineAndCharacterOfPosition(diag.start ?? 0).line + 1 : null;
    const key = `${file}::${line}::${diag.code}::${msg}`;
    if (declSeen.has(key)) continue;
    declSeen.add(key);
    report(file, line, `sdk declaration diagnostic TS${diag.code}: ${msg} — the published SDK surface the fences compile against is unhealthy; fence results are not trustworthy until this is fixed`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Check 3 — fence extraction + type-check.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Extract fenced code blocks: { lang, flags, startLine (1-based, first code line), code }.
 * Recognizes BOTH CommonMark fence characters — backtick (```) and tilde (~~~)
 * runs of >= 3. The state machine tracks the OPENING fence character + length:
 * a fence closes only on a run of the SAME character at least as long as the
 * opener (with no trailing info string). Per CommonMark the two forms are not
 * interchangeable — inside an open tilde fence a backtick run is literal
 * content, and vice versa.
 *
 * A fence still open at EOF is EMITTED, not dropped: CommonMark treats an
 * unclosed fence as extending through end of input, so every renderer shows
 * that content as a code block — the gate must compile what readers see. (The
 * alternative — failing on unclosed fences — was rejected because it would
 * diverge from rendering semantics; emitting keeps the guarantee that no ts
 * example can bypass compilation.)
 *
 * Container prefixes (CommonMark §5.1 blockquotes + list items): a fence
 * opener may sit inside blockquotes (`> ```ts`, nested `> > ```ts`) and/or
 * list items (`- ```ts`, `* ```ts`, `+ ```ts`, ordered `1. ```ts` /
 * `1) ```ts`), composed in any nesting order (`> - ```ts`) — AND the
 * containers need not open on the fence's own line: document-flow container
 * state carries across lines (matchOpenContainers), so a fence on a list
 * item's CONTINUATION line is recognized by stripping the open item's
 * content column first. Without that state, an item whose content column is
 * >= 4 (`10. Step ten` then a 4-space-indented ```ts) would leave the opener
 * looking like an indented code line and the example would silently skip the
 * gate. The opener records its container-token SEQUENCE — carried-over
 * tokens first, then any markers on the opener line itself, in order:
 * blockquote tokens (`>` preceded by up to 3 spaces of indent, followed by
 * one optional space — or the first COLUMN of a following tab, whose
 * remainder is re-emitted as spaces per §2.2's partial-tab rule, so
 * `>\t```ts` opens a fence at 2 columns of indent; see
 * consumeBlockquoteMarker) and list tokens carrying the item's CONTENT COLUMN
 * (up to 3 spaces of indent + marker width + at least one following space or
 * tab — the separator measured in COLUMNS per §2.2, a tab advancing to the
 * next multiple-of-4 stop, so `-\t` + fence opens at content column 4). A
 * separator of >= 5 columns triggers CommonMark §5.2 rule #2 instead: the
 * content column is marker width + 1 and the surplus separator columns are
 * content indentation — `-      ```ts` (6-space separator) is an indented
 * code line inside the item, NOT a fence opener.
 * Contained lines are stripped token by token before buffering: blockquote
 * markers must be present on every line; list content columns are measured in
 * COLUMNS per CommonMark §2.2 — a tab advances to the next multiple-of-4 tab
 * stop from its absolute column in the line — and stripped by the CHARACTERS
 * covering the content column, re-emitting the unconsumed remainder of a
 * boundary-straddling tab as spaces (the partial-tab rule) — except blank
 * lines, which remain inside the item (and the fence)
 * per CommonMark. The closer must carry the same full prefix (an
 * item-indented closer is honored; following list text is NOT swallowed).
 * Fenced blocks cannot be lazily continued: a line missing a blockquote
 * marker — or a non-blank line indented short of a list content column —
 * closes the container and thus ends the fence — the collected content is
 * emitted (same reader-sees-it rationale as the EOF rule) and the line is
 * reprocessed in normal document flow, where it may itself open a new fence
 * (matches CommonMark's `> ```` / `foo` / ```` ` example).
 *
 * Indentation (CommonMark §4.5): fence openers AND closers may be preceded
 * by AT MOST 3 spaces — 4+ spaces (or a tab, which counts as 4 columns) make
 * the line an indented code line, not a fence. Inside an open fence a
 * 4-space-indented ```-run is therefore CONTENT, not a closer (accepting it
 * as a closer would end the fence early and let invalid TS after it escape
 * compilation). The rule applies to the REMAINDER after container-prefix
 * stripping, i.e. per container level: `parseContainerPrefix` /
 * `stripContainerPrefix` remove blockquote markers and list content columns
 * first, then FENCE_LINE_RE's ` {0,3}` bound applies to what's left. That
 * bound is written character-wise but is column-consistent for tabs per §2.2:
 * a tab anywhere in the leading run advances to column >= 4 (the next
 * multiple-of-4 stop), so a tab-led ```-run is an indented code line under
 * BOTH readings and FENCE_LINE_RE correctly fails to match it. Partial-tab
 * remainders re-emitted by `stripColumns` are spaces, so a tab-indented
 * closer inside a list item (e.g. content column 2, closer `\t` + fence) is
 * seen as `  ` + fence and closes the fence, matching rendered semantics.
 */
const FENCE_LINE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

/**
 * One CommonMark blockquote marker (§5.1) — DETECTION only: up to 3 spaces of
 * indent, then `>`. CONSUMPTION (the optional following space — or, per §2.2,
 * the first COLUMN of a following tab) is owned by consumeBlockquoteMarker,
 * the single helper every stripping call site routes through; presence
 * testing (canInterruptParagraph) may use this regex directly because marker
 * presence is independent of what follows the `>`.
 */
const BLOCKQUOTE_MARKER_RE = /^ {0,3}>/;

/**
 * Consume ONE blockquote marker from `line`, which begins at absolute line
 * column `startCol`. Per CommonMark §5.1 the marker is up to 3 spaces of
 * indent + `>` + an OPTIONAL following space — and §2.2's partial-tab rule
 * extends that space to tabs: a tab immediately after the `>` expands to the
 * next multiple-of-4 tab stop (anchored to the LINE), the marker consumes
 * exactly ONE of the tab's columns (the optional space), and the tab's
 * remaining columns are re-emitted as literal spaces of content indentation.
 * So `>\t```ts` at line start strips to `  ```ts` — the tab spans columns
 * 1-3, the marker eats column 1, columns 2-3 come back as two spaces — a
 * valid fence opener at 2 columns of indent, exactly what renderers show.
 * (Before r13 the marker regex was `> ?`, which never consumed into a tab, so
 * the fence line surfaced as `\t```ts`, failed FENCE_LINE_RE, and the example
 * silently skipped the gate.)
 *
 * Returns null when no marker leads, else { rest, cols }: `rest` is the line
 * with the marker consumed (a straddled tab's remainder re-emitted as
 * spaces), `cols` the marker's column width — every admitted character
 * (indent spaces, `>`, the optional space) is width-1 and the consumed tab
 * column counts 1, so callers advance their absolute-column cursor by
 * exactly `cols`.
 */
function consumeBlockquoteMarker(line, startCol) {
  const m = line.match(BLOCKQUOTE_MARKER_RE);
  if (!m) return null;
  const after = line.slice(m[0].length);
  if (after[0] === " ") return { rest: after.slice(1), cols: m[0].length + 1 };
  if (after[0] === "\t") {
    const tabWidth = 4 - ((startCol + m[0].length) % 4); // tab stop anchored to the LINE
    return { rest: " ".repeat(tabWidth - 1) + after.slice(1), cols: m[0].length + 1 };
  }
  return { rest: after, cols: m[0].length };
}
/**
 * One CommonMark list marker: up to 3 spaces of indent, a bullet (`-`, `*`,
 * `+`) or ordered marker (1-9 digits + `.` or `)`), and >= 1 following space
 * OR TAB. Group 1 (indent + marker) admits only width-1 characters, so its
 * length is its column width; group 2 (the marker-content separator) may
 * contain tabs and is measured in COLUMNS per §2.2 by parseContainerPrefix —
 * a tab after the marker advances to the next multiple-of-4 tab stop, so
 * `-\t` + fence is a valid opener at content column 4 (r12: previously only
 * literal spaces were admitted here, and a `-\t`-led fence was never
 * recognized — its content silently skipped the gate). The leading indent
 * stays space-only deliberately: a tab anywhere in the first <= 3 characters
 * expands to column >= 4, making the line indented code, never a list item.
 * Contained lines may also reach the content column via tabs; they are
 * measured/stripped column-wise too (see stripContainerPrefix). The regex
 * consumes ALL separator whitespace; parseContainerPrefix then applies
 * CommonMark §5.2's separator split — <= 4 columns set the content column
 * past the separator, >= 5 columns mean the item starts with INDENTED CODE
 * (rule #2: content column = marker width + 1, surplus columns re-emitted as
 * content indentation, so the line is never a fence opener).
 */
const LIST_MARKER_RE = /^( {0,3}(?:[-*+]|\d{1,9}[.)]))([ \t]+)/;

/**
 * Measure the leading whitespace of `text` in COLUMNS per CommonMark §2.2:
 * a space advances 1 column; a tab advances to the next multiple-of-4 tab
 * stop. `startCol` is the absolute column of the line at which `text` begins
 * (tab stops are anchored to the LINE, not to the stripped remainder).
 */
function indentColumns(text, startCol) {
  let col = startCol;
  for (const ch of text) {
    if (ch === " ") col += 1;
    else if (ch === "\t") col += 4 - (col % 4);
    else break;
  }
  return col - startCol;
}

/**
 * Strip `cols` columns of leading indentation from `text` (beginning at
 * absolute line column `startCol`), returning the remainder. Implements
 * CommonMark's partial-tab rule: a tab straddling the target column is
 * consumed and its unconsumed width is re-emitted as spaces, so downstream
 * checks (FENCE_LINE_RE's ` {0,3}` closer bound, nested content) see plain
 * spaces. Caller must have verified indentColumns(text, startCol) >= cols.
 */
function stripColumns(text, cols, startCol) {
  let col = startCol;
  const target = startCol + cols;
  let i = 0;
  while (i < text.length && col < target) {
    const ch = text[i];
    if (ch === " ") {
      col += 1;
      i += 1;
    } else if (ch === "\t") {
      const stop = col + 4 - (col % 4);
      i += 1;
      if (stop > target) return " ".repeat(stop - target) + text.slice(i);
      col = stop;
    } else {
      break; // unreachable when the caller's indent check held
    }
  }
  return text.slice(i);
}

/**
 * Parse the container prefix of a potential OPENER line: a sequence of
 * blockquote / list-item markers in source order. Returns { tokens, rest }
 * where tokens is [{ kind: "bq" } | { kind: "li", col }] and rest is the line
 * with the whole prefix removed (tokens is empty and rest === line when no
 * container marker leads). `startCol` is the absolute line column at which
 * `line` begins (non-zero when a carried-over container prefix was already
 * stripped) — tab stops are anchored to the LINE, so the marker-separator
 * measurement below needs it.
 */
function parseContainerPrefix(line, startCol = 0) {
  const tokens = [];
  let rest = line;
  let absCol = startCol;
  for (;;) {
    const bq = consumeBlockquoteMarker(rest, absCol);
    if (bq) {
      tokens.push({ kind: "bq" });
      rest = bq.rest;
      absCol += bq.cols;
      continue;
    }
    const li = rest.match(LIST_MARKER_RE);
    if (li) {
      // Indent + marker (group 1) admit only width-1 chars; the separator
      // (group 2) may contain tabs, so the item's content column is group 1's
      // length plus the separator measured in COLUMNS per §2.2 — a tab after
      // the marker advances to the next multiple-of-4 stop anchored at the
      // line (`-\t` + fence => content column 4). All separator whitespace is
      // consumed by the regex, so no tab straddles the content column here.
      const markerEndCol = absCol + li[1].length;
      const sepCols = indentColumns(li[2], markerEndCol);
      if (sepCols > 4) {
        // CommonMark §5.2 rule #2 ("item starting with indented code"): a
        // marker followed by >= 5 columns of whitespace means the item's
        // content column is marker width + 1 and the content starts with an
        // INDENTED CODE BLOCK — the marker consumes exactly ONE separator
        // column; the remaining sepCols-1 (>= 4) columns are content
        // indentation, re-emitted as spaces. So `-      ```ts` (6-space
        // separator) surfaces as a 5-space-indented code line inside the
        // item — FENCE_LINE_RE's ` {0,3}` bound rejects it, matching what
        // renderers show — while `-    ```ts` (4-space separator, sepCols
        // <= 4 below) keeps content column 5 and IS a fence opener. Before
        // r13 the separator was consumed greedily, over-extracting the >= 5
        // shape as a fence (stricter-than-renderer — safe for a gate, but
        // the exact rule is a few lines with the shared column math).
        tokens.push({ kind: "li", col: li[1].length + 1 });
        rest = " ".repeat(sepCols - 1) + rest.slice(li[0].length);
        absCol = markerEndCol + 1;
        continue;
      }
      tokens.push({ kind: "li", col: li[1].length + sepCols });
      rest = rest.slice(li[0].length);
      absCol = markerEndCol + sepCols;
      continue;
    }
    return { tokens, rest };
  }
}

/**
 * Strip an open fence's recorded container prefix from a CONTAINED line.
 * Returns { closed: true } when the line lacks the prefix — the container
 * (and the fence) ends at this line and the caller must emit + reprocess it —
 * or { closed: false, content } with the prefix stripped. Blank lines inside
 * a list item stay inside the item per CommonMark (a blockquote, by contrast,
 * always requires its `>` marker).
 *
 * List indentation is handled in COLUMNS per CommonMark §2.2: the under-
 * indent container-end test compares indentColumns(...) — tabs expanding to
 * 4-column stops anchored at the line's absolute column — against the item's
 * content column, and stripColumns(...) removes the characters covering that
 * column, re-emitting a boundary-straddling tab's remainder as spaces. A
 * character-count test here would see zero leading spaces on a tab-indented
 * line, wrongly end the container, and emit an empty/truncated fence whose
 * remaining (possibly invalid) TS is reprocessed as ordinary Markdown —
 * escaping compilation while the gate reports success.
 */
function stripContainerPrefix(line, tokens) {
  let rest = line;
  let absCol = 0; // absolute line column at which `rest` begins
  for (const t of tokens) {
    if (t.kind === "bq") {
      const m = consumeBlockquoteMarker(rest, absCol);
      if (!m) return { closed: true };
      rest = m.rest;
      absCol += m.cols;
    } else {
      if (rest.trim() === "") return { closed: false, content: "" };
      if (indentColumns(rest, absCol) < t.col) return { closed: true };
      rest = stripColumns(rest, t.col, absCol);
      absCol += t.col;
    }
  }
  return { closed: false, content: rest };
}

/** ATX heading opener — one of the block forms that can interrupt a paragraph. */
const ATX_HEADING_RE = /^ {0,3}#{1,6}(?:[ \t]|$)/;
/** Thematic break (`---` / `***` / `___` with interior spaces allowed). */
const THEMATIC_BREAK_RE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;

/**
 * Can `rest` (a line remainder at the current container level) start a new
 * block, i.e. interrupt an open paragraph? Used by the lazy-continuation rule
 * in matchOpenContainers: an under-indented line that CANNOT interrupt is
 * paragraph continuation text and keeps every open container alive; one that
 * CAN interrupt ends the container at that level. This is the CommonMark
 * interrupter set that matters for fence extraction (fence lines, list /
 * blockquote markers, ATX headings, thematic breaks); rarer interrupters
 * (HTML blocks types 1–6, the ordered-marker must-start-at-1 nuance) are
 * deliberately approximated — every divergence errs toward ending the
 * container, i.e. toward how the scanner treated these lines before
 * cross-line state existed.
 */
function canInterruptParagraph(rest) {
  return (
    FENCE_LINE_RE.test(rest) ||
    BLOCKQUOTE_MARKER_RE.test(rest) ||
    LIST_MARKER_RE.test(rest) ||
    ATX_HEADING_RE.test(rest) ||
    THEMATIC_BREAK_RE.test(rest)
  );
}

/**
 * Match `line` against the DOCUMENT-FLOW container stack carried over from
 * earlier lines (fence-opener side of the cross-line state — the in-fence
 * side is stripContainerPrefix). Walks the stack tokens in order:
 *  - blockquote: `>` marker present → strip and keep; missing → the
 *    blockquote ends here (subject to the lazy rule below) — even on blank
 *    lines, which end a blockquote per CommonMark.
 *  - list item: blank line → stays inside the item (kept WITHOUT stripping);
 *    non-blank indented to the content column (measured in columns per §2.2,
 *    same as stripContainerPrefix) → strip and keep; under-indented → the
 *    item ends here, subject to the lazy rule.
 *  - lazy rule (CommonMark lazy continuation): when a paragraph is open and
 *    the failing line cannot interrupt a paragraph, EVERY container stays
 *    open and the line is pure paragraph text — { lazy: true }.
 * Returns { kept, rest, col, lazy }: `kept` = surviving token count (callers
 * slice the stack), `rest` = the line with the surviving prefix stripped,
 * `col` = the absolute line column at which `rest` begins (feeds
 * parseContainerPrefix so its tab-stop math stays line-anchored).
 */
function matchOpenContainers(line, stack, paragraphOpen) {
  let rest = line;
  let absCol = 0; // absolute line column at which `rest` begins
  let kept = 0;
  for (const t of stack) {
    if (t.kind === "bq") {
      const m = consumeBlockquoteMarker(rest, absCol);
      if (m) {
        rest = m.rest;
        absCol += m.cols;
        kept += 1;
        continue;
      }
    } else {
      if (rest.trim() === "") {
        // Blank lines stay inside a list item (deeper blockquote tokens, which
        // need their marker even on blanks, still pop on their own iteration).
        kept += 1;
        continue;
      }
      if (indentColumns(rest, absCol) >= t.col) {
        rest = stripColumns(rest, t.col, absCol);
        absCol += t.col;
        kept += 1;
        continue;
      }
    }
    if (paragraphOpen && rest.trim() !== "" && !canInterruptParagraph(rest)) {
      return { kept: stack.length, rest, col: absCol, lazy: true };
    }
    return { kept, rest, col: absCol, lazy: false };
  }
  return { kept, rest, col: absCol, lazy: false };
}

function extractFences(text) {
  const lines = text.split(/\r?\n/);
  const fences = [];
  let open = null;
  // Document-flow container state (see docstring + matchOpenContainers): list
  // items / blockquotes opened on EARLIER lines stay on this stack so a fence
  // opener on a continuation line (e.g. `10. Step ten` then a 4-space-indented
  // ```ts — content column 4) is recognized; without it the raw indentation
  // fails FENCE_LINE_RE's ` {0,3}` bound and the example silently skips the
  // gate. `paragraphOpen` gates the lazy-continuation rule.
  let stack = [];
  let paragraphOpen = false;
  const emit = () => {
    fences.push({ lang: open.lang, flags: open.flags, startLine: open.startLine, code: open.code.join("\n") });
    open = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open) {
      let content = line;
      if (open.containers.length > 0) {
        const stripped = stripContainerPrefix(line, open.containers);
        if (stripped.closed) {
          // Fenced blocks have no lazy continuation: losing the container
          // prefix (a blockquote marker, or a list item's content-column
          // indentation) closes the container, ending the fence with it. Emit
          // the collected content (r3 EOF rationale — compile what readers
          // see), then fall through so this line is reprocessed in normal flow.
          emit();
        } else {
          content = stripped.content;
        }
      }
      if (open) {
        const m = content.match(FENCE_LINE_RE);
        if (m && m[2][0] === open.fence[0] && m[2].length >= open.fence.length && m[3].trim() === "") {
          emit();
        } else {
          open.code.push(content);
        }
        continue;
      }
    }
    // Document flow (also reached when a container loss just ended a fence —
    // the line reprocesses here). Carry over container state from earlier
    // lines, then parse any NEW markers this line introduces.
    const carried = matchOpenContainers(line, stack, paragraphOpen);
    stack = stack.slice(0, carried.kept);
    if (carried.lazy) {
      paragraphOpen = true;
      continue; // paragraph continuation text — cannot open a fence or a container
    }
    const { tokens, rest } = parseContainerPrefix(carried.rest, carried.col);
    stack.push(...tokens);
    const m = rest.match(FENCE_LINE_RE);
    if (m) {
      const info = m[3].trim();
      const [lang, ...flags] = info.split(/\s+/);
      open = { fence: m[2], indent: m[1].length, lang: (lang || "").toLowerCase(), flags, startLine: i + 2, code: [], containers: stack.slice() };
      paragraphOpen = false;
    } else {
      paragraphOpen = rest.trim() !== "";
    }
  }
  if (open) {
    // Unclosed fence at EOF — CommonMark runs it to end of input, so emit it
    // (see docstring); dropping it would let the final example skip the gate.
    emit();
  }
  return fences;
}

const PREAMBLE_IMPORT = `import type * as __sdk from "${PKG_NAME}";`;
const PREAMBLE_CTX = "declare const ctx: __sdk.PluginContext;";
const bindsCtx = (code) => /\b(?:const|let|var|function|class)\s+ctx\b/.test(code) || /^\s*import\b.*\bctx\b/m.test(code);

const fenceUnits = []; // { virtualPath, mdFile, startLine, preambleLines, env }
const fenceTmpDir = path.join(REPO_ROOT, "node_modules", ".cache", "verify-knowledge");
fs.rmSync(fenceTmpDir, { recursive: true, force: true });
fs.mkdirSync(fenceTmpDir, { recursive: true });

/**
 * Ambient globals for the DEFAULT (JavaScriptCore plugin-runtime) fence
 * environment — synthesized by this script, NOT a teaching artifact.
 * Restricted to what the AppOS host runtime GENUINELY provides:
 *  - `console`: JavaScriptCore's JSContext ships a native console; teaching
 *    fences use console.log/error throughout and it exists at runtime.
 *  - timers: the host injects NONE (PluginRuntimeHost evaluates only the
 *    bridge shim + sanitization scripts) and bare JSC has no setTimeout —
 *    the documented contract is "guard with `typeof setTimeout ===
 *    'function'`". Typed `| undefined` so an UNGUARDED call is a type error
 *    (TS2722) while a typeof-narrowed call compiles.
 *  - `URL`: AppOS hosts 1.1.0+ inject a native Foundation-bridged `URL`
 *    (fn-182) — but older hosts, the `appos.jsc.urlGlobal.disabled` kill
 *    switch, and menu-bar raw JSContexts do NOT, so the documented
 *    contract is "guard with `typeof URL === 'function'`". Typed
 *    `| undefined` so an UNGUARDED `new URL(...)` is a type error
 *    (TS18048) while a typeof-narrowed call compiles. The surface below
 *    mirrors the SDK 3.0.1 opt-in `@appos.space/plugin-types/globals`
 *    subpath (v1 subset: readonly accessors, `canParse`, NO
 *    `searchParams` — that getter THROWS at runtime), declared HERE
 *    because the subpath is opt-in (never auto-included) and the pinned
 *    SDK may predate it.
 * Every value global below is declared `var` (never `const`): the
 * scaffolded `src/jsc-globals.ts` teaching fences (new-plugin.md step 6,
 * patterns.md §18) are `declare global` MODULES whose declarations land in
 * the same global scope as this file when those fences compile. `var`
 * redeclaration is legal only with IDENTICAL types, while a `const` would
 * collide outright (TS2451) — so the canonical fences stay verified AND
 * check 3 pins their declared surface to this copy: any drift between the
 * taught globals and this file fails as TS2403 mapped to the markdown line.
 * Deliberately ABSENT: DOM (`document`, `window`), browser `fetch` (plugins
 * use `ctx.network.fetch`), XMLHttpRequest, storage, `URLSearchParams` (the
 * runtime `url.searchParams` getter throws — parse `url.search` manually) —
 * none exist in the plugin runtime. WebView-side fences take the `webview`
 * flag instead.
 */
const JSC_GLOBALS_DTS = path.join(fenceTmpDir, "__jsc-runtime-globals.d.ts");
fs.writeFileSync(JSC_GLOBALS_DTS, `// Synthesized by verify-knowledge.mjs — JSC plugin-runtime ambient globals.
// All value globals are \`var\` (never \`const\`) so the scaffolded
// src/jsc-globals.ts fences — \`declare global\` modules — can legally
// REDECLARE them (identical types required, which pins doc surface to this
// canonical copy; a \`const\` would collide as TS2451).
declare var console: {
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    trace(...args: unknown[]): void;
};
declare var setTimeout: ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => number) | undefined;
declare var clearTimeout: ((id: number | undefined) => void) | undefined;
declare var setInterval: ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => number) | undefined;
declare var clearInterval: ((id: number | undefined) => void) | undefined;
// Host-injected Foundation-bridged URL (AppOS 1.1.0+, fn-182) — v1 subset,
// same surface as the SDK 3.0.1 opt-in globals subpath. \`var\` (not const)
// matches that subpath's declaration. No searchParams: the runtime getter
// throws — parse url.search manually.
interface URL {
    readonly href: string;
    readonly protocol: string;
    readonly hostname: string;
    readonly host: string;
    readonly port: string;
    readonly pathname: string;
    readonly search: string;
    readonly hash: string;
    readonly origin: string;
    readonly username: string;
    readonly password: string;
    toString(): string;
    toJSON(): string;
}
interface URLConstructor {
    new (url: string | URL, base?: string | URL): URL;
    canParse(url: string | URL, base?: string | URL): boolean;
    readonly prototype: URL;
}
declare var URL: URLConstructor | undefined;
`);

/**
 * WebView-side ambient bridge declaration for `js webview` fences —
 * EXTRACTED AT VERIFY TIME from the canonical teaching fence in
 * reference/extension-api.md § "WebView-side bridge (`window.twopanez`)"
 * (the authoritative copy per webview-panels/SKILL.md, which tells readers
 * to copy from there). ONE source of truth: this file previously carried an
 * independent hardcoded copy, so a member rename in the taught declaration
 * would have left `js webview` fences compiling green against a stale
 * surface while the same code failed the `tsc -p tsconfig.webview.json`
 * users actually run. Extraction fails CLOSED (exit 2) unless exactly one
 * ts fence declaring `interface TwopanezBridge` exists in the canonical
 * doc; the SKILL.md duplicate is pinned to it by byte equality (a check-3
 * finding on drift). The prescribed tsconfig.webview.json includes
 * webview/**\/* so panel .js and the d.ts share one program — this extra
 * root mirrors that program shape for checkJs fences. It is deliberately
 * NOT given to `ts webview` fences: those self-declare their ambients (the
 * canonical fence IS this declaration, and injecting a second global
 * augmentation would collide).
 */
const BRIDGE_CANONICAL_MD = "plugins/appos-dev/skills/appos-plugin-dev/reference/extension-api.md";
const BRIDGE_DUPLICATE_MD = "plugins/appos-dev/skills/webview-panels/SKILL.md";
function extractBridgeFences(mdRelPath) {
  const text = fs.readFileSync(path.join(REPO_ROOT, mdRelPath), "utf8");
  return extractFences(text).filter(
    (f) => (f.lang === "ts" || f.lang === "typescript") && /\binterface\s+TwopanezBridge\b/.test(f.code),
  );
}
const canonicalBridgeFences = extractBridgeFences(BRIDGE_CANONICAL_MD);
if (canonicalBridgeFences.length !== 1) {
  console.error(
    `[verify-knowledge] ERROR expected exactly 1 ts fence declaring \`interface TwopanezBridge\` in ` +
    `${BRIDGE_CANONICAL_MD} (found ${canonicalBridgeFences.length}) — the js-webview compile lane binds to that ` +
    "canonical taught declaration; restore it (or update extractBridgeFences in scripts/verify-knowledge.mjs)",
  );
  process.exit(2);
}
const TWOPANEZ_DTS = path.join(fenceTmpDir, "__webview-twopanez.d.ts");
fs.writeFileSync(
  TWOPANEZ_DTS,
  `// Extracted by verify-knowledge.mjs from ${BRIDGE_CANONICAL_MD}\n// § "WebView-side bridge (window.twopanez)" — the canonical taught copy.\n` +
  canonicalBridgeFences[0].code + "\n",
);
// The webview-panels SKILL.md carries a reader-facing duplicate of the same
// declaration (its prose names extension-api.md as the authoritative copy).
// Pin it byte-identical so the two taught copies cannot drift apart silently.
{
  const dup = extractBridgeFences(BRIDGE_DUPLICATE_MD);
  if (dup.length !== 1) {
    report(BRIDGE_DUPLICATE_MD, null,
      `expected exactly 1 ts fence declaring \`interface TwopanezBridge\` (found ${dup.length}) — ` +
      `the WebView bridge declaration must mirror the canonical copy in ${BRIDGE_CANONICAL_MD}`);
  } else if (dup[0].code !== canonicalBridgeFences[0].code) {
    report(BRIDGE_DUPLICATE_MD, dup[0].startLine,
      `WebView bridge declaration fence differs from the canonical copy in ${BRIDGE_CANONICAL_MD} — ` +
      "the two taught twopanez.d.ts copies must stay byte-identical (js-webview fences compile against the canonical one)");
  }
}

let fenceCount = 0;
let optedOut = 0;
let webviewEnvCount = 0;
let webviewJsEnvCount = 0;
for (const mdFile of fenceFiles) {
  const text = fs.readFileSync(path.join(REPO_ROOT, mdFile), "utf8");
  for (const fence of extractFences(text)) {
    const isTs = fence.lang === "ts" || fence.lang === "typescript";
    // js fences compile ONLY with the explicit `webview` opt-in tag
    // (```js webview) — checked as strict-checkJs WebView panel code (see
    // header). Untagged js fences stay invisible to this gate.
    const isWebviewJs = (fence.lang === "js" || fence.lang === "javascript") && fence.flags.includes("webview");
    if (!isTs && !isWebviewJs) continue;
    if (fence.flags.includes("no-verify")) { optedOut++; continue; }
    fenceCount++;
    const env = isWebviewJs ? "webviewJs" : fence.flags.includes("webview") ? "webview" : "plugin";
    if (env === "webview") webviewEnvCount++;
    if (env === "webviewJs") webviewJsEnvCount++;
    // No preamble for js fences: `declare` is illegal in .js files (TS8006)
    // and WebView code never sees the SDK — window.twopanez comes from the
    // extracted canonical ambient d.ts in the env's extraRoots.
    const preamble = isWebviewJs ? [] : [PREAMBLE_IMPORT, ...(bindsCtx(fence.code) ? [] : [PREAMBLE_CTX])];
    const virtualPath = path.join(
      fenceTmpDir,
      `${mdFile.replace(/[\\/]/g, "__").replace(/\.md$/, "")}__L${fence.startLine}.${isWebviewJs ? "js" : "ts"}`,
    );
    fs.writeFileSync(virtualPath, (preamble.length ? preamble.join("\n") + "\n" : "") + fence.code + "\n");
    fenceUnits.push({ virtualPath, mdFile, startLine: fence.startLine, preambleLines: preamble.length, env });
  }
}

if (fenceUnits.length) {
  const baseOptions = {
    strict: true,
    noEmit: true,
    // skipLibCheck stays TRUE here for speed — semantic declaration health is
    // check 2's dedicated skipLibCheck:false program, so nothing is lost.
    skipLibCheck: true,
    types: [], // no @types/* — keeps diagnostics deterministic across machines
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  // TWO ENVIRONMENTS (see header): the default `plugin` env compiles against
  // the documented JSC runtime (es2022 + the synthesized runtime-globals d.ts
  // above — no DOM), so `document` / `window` / global `fetch` / an unguarded
  // timer in a plugin-runtime fence FAIL instead of type-checking against
  // browser globals that do not exist at runtime. Fences flagged `webview`
  // compile with lib.dom instead (and without the JSC globals file — DOM
  // provides console + timers there).
  const envConfigs = {
    plugin: { options: { ...baseOptions, lib: ["lib.es2022.d.ts"] }, extraRoots: [JSC_GLOBALS_DTS] },
    webview: { options: { ...baseOptions, lib: ["lib.es2022.d.ts", "lib.dom.d.ts"] }, extraRoots: [] },
    // ```js webview fences: strict checkJs over a .js virtual file + the
    // extracted canonical twopanez.d.ts — mirrors the taught
    // tsconfig.webview.json program (allowJs/checkJs/strict, DOM lib,
    // webview/**/* include). allowJs/checkJs are not parse-affecting, so
    // the shared source-file cache stays safe across envs.
    webviewJs: {
      options: { ...baseOptions, allowJs: true, checkJs: true, lib: ["lib.es2022.d.ts", "lib.dom.d.ts"] },
      extraRoots: [TWOPANEZ_DTS],
    },
  };
  // ONE PROGRAM PER FENCE — the isolation guarantee is structural. With all
  // fences as roots of a single Program, a `declare global` augmentation or
  // ambient `declare module` in one fence is visible to every other fence
  // (module symbol merging is program-wide), so a snippet that omitted its
  // required local ambient declaration (e.g. the Window.twopanez teaching
  // declaration) would compile here yet fail when copied out alone — a silent
  // false green. Per-fence programs make cross-fence leakage impossible: no
  // other fence file is in the program at all.
  //
  // Cost control: per-env CompilerHosts memoize getSourceFile through ONE
  // shared cache keyed by resolved path, so the lib + installed SDK d.ts
  // files are read/parsed/bound once and reused across all programs
  // (SourceFile reuse across programs is safe here — every parse-affecting
  // option, notably target, is identical across both envs; lib SETS differ
  // but the cache is per-file). Measured on this corpus (63 fences): ~0.6s
  // wall single-program → ~1.0s wall per-fence + both envs + check 2 — the
  // isolation is essentially free.
  const sourceFileCache = new Map();
  for (const cfg of Object.values(envConfigs)) {
    const host = ts.createCompilerHost(cfg.options);
    const hostGetSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, ...rest) => {
      const key = path.resolve(fileName);
      if (!sourceFileCache.has(key)) sourceFileCache.set(key, hostGetSourceFile(fileName, ...rest));
      return sourceFileCache.get(key);
    };
    cfg.host = host;
  }
  const byPath = new Map(fenceUnits.map((u) => [path.resolve(u.virtualPath), u]));
  // Diagnostics NOT attributed to a fence virtual file (installed SDK d.ts,
  // another imported module, lib, or file-less options/global diagnostics)
  // must surface as failures too: if a dependency of the fences is broken,
  // the compiler never reaches the examples and dropping these diagnostics
  // would false-green the whole gate. Each distinct one is reported once —
  // the dedupe set spans ALL per-fence programs, so a broken dependency
  // surfaces once, not once per fence.
  const nonFenceSeen = new Set();
  for (const unit of fenceUnits) {
    const cfg = envConfigs[unit.env];
    const program = ts.createProgram([unit.virtualPath, ...cfg.extraRoots], cfg.options, cfg.host);
    for (const diag of ts.getPreEmitDiagnostics(program)) {
      const msg = ts.flattenDiagnosticMessageText(diag.messageText, " ");
      if (!diag.file) {
        const key = `global::${diag.code}::${msg}`;
        if (nonFenceSeen.has(key)) continue;
        nonFenceSeen.add(key);
        report("(global)", null, `global diagnostic TS${diag.code}: ${msg} — fence type-check program is unhealthy; fence results are not trustworthy`);
        continue;
      }
      const diagUnit = byPath.get(path.resolve(diag.file.fileName));
      if (!diagUnit) {
        const depFile = path.relative(REPO_ROOT, diag.file.fileName);
        const { line } = diag.file.getLineAndCharacterOfPosition(diag.start ?? 0);
        const key = `${depFile}::${line}::${diag.code}::${msg}`;
        if (nonFenceSeen.has(key)) continue;
        nonFenceSeen.add(key);
        report(depFile, line + 1, `dependency diagnostic TS${diag.code}: ${msg} — error in a file the fences depend on (not in any fence); fence results are not trustworthy until this is fixed`);
        continue;
      }
      const { line } = diag.file.getLineAndCharacterOfPosition(diag.start ?? 0);
      const mdLine = diagUnit.startLine + Math.max(0, line - diagUnit.preambleLines);
      report(diagUnit.mdFile, mdLine, `fence type error TS${diag.code}: ${msg}`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Checks 4 + 5 — denylist + count strings (tier (a) only).
// ───────────────────────────────────────────────────────────────────────────

function runTextChecks(file, { denylist }) {
  const lines = fs.readFileSync(path.join(REPO_ROOT, file), "utf8").split(/\r?\n/);
  lines.forEach((lineText, i) => {
    if (denylist) {
      for (const item of DENYLIST) {
        if (item.re.test(lineText)) report(file, i + 1, `stale identifier: ${item.name}`);
      }
    }
    if (lineText.includes("<!-- count-ok -->")) return;
    const claimed = new Set(); // avoid double-reporting the same match position
    for (const cp of COUNT_PATTERNS) {
      cp.re.lastIndex = 0;
      for (const m of lineText.matchAll(cp.re)) {
        if (claimed.has(m.index)) continue;
        claimed.add(m.index);
        const n = Number(m[1]);
        if (n !== truth[cp.key]) {
          report(file, i + 1, `count drift: "${m[0].trim()}" but the mirror derives ${cp.label} = ${truth[cp.key]}`);
        }
      }
    }
  });
}

for (const file of teachingFiles) runTextChecks(file, { denylist: true });

// Scoped COUNT-ONLY pass for the migration guide (tier (b)). The guide's
// exclusion from teachingFiles exists for the stale-identifier DENYLIST —
// it is the single sanctioned home for pre-3.0 identifiers — but that
// exemption was over-broad for count strings: the guide's "What did NOT
// change" section asserts LIVE surface ("The 17-type `ViewDescriptor`
// union"), which would stay green-and-stale when the SDK grows the union.
// Run check 5 alone here (denylist stays OFF, preserving the sanctioned-home
// design). A legacy before-count cited in migration prose (none today) is
// exactly the "legitimately different count" case the existing per-line
// `<!-- count-ok -->` exemption covers.
if (migrationExists) runTextChecks(migrationRel, { denylist: false });

// ───────────────────────────────────────────────────────────────────────────
// Summary + exit.
// ───────────────────────────────────────────────────────────────────────────

console.log(`[verify-knowledge] derived truth: ${JSON.stringify(truth)}`);
console.log(
  `[verify-knowledge] scanned ${teachingFiles.length} teaching files, ` +
  `${fenceCount} fences compiled (${fenceCount - webviewEnvCount - webviewJsEnvCount} plugin-runtime env, ` +
  `${webviewEnvCount} webview ts env, ${webviewJsEnvCount} webview checkJs env, ${optedOut} opted out via no-verify), ` +
  `migration guide ${migrationExists ? "fence- and count-checked (denylist-exempt)" : "not present yet (fn-165.2)"}, compiled/** excluded`,
);

if (findings.length) {
  console.error(`\n[verify-knowledge] FAIL ${findings.length} finding(s):`);
  for (const f of findings.sort()) console.error(`  ${f}`);
  process.exit(1);
}
console.log("[verify-knowledge] OK all checks green");
process.exit(0);
