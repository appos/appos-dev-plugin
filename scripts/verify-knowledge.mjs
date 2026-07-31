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
 *  (b) reference/migration-2.x-to-3.0.md — fence type-check ONLY. This file
 *      is the single sanctioned home for pre-3.0 identifiers, so it is
 *      denylist- and count-string-EXEMPT; its legacy "before" fences carry
 *      the `no-verify` opt-out tag so only the "after" fences compile.
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
 *    per-fence programs stay cheap. The package ships no ambient globals, so
 *    a fence must `import type { ... } from "@appos.space/plugin-types"` for
 *    any type NAME it references — exactly like real plugin source. The
 *    exact-pinned sibling packages `@appos.space/plugin-utils` and
 *    `@appos.space/view-builders` are also installed, so fences may import
 *    them too. Relative imports (`./panels/foo.js`) are unresolvable by
 *    construction — multi-file example fences are fragments and take
 *    `no-verify`. `window.twopanez` is NOT typed by the published package;
 *    WebView-side fences teach a local ambient declaration (or take
 *    `no-verify`).
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
 *  2. fence type-check — every non-opted-out ts fence in tiers (a)+(b)
 *     compiles clean (tsc 5.9.3, strict, noEmit; ONE Program PER FENCE so
 *     ambient/global declarations cannot leak between examples; diagnostics
 *     mapped back to the markdown file + line). Diagnostics attributed to a
 *     NON-fence file
 *     (installed SDK d.ts, another imported module, lib) or to no file at
 *     all (options/global) are NOT discarded — each distinct one is
 *     reported once as a "dependency diagnostic" / "global diagnostic"
 *     finding (no markdown line mapping), because a broken dependency
 *     would otherwise false-green every fence.
 *  3. stale-identifier denylist — tier (a) text must not contain pre-3.0
 *     identifiers (PluginCacheAPI, HostEventsAPI, *Namespace spellings,
 *     ambient `declare function activate`, 2.4.0-fn50, com.twopanez/plugins,
 *     "22 namespaces" / "34 permissions", triple-slash types reference, ...).
 *  4. count-string consistency — numeric surface claims in tier (a)
 *     ("N namespaces", "N permission scopes", "N exported types", plus the
 *     hyphenated singular forms "N-scope" / "N-namespace", ...) must match
 *     the truth DERIVED from the mirror at run time.
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
  { name: "ambient `declare function activate` (3.0.0 has no ambient globals)", re: /declare\s+function\s+activate\b/ },
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
];

// ───────────────────────────────────────────────────────────────────────────
// Derived truth from a d.ts directory (mirror or tarball dist/).
// ───────────────────────────────────────────────────────────────────────────

function deriveCounts(dtsDir) {
  const core = fs.readFileSync(path.join(dtsDir, "core.d.ts"), "utf8");
  const ctxBody = core.match(/export interface PluginContext \{([\s\S]*?)\n\}/);
  if (!ctxBody) throw new Error(`PluginContext not found in ${dtsDir}/core.d.ts`);
  const members = [...ctxBody[1].matchAll(/readonly (\w+):/g)].map((m) => m[1]);
  const scalars = members.filter((n) => ["pluginId", "pluginVersion", "hostVersion"].includes(n));

  const coreImport = core.match(/import type \{([^}]+)\} from "\.\/namespaces-core-plugins"/);
  const corePluginNamespaces = coreImport
    ? coreImport[1].split(",").map((s) => s.trim()).filter((n) => /API$/.test(n)).length
    : 0;

  const perms = fs.readFileSync(path.join(dtsDir, "permissions.d.ts"), "utf8");
  const canon = perms.match(/export type CanonicalPermissionScope = ([^;]+);/);
  if (!canon) throw new Error(`CanonicalPermissionScope not found in ${dtsDir}/permissions.d.ts`);
  // Fixed scopes are double-quoted literals; the dynamic `oauth.${string}`
  // family is a backtick template literal — counted separately, never choked on.
  const fixedScopes = [...canon[1].matchAll(/"([^"]+)"/g)].length;
  const templateFamilies = [...canon[1].matchAll(/`[^`]+`/g)].length;
  const legacy = perms.match(/export type LegacyPermissionScope = ([^;]+);/);
  const legacyAliases = legacy ? [...legacy[1].matchAll(/"([^"]+)"/g)].length : 0;

  return {
    namespaces: members.length - scalars.length,
    metadataScalars: scalars.length,
    corePluginNamespaces,
    canonicalScopes: fixedScopes,
    dynamicScopeFamilies: templateFamilies,
    legacyAliases,
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

// ───────────────────────────────────────────────────────────────────────────
// Check 2 — fence extraction + type-check.
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
 * one optional space) and list tokens carrying the item's CONTENT COLUMN
 * (up to 3 spaces of indent + marker width + at least one following space).
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

/** One CommonMark blockquote marker: up to 3 spaces, `>`, one optional space. */
const BLOCKQUOTE_MARKER_RE = /^ {0,3}> ?/;
/**
 * One CommonMark list marker: up to 3 spaces of indent, a bullet (`-`, `*`,
 * `+`) or ordered marker (1-9 digits + `.` or `)`), and >= 1 following space.
 * The full match length IS the item's content column — in COLUMNS as well as
 * characters, since every char the pattern admits (space, bullet, digit, `.`,
 * `)`) is width-1. Contained lines, by contrast, may reach that column via
 * tabs, so they are measured/stripped column-wise (see stripContainerPrefix).
 */
const LIST_MARKER_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)]) +/;

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
 * container marker leads).
 */
function parseContainerPrefix(line) {
  const tokens = [];
  let rest = line;
  for (;;) {
    const bq = rest.match(BLOCKQUOTE_MARKER_RE);
    if (bq) {
      tokens.push({ kind: "bq" });
      rest = rest.slice(bq[0].length);
      continue;
    }
    const li = rest.match(LIST_MARKER_RE);
    if (li) {
      tokens.push({ kind: "li", col: li[0].length });
      rest = rest.slice(li[0].length);
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
      const m = rest.match(BLOCKQUOTE_MARKER_RE);
      if (!m) return { closed: true };
      rest = rest.slice(m[0].length);
      absCol += m[0].length; // every admitted char (space, `>`) is width-1
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
 * Returns { kept, rest, lazy }: `kept` = surviving token count (callers slice
 * the stack), `rest` = the line with the surviving prefix stripped.
 */
function matchOpenContainers(line, stack, paragraphOpen) {
  let rest = line;
  let absCol = 0; // absolute line column at which `rest` begins
  let kept = 0;
  for (const t of stack) {
    if (t.kind === "bq") {
      const m = rest.match(BLOCKQUOTE_MARKER_RE);
      if (m) {
        rest = rest.slice(m[0].length);
        absCol += m[0].length; // every admitted char (space, `>`) is width-1
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
      return { kept: stack.length, rest, lazy: true };
    }
    return { kept, rest, lazy: false };
  }
  return { kept, rest, lazy: false };
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
    const { tokens, rest } = parseContainerPrefix(carried.rest);
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

const fenceUnits = []; // { virtualPath, mdFile, startLine, preambleLines }
const fenceTmpDir = path.join(REPO_ROOT, "node_modules", ".cache", "verify-knowledge");
fs.rmSync(fenceTmpDir, { recursive: true, force: true });
fs.mkdirSync(fenceTmpDir, { recursive: true });

let fenceCount = 0;
let optedOut = 0;
for (const mdFile of fenceFiles) {
  const text = fs.readFileSync(path.join(REPO_ROOT, mdFile), "utf8");
  for (const fence of extractFences(text)) {
    if (fence.lang !== "ts" && fence.lang !== "typescript") continue;
    if (fence.flags.includes("no-verify")) { optedOut++; continue; }
    fenceCount++;
    const preamble = [PREAMBLE_IMPORT, ...(bindsCtx(fence.code) ? [] : [PREAMBLE_CTX])];
    const virtualPath = path.join(
      fenceTmpDir,
      `${mdFile.replace(/[\\/]/g, "__").replace(/\.md$/, "")}__L${fence.startLine}.ts`,
    );
    fs.writeFileSync(virtualPath, preamble.join("\n") + "\n" + fence.code + "\n");
    fenceUnits.push({ virtualPath, mdFile, startLine: fence.startLine, preambleLines: preamble.length });
  }
}

if (fenceUnits.length) {
  const compilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [], // no @types/* — keeps diagnostics deterministic across machines
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"], // DOM for WebView-panel snippets
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
  // Cost control: a shared CompilerHost memoizes getSourceFile so the lib +
  // installed SDK d.ts files are read/parsed/bound ONCE and reused across all
  // programs (SourceFile reuse across programs with identical options is the
  // standard LanguageService/documentRegistry pattern). Measured on this
  // corpus (63 fences): ~0.6s wall single-program → ~0.9s wall per-fence —
  // the isolation is essentially free.
  const host = ts.createCompilerHost(compilerOptions);
  const sourceFileCache = new Map();
  const hostGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, ...rest) => {
    const key = path.resolve(fileName);
    if (!sourceFileCache.has(key)) sourceFileCache.set(key, hostGetSourceFile(fileName, ...rest));
    return sourceFileCache.get(key);
  };
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
    const program = ts.createProgram([unit.virtualPath], compilerOptions, host);
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
// Checks 3 + 4 — denylist + count strings (tier (a) only).
// ───────────────────────────────────────────────────────────────────────────

for (const file of teachingFiles) {
  const lines = fs.readFileSync(path.join(REPO_ROOT, file), "utf8").split(/\r?\n/);
  lines.forEach((lineText, i) => {
    for (const item of DENYLIST) {
      if (item.re.test(lineText)) report(file, i + 1, `stale identifier: ${item.name}`);
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

// ───────────────────────────────────────────────────────────────────────────
// Summary + exit.
// ───────────────────────────────────────────────────────────────────────────

console.log(`[verify-knowledge] derived truth: ${JSON.stringify(truth)}`);
console.log(
  `[verify-knowledge] scanned ${teachingFiles.length} teaching files, ` +
  `${fenceCount} ts fences compiled (${optedOut} opted out via no-verify), ` +
  `migration guide ${migrationExists ? "fence-checked" : "not present yet (fn-165.2)"}, compiled/** excluded`,
);

if (findings.length) {
  console.error(`\n[verify-knowledge] FAIL ${findings.length} finding(s):`);
  for (const f of findings.sort()) console.error(`  ${f}`);
  process.exit(1);
}
console.log("[verify-knowledge] OK all checks green");
process.exit(0);
