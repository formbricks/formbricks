# @formbricks/emails

Email templates for Formbricks with React Email preview server.

## Purpose

This package provides email templates for visual QA and preview. It includes:

- Email templates (auth, invite, survey, general)
- Shared email UI components
- Mock translation utilities for preview
- Example data for template rendering
- Tailwind CSS for styling with full intellisense support

## Development

### Preview Server

Run the React Email preview server:

```bash
pnpm dev
```

Visit `localhost:3456` to preview all email templates with mock data.

### Styling

The package uses Tailwind CSS via `@react-email/components`. Tailwind intellisense is configured and should work automatically in your IDE. The config files are:

- `tailwind.config.js` - Tailwind configuration for intellisense
- `postcss.config.js` - PostCSS configuration

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
  environmentId,
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
