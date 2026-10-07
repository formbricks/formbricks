# Post-deployment health check. Build from the repository root:
#   docker build -f apps/deployment-check/Dockerfile -t ghcr.io/formbricks/deployment-check .
#
# The base image tag must match the `@playwright/test` entry in the pnpm catalog: the browsers baked into
# the image are only usable by that exact Playwright version.
FROM mcr.microsoft.com/playwright:v1.58.2-noble AS deps

WORKDIR /app
COPY pnpm-workspace.yaml /tmp/pnpm-workspace.yaml
COPY apps/deployment-check/package.json ./package.json
# Standalone install: resolve `catalog:` against the workspace catalog and keep runtime dependencies only,
# so the image needs no monorepo, lockfile or workspace package.
RUN node -e ' \
  const fs = require("fs"); \
  const catalog = {}; \
  let inCatalog = false; \
  for (const line of fs.readFileSync("/tmp/pnpm-workspace.yaml", "utf8").split("\n")) { \
    if (/^catalog:/.test(line)) { inCatalog = true; continue; } \
    if (inCatalog && /^\S/.test(line)) break; \
    const m = line.match(/^  "?([^":\s]+(?:\/[^":\s]+)?)"?:\s*(\S+)\s*$/); \
    if (inCatalog && m) catalog[m[1]] = m[2]; \
  } \
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); \
  for (const [name, range] of Object.entries(pkg.dependencies)) { \
    if (range === "catalog:") { \
      if (!catalog[name]) throw new Error("no catalog entry for " + name); \
      pkg.dependencies[name] = catalog[name]; \
    } \
  } \
  pkg.devDependencies = {}; \
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2)); \
' && npm install --omit=dev --no-audit --no-fund
COPY apps/deployment-check/playwright.config.ts apps/deployment-check/tsconfig.json ./
COPY apps/deployment-check/checks checks
COPY apps/deployment-check/src src

FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app
COPY --from=deps /app/ /app/
RUN mkdir /report && chown pwuser:pwuser /report

ENV REPORT_DIR=/report \
    CI=1

USER pwuser
VOLUME ["/report"]
ENTRYPOINT ["node_modules/.bin/playwright", "test"]
