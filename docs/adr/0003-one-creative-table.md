# One Creative table with per-type JSON

Every creative type lives in one `Creative` table (ENG-3690). `content` and `styling` are JSON validated per type, `type` never changes, and relations exist only where integrity or queries need them: the Destination survey, `CreativeTrigger`, `CreativeLanguage` and the daily rollups. A new type (drawer, popover, custom HTML) is a new payload variant, not new columns or a migration.

## Considered Options

- **Separate database fields for each type**: rejected, because every type shares the editor tabs, Show when, Schedule, Styling and counting.
