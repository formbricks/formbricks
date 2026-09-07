# @formbricks/emails

Email templates for Formbricks with React Email preview server.

## Purpose

This package provides email templates for visual QA and preview. It includes:

- Email templates (auth, invite, survey, general)
- Shared email UI components
- Mock translation utilities for preview
- Example data for template rendering
- Tailwind CSS for styling with full intellisense support

## Source-Consumed Package

This package is **not built**. It has no bundler, no `dist/`, and deliberately no `build` script:

- `main` and `types` both point at `src/index.ts`.
- `apps/web` imports `@formbricks/email` as TypeScript source and transpiles it in its own Next.js build.
- The `email dev` preview server also runs straight off the source files.

Two consequences worth remembering when editing this package:

- **Every runtime import must be a real `dependency`, not a `devDependency`.** A consumer that transpiles
  our source also has to resolve everything that source imports. `clsx` and `tailwind-merge` are runtime
  dependencies for exactly this reason (`src/lib/cn.ts`).
- **Type errors are caught by `pnpm typecheck`, not by a build.** The turbo `typecheck` task covers this
  package; there is no `@formbricks/email#build` entry in `turbo.json` for other tasks to wait on.

## Development

### Preview Server

Run the React Email preview server:

```bash
pnpm dev
```

Visit `localhost:3456` to preview all email templates with mock data.

### Styling

Templates are styled with Tailwind utility classes on the `<Tailwind>` component from
`@react-email/components`. There is no Tailwind build step, no PostCSS pipeline and no Tailwind config
in this package, and none is needed: `@react-email/tailwind` compiles the classes at render time and
inlines them into the email HTML.

The engine it compiles with is **Tailwind v4** (`@react-email/components` → `@react-email/tailwind`,
which depends on `tailwindcss@^4`), and `<Tailwind>` is used without a `config` prop, so the available
utilities are exactly the **default v4 theme**. Write v4: `bg-linear-to-r`, `shadow-xs`,
`inset-shadow-sm` and `text-shadow-lg` all render. The v3 spellings mostly still resolve as deprecated
aliases, but v4 re-scaled some of them — `shadow-sm` now emits what v3's plain `shadow` emitted — so
carrying v3 habits over changes the result silently.

Nothing here should pin a Tailwind version of its own. Class sorting comes from the repo-root Prettier
config, whose `prettier-plugin-tailwindcss` defaults to the same v4 theme. A package-local
`tailwindConfig` override switches the plugin to its v3 code path, which sorts by v3 rules and treats
every v4-only utility as unknown — sorting that quietly disagrees with what actually renders.

### Path Aliases

Use `@/` prefix for clean imports:

```typescript
import { FollowUpEmail } from "@/emails/survey/follow-up-email";
import { EmailTemplate } from "@/src/components/email-template";
import { mockT } from "@/src/lib/mock-translate";
```

## Usage in Production

The web app imports render helper functions from this package:

```typescript
import { renderVerificationEmail } from "@formbricks/email";

// Pass real translation function and data
const html = await renderVerificationEmail({
  verifyLink,
  verificationRequestLink,
  t, // Real i18n function from getTranslate()
});
```

For complex emails with pre-processing:

```typescript
import { renderResponseFinishedEmail } from "@formbricks/email";
import { getElementResponseMapping } from "@/lib/responses";

// Pre-process data before rendering
const elements = getElementResponseMapping(survey, response);

const html = await renderResponseFinishedEmail({
  survey,
  responseCount,
  response,
  WEBAPP_URL,
  workspaceId,
  organization,
  elements, // Pre-processed data
  t,
});
```

## Architecture

- **Preview Mode**: Templates use mock `t()` function and example data for visual QA
- **Production Mode**: Web app passes real `t()` function and pre-processed data
- **Render Functions**: Typed helper functions abstract `@react-email/render` from web app
- **No Business Logic**: SMTP, i18n, JWT, database queries, and data processing stay in web app
- **Clean Separation**: Web app processes data → Email package renders HTML
