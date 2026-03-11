---
title: PostHog Setup - Edit
description: Implement PostHog event tracking in the identified files, following best practices and the example project
---

For each of the files and events noted in .posthog-events.json, make edits to capture events using PostHog. Make sure to set up any helper files needed. Carefully examine the included example project code: your implementation should match it as closely as possible. Do not spawn subagents.

Use environment variables for PostHog keys. Do not hardcode PostHog keys.

If a file already has existing integration code for other tools or services, don't overwrite or remove that code. Place PostHog code below it.

For each event, add useful properties, and use your access to the PostHog source code to ensure correctness. You also have access to documentation about creating new events with PostHog. Consider this documentation carefully and follow it closely before adding events. Your integration should be based on documented best practices. Carefully consider how the user project's framework version may impact the correct PostHog integration approach.

Remember that you can find the source code for any dependency in the node_modules directory. This may be necessary to properly populate property names. There are also example project code files available via the PostHog MCP; use these for reference.

Where possible, add calls for PostHog's identify() function on the client side upon events like logins and signups. Use the contents of login and signup forms to identify users on submit. If there is server-side code, pass the client-side session and distinct ID to the server-side code to identify the user. On the server side, make sure events have a matching distinct ID where relevant. 

It's essential to do this in both client code and server code, so that user behavior from both domains is easy to correlate.

You should also add PostHog exception capture error tracking to these files where relevant.

Remember: Do not alter the fundamental architecture of existing files. Make your additions minimal and targeted.

Remember the documentation and example project resources you were provided at the beginning. Read them now.

## Status

Status to report in this phase:

- Inserting PostHog capture code
- A status message for each file whose edits you are planning, including a high level summary of changes
- A status message for each file you have edited


---

**Upon completion, continue with:** [basic-integration-1.2-revise.md](basic-integration-1.2-revise.md)