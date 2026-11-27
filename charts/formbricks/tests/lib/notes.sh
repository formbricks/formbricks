#!/usr/bin/env bash
# Renders the chart's NOTES.txt without a cluster, for the chart tests that assert on it. Source it, then call
# `build_notes_chart <dir>` once and `render_notes <release> [helm args...]` per case. Expects CHART_DIR and
# COMMON_ARGS to be set by the caller.
#
# `helm template` deliberately omits NOTES.txt, while Helm 3.15 still contacts Kubernetes during a dry-run
# install. Evaluate the real notes through `tpl` in a minimal ConfigMap chart so the contract stays clusterless
# and release-accurate across supported Helm versions.

build_notes_chart() {
  NOTES_CHART="$1/notes-chart"
  mkdir -p "${NOTES_CHART}/charts" "${NOTES_CHART}/templates"
  cp "${CHART_DIR}/Chart.yaml" "${NOTES_CHART}/Chart.yaml"
  cp "${CHART_DIR}"/charts/*.tgz "${NOTES_CHART}/charts/"
  cp "${CHART_DIR}/values.yaml" "${NOTES_CHART}/values.yaml"
  cp "${CHART_DIR}/templates/_helpers.tpl" "${NOTES_CHART}/templates/_helpers.tpl"
  cp "${CHART_DIR}/templates/NOTES.txt" "${NOTES_CHART}/notes.txt"
  printf '%s\n' \
    'apiVersion: v1' \
    'kind: ConfigMap' \
    'metadata:' \
    '  name: notes-contract' \
    'data:' \
    '  notes: |' \
    '{{ tpl (.Files.Get "notes.txt") . | nindent 4 }}' >"${NOTES_CHART}/templates/notes.yaml"
}

render_notes() {
  local release_name="$1"
  shift

  helm template "${release_name}" "${NOTES_CHART}" --namespace qa "${COMMON_ARGS[@]}" "$@" \
    --show-only templates/notes.yaml \
    | sed -n '/^  notes: |/,$p' \
    | sed '1d; s/^    //'
}
