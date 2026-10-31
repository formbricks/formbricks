# Glossary

Domain terms the code and architecture reviews use. Add a term when a module is named after a concept
that is not listed here.

## Survey runtime

**Block** — One card of a survey holding one or more elements. Logic rules and a `logicFallback` hang off a block.

**Card pointer (`blockId`)** — The renderer's position in a survey: the `"start"` sentinel (welcome card), a block id while answering, an ending id once finished, or the `"end"` sentinel for a survey with no endings. Only a block id resolves against `survey.blocks`.

**Ending** — A card shown when the survey finishes. A response records the ending it finished on as `endingId`.

**Block flow** — The decision of where a respondent goes after submitting a block: the block's logic rules (first jump wins), then `logicFallback`, then the next block in order. It also covers dropping a jump target that names a deleted block or ending, and the `finished` flag and `endingId` the persisted response reports. Lives in `packages/surveys/src/lib/block-flow.ts` (`advanceFromBlock`).

**Advance** — Moving from the current block to the next card, as decided by block flow. Back navigation is separate: it follows `history`, not logic.

## Dashboards

**Feedback Dataset** — The set of Feedback Records a chart reads from. A chart reads exactly one, fixed when the chart is created. _Avoid_: feedback directory, tenant (internal names only).

**Chart** — One saved visualisation of one Feedback Dataset: a chart type, a query and display settings. It belongs to a workspace and can sit on any number of dashboards.

**Chart query** — What a chart computes: its measures, dimensions, time dimensions, filters, order and limit over its Feedback Dataset's fields. Kept apart from the chart's display settings. _Avoid_: chart spec, definition (when only the query is meant).

**Field** — A measure or dimension a chart query can use, named after its data source (`FeedbackRecords.npsScore`). The fields callers may use are the ones the field catalog lists. _Avoid_: member, column.

**Field catalog** — The published list of fields a chart query may use, with each field's kind, type, label and filter options. It is the contract: a field not in the catalog is refused.

**Date range** — The window of `collectedAt` a chart shows: a named preset (`last 7 days`), all time, or a pair of calendar dates, always read in the organization's display time zone. A date range given when reading a chart's data replaces the one saved on the chart.

**Dashboard** — A named grid of widgets in a workspace. Its charts can come from different Feedback Datasets.

**Widget** — One chart's placement on one dashboard: its position and size on the dashboard's 12-column grid, and its order. A chart sits on a dashboard at most once; removing a widget keeps the chart. User-facing copy says "chart". _Avoid_: placement, tile, panel.

**Layout** — The positions and sizes of a dashboard's widgets. Widgets may not overlap; gaps close upward when the dashboard is drawn.

**In use** — A chart is in use while it sits on at least one dashboard. A chart in use cannot be deleted; the refusal names the dashboards holding it.

## Tables and filtering

**Table toolbar** — The one control bar every list table shares: settings gear (sort, columns, show archived), search, the Filter button, filter chips, and the match count.

**Filter property** — Something a table can be filtered by, such as Status, Source or one contact attribute. Each table publishes its own filter properties; a property not published there cannot be filtered on. _Avoid_: field (a chart-query term), filter attribute, filter key, column.

**Quick filter** — A filter made by ticking values of one filter property from a list. A row matches when it has any of the ticked values.

**Filter rule** — One Advanced filter row: a filter property, an operator and a value, such as `Number value > 8`.

**Filter chip** — The visible token for one active quick filter or one filter rule. A row has to match every chip; there is no OR between chips.

**Match count** — How many rows match the active filters and search in total, not how many are loaded. Large counts may stop at a cap and read as "at least" (`10,000+`). _Avoid_: result count, loaded rows.

## Creatives

**Creative** — A page element Formbricks shows on a customer's site next to surveys (a Feedback button or a Banner), with its own content, look, display rules and schedule. It is separate from the survey it may open. _Avoid_: widget, prompt, intercept, launcher.

**Destination** — What a creative opens when pressed: a survey or a link. A Banner without a button has none. The editor labels it "On click". _Avoid_: action, on-click action, target.

**Show on** — What makes a creative appear: **Every page view** (the default) or **When an action fires**. A creative left with no action never shows; it never falls back to every page. _Avoid_: trigger mode.

**Show when** — The conditions on the page, the visit and the device that must hold for a creative to show. Surveys use the same conditions.

**Impression** — One page view on which a creative was shown. Showing it again on the same page doesn't add another; a new page (including a single-page-app route change) does. _Avoid_: view, display (a Display is a survey being shown).

**Click** — One press on a creative that opened its Destination. Dismissing a Banner is not a Click. _Avoid_: conversion, interaction.

**Wind-down** — The Creatives access level of a self-hosted workspace that still has creatives after the Enterprise license stops including Creatives: they stop showing on sites and turn read-only, and authors can still pause, close and delete them.

## Survey import and export

**Formbricks file** — A survey's content saved as a file (`.formbricks.json`) that imports into any workspace, organization or instance. It carries the questions, blocks, endings, welcome card, languages, hidden fields, variables, logic and triggers; styling, settings, follow-ups and quotas stay out. _Avoid_: JSON export, survey JSON.

**Match** — A Formbricks file whose source survey is a survey in the current workspace that the importing user can edit. Only a match offers Update; anything else becomes a new survey.

**Update** — Importing a matched Formbricks file over that survey's content. The survey keeps its ID, status, responses, settings and styling. An active survey is never updated. _Avoid_: re-import (which also covers creating a new survey), overwrite, import into existing.

**Reference** — Something a survey points at that lives outside it in its workspace: an action class a trigger uses, a contact attribute key in targeting, a shared hidden field or variable, a media file. A Formbricks file carries enough of each to find or recreate it in another workspace.

**Document import** — Importing a Word, Excel or CSV questionnaire, read with AI. Texts come across word for word; the AI decides structure, types and logic only. _Avoid_: AI import (Qualtrics import also uses AI).

**Qualtrics import** — Importing a Qualtrics export (`.qsf`), read with AI.

**Import report** — The warnings and notes an import shows before anything is created or updated: what was removed, changed or needs a check.

**Excel export** — A survey written as a spreadsheet for reviewers and translators: one row per question and option, one column per language. It is not a Formbricks file and never matches.
