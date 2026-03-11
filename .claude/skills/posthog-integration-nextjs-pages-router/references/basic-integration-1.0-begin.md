---
title: PostHog Setup - Begin
description: Start the event tracking setup process by analyzing the project and creating an event tracking plan
---

We're making an event tracking plan for this project.

Before proceeding, find any existing `posthog.capture()` code. Make note of event name formatting.

From the project's file list, select between 10 and 15 files that might have interesting business value for event tracking, especially conversion and churn events. Also look for additional files related to login that could be used for identifying users, along with error handling. Read the files. If a file is already well-covered by PostHog events, replace it with another option. Do not spawn subagents.

Look for opportunities to track client-side events.

**IMPORTANT: Server-side events are REQUIRED** if the project includes any instrumentable server-side code. If the project has API routes (e.g., `app/api/**/route.ts`) or Server Actions, you MUST include server-side events for critical business operations like:

  - Payment/checkout completion
  - Webhook handlers
  - Authentication endpoints

Do not skip server-side events - they capture actions that cannot be tracked client-side.

Create a new file with a JSON array at the root of the project: .posthog-events.json. It should include one object for each event we want to add: event name, event description, and the file path we want to place the event in. If events already exist, don't duplicate them; supplement them.

Track actions only, not pageviews. These can be captured automatically. Exceptions can be made for "viewed"-type events that correspond to the top of a conversion funnel.

As you review files, make an internal note of opportunities to identify users and catch errors. We'll need them for the next step.

## Status

Before beginning a phase of the setup, you will send a status message with the exact prefix '[STATUS]', as in:

[STATUS] Checking project structure.

Status to report in this phase:

- Checking project structure
- Verifying PostHog dependencies
- Generating events based on project


---

**Upon completion, continue with:** [basic-integration-1.1-edit.md](basic-integration-1.1-edit.md)