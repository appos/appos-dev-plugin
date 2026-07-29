#!/usr/bin/env bash
# check-sdk-freshness.sh — fn-165.1 (R1)
#
# Guards the bundled SDK type mirror
#   plugins/appos-dev/skills/appos-plugin-dev/reference/plugin-api/
# against drift from the PUBLISHED @appos.space/plugin-types package.
#
# The mirror is a BYTE-VERBATIM copy of the published tarball's dist/*.d.ts
# files (.d.ts.map files dropped) plus a generated INDEX.md. The published
# npm tarball — pinned by its registry `dist.integrity` sha512 in the
# committed .sdk-integrity file — is the SOLE canonical source. Neither the
# plugin-sdk working tree nor the host's plugin-api.d.ts is ever consulted.
#
# Check mode (default) fails NON-ZERO when ANY of these drift:
#   0. pin/toolchain coherence: package.json's devDependency on the package is
#      not EXACTLY the pinned version, or the package-lock.json entry carries a
#      different version/integrity. verify-knowledge.mjs type-checks against
#      the `npm ci`-installed package (lockfile truth); this gate guarantees
#      that is the SAME artifact this script verifies the mirror against — a
#      devDependency/lockfile bump without `--update` FAILS here instead of
#      silently green-lighting the old mirror
#   1. registry `dist.integrity` for the pinned version != committed pin
#   2. sha512 of the actually-downloaded tarball bytes != committed pin
#   3. any mirrored *.d.ts differs byte-for-byte from the tarball's dist/ copy
#   4. the mirror contains extra/missing *.d.ts files vs the tarball
#   5. INDEX.md is missing, or its recorded version / integrity / per-file
#      sha256 values do not match the recomputed truth
#
# Update mode (--update) regenerates the mirror + INDEX.md + .sdk-integrity
# from the published tarball for the version in package.json devDependencies
# (or $1 after --update). Bump the devDependency + lockfile first, then run
# --update, then commit everything together.
#
# Usage:
#   scripts/check-sdk-freshness.sh                # verify (CI + local)
#   scripts/check-sdk-freshness.sh --update       # regenerate mirror for the
#                                                 # version pinned in package.json
#   scripts/check-sdk-freshness.sh --update 3.1.0 # regenerate for an explicit version
#   scripts/check-sdk-freshness.sh --help
#
# Exit codes:
#   0  fresh (or --update succeeded)
#   1  drift detected (check mode)
#   2  usage / environment error (no npm, no network, missing pin file, ...)
#
# Requires: npm (network access to the registry), openssl, node.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

PKG="@appos.space/plugin-types"
MIRROR_DIR="plugins/appos-dev/skills/appos-plugin-dev/reference/plugin-api"
PIN_FILE=".sdk-integrity"
INDEX_FILE="$MIRROR_DIR/INDEX.md"

MODE="check"
REQ_VERSION=""
case "${1:-}" in
  --help|-h) sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
  --update)  MODE="update"; REQ_VERSION="${2:-}" ;;
  "")        ;;
  *) echo "[check-sdk-freshness] ERROR unknown argument: $1 (see --help)" >&2; exit 2 ;;
esac

for tool in npm openssl node; do
  command -v "$tool" >/dev/null 2>&1 || { echo "[check-sdk-freshness] ERROR $tool not found on PATH" >&2; exit 2; }
done

sri_sha512() { # SRI sha512 of a file, matching npm's dist.integrity format
  printf 'sha512-%s' "$(openssl dgst -sha512 -binary "$1" | openssl base64 -A)"
}

sha256_of() { openssl dgst -sha256 -r "$1" | awk '{print $1}'; }

# ---------------------------------------------------------------------------
# Resolve the version under test.
# ---------------------------------------------------------------------------
if [[ "$MODE" == "update" ]]; then
  if [[ -n "$REQ_VERSION" ]]; then
    VERSION="$REQ_VERSION"
  else
    VERSION="$(node -p "require('./package.json').devDependencies['$PKG']")" || exit 2
  fi
else
  if [[ ! -f "$PIN_FILE" ]]; then
    echo "[check-sdk-freshness] ERROR pin file missing: $PIN_FILE (run --update once)" >&2
    exit 2
  fi
  VERSION="$(sed -n 's/^version=//p' "$PIN_FILE")"
  PINNED_INTEGRITY="$(sed -n 's/^integrity=//p' "$PIN_FILE")"
  PINNED_PKG="$(sed -n 's/^package=//p' "$PIN_FILE")"
  if [[ -z "$VERSION" || -z "$PINNED_INTEGRITY" || "$PINNED_PKG" != "$PKG" ]]; then
    echo "[check-sdk-freshness] ERROR malformed pin file $PIN_FILE (need package=/version=/integrity= lines; package must be $PKG)" >&2
    exit 2
  fi

  # Gate 0: pin ⇄ npm-toolchain coherence. The devDependency must be the EXACT
  # pinned version (no ranges) and the lockfile entry must carry the same
  # version + integrity, so verify-knowledge.mjs (which type-checks against the
  # `npm ci`-installed package) and this script verify the SAME artifact.
  DEVDEP_VERSION="$(node -p "require('./package.json').devDependencies?.['$PKG'] ?? ''")" || exit 2
  LOCK_VERSION="$(node -p "require('./package-lock.json').packages?.['node_modules/$PKG']?.version ?? ''")" || exit 2
  LOCK_INTEGRITY="$(node -p "require('./package-lock.json').packages?.['node_modules/$PKG']?.integrity ?? ''")" || exit 2
  PIN_RC=0
  if [[ "$DEVDEP_VERSION" != "$VERSION" ]]; then
    echo "[check-sdk-freshness] FAIL package.json devDependency '$PKG' is '$DEVDEP_VERSION' but $PIN_FILE pins '$VERSION' (must match EXACTLY — no ranges)" >&2
    PIN_RC=1
  fi
  if [[ "$LOCK_VERSION" != "$VERSION" ]]; then
    echo "[check-sdk-freshness] FAIL package-lock.json resolves $PKG@'$LOCK_VERSION' but $PIN_FILE pins '$VERSION'" >&2
    PIN_RC=1
  fi
  if [[ "$LOCK_INTEGRITY" != "$PINNED_INTEGRITY" ]]; then
    echo "[check-sdk-freshness] FAIL package-lock.json integrity for $PKG != pinned integrity" >&2
    echo "  pinned   = $PINNED_INTEGRITY" >&2
    echo "  lockfile = $LOCK_INTEGRITY" >&2
    PIN_RC=1
  fi
  if [[ "$PIN_RC" -ne 0 ]]; then
    echo "[check-sdk-freshness] fix: bump/restore the devDependency + lockfile, then run scripts/check-sdk-freshness.sh --update and commit everything together" >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Fetch: registry integrity + the tarball itself (both modes need the bytes).
# ---------------------------------------------------------------------------
REGISTRY_INTEGRITY="$(npm view "$PKG@$VERSION" dist.integrity 2>/dev/null)"
if [[ -z "$REGISTRY_INTEGRITY" ]]; then
  echo "[check-sdk-freshness] ERROR could not read dist.integrity for $PKG@$VERSION from the registry (network? version exists?)" >&2
  exit 2
fi

# Portable mktemp: GNU (Linux CI) requires >=3 X's in the template; BSD (macOS)
# accepts an explicit path template too. An explicit path works on both.
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sdk-freshness.XXXXXXXX")" || exit 2
trap 'rm -rf "$TMP_DIR"' EXIT

( cd "$TMP_DIR" && npm pack "$PKG@$VERSION" --silent >/dev/null 2>&1 )
TARBALL="$(find "$TMP_DIR" -maxdepth 1 -name '*.tgz' | head -1)"
if [[ -z "$TARBALL" ]]; then
  echo "[check-sdk-freshness] ERROR npm pack $PKG@$VERSION produced no tarball" >&2
  exit 2
fi
TARBALL_INTEGRITY="$(sri_sha512 "$TARBALL")"

tar xzf "$TARBALL" -C "$TMP_DIR" || { echo "[check-sdk-freshness] ERROR tarball extraction failed" >&2; exit 2; }
DIST_DIR="$TMP_DIR/package/dist"
[[ -d "$DIST_DIR" ]] || { echo "[check-sdk-freshness] ERROR tarball has no dist/ directory" >&2; exit 2; }

TARBALL_DTS=()
while IFS= read -r f; do TARBALL_DTS+=("$(basename "$f")"); done \
  < <(find "$DIST_DIR" -maxdepth 1 -name '*.d.ts' | sort)
if [[ "${#TARBALL_DTS[@]}" -eq 0 ]]; then
  echo "[check-sdk-freshness] ERROR tarball dist/ contains no .d.ts files" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# --update: regenerate mirror + INDEX.md + pin file, then exit.
# ---------------------------------------------------------------------------
if [[ "$MODE" == "update" ]]; then
  if [[ "$TARBALL_INTEGRITY" != "$REGISTRY_INTEGRITY" ]]; then
    echo "[check-sdk-freshness] FAIL downloaded tarball bytes do not hash to the registry dist.integrity — refusing to mirror" >&2
    echo "  registry = $REGISTRY_INTEGRITY" >&2
    echo "  tarball  = $TARBALL_INTEGRITY" >&2
    exit 1
  fi

  # Stage-then-swap: build the ENTIRE new mirror + INDEX + pin in a staging
  # area first, guarding every write, so an I/O failure (full disk, perms)
  # exits non-zero without having touched the committed artifacts. Only the
  # final swap mutates the repo — and each swap step is guarded too, so even
  # a mid-swap failure exits non-zero (and check mode would then fail loudly
  # on the inconsistent state rather than trusting it).
  STAGE_DIR="$TMP_DIR/stage"
  STAGE_PIN="$TMP_DIR/sdk-integrity.staged"
  mkdir -p "$STAGE_DIR" || { echo "[check-sdk-freshness] ERROR could not create staging dir" >&2; exit 2; }
  for f in "${TARBALL_DTS[@]}"; do
    cp "$DIST_DIR/$f" "$STAGE_DIR/$f" || { echo "[check-sdk-freshness] ERROR staging copy failed for $f" >&2; exit 2; }
  done

  COUNTS_JSON="$(node scripts/verify-knowledge.mjs --counts "$DIST_DIR")" || {
    echo "[check-sdk-freshness] ERROR could not derive surface counts from $DIST_DIR" >&2
    exit 2
  }
  NS_COUNT="$(node -pe "($COUNTS_JSON).namespaces")" || exit 2
  SCOPE_COUNT="$(node -pe "($COUNTS_JSON).canonicalScopes")" || exit 2
  LEGACY_COUNT="$(node -pe "($COUNTS_JSON).legacyAliases")" || exit 2
  CORE_NS_COUNT="$(node -pe "($COUNTS_JSON).corePluginNamespaces")" || exit 2
  TOTAL_LINES="$(cat "$STAGE_DIR"/*.d.ts | wc -l | tr -d ' ')" || exit 2

  {
    printf '# Bundled SDK type mirror — %s@%s\n\n' "$PKG" "$VERSION"
    printf 'GENERATED by `scripts/check-sdk-freshness.sh --update` — DO NOT EDIT BY HAND.\n\n'
    printf 'Byte-verbatim mirror of the published npm tarball'"'"'s `dist/*.d.ts` files\n'
    printf '(`.d.ts.map` files dropped). The published tarball is the sole canonical\n'
    printf 'source; `scripts/check-sdk-freshness.sh` re-verifies this mirror against the\n'
    printf 'registry on every CI run.\n\n'
    printf -- '- package: `%s`\n' "$PKG"
    printf -- '- version: `%s`\n' "$VERSION"
    printf -- '- dist.integrity: `%s`\n' "$REGISTRY_INTEGRITY"
    printf -- '- surface (derived from these files): %s API namespaces on `PluginContext` (of which %s core-plugin namespaces) + 3 metadata scalars, %s canonical permission scopes, %s legacy aliases (deprecated), 1 dynamic `oauth.<provider>` scope family, %s lines total\n' \
      "$NS_COUNT" "$CORE_NS_COUNT" "$SCOPE_COUNT" "$LEGACY_COUNT" "$TOTAL_LINES"
    printf -- '- regenerate: `scripts/check-sdk-freshness.sh --update` (after bumping the `%s` devDependency + lockfile)\n' "$PKG"
    printf -- '- verify: `scripts/check-sdk-freshness.sh`\n\n'
    printf '| file | sha256 |\n|---|---|\n'
    for f in "${TARBALL_DTS[@]}"; do
      SHA="$(sha256_of "$STAGE_DIR/$f")" || exit 2
      printf '| %s | %s |\n' "$f" "$SHA"
    done
  } > "$STAGE_DIR/INDEX.md" || { echo "[check-sdk-freshness] ERROR writing staged INDEX.md failed" >&2; exit 2; }

  {
    printf 'package=%s\n' "$PKG"
    printf 'version=%s\n' "$VERSION"
    printf 'integrity=%s\n' "$REGISTRY_INTEGRITY"
  } > "$STAGE_PIN" || { echo "[check-sdk-freshness] ERROR writing staged pin failed" >&2; exit 2; }

  # Staged-content sanity before touching the repo: every expected file
  # present, and every staged d.ts byte-equal to the tarball source.
  for f in "${TARBALL_DTS[@]}"; do
    cmp -s "$DIST_DIR/$f" "$STAGE_DIR/$f" || { echo "[check-sdk-freshness] ERROR staged $f not byte-equal to tarball (I/O corruption?)" >&2; exit 2; }
  done
  [[ -s "$STAGE_DIR/INDEX.md" && -s "$STAGE_PIN" ]] || { echo "[check-sdk-freshness] ERROR staged INDEX.md/pin empty" >&2; exit 2; }

  # Swap into place (guarded; a failure here exits non-zero and the committed
  # tree is left for check mode to flag rather than being trusted).
  rm -rf "$MIRROR_DIR" || { echo "[check-sdk-freshness] ERROR could not remove old mirror $MIRROR_DIR" >&2; exit 2; }
  mkdir -p "$(dirname "$MIRROR_DIR")" || exit 2
  if ! mv "$STAGE_DIR" "$MIRROR_DIR"; then
    echo "[check-sdk-freshness] ERROR mirror swap failed — repo has NO mirror right now; re-run --update" >&2
    exit 2
  fi
  if ! mv "$STAGE_PIN" "$PIN_FILE"; then
    echo "[check-sdk-freshness] ERROR pin swap failed — $PIN_FILE is stale vs the new mirror; re-run --update (check mode will fail loudly until then)" >&2
    exit 2
  fi

  echo "[check-sdk-freshness] UPDATED $MIRROR_DIR (${#TARBALL_DTS[@]} d.ts files), $INDEX_FILE, $PIN_FILE for $PKG@$VERSION"
  exit 0
fi

# ---------------------------------------------------------------------------
# Check mode.
# ---------------------------------------------------------------------------
RC=0

# Gate 1: registry integrity vs committed pin.
if [[ "$REGISTRY_INTEGRITY" != "$PINNED_INTEGRITY" ]]; then
  echo "[check-sdk-freshness] FAIL registry dist.integrity drift for $PKG@$VERSION" >&2
  echo "  pinned   = $PINNED_INTEGRITY" >&2
  echo "  registry = $REGISTRY_INTEGRITY" >&2
  RC=1
fi

# Gate 2: actual tarball bytes vs committed pin.
if [[ "$TARBALL_INTEGRITY" != "$PINNED_INTEGRITY" ]]; then
  echo "[check-sdk-freshness] FAIL downloaded tarball sha512 != pinned integrity" >&2
  echo "  pinned  = $PINNED_INTEGRITY" >&2
  echo "  tarball = $TARBALL_INTEGRITY" >&2
  RC=1
fi

# Gate 3+4: mirror file set + byte-equality vs tarball dist/.
if [[ ! -d "$MIRROR_DIR" ]]; then
  echo "[check-sdk-freshness] FAIL mirror directory missing: $MIRROR_DIR" >&2
  exit 1
fi

MIRROR_DTS=()
while IFS= read -r f; do MIRROR_DTS+=("$(basename "$f")"); done \
  < <(find "$MIRROR_DIR" -maxdepth 1 -name '*.d.ts' | sort)

if [[ "${TARBALL_DTS[*]}" != "${MIRROR_DTS[*]:-}" ]]; then
  echo "[check-sdk-freshness] FAIL mirror file set differs from tarball dist/*.d.ts" >&2
  echo "  tarball: ${TARBALL_DTS[*]}" >&2
  echo "  mirror : ${MIRROR_DTS[*]:-<none>}" >&2
  RC=1
fi

for f in "${TARBALL_DTS[@]}"; do
  [[ -f "$MIRROR_DIR/$f" ]] || continue # already reported by the set diff
  if ! cmp -s "$DIST_DIR/$f" "$MIRROR_DIR/$f"; then
    echo "[check-sdk-freshness] FAIL mirror file differs from tarball: $MIRROR_DIR/$f" >&2
    RC=1
  fi
done

# Gate 5: INDEX.md presence + recorded version/integrity/per-file sha256.
if [[ ! -f "$INDEX_FILE" ]]; then
  echo "[check-sdk-freshness] FAIL INDEX.md missing: $INDEX_FILE" >&2
  RC=1
else
  grep -qF -- "- version: \`$VERSION\`" "$INDEX_FILE" || {
    echo "[check-sdk-freshness] FAIL INDEX.md does not record version $VERSION" >&2; RC=1; }
  grep -qF -- "- dist.integrity: \`$PINNED_INTEGRITY\`" "$INDEX_FILE" || {
    echo "[check-sdk-freshness] FAIL INDEX.md does not record the pinned dist.integrity" >&2; RC=1; }
  for f in "${MIRROR_DTS[@]:-}"; do
    [[ -n "$f" ]] || continue
    ACTUAL_SHA="$(sha256_of "$MIRROR_DIR/$f")"
    grep -qF -- "| $f | $ACTUAL_SHA |" "$INDEX_FILE" || {
      echo "[check-sdk-freshness] FAIL INDEX.md sha256 row stale for $f (recomputed $ACTUAL_SHA)" >&2; RC=1; }
  done

  # Gate 5b: the INDEX.md table's file rows must match the mirror's *.d.ts set
  # ONE-TO-ONE. The per-file grep above only proves a correct row EXISTS for
  # each current mirror file — an obsolete, duplicate, or hand-added extra row
  # would survive it, leaving a supposedly generated integrity index describing
  # files that are not in the mirrored tarball. Parse every data row (skip the
  # `| file | sha256 |` header and `|---|` separator) and require multiset
  # equality: extra row, missing row, or duplicate row all FAIL.
  INDEX_ROW_FILES="$(awk -F'|' '/^\|/ { f=$2; gsub(/^[ \t]+|[ \t]+$/, "", f); if (f != "file" && f !~ /^-+$/) print f }' "$INDEX_FILE" | sort)"
  MIRROR_SET="$(printf '%s\n' "${MIRROR_DTS[@]:-}")"
  if [[ "$INDEX_ROW_FILES" != "$MIRROR_SET" ]]; then
    echo "[check-sdk-freshness] FAIL INDEX.md file rows are not one-to-one with the mirror's *.d.ts set (extra/missing/duplicate row)" >&2
    echo "  index rows: $(printf '%s' "$INDEX_ROW_FILES" | tr '\n' ' ')" >&2
    echo "  mirror    : ${MIRROR_DTS[*]:-<none>}" >&2
    RC=1
  fi
fi

if [[ "$RC" -eq 0 ]]; then
  echo "[check-sdk-freshness] OK mirror is fresh: $PKG@$VERSION (${#MIRROR_DTS[@]} d.ts files byte-equal to the published tarball; integrity $PINNED_INTEGRITY)"
fi
exit "$RC"
