# ghcr.io/formbricks/cube: the Cube API server and its Postgres driver on a distroless Node runtime.
# It carries no shell, package manager, Python or Cube Store. See README.md for what is left out and
# why, and for how to bump it.

# The build stage runs on the builder's own platform and only downloads files: npm is told the target
# platform and the native module is fetched for the target architecture, so a multi-arch build needs
# no emulation.
FROM --platform=$BUILDPLATFORM node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe AS build

ARG TARGETARCH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /cube
COPY package.json package-lock.json native.sha256 ./

# --ignore-scripts skips Cube Store's binary download (unused: the bundled schema has no external
# pre-aggregations and the cache and queue driver is memory) and the native module's own installer,
# which picks a Python-linked build. The Python-free build is fetched below and checked against
# native.sha256 instead.
RUN set -eu; \
  case "$TARGETARCH" in \
    amd64) arch=x64 ;; \
    arm64) arch=arm64 ;; \
    *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
  esac; \
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund --os=linux --cpu="$arch" --libc=glibc; \
  version="$(node -p 'require("@cubejs-backend/native/package.json").version')"; \
  asset="v${version}/native-linux-${arch}-glibc-fallback.tar.gz"; \
  checksum="$(awk -v asset="$asset" '$2 == asset { print $1 }' native.sha256)"; \
  if [ -z "$checksum" ]; then \
    echo "native.sha256 has no checksum for ${asset}. See \"Bumping Cube\" in README.md." >&2; \
    exit 1; \
  fi; \
  curl -fsSL --retry 3 -o /tmp/native.tar.gz "https://github.com/cube-js/cube/releases/download/${asset}"; \
  echo "${checksum}  /tmp/native.tar.gz" | sha256sum -c -; \
  tar -xzf /tmp/native.tar.gz -C node_modules/@cubejs-backend/native; \
  test -f node_modules/@cubejs-backend/native/native/index.node; \
  rm /tmp/native.tar.gz; \
  find node_modules -type f -name '*.map' -delete

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:bb6b03d81066993293a10feda7250e8e1cc034035fe9b61cfceededa7c8bf04d

LABEL org.opencontainers.image.source="https://github.com/formbricks/formbricks" \
  org.opencontainers.image.description="Cube API server for Formbricks analytics, on a distroless Node runtime"

# /nodejs/bin on PATH lets `node -e ...` healthchecks resolve `node` without a shell. NODE_PATH mirrors
# the upstream cubejs/cube image so a mounted cube.js can require Cube's own packages.
ENV NODE_ENV=production \
  NODE_PATH=/cube/conf/node_modules:/cube/node_modules \
  PATH=/nodejs/bin:/usr/local/bin:/usr/bin:/bin

COPY --from=build /cube/node_modules /cube/node_modules

WORKDIR /cube/conf
EXPOSE 4000

# The base image's entrypoint is node, so this runs `node .../server`: the same process upstream's
# `cubejs server` starts, without a shell.
CMD ["/cube/node_modules/@cubejs-backend/server/bin/server"]
