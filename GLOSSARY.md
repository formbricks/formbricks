# Glossary

Domain terms the code and architecture reviews use. Add a term when a module is named after a concept
that is not listed here.

## Survey runtime

**Block** — One card of a survey holding one or more elements. Logic rules and a `logicFallback` hang off a block.

**Card pointer (`blockId`)** — The renderer's position in a survey: the `"start"` sentinel (welcome card), a block id while answering, an ending id once finished, or the `"end"` sentinel for a survey with no endings. Only a block id resolves against `survey.blocks`.

**Ending** — A card shown when the survey finishes. A response records the ending it finished on as `endingId`.

**Block flow** — The decision of where a respondent goes after submitting a block: the block's logic rules (first jump wins), then `logicFallback`, then the next block in order. It also covers dropping a jump target that names a deleted block or ending, and the `finished` flag and `endingId` the persisted response reports. Lives in `packages/surveys/src/lib/block-flow.ts` (`advanceFromBlock`).

**Advance** — Moving from the current block to the next card, as decided by block flow. Back navigation is separate: it follows `history`, not logic.

## Feedback queries

**Feedback Dataset** — The set of Feedback Records a query reads from. A query reads exactly one. _Avoid_: feedback directory, tenant (internal names only).

**Feedback query** — What an agent asks of a Feedback Dataset: its measures, dimensions, time dimensions, filters, order and limit, written over the dataset's fields. Read-only. _Avoid_: chart query, chart spec.

**Field** — A measure or dimension a feedback query can use, named after its data source (`FeedbackRecords.npsScore`). The fields callers may use are the ones the field catalog lists. _Avoid_: member, column.

**Field catalog** — The published list of fields a feedback query may use, with each field's kind, type, label and filter options. It is the contract: a field not in the catalog is refused.

**Date range** — The window of `collectedAt` a feedback query covers: a named preset (`last 7 days`), all time, or a pair of calendar dates, always read in the organization's display time zone.

## Creatives

**Creative** — A page element Formbricks shows on a customer's site next to surveys (a Feedback button or a Banner), with its own content, look, display rules and schedule. It is separate from the survey it may open. _Avoid_: widget, prompt, intercept, launcher.

**Destination** — What a creative opens when pressed: a survey or a link. A Banner without a button has none. The editor labels it "On click". _Avoid_: action, on-click action, target.

**Show on** — What makes a creative appear: **Every page view** (the default) or **When an action fires**. A creative left with no action never shows; it never falls back to every page. _Avoid_: trigger mode.

**Show when** — The conditions on the page, the visit and the device that must hold for a creative to show. Surveys use the same conditions.

**Impression** — One page view on which a creative was shown. Showing it again on the same page doesn't add another; a new page (including a single-page-app route change) does. _Avoid_: view, display (a Display is a survey being shown).

**Click** — One press on a creative that opened its Destination. Dismissing a Banner is not a Click. _Avoid_: conversion, interaction.

**Wind-down** — The Creatives access level of a self-hosted workspace that still has creatives after the Enterprise license stops including Creatives: they stop showing on sites and turn read-only, and authors can still pause, close and delete them.

## Agent platform

**Agent** — An AI client such as Claude, Codex or Cursor that acts on a person's behalf through the MCP server or the v3 API. _Avoid_: bot, assistant, integration.

**Agent connection** — One grant by which an agent acts in a workspace: an OAuth consent or an API key, limited to the scopes it was given. _Avoid_: token, app, client.

**Scope** — A read or write permission over one resource family that an agent connection holds.

**Document** — The canonical JSON form of a survey, creative or workflow that an agent can pull, edit and push back. _Avoid_: export, config, spec.

**Pull** — An agent reading a resource as a Document.

**Push** — An agent writing a Document onto a live resource. It applies directly, is refused if the resource changed since the Document was pulled, and is recorded in the audit log. _Avoid_: import, sync, deploy.

**Account shell** — The few human screens left: sign-up and login, organization management, connecting an agent, creating agent connections, and OAuth consent. Everything else is done by an agent. _Avoid_: dashboard, app.
