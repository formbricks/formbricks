# The Excel export is one-way

The Excel export is for reviewers and translators who don't use Formbricks: one row per question and option, one column per language, a plain-words Logic column. It never updates the survey it came from; importing it back goes through the AI document import and creates a new survey. A spreadsheet is free-form, so inserted rows, edited types and edited logic sentences can only be read back by guessing, and no comparable product (Qualtrics, Alchemer, SurveyMonkey, LimeSurvey) updates survey structure from a sheet. Updating texts from a sheet belongs to the translations round trip (ENG-4009), which is texts-only and matched by row key.

## Consequences

- Every row carries a hidden key built from element, choice, row, column and sub-field ids, and a hidden sheet holds the survey id, `updatedAt` and format, so a later translations round trip can match rows without changing the file.
- Cells hold plain text, not the stored HTML: the sheet is for reading.
- Cells are written as typed text, never with a leading `'`: in xlsx the apostrophe would become part of the text and come back on import.
