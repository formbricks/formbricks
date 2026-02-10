# Repository Guidelines

## Project Structure & Module Organization

Formbricks runs as a pnpm/turbo monorepo. `apps/web` is the Next.js product surface, with feature modules under `app/` and `modules/`, assets in `public/` and `images/`, and Playwright specs in `apps/web/playwright/`. `apps/storybook` renders reusable UI pieces for review. Shared logic lives in `packages/*`: `database` (Prisma schemas/migrations), `surveys`, `js-core`, `types`, plus linting and TypeScript presets (`config-*`). Deployment collateral is kept in `docs/`, `docker/`, and `helm-chart/`. Unit tests sit next to their source as `*.test.ts` or inside `__tests__`.

## Build, Test & Development Commands

- `pnpm install` — install workspace dependencies pinned by `pnpm-lock.yaml`.
- `pnpm db:up` / `pnpm db:down` — start/stop the Docker services backing the app.
- `pnpm dev` — run all app and worker dev servers in parallel via Turborepo.
- `pnpm build` — generate production builds for every package and app.
- `pnpm lint` — apply the shared ESLint rules across the workspace.
- `pnpm test` / `pnpm test:coverage` — execute Vitest suites with optional coverage.
- `pnpm test:e2e` — launch the Playwright browser regression suite.
- `pnpm db:migrate:dev` — apply Prisma migrations against the dev database.

## Coding Style & Naming Conventions

TypeScript, React, and Prisma are the primary languages. Use the shared ESLint presets (`@formbricks/eslint-config`) and Prettier preset (110-char width, semicolons, double quotes, sorted import groups). Two-space indentation is standard; prefer `PascalCase` for React components and folders under `modules/`, `camelCase` for functions/variables, and `SCREAMING_SNAKE_CASE` only for constants. When adding mocks, place them inside `__mocks__` so import ordering stays stable.
We are using SonarQube to identify code smells and security hotspots.

## Architecture & Patterns

- Next.js app router lives in `apps/web/app` with route groups like `(app)` and `(auth)`. Services live in `apps/web/lib`, feature modules in `apps/web/modules`.
- Server actions wrap service calls and return `{ data }` or `{ error }` consistently.
- Context providers should guard against missing provider usage and use cleanup patterns that snapshot refs inside `useEffect` to avoid React hooks warnings

## Caching

- Use React `cache()` for request-level dedupe and `cache.withCache()` or explicit Redis for expensive data.
- Do not use Next.js `unstable_cache()`.
- Always use `createCacheKey.*` utilities for cache keys.

## i18n (Internationalization)

- All user-facing text must use the `t()` function from `react-i18next`.
- Key naming: use lowercase with dots for nesting (e.g., `common.welcome`).
- Translations are in `apps/web/locales/`. Default is `en-US.json`.
- Lingo.dev is automatically translating strings from en-US into other languages on commit. Run `pnpm i18n` to generate missing translations and validate keys.

## Database & Prisma Performance

- Multi-tenancy: All data must be scoped by Organization or Environment.
- Soft Deletion: Check for `isActive` or `deletedAt` fields; use proper filtering.
- Never use `skip`/`offset` with `prisma.response.count()`; only use `where`.
- Separate count and data queries and run in parallel (`Promise.all`).
- Prefer cursor pagination for large datasets.
- When filtering by `createdAt`, include indexed fields (e.g., `surveyId` + `createdAt`).

## Testing Guidelines

Prefer Vitest with Testing Library for logic in `.ts` files, keeping specs colocated with the code they exercise (`utility.test.ts`). Do not write tests for `.tsx` files—React components are covered by Playwright E2E tests instead. Mock network and storage boundaries through helpers from `@formbricks/*`. Run `pnpm test` before opening a PR and `pnpm test:coverage` when touching critical flows; keep coverage from regressing. End-to-end scenarios belong in `apps/web/playwright`, using descriptive filenames (`billing.spec.ts`) and tagging slow suites with `@slow` when necessary.

## Documentation (apps/docs)

- Add frontmatter with `title`, `description`, and `icon` at the top of the MDX file.
- Do not start with an H1; use Camel Case headings (only capitalize the feature name).
- Use Mintlify components for steps and callouts.
- If Enterprise-only, add the Enterprise note block described in docs.

## Storybook

- Stories live in `stories.tsx` in the component folder and import from `"./index"`.
- Use `@storybook/react-vite` and organize argTypes into `Behavior`, `Appearance`, `Content`.
- Include Default, Disabled (if supported), WithIcon (if supported), all variants, and edge cases.

## GitHub Actions

- Always set minimal `permissions` for `GITHUB_TOKEN`.
- On `ubuntu-latest`, add `step-security/harden-runner` as the first step.

## Quality Checklist

- Keep code DRY and small; remove dead code and unused imports.
- Follow React hooks rules, keep effects focused, and avoid unnecessary `useMemo`/`useCallback`.
- Prefer type inference, avoid `any`, and use shared types from `@formbricks/types`.
- Keep components focused, avoid deep nesting, and ensure basic accessibility.

## Commit & Pull Request Guidelines

Commits follow a lightweight Conventional Commit format (`fix:`, `chore:`, `feat:`) and usually append the PR number, e.g. `fix: update OpenAPI schema (#6617)`. Keep commits scoped and lint-clean. Pull requests should outline the problem, summarize the solution, and link to issues or product specs. Attach screenshots or gifs for UI-facing work, list any migrations or env changes, and paste the output of relevant commands (`pnpm test`, `pnpm lint`, `pnpm db:migrate:dev`) so reviewers can verify readiness.

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md|01-app:{04-glossary.mdx}|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-cache-components.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,public-static-pages.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,isolatedDevBuild.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackFileSystemCache.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-params.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,isolatedDevBuild.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
