#!/usr/bin/env bash
# Runs the labels.sps of an unzipped Analysis export through PSPP (Debian `pspp` in Docker) and prints
# DISPLAY DICTIONARY, MRSETS /DISPLAY, LIST and FREQUENCIES. A manual check, not part of CI.
#
#   scripts/validate-analysis-export-spss.sh <unzipped export folder> [variables for FREQUENCIES]
#
# What it can and cannot tell you (ENG-6791):
# - PSPP has no ALTER TYPE. That one command is rewritten to RENAME VARIABLES + NUMERIC + COMPUTE
#   NUMBER(...) + DELETE VARIABLES, which reads the same text the same way. The "Cannot parse" errors it
#   prints for UNMAPPED cells are the warnings SPSS gives for the same cells.
# - It cannot check how real SPSS treats the byte order mark or its warning limit (SET MXWARNS).
#   Ask a customer who analyses in SPSS to run a staging export in real SPSS before launch.
set -euo pipefail

if [[ $# -lt 1 || ! -f "$1/labels.sps" ]]; then
  echo "usage: $0 <folder with the unzipped export (labels.sps inside)> [variables for FREQUENCIES]" >&2
  exit 2
fi

readonly DIR="$(cd -- "$1" && pwd)"
readonly VARIABLES="${2:-language outcome}"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# Point the CD line (the analyst edits it) at the mount, drop the byte order mark of the first line, and
# swap ALTER TYPE for what PSPP can run.
sed -E \
  -e "s#^CD '.*'\.#CD '/export'.#" \
  -e '1s/^\xEF\xBB\xBF//' \
  -e 's#^ALTER TYPE ([A-Za-z0-9_.@$\#]+) \((F[0-9]+\.[0-9]+)\)\.#RENAME VARIABLES (\1 = \1_t_).\nNUMERIC \1 (\2).\nCOMPUTE \1 = NUMBER(\1_t_, \2).\nDELETE VARIABLES \1_t_.#' \
  "${DIR}/labels.sps" >"${WORK}/run.sps"

cat >>"${WORK}/run.sps" <<EOF
DISPLAY DICTIONARY.
MRSETS /DISPLAY NAME=ALL.
LIST.
FREQUENCIES VARIABLES=${VARIABLES}.
EOF

docker run --rm -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 \
  -v "${DIR}":/export:ro -v "${WORK}":/work:ro \
  debian:bookworm-slim \
  sh -c 'apt-get update -qq >/dev/null && apt-get install -y -qq pspp >/dev/null 2>&1 && pspp -O format=csv /work/run.sps'
