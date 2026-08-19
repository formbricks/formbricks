-- Migrate legacy styling fields (questionColor, inputColor) to granular fields
-- and remove the legacy keys from the JSONB.
--
-- Mapping:
--   questionColor    -> elementHeadlineColor, elementDescriptionColor,
--                       elementUpperLabelColor, inputTextColor, optionLabelColor
--   brandColor       -> buttonBgColor, progressIndicatorBgColor  (brandColor itself is kept)
--   inputColor       -> optionBgColor, inputBgColor
--   inputBorderColor -> optionBorderColor                        (inputBorderColor itself is kept)

-- ── Workspace ────────────────────────────────────────────────────────────────
-- NOTE: We use COALESCE(styling->'field', 'null'::jsonb) = 'null'::jsonb instead of
-- NOT (styling ? 'field') to treat JSON null values as absent — the form layer saves
-- null to mean "use default", so the migration must copy the legacy value in that case too.
UPDATE "Workspace"
SET styling = (
  styling
  -- questionColor  →  five text/label fields
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'elementHeadlineColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('elementHeadlineColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'elementDescriptionColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('elementDescriptionColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'elementUpperLabelColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('elementUpperLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'inputTextColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('inputTextColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'optionLabelColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('optionLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  -- brandColor  →  button + progress indicator
  || CASE WHEN styling ? 'brandColor' AND COALESCE(styling->'buttonBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('buttonBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'brandColor' AND COALESCE(styling->'progressIndicatorBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('progressIndicatorBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  -- inputColor  →  option + input background
  || CASE WHEN styling ? 'inputColor' AND COALESCE(styling->'optionBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('optionBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputColor' AND COALESCE(styling->'inputBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('inputBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  -- inputBorderColor  →  optionBorderColor
  || CASE WHEN styling ? 'inputBorderColor' AND COALESCE(styling->'optionBorderColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('optionBorderColor', styling->'inputBorderColor') ELSE '{}'::jsonb END
) - 'questionColor' - 'inputColor'
WHERE styling IS NOT NULL
  AND styling != 'null'::jsonb
  AND jsonb_typeof(styling) = 'object';

-- ── Survey ───────────────────────────────────────────────────────────────────
UPDATE "Survey"
SET styling = (
  styling
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'elementHeadlineColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('elementHeadlineColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'elementDescriptionColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('elementDescriptionColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'elementUpperLabelColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('elementUpperLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'inputTextColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('inputTextColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND COALESCE(styling->'optionLabelColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('optionLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'brandColor' AND COALESCE(styling->'buttonBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('buttonBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'brandColor' AND COALESCE(styling->'progressIndicatorBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('progressIndicatorBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputColor' AND COALESCE(styling->'optionBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('optionBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputColor' AND COALESCE(styling->'inputBgColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('inputBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputBorderColor' AND COALESCE(styling->'optionBorderColor', 'null'::jsonb) = 'null'::jsonb
     THEN jsonb_build_object('optionBorderColor', styling->'inputBorderColor') ELSE '{}'::jsonb END
) - 'questionColor' - 'inputColor'
WHERE styling IS NOT NULL
  AND styling != 'null'::jsonb
  AND jsonb_typeof(styling) = 'object';
