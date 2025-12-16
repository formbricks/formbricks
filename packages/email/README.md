# @formbricks/emails

Email templates for Formbricks with React Email preview server.

## Purpose

This package provides email templates for visual QA and preview. It includes:

- Email templates (auth, invite, survey, general)
- Shared email UI components
- Mock translation utilities for preview
- Example data for template rendering

## Development

Run the React Email preview server:

```bash
pnpm dev
```

Visit `localhost:3456` to preview all email templates with mock data.

## Usage in Production

The web app imports templates from this package:

```typescript
import { VerificationEmail } from "@formbricks/emails";

// Pass real translation function and data
const html = await render(
  await VerificationEmail({
    verifyLink,
    verificationRequestLink,
    t, // Real i18n function
  })
);
```

## Architecture

- **Preview Mode**: Templates use mock `t()` function and example data
- **Production Mode**: Web app passes real `t()` function and actual data
- **No Business Logic**: SMTP, i18n, JWT, and database logic remain in web app
