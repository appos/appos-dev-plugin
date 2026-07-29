#!/usr/bin/env bash
# check-compiled-freshness.sh — fn-165.4
#
# Guards plugins/appos-dev/compiled/ against BOTH desync directions using
# ONLY files in this repo (no cross-repo reads):
#
#   1. source-changed-without-regen: a hash recorded under "sources" in
#      plugins/appos-dev/compiled/manifest.json no longer matches the file
#      under plugins/appos-dev/skills/appos-plugin-dev/ — the knowledge
#      sources moved but the compiled artifacts were not regenerated.
#   2. compiled-artifact-edited-directly: a hash recorded under "artifacts"
#      no longer matches the file in plugins/appos-dev/compiled/ — someone
#      hand-edited a generated artifact (or the Desktop-owned
#      cli-chat-system-prompt.md copy) instead of regenerating.
#
# Also fails when compiled/ contains a .md file the manifest does not list
# (unaccounted drift), or when the manifest itself is not parseable JSON
# (truncated / unbalanced braces — downstream tooling could not read it even
# if the hash-entry lines survived). Hash entries are extracted FROM THE
# PARSED JSON OBJECT (not by scanning raw lines), so this gate checks exactly
# the object every downstream JSON.parse consumer sees — duplicate section
# keys resolve last-wins the same way, and a shadowed-empty "artifacts"/
# "sources" section fails the zero-count check instead of passing on stale
# raw-line matches.
#
# Beyond per-entry hashes, the manifest's key SETS must exactly equal the
# compile-input sets the generator enumerates (a dropped entry would
# otherwise silently exempt that file from the gate forever):
#   sources   == SKILL.md + reference/extension-api.md + reference/patterns.md
#                + reference/plugin-api/index.d.ts + one entry per barrel
#                module ('export * from "./<name>";' line) of index.d.ts —
#                derived here from THIS repo's index.d.ts exactly the way
#                compile-factory-context.sh enumerates its inputs. Desktop-
#                owned files (cli-chat-system-prompt.md) are deliberately NOT
#                sources in this manifest — they appear under artifacts only.
#   artifacts == exactly { cli-chat-system-prompt.md,
#                plugin-factory-context.md } (the fixed pair the generator
#                writes).
# Missing, extra, or renamed keys on either side fail with a per-key diff.
#
# The manifest and every file in compiled/ are written by the AppOS-Desktop
# repo's scripts/compile-factory-context.sh (ownership: the factory context
# flows dev-plugin -> Desktop; cli-chat-system-prompt.md flows Desktop ->
# dev-plugin). To fix a failure, re-run that script from an AppOS-Desktop
# checkout and commit the refreshed compiled/ + manifest here.
#
# Usage:
#   scripts/check-compiled-freshness.sh
#
# Exit codes:
#   0  fresh
#   1  drift detected
#   2  usage / environment error (missing manifest, no hashing tool, ...)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

COMPILED_DIR="plugins/appos-dev/compiled"
SKILL_DIR="plugins/appos-dev/skills/appos-plugin-dev"
MANIFEST="$COMPILED_DIR/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
    echo "error: $MANIFEST not found — run AppOS-Desktop's scripts/compile-factory-context.sh" >&2
    exit 2
fi

# Parse the manifest as JSON and emit every hash entry FROM THE PARSED OBJECT
# as "section<TAB>file<TAB>hash" lines for the shell loop below. Parsing and
# hash extraction share one JSON view, so this gate can never diverge from
# what downstream JSON.parse consumers read — a truncated manifest fails
# outright, and duplicate section keys resolve last-wins here exactly as they
# do for every other JSON consumer (a shadowed-empty section then trips the
# zero-count check below instead of passing on raw-line matches from the
# shadowed occurrence). node is guaranteed in CI (setup-node + npm ci in
# verify.yml) and on dev machines; jq is not.
if ! command -v node >/dev/null 2>&1; then
    echo "error: node not available — required to parse $MANIFEST" >&2
    exit 2
fi
# node exit codes: 0 = entries on stdout; 1 = not parseable JSON;
# 3 = parseable but not the expected shape. Anything else = node blew up.
# All validation happens before any output, so on failure the captured
# output is exactly the error message.
manifest_entries="$(node -e '
const fs = require("fs");
let m;
try {
    m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
const out = [];
for (const section of ["artifacts", "sources"]) {
    const obj = m[section];
    if (obj === undefined) continue; // missing section -> zero-count check below
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        console.error(JSON.stringify(section) + " is not a JSON object");
        process.exit(3);
    }
    for (const [rel, hash] of Object.entries(obj)) {
        if (/[\t\n]/.test(rel)) {
            console.error(JSON.stringify(section) + " key " + JSON.stringify(rel) + " contains a tab or newline");
            process.exit(3);
        }
        if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
            console.error(JSON.stringify(section) + " entry " + JSON.stringify(rel) + " is not a 64-char lowercase sha256 hex string");
            process.exit(3);
        }
        out.push(section + "\t" + rel + "\t" + hash);
    }
}
if (out.length > 0) process.stdout.write(out.join("\n") + "\n");
' "$MANIFEST" 2>&1)"
node_status=$?
if [[ $node_status -eq 1 ]]; then
    echo "DRIFT: $MANIFEST is not valid JSON: $manifest_entries" >&2
    echo "  (truncated or hand-edited?) Regenerate from an AppOS-Desktop checkout:" >&2
    echo "  ./scripts/compile-factory-context.sh   (writes compiled/ + manifest here)" >&2
    exit 1
elif [[ $node_status -eq 3 ]]; then
    echo "DRIFT: $MANIFEST is valid JSON but not the expected shape: $manifest_entries" >&2
    echo "  (hand-edited?) Regenerate from an AppOS-Desktop checkout:" >&2
    echo "  ./scripts/compile-factory-context.sh   (writes compiled/ + manifest here)" >&2
    exit 1
elif [[ $node_status -ne 0 ]]; then
    echo "error: node exited $node_status while parsing $MANIFEST: $manifest_entries" >&2
    exit 2
fi

sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    elif command -v openssl >/dev/null 2>&1; then
        openssl dgst -sha256 -r "$1" | awk '{print $1}'
    else
        echo "error: no sha256sum / shasum / openssl available" >&2
        exit 2
    fi
}

FAIL=0
artifact_count=0
source_count=0
declare -a MANIFEST_ARTIFACTS=()
declare -a MANIFEST_SOURCES=()

while IFS=$'\t' read -r section rel want; do
    case "$section" in
        artifacts)
            file="$COMPILED_DIR/$rel"
            kind="compiled artifact (edited directly, or stale vs a regen?)"
            artifact_count=$((artifact_count + 1))
            MANIFEST_ARTIFACTS+=("$rel")
            ;;
        sources)
            file="$SKILL_DIR/$rel"
            kind="source (changed without regenerating compiled/)"
            source_count=$((source_count + 1))
            MANIFEST_SOURCES+=("$rel")
            ;;
        *)
            continue
            ;;
    esac

    if [[ ! -f "$file" ]]; then
        echo "DRIFT: $file is listed in $MANIFEST but missing" >&2
        FAIL=1
        continue
    fi
    got="$(sha256_of "$file")"
    if [[ "$got" != "$want" ]]; then
        echo "DRIFT: $file — $kind" >&2
        echo "  manifest sha256: $want" >&2
        echo "  actual   sha256: $got" >&2
        FAIL=1
    fi
done <<< "$manifest_entries"

if [[ $artifact_count -eq 0 || $source_count -eq 0 ]]; then
    echo "error: $MANIFEST parsed with $artifact_count artifacts / $source_count sources — manifest malformed?" >&2
    exit 2
fi

# ── Key-set equality vs the generator's compile-input enumeration ─────────────
# A manifest entry that is silently DROPPED (not just stale) would otherwise
# pass every per-entry hash check above: the file it used to cover could then
# change forever without tripping this gate. So require the manifest key sets
# to equal, one-to-one, what compile-factory-context.sh enumerates:
#   sources: 3 fixed prose files + index.d.ts + one <name>.d.ts per barrel
#            module of THIS repo's index.d.ts (same derivation the generator
#            uses; the barrel itself lives in this repo, so no cross-repo read)
#   artifacts: the fixed pair the generator writes
declare -a EXPECTED_SOURCES=(
    "SKILL.md"
    "reference/extension-api.md"
    "reference/patterns.md"
    "reference/plugin-api/index.d.ts"
)
declare -a EXPECTED_ARTIFACTS=(
    "cli-chat-system-prompt.md"
    "plugin-factory-context.md"
)

INDEX_DTS="$SKILL_DIR/reference/plugin-api/index.d.ts"
skip_source_set_check=0
if [[ ! -f "$INDEX_DTS" ]]; then
    # Cannot derive the expected mirror-module set. This is drift in its own
    # right (the generator hard-requires index.d.ts); skip the set comparison
    # so its output does not mis-flag legitimate d.ts manifest entries.
    echo "DRIFT: $INDEX_DTS is missing — cannot derive the expected mirror-module source set" >&2
    FAIL=1
    skip_source_set_check=1
else
    barrel_count=0
    while IFS= read -r name; do
        EXPECTED_SOURCES+=("reference/plugin-api/$name.d.ts")
        barrel_count=$((barrel_count + 1))
    done < <(sed -n 's/^export \* from "\.\/\(.*\)";$/\1/p' "$INDEX_DTS")
    if [[ $barrel_count -eq 0 ]]; then
        # Mirrors the generator, which refuses an empty barrel outright.
        echo "error: no 'export * from \"./…\";' lines found in $INDEX_DTS — cannot derive expected source set" >&2
        exit 2
    fi
fi

if [[ $skip_source_set_check -eq 0 ]]; then
    for exp in "${EXPECTED_SOURCES[@]}"; do
        found=0
        for rel in "${MANIFEST_SOURCES[@]}"; do
            [[ "$rel" == "$exp" ]] && { found=1; break; }
        done
        if [[ $found -eq 0 ]]; then
            echo "DRIFT: manifest \"sources\" is missing \"$exp\" — a compile input is not covered by this gate" >&2
            FAIL=1
        fi
    done
    for rel in "${MANIFEST_SOURCES[@]}"; do
        found=0
        for exp in "${EXPECTED_SOURCES[@]}"; do
            [[ "$rel" == "$exp" ]] && { found=1; break; }
        done
        if [[ $found -eq 0 ]]; then
            echo "DRIFT: manifest \"sources\" lists unexpected \"$rel\" — not a compile input of compile-factory-context.sh" >&2
            FAIL=1
        fi
    done
fi

for exp in "${EXPECTED_ARTIFACTS[@]}"; do
    found=0
    for rel in "${MANIFEST_ARTIFACTS[@]}"; do
        [[ "$rel" == "$exp" ]] && { found=1; break; }
    done
    if [[ $found -eq 0 ]]; then
        echo "DRIFT: manifest \"artifacts\" is missing \"$exp\" — a generated artifact is not covered by this gate" >&2
        FAIL=1
    fi
done
for rel in "${MANIFEST_ARTIFACTS[@]}"; do
    found=0
    for exp in "${EXPECTED_ARTIFACTS[@]}"; do
        [[ "$rel" == "$exp" ]] && { found=1; break; }
    done
    if [[ $found -eq 0 ]]; then
        echo "DRIFT: manifest \"artifacts\" lists unexpected \"$rel\" — not an artifact compile-factory-context.sh writes" >&2
        FAIL=1
    fi
done

# Unaccounted files in compiled/ (anything .md the manifest does not list).
for f in "$COMPILED_DIR"/*.md; do
    [[ -e "$f" ]] || continue
    base="$(basename "$f")"
    listed=0
    for rel in "${MANIFEST_ARTIFACTS[@]}"; do
        [[ "$rel" == "$base" ]] && { listed=1; break; }
    done
    if [[ $listed -eq 0 ]]; then
        echo "DRIFT: $f exists in compiled/ but is not listed in $MANIFEST" >&2
        FAIL=1
    fi
done

if [[ $FAIL -ne 0 ]]; then
    echo "" >&2
    echo "compiled/ is stale. Regenerate from an AppOS-Desktop checkout:" >&2
    echo "  ./scripts/compile-factory-context.sh   (writes compiled/ + manifest here)" >&2
    exit 1
fi

echo "check-compiled-freshness: OK ($artifact_count artifacts, $source_count sources fresh)"
exit 0
