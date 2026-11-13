# Glossary

Domain terms the code and architecture reviews use. Only terms specific to Formbricks belong here: no general
programming or UI concepts, and no implementation details.

## Tenancy

**Workspace** — The tenant unit inside an organization: surveys, contacts, API key permissions and stored files belong to exactly one. Until Formbricks 5 it was split into a project and its environments; `environmentId` survives only as the legacy id that the client API, old SDKs and old storage keys still accept. _Avoid_: environment, project.

## Survey runtime

**Display** — One showing of a survey to a respondent, whether or not they answer it.

**Block** — One card of a survey holding one or more elements. Logic rules and a fallback hang off a block.

**Element** — One input inside a block, which the editor calls a question. Its `id` (the editor's "Question ID") is the key responses are stored under, so it never changes once a survey is published.

**Question code** — The readable name an element exposes to the outside: webhook payloads, prefill links (`?<questionCode>=…`) and start-at links. It is the editor's "Variable name". Integrations key on it rather than on the element id (ENG-3885). _Avoid_: question ID (when the public name is meant).

**Choice id** — The stable id of one option of a choice element. Responses, filters, charts and Hub records store and compare it, never the label, whose text differs per language.

**Default language** — A survey's fallback language. Its strings sit under the `default` key of every translated string, not under its own code; other languages sit under canonical BCP-47 tags (`de-DE`), and a bare or mis-cased code is normalized with `normalizeLanguageCode` (`@formbricks/i18n-utils`).

**Signature element** — An element where the respondent signs, by drawing or by typing their name, and the owner gets the signature as one image with the response. UI copy says "Signature". _Avoid_ (in code and domain talk): signature question, signature field, e-signature (it carries no legal-signature claim).

**Signed** — A Signature element is signed when the tab the respondent is on holds a signature: a drawn stroke of minimum length on Draw, or a name containing at least one letter, number or symbol on Type. A bare tap, an empty name, or a name of only spaces or punctuation does not count, and the other tab's input is kept but does not count. Clearing makes it not signed again. Logic conditions read "is signed" / "is not signed".

**Ending** — A card shown when the survey finishes. A response records the ending it finished on.

**Block flow** — The decision of where a respondent goes after submitting a block: the block's logic rules (first jump wins), then the block's fallback, then the next block in order. A jump to a deleted block or ending is ignored. Going back does not follow block flow: it retraces the respondent's path.

**Show-if** — A condition that decides whether a respondent sees a block, an element, a choice, or a matrix row or column. An item whose show-if fails is not shown, which is different from shown and skipped. _Avoid_: display logic, visibility rule, conditional display.

**Hidden option** — A choice, matrix row or matrix column retired on a live survey instead of deleted: never shown again, keeping its id and earlier answers. It is not a show-if that never matches. _Avoid_: deleted option, disabled option.

**Not shown** — What a respondent never saw because of a show-if, a hidden option, or a question left with no options. Recorded on the response while they answer, never worked out later from the current rules. A question passed over is skipped, and one never reached is a drop-off; neither is not shown. _Avoid_: skipped (for hidden items), hidden (for responses).

**Copied options** — The options of a question copied from an earlier question, keeping their ids and answer codes, each shown only if it was picked in the source. Native carry-forward lists are a different, later feature. _Avoid_: carry-forward list, piped options.

**Start logic** — The rules that run before the respondent sees the first block: they can screen out to an ending, jump, or set a value. The editor labels it "Before the first question". _Avoid_: pre-qualification logic, pre-Q1 logic.

**Set value** — The rule action that writes a computed Embedded Data field from a fixed value, an answer, another field or an expression. The editor names it "Set value" whether or not the rule has a condition; a rule with none reads "Always". _Avoid_: assign, variable update, calculation, "Set a value".

**Expression** — A formula a Set value computes from answers, Embedded Data fields and fixed values, using arithmetic and a fixed list of functions. A rule's conditions never contain one. _Avoid_: formula, script.

## Dashboards

**Feedback Record** — One piece of feedback in the normalized store behind Unify Feedback, whatever source it came from.

**Feedback Dataset** — The set of Feedback Records a chart reads from. A chart reads exactly one, fixed when the chart is created. _Avoid_: feedback directory, tenant (internal names only).

**Chart** — One saved visualisation of one Feedback Dataset: a chart type, a query and display settings. It belongs to a workspace and can sit on any number of dashboards.

**Chart query** — What a chart computes: its measures, dimensions, time dimensions, filters, order and limit over its Feedback Dataset's fields. Kept apart from the chart's display settings. _Avoid_: chart spec, definition (when only the query is meant).

**Field** — A measure or dimension a chart query can use, such as NPS score. The fields callers may use are the ones the field catalog lists. _Avoid_: member, column.

**Field catalog** — The published list of fields a chart query may use, with each field's kind, type, label and filter options. A field not in the catalog is refused.

**Date range** — The window of collection dates a chart shows: a named preset (`last 7 days`), all time, or a pair of calendar dates, always read in the organization's display time zone. A date range given when reading a chart's data replaces the one saved on the chart.

**Answer filter** — A chart filter rule on how the same submission answered another question in the chart's Feedback Dataset, such as "NPS where Delivery is Late". A submission that skipped that question never matches, not even an "is not" rule. _Avoid_: sibling filter, response-wide filter.

**Dashboard** — A named grid of widgets in a workspace. Its charts can come from different Feedback Datasets.

**Widget** — One chart's placement on one dashboard: its position, size and order. A chart sits on a dashboard at most once; removing a widget keeps the chart. User-facing copy says "chart". _Avoid_: placement, tile, panel.

**Dashboard filter** — A filter on one field and operator that a dashboard's editors pin to the dashboard's top bar, shared by everyone who opens it. Each person picks or enters its value (their **filter pick**, kept in their own browser); the pick applies to every chart on the dashboard and only ever narrows what a chart's own saved filters let through, never widens it. A chart whose Feedback Dataset lacks the field shows no data and says it cannot be filtered by it. _Avoid_: global filter, slicer.

**Dashboard viewer** — An organization role that can only read the dashboards of the workspaces its teams are granted, and pick values in their dashboard filters. It never sees surveys, responses, contacts or Feedback Records, and never runs a chart query of its own: only the saved charts on dashboards it can see. _Avoid_: viewer, read-only member (a Member on a read team still sees raw data).

## Tables and filtering

**Filter property** — Something a table can be filtered by, such as Status, Source or one contact attribute. Each table publishes its own filter properties; a property not published there cannot be filtered on. _Avoid_: field (a chart-query term), filter attribute, filter key, column.

**Quick filter** — A filter made by ticking values of one filter property from a list. A row matches when it has any of the ticked values.

**Filter rule** — One Advanced filter row: a filter property, an operator and a value, such as `Number value > 8`.

**Filter chip** — The visible token for one active quick filter or one filter rule. A row has to match every chip; there is no OR between chips.

**Match count** — How many rows match the active filters and search in total, not how many are loaded. Large counts may stop at a cap and read as "at least". _Avoid_: result count, loaded rows.

## Creatives

**Creative** — A page element Formbricks shows on a customer's site next to surveys (a Feedback button or a Banner), with its own content, look, display rules and schedule. It is separate from the survey it may open. _Avoid_: widget, prompt, intercept, launcher.

**Destination** — What a creative opens when pressed: a survey or a link. A Banner without a button has none. The editor labels it "On click". _Avoid_: action, on-click action, target.

**Show on** — What makes a creative appear: **Every page view** (the default) or **When an action fires**. A creative left with no action never shows; it never falls back to every page. _Avoid_: trigger mode.

**Show when** — The conditions on the page, the visit and the device that must hold for a creative to show. Surveys use the same conditions.

**Impression** — One page view on which a creative was shown. Showing it again on the same page doesn't add another; a new page (including a single-page-app route change) does. _Avoid_: view, display (a Display is a survey being shown).

**Click** — One press on a creative that opened its Destination. Dismissing a Banner is not a Click. _Avoid_: conversion, interaction.

**Wind-down** — The Creatives access level of a self-hosted workspace that still has creatives after the Enterprise license stops including Creatives: they stop showing on sites and turn read-only, and authors can still pause, close and delete them.

## Recoding and exports

**Question code** — The short name a question carries in exported data and in webhooks, prefill and start-at links, such as `q1`. Set automatically, editable until the survey is published. It starts with a lowercase letter, then lowercase letters, digits and `_`, and is unique in the survey across question codes and Embedded Data names. _Avoid_: variable name, question number.

**Answer code** — The short code of one answer option, or one matrix row or column, such as `1` or `98`. Defaults to 1…n, may use lowercase letters, digits and `_`, is unique within its question and is never reused. Scale questions (NPS, rating, CSAT, CES) use their number instead. The editor section that holds them is labelled "Recode". _Avoid_: option code, value.

**Question ID** — The generated, read-only key of a question. Responses are stored under it, and links and the API accept it next to the question code. **Option ID** is the same for an answer option. _Avoid_: element id in user-facing copy.

**Published** — A survey that has left draft: active, paused or completed. From then on its question codes, answer codes, question types and option text are locked, and an option that existed at launch cannot be deleted. A scheduled survey counts as published once scheduled.

**Standard export** — Today's CSV or Excel file, which the export modal's default settings reproduce unchanged.

**Analysis export** — Any export that is not the Standard export: codes for questions or answers, any analysis option, or an SPSS syntax file. It leaves Low quality responses out by default.

**Datamap** — The codebook that comes with an Analysis export: one row per column and per answer code, with the question text, type and labels.

**Unmapped value** — An answer that matches no option of its question. An Analysis export keeps it as given and lists it, instead of coding it or counting it as Other.

**Outcome** — The single status of a response. It is empty unless a reviewer or a survey rule sets one; Low quality is the only value for now.

**Low quality** — The outcome of a response that should not count. A reviewer or a survey rule sets it, only a reviewer undoes it, nothing is deleted, and the response drops out of the Analysis export and of Dashboards. _Avoid_: rejected, deleted.

## Survey import and export

**Formbricks file** — A survey's content saved as a file (`.formbricks.json`) that imports into any workspace, organization or instance. It carries the questions, blocks, endings, welcome card, languages, hidden fields, variables, logic and triggers; styling, settings, follow-ups and quotas stay out. _Avoid_: JSON export, survey JSON.

**Match** — A Formbricks file whose source survey is a survey in the current workspace that the importing user can edit. Only a match offers Update; anything else becomes a new survey.

**Update** — Importing a matched Formbricks file over that survey's content. The survey keeps its ID, status, responses, settings and styling. An active survey is never updated. _Avoid_: re-import (which also covers creating a new survey), overwrite, import into existing.

**Reference** — Something a survey points at that lives outside it in its workspace: an action class a trigger uses, a contact attribute key in targeting, a shared hidden field or variable. A Formbricks file carries enough of each to find or recreate it in another workspace. Media is not a reference: the file keeps only a link to each image or video on the source instance (ENG-3401).

**Document import** — Importing a Word, Excel or CSV questionnaire, read with AI. Texts come across word for word; the AI decides structure, types and logic only. _Avoid_: AI import (Qualtrics import also uses AI).

**Qualtrics import** — Importing a Qualtrics export (`.qsf`), read with AI.

**Import report** — The warnings and notes an import shows before anything is created or updated: what was removed, changed or needs a check.

**Excel export** — A survey written as a spreadsheet for reviewers and translators: one row per question and option, one column per language. It is not a Formbricks file and never matches.
