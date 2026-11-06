# The Excel export comes back into its survey by id, and never removes anything

The Excel export is for reviewers and translators who don't use Formbricks: one row per question and option, one column per language, a plain-words Logic column. Their edits come back through Import in the survey's own menu (ENG-6809), which updates that survey: the file names no survey, and the import is aimed at the one it was started from. Each row carries a hidden key built from element, choice, row, column and sub-field ids, so a row finds its text however the sheet was sorted; a row a reviewer added (no key) adds a question when its Type names a question type, or an option or text to a question when it names a field. A sheet can't say whether a missing row or an empty cell was deleted on purpose, so neither removes anything: a changed cell replaces its text, everything else stays. This is read by code alone, never by AI, and the result is applied as the survey's own Formbricks file would be, so it gets the same review, Match, Update and checks (ADR 0024). Imported through New survey › Import instead, the sheet is just a spreadsheet and goes through the document import.

## Considered options

- **One-way, re-import only as a new survey (this ADR's first version).** Reviewers' edits had to be retyped.
- **Fingerprint each exported cell, and apply only cells edited since the export.** It keeps edits made in Formbricks after the export from being undone, but it can't tell "left alone" from "cleared" either, and it adds a hidden per-cell table nobody can reason about when a file looks wrong. Dropped: the review shows what changes, and a stale sheet is the user's to check.
- **Rebuild the survey from the sheet.** The sheet doesn't hold settings, logic or option codes, so structure would be lost.

## Consequences

- A very hidden `formbricks` sheet holds the format, each language column's code and header, the Question ID and Type columns' headers and the export's locale, so columns are found by header and Type cells are read in the export's language (and English, and by type id). It holds no survey id.
- Cells hold plain text, not the stored HTML: an edited text loses its formatting, with a warning, and `@Label` recalls come back as recalls.
- New questions get a block of their own after the question above, the editor's defaults for their type, and no logic. Picture selection and Cal.com can't be added from a sheet.
- The published lock (ADR 0020) still applies: once a survey has left draft, a sheet that changes an option's text is refused on Update, with the reason in the review.
- Cells are written as typed text, never with a leading `'`: in xlsx the apostrophe would become part of the text and come back on import.
