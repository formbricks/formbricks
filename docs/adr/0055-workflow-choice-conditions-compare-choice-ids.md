# Workflow conditions on a choice question compare choice ids

An If/else condition or Switch case on a single or multi select question's answer (`response.<questionId>`) stores the picked choices by id, `{ "choiceIds": [...] }`, and the runner compares them the way survey logic does (ADR 0046). A response stores a choice answer as its label in the respondent's language, so the runner first maps the answer back to choice ids: the label in the response's language, then a label in any of the survey's languages, and an answer that matches no choice is `other` when the question offers "Other". `equals` and `doesNotEqual` take exactly one id; the list operators take one or more. The If/else and Switch panels offer the question's choices in a dropdown, as the survey flow editor does, and summaries show each choice by its label.

Until now the panels had a text field, so a condition compared the stored label with whatever was typed. It never matched a respondent who answered in another language ("Einfach" against "Basic"), and it stopped matching when the choice was renamed. Survey logic already avoids both by comparing ids.

## Considered Options

- **Keep typing the value**: no work, but wrong for multilingual surveys and renamed choices.
- **A dropdown of the choices, stored as the label**: looks like the flow editor and is UI only, but fails in the same two cases.

## Consequences

- A condition's `right` gains a fourth shape, `WorkflowChoiceIds`, in the definition schema, API v3 and MCP. It is additive: conditions with typed labels keep working as before, and the panel keeps showing a typed label until a choice is picked.
- Saving refuses choice ids unless the Variable is `response.<questionId>`. Enabling doesn't check that the question still exists or is still a choice question: like survey logic, a deleted question has no answer to compare, so `equals` is false.
- A run without a survey response (a Webhook run) has no choice answers, so such a condition compares an empty answer.
- Changing a Switch's Variable clears picked choices, since they belong to the question it compared.
