#!/usr/bin/env bash

# Generates a single paste-ready file for https://play.authzed.com from the two files the
# repo keeps separate. The Playground wants the schema inlined under `schema:`; `zed validate`
# is happy with either, so the generated file is validated the same way as the sources and
# cannot drift from them.
#
# Run: bash authzed/next/build-playground.sh

set -euo pipefail
readonly DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCHEMA="${DIR}/candidate-a-container.zed"
readonly SUITE="${DIR}/candidate-a-validation.yaml"
readonly OUT="${DIR}/playground-candidate-a.yaml"

{
  echo "# GENERATED — do not edit. Run authzed/next/build-playground.sh after changing"
  echo "# candidate-a-container.zed or candidate-a-validation.yaml."
  echo "#"
  echo "# Paste this whole file into https://play.authzed.com (it replaces schema, test"
  echo "# relationships and assertions in one go), or open it with:  zed validate <file>"
  echo ""
  echo "schema: |-"
  sed -e 's/^/  /' -e 's/[[:space:]]*$//' "${SCHEMA}"
  echo ""
  # everything after the `schemaFile:` line, i.e. relationships + assertions + validation
  sed -n '/^relationships:/,$p' "${SUITE}"
} > "${OUT}"

printf 'wrote %s\n' "${OUT}"
