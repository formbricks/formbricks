# One show-conditions schema and evaluator for surveys and creatives

Surveys and creatives share one conditions schema (`ZShowConditions`) and one zod-free evaluator (`evaluateShowConditions`) in `@formbricks/types`, so the SDK can bundle it and the editor can test real URLs with it (ENG-3910, shipped in PR #9618). Creatives evaluate on every page view as well as on actions.
