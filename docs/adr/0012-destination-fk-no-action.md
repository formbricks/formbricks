# The Destination foreign key uses NoAction, not Restrict

The creative's Destination is a composite FK `[surveyId, workspaceId]` with `onDelete: NoAction` (ENG-3914). `Restrict` is checked immediately and would make cascading workspace and organization deletes fail when a linked creative exists; `NoAction` still blocks deleting the survey itself. Before the database gets that far, the app checks for linked creatives under a row lock and answers 409 listing them; archived creatives don't block the delete and are unlinked in the same transaction.

## Consequences

- A DB test must delete a workspace that contains a linked creative.
