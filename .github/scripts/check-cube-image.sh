#!/usr/bin/env bash
# Fails unless the Cube image that charts/formbricks/values.yaml pins can be pulled the way a self-hoster
# pulls it, without credentials.
#
# cube-image.yml publishes ghcr.io/formbricks/cube separately from the chart, and GitHub creates a new
# package as private, so a chart or release that pins a tag before it is published and made public ships an
# install whose Cube cannot start. Run it from the repository root, with `yq` on the PATH, before anything
# is built or published. Used by formbricks-release.yml and release-helm-chart.yml.
#
# docker/__tests__/formbricks-script.test.ts keeps docker/docker-compose.yml on the same tag.

set -euo pipefail

image="$(yq -r '.cube.image.repository + ":" + .cube.image.tag' charts/formbricks/values.yaml)"

# An empty config directory, so a runner's stored login cannot make a private package look public.
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG

if ! docker manifest inspect "$image" >/dev/null; then
  echo "::error::$image cannot be pulled without credentials. Publish it with cube-image.yml and make the formbricks/cube package public, then re-run." >&2
  exit 1
fi

echo "$image is publicly pullable."
