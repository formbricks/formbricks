#!/usr/bin/env bash

# Generates paste-ready artifacts for the recommended model (candidate A).
#
# Two different consumers want two different shapes:
#
#   * `zed validate` takes ONE document with `schema:`, `relationships:`, `assertions:`
#     and `validation:` keys           -> playground-candidate-a.yaml
#   * play.authzed.com has FOUR TABS and each wants only its own fragment, un-nested
#                                      -> playground/{1..4}-*.txt
#
# Run: bash authzed/next/build-playground.sh

set -euo pipefail
readonly DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCHEMA="${DIR}/candidate-a-container.zed"
readonly SUITE="${DIR}/candidate-a-validation.yaml"
readonly COMBINED="${DIR}/playground-candidate-a.yaml"
readonly TABS="${DIR}/playground"

# --- one combined document, for `zed validate` -------------------------------------
{
  echo "# GENERATED — do not edit. Run authzed/next/build-playground.sh."
  echo "# This is the ZED VALIDATE shape (one document). For play.authzed.com use the"
  echo "# four per-tab files in authzed/next/playground/ instead — the Playground's"
  echo "# Schema tab takes raw schema text and rejects a 'schema:' key."
  echo ""
  echo "schema: |-"
  sed -e 's/^/  /' -e 's/[[:space:]]*$//' "${SCHEMA}"
  echo ""
  sed -n '/^relationships:/,$p' "${SUITE}"
} > "${COMBINED}"

# --- four fragments, one per Playground tab ----------------------------------------
mkdir -p "${TABS}"

cp "${SCHEMA}" "${TABS}/1-schema.zed"

# Relationships tab: the tuples only, no `relationships: |-` key, no indent.
sed -n '/^relationships: |-$/,/^assertions:$/p' "${SUITE}" \
  | sed -e '1d' -e '$d' -e 's/^  //' -e 's/[[:space:]]*$//' \
  | sed -e :a -e '/^\n*$/{$d;N;};/\n$/ba' > "${TABS}/2-relationships.txt"

# Assertions tab: keeps its own `assertTrue:` / `assertFalse:` root keys.
sed -n '/^assertions:$/,/^validation:$/p' "${SUITE}" \
  | sed -e '1d' -e '$d' -e 's/^  //' -e 's/[[:space:]]*$//' > "${TABS}/3-assertions.yaml"

# Expected Relations tab: the map only — the `validation:` key itself is NOT included.
sed -n '/^validation:$/,$p' "${SUITE}" \
  | sed -e '1d' -e 's/^  //' -e 's/[[:space:]]*$//' > "${TABS}/4-expected-relations.yaml"

printf 'wrote %s\n' "${COMBINED}"
printf 'wrote %s/{1-schema.zed,2-relationships.txt,3-assertions.yaml,4-expected-relations.yaml}\n' "${TABS}"
