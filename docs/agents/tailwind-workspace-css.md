# Tailwind and workspace package CSS

Read this when a utility class used only inside a `@formbricks/*` workspace package does not appear in
the app's stylesheet, or when you consume a workspace package as raw source for its styling.

Tailwind v4 detects sources starting from the consuming app's own root (`apps/web` for the Next.js
PostCSS build, the Vite root for `apps/storybook`) and **never descends into `node_modules`** — which
is exactly where every `@formbricks/*` workspace package is linked. A utility used only inside a
workspace package therefore never reaches the consuming app's stylesheet. Consumed workspace packages
ship their own CSS rather than relying on the app to scan them:

- `@formbricks/surveys` — prebuilt bundle served from `apps/web/public/js/` (see the section above).
- `@formbricks/survey-ui` — exports `./styles` (`dist/survey-ui.css`), scoped to `#fbjs`.
- `@formbricks/email` — ships no stylesheet at all; `react-email`'s `Tailwind` component compiles and
  inlines the classes into the email HTML at render time.

If you ever consume a workspace package as raw source **for its styling**, the app has to be told
about that package's files explicitly — detection stops at the app's own root, so nothing else will
pick them up. `apps/storybook` is the worked example: it consumes `packages/survey-ui` as raw source
(its `stories` glob loads `packages/survey-ui/src/**` directly, and Vite aliases the package specifier
to that same source), and it works because `apps/storybook/src/index.css` imports **survey-ui's own
stylesheet**, which carries the `@config` and `@source` covering `packages/survey-ui/src/**` — those
resolve relative to survey-ui's file, so the package declares its own coverage and the app just pulls
it in. Prefer that: let the package own its globs. Only write an `@source` in the app entry when the
files are the app's own (as `index.css` does for `.storybook/**` and `src/**`).

Tailwind is configured CSS-first everywhere. Only two JS/TS Tailwind configs remain
(`packages/survey-ui/tailwind.config.ts` and `packages/surveys/tailwind.config.cjs`) and both are
reached through an explicit `@config` bridge from the package's own stylesheet. Do not add a
`tailwind.config.js` that nothing `@config`s — Tailwind v4 will not load it, and it will silently rot.
