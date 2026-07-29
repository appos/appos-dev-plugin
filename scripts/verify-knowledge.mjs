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
 *    tilde fence a backtick run is literal content, and vice versa.
 *  - Fences tagged `ts` / `typescript` are compiled as ISOLATED ES MODULES
 *    against the pinned package. The package ships no ambient globals, so a
 *    fence must `import type { ... } from "@appos.space/plugin-types"` for
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
 *     compiles clean (tsc 5.9.3, strict, noEmit; diagnostics mapped back to
 *     the markdown file + line). Diagnostics attributed to a NON-fence file
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
 *     ("N namespaces", "N permission scopes", "N exported types", ...) must
 *     match the truth DERIVED from the mirror at run time.
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
  { label: "legacy aliases", re: /(\d+)[\s-]+legacy\s+alias(?:es)?\b/gi, key: "legacyAliases" },
  { label: "permission scopes", re: /(\d+)[\s-]+(?:canonical\s+)?permission\s+scopes\b/gi, key: "canonicalScopes" },
  { label: "permissions", re: /(\d+)[\s-]+permissions\b/gi, key: "canonicalScopes" },
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
 */
function extractFences(text) {
  const lines = text.split(/\r?\n/);
  const fences = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!open) {
      if (m) {
        const info = m[3].trim();
        const [lang, ...flags] = info.split(/\s+/);
        open = { fence: m[2], indent: m[1].length, lang: (lang || "").toLowerCase(), flags, startLine: i + 2, code: [] };
      }
    } else if (m && m[2][0] === open.fence[0] && m[2].length >= open.fence.length && m[3].trim() === "") {
      fences.push({ lang: open.lang, flags: open.flags, startLine: open.startLine, code: open.code.join("\n") });
      open = null;
    } else {
      open.code.push(lines[i]);
    }
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
  const program = ts.createProgram(
    fenceUnits.map((u) => u.virtualPath),
    {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [], // no @types/* — keeps diagnostics deterministic across machines
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts"], // DOM for WebView-panel snippets
    },
  );
  const byPath = new Map(fenceUnits.map((u) => [path.resolve(u.virtualPath), u]));
  // Diagnostics NOT attributed to a fence virtual file (installed SDK d.ts,
  // another imported module, lib, or file-less options/global diagnostics)
  // must surface as failures too: if a dependency of the fences is broken,
  // the compiler never reaches the examples and dropping these diagnostics
  // would false-green the whole gate. Each distinct one is reported once.
  const nonFenceSeen = new Set();
  for (const diag of ts.getPreEmitDiagnostics(program)) {
    const msg = ts.flattenDiagnosticMessageText(diag.messageText, " ");
    if (!diag.file) {
      const key = `global::${diag.code}::${msg}`;
      if (nonFenceSeen.has(key)) continue;
      nonFenceSeen.add(key);
      report("(global)", null, `global diagnostic TS${diag.code}: ${msg} — fence type-check program is unhealthy; fence results are not trustworthy`);
      continue;
    }
    const unit = byPath.get(path.resolve(diag.file.fileName));
    if (!unit) {
      const depFile = path.relative(REPO_ROOT, diag.file.fileName);
      const { line } = diag.file.getLineAndCharacterOfPosition(diag.start ?? 0);
      const key = `${depFile}::${line}::${diag.code}::${msg}`;
      if (nonFenceSeen.has(key)) continue;
      nonFenceSeen.add(key);
      report(depFile, line + 1, `dependency diagnostic TS${diag.code}: ${msg} — error in a file the fences depend on (not in any fence); fence results are not trustworthy until this is fixed`);
      continue;
    }
    const { line } = diag.file.getLineAndCharacterOfPosition(diag.start ?? 0);
    const mdLine = unit.startLine + Math.max(0, line - unit.preambleLines);
    report(unit.mdFile, mdLine, `fence type error TS${diag.code}: ${msg}`);
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
