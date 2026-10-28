---
status: proposed
---

# Render interactive views inside the agent with MCP Apps

Six tools render a view in the user's agent through the MCP Apps extension (`io.modelcontextprotocol/ui`, specification 2026-01-26): a survey preview with a live try-it, a change review that gates `push_document`, a feedback chart, a response browser, a creative preview and a workflow viewer. The views are a viewer, preview and approval surface and never a second editor: changes are still made by asking the agent, which keeps ADR 0015's rule that there is one path for changes. This reopens the "read-only results view" that ADR 0015 rejected for the web app, but inside the agent and without a UI of ours to keep.

## Considered Options

- **Return JSON only and let the client draw something.** Rejected: a survey cannot be reviewed or tried from JSON, and people approve what they can see.
- **Iframe the hosted survey page for the preview.** Rejected: drafts are not served there, and hosts block nested frames by default. The preview loads the same renderer script respondents use, from the deployment, inside the view.
- **Inline the 880 kB survey renderer into the view.** Rejected for size; the one declared `resourceDomains` entry is cheaper and always matches the deployed renderer.
- **A second tool per view that takes its own data.** Rejected: each render tool calls the same v3 operation as its plain sibling, so authorization, tenancy and limits are decided once.
- **Implement the postMessage protocol by hand** to shrink the views (about 600 kB each). Rejected: the official `App` class tracks the specification, and a view that drifts from the host dialect fails silently.

## Consequences

- A new workspace package, `@formbricks/mcp-views`, builds one HTML file per view; `apps/web/modules/mcp/apps` serves them and links the tools. Handbook: "Interactive views (MCP Apps)".
- A client that does not support MCP Apps gets each tool's text and JSON result, so no tool depends on its view. Tools carry the nested `_meta.ui.resourceUri` plus the deprecated flat key and ChatGPT's alias until the specification drops the flat key.
- The approve button in the change review is the only mutation a view can start. It reuses the exact reviewed arguments, adds `confirmDestructive` only after an explicit tick, and the server re-checks scope, staleness and confirmation, so the view is not a trust boundary.
- A view never puts workspace-authored text (names, headlines, answers) into a message it sends to the agent, only ids and what the person typed; response rows travel in `_meta`, which hosts keep from the model.
- The views were exercised in a small dev host, not in Claude, ChatGPT or VS Code; a pass in each is still needed before anyone relies on them.
