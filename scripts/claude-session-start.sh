#!/usr/bin/env bash
# Claude Code SessionStart hook.
#
# Prepares a checkout so tests, linters and `pnpm db:up` work right away, in a
# plain local clone, in a git worktree, and in a cloud session. Every step is
# idempotent and cheap once a checkout is prepared, so re-running on resume is
# nearly free.
#
# Cloud sessions start dockerd here rather than in the cloud environment's setup
# script: that script only runs while the environment cache is being built, and
# the cache is a filesystem snapshot, so it keeps installed files but not
# running processes.
#
# Never exits non-zero: a broken checkout should still give you a session.

set -uo pipefail

REPO_ROOT="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "${REPO_ROOT}" ]]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
fi
cd "${REPO_ROOT}" 2>/dev/null || exit 0

log() {
  printf 'session-start: %s\n' "$1"
}

# A fresh worktree has no .env of its own. Every worktree on a machine talks to
# the same docker-compose Postgres, so generating a fresh ENCRYPTION_KEY here
# would leave rows written by another checkout undecryptable. Copy the main
# worktree's .env when there is one; scripts/setup-dev-env.sh then fills in
# whatever is still missing, and leaves an existing .env alone.
prepare_env_file() {
  if [[ ! -f .env ]]; then
    local main_root
    main_root="$(git worktree list --porcelain 2>/dev/null |
      awk 'NR == 1 && /^worktree /{ print substr($0, 10) }')"

    if [[ -n "${main_root}" && "${main_root}" != "${REPO_ROOT}" && -f "${main_root}/.env" ]]; then
      cp "${main_root}/.env" .env && log "seeded .env from ${main_root}"
    fi
  fi

  # Called directly rather than through `pnpm dev:setup`: booting pnpm costs
  # about a minute on a cold VM, and this step must not pay that when there is
  # nothing to install.
  if [[ -f scripts/setup-dev-env.sh ]]; then
    bash scripts/setup-dev-env.sh >/dev/null 2>&1 ||
      log "scripts/setup-dev-env.sh failed - run 'pnpm dev:setup' manually"
  fi
}

# pnpm links from a global store, so a worktree's install is mostly symlinks,
# but each worktree still needs its own node_modules.
#
# Staleness is tracked with a hash of the lockfile rather than mtimes: a cloud
# session restores node_modules from the environment cache and then clones the
# repo on top, which leaves the lockfile newer than node_modules every time and
# would reinstall on every session start.
install_dependencies() {
  local lock_hash marker="node_modules/.formbricks-lock-hash"

  lock_hash="$(git hash-object pnpm-lock.yaml 2>/dev/null || cksum pnpm-lock.yaml)"

  if [[ -d node_modules && -n "${lock_hash}" && -f "${marker}" ]] &&
    [[ "$(cat "${marker}" 2>/dev/null)" == "${lock_hash}" ]]; then
    return 0
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi

  log "installing dependencies"
  if pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1; then
    printf '%s\n' "${lock_hash}" >"${marker}" 2>/dev/null || true
  else
    log "pnpm install failed - run 'pnpm install' manually"
  fi
}

# apps/web resolves @formbricks/* through each package's dist/, so vitest cannot
# even load a suite in a checkout where the packages have never been built.
# Turbo decides what actually needs rebuilding; a warm cache costs a second or
# two, a cold one about a minute.
build_workspace_packages() {
  # Any package's dist would do as the cold-build sentinel; this one is imported
  # widely enough that its absence always means a cold cache.
  [[ -d packages/logger/dist ]] || log "building workspace packages (first run, takes a minute)"

  pnpm turbo run build --filter='./packages/*' >/dev/null 2>&1 ||
    log "workspace package build failed - run 'pnpm build' manually"
}

# Cloud only. On a developer machine the Docker daemon is the developer's
# business, and dockerd is not ours to start.
start_docker_daemon() {
  [[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || return 0
  docker info >/dev/null 2>&1 && return 0
  command -v dockerd >/dev/null 2>&1 || return 0

  dockerd >/var/log/dockerd.log 2>&1 &

  for _ in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
      log "dockerd started"
      return 0
    fi
    sleep 1
  done

  log "dockerd did not start - see /var/log/dockerd.log"
}

prepare_env_file
install_dependencies
build_workspace_packages
start_docker_daemon

exit 0
