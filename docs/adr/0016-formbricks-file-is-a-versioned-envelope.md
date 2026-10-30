# The Formbricks file is a versioned envelope, not the v3 survey document

A Formbricks file wraps the survey in an envelope with its own integer `format`, the source survey's id and `updatedAt`, and a `references` section that embeds what the survey points at outside itself (action classes, attribute keys, shared embedded-data fields). The v3 survey document is still a private beta that can change without notice, and a file has to keep importing after it does: the importer reads every format up to the current one through explicit upgrade steps and refuses newer ones. The `survey` part is the v3 *create* body, not the GET body, so the file never carries server-owned fields that create refuses and an AI assistant editing it can't trip over them. Matching for Update goes by the source survey id alone; the source instance URL is left out because it adds nothing to the match and leaks internal hostnames into files customers paste into chat assistants.

## Consequences

- References are matched by natural key in the target (action class key or no-code config, attribute key, embedded-data key) and created only when missing, inside the same transaction as the survey.
- Every file names its JSON Schema in `$schema`, generated from the envelope's schema and published with the docs, so an AI assistant editing the file can validate it.
- `/storage/…` media paths are written as absolute URLs, so a file moved to another instance keeps loading media from the source until re-upload exists (ENG-3401).
