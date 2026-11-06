# The Excel export comes back into its survey by id, and never removes anything

The Excel export is for reviewers and translators who don't use Formbricks: one row per question and option, one column per language, a plain-words Logic column. Their edits come back through New survey › Import (ENG-6809), as a Formbricks file's do: a very hidden sheet names the survey the file was exported from, and when that survey is one the user may update — in this workspace, not archived, editable — the import offers to update it. Each row carries a hidden key built from element, choice, row, column and sub-field ids, so a row finds its text however the sheet was sorted; a row a reviewer added (no key) adds a question when its Type names a question type, or an option or text to a question when it names a field. A sheet can't say whether a missing row or an empty cell was deleted on purpose, so neither removes anything: a changed cell replaces its text, everything else stays. This is read by code alone, never by AI, and the result is applied as the survey's own Formbricks file would be, so it gets the same review, Match, Update and checks (ADR 0024). Any other workbook, an export of a survey the user may not update included, is just a spreadsheet and goes through the document import, so the import says nothing about surveys the user can't see.

## Considered options

- **One-way, re-import only as a new survey (this ADR's first version).** Reviewers' edits had to be retyped.
- **Fingerprint each exported cell, and apply only cells edited since the export.** It keeps edits made in Formbricks after the export from being undone, but it can't tell "left alone" from "cleared" either, and it adds a hidden per-cell table nobody can reason about when a file looks wrong. Dropped: the review shows what changes, and a stale sheet is the user's to check.
- **Rebuild the survey from the sheet.** The sheet doesn't hold settings, logic or option codes, so structure would be lost.
- **Import from the survey's own menu, the file naming no survey (this ADR's second version).** It needed a second entry point and dialog for one kind of file, and a sheet imported through New survey › Import silently became a new survey. Naming the survey in the file gives the Excel export the Formbricks file's one dialog and Match. The id is not a secret: it is in the survey's links, and the Match checks access as an Update does.

## Consequences

- A very hidden `formbricks` sheet holds the format, each language column's code and header, the Question ID and Type columns' headers, the export's locale and the survey's id, so columns are found by header, Type cells are read in the export's language (and English, and by type id), and the file finds its survey. A visible **Survey** sheet lists the survey's properties for the reader; the import never reads it, so new properties are new rows.
- The workbook is parsed once for both readings, since the Excel export lane and the document import are told apart only by the meta sheet: the zip guard counts every part it inflates, so a second parse would count the file twice.
- An Excel export imports without AI, so the dialog takes `.xlsx` without Formbricks AI too; a workbook that is not an export of a survey the user may update is then refused by the document import's AI gate.
- Cells hold plain text, not the stored HTML: an edited text loses its formatting, with a warning, and `@Label` recalls come back as recalls.
- New questions get a block of their own after the question above, the editor's defaults for their type, and no logic. Picture selection and Cal.com can't be added from a sheet.
- The published lock (ADR 0020) still applies: once a survey has left draft, a sheet that changes an option's text is refused on Update, with the reason in the review.
- Cells are written as typed text, never with a leading `'`: in xlsx the apostrophe would become part of the text and come back on import.
