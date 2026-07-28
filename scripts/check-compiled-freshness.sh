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
# (unaccounted drift).
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
ENTRY_RE='"([^"]+)": "([0-9a-f]{64})"'
section=""
artifact_count=0
source_count=0
declare -a MANIFEST_ARTIFACTS=()

while IFS= read -r line; do
    case "$line" in
        *'"artifacts": {'*) section="artifacts"; continue ;;
        *'"sources": {'*)   section="sources";   continue ;;
    esac
    [[ "$line" =~ $ENTRY_RE ]] || continue
    rel="${BASH_REMATCH[1]}"
    want="${BASH_REMATCH[2]}"

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
done < "$MANIFEST"

if [[ $artifact_count -eq 0 || $source_count -eq 0 ]]; then
    echo "error: $MANIFEST parsed with $artifact_count artifacts / $source_count sources — manifest malformed?" >&2
    exit 2
fi

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
