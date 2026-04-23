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
UPDATE "Workspace"
SET styling = (
  styling
  -- questionColor  →  five text/label fields
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'elementHeadlineColor')
     THEN jsonb_build_object('elementHeadlineColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'elementDescriptionColor')
     THEN jsonb_build_object('elementDescriptionColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'elementUpperLabelColor')
     THEN jsonb_build_object('elementUpperLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'inputTextColor')
     THEN jsonb_build_object('inputTextColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'optionLabelColor')
     THEN jsonb_build_object('optionLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  -- brandColor  →  button + progress indicator
  || CASE WHEN styling ? 'brandColor' AND NOT (styling ? 'buttonBgColor')
     THEN jsonb_build_object('buttonBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'brandColor' AND NOT (styling ? 'progressIndicatorBgColor')
     THEN jsonb_build_object('progressIndicatorBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  -- inputColor  →  option + input background
  || CASE WHEN styling ? 'inputColor' AND NOT (styling ? 'optionBgColor')
     THEN jsonb_build_object('optionBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputColor' AND NOT (styling ? 'inputBgColor')
     THEN jsonb_build_object('inputBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  -- inputBorderColor  →  optionBorderColor
  || CASE WHEN styling ? 'inputBorderColor' AND NOT (styling ? 'optionBorderColor')
     THEN jsonb_build_object('optionBorderColor', styling->'inputBorderColor') ELSE '{}'::jsonb END
) - 'questionColor' - 'inputColor'
WHERE styling IS NOT NULL
  AND styling != 'null'::jsonb
  AND jsonb_typeof(styling) = 'object';

-- ── Survey ───────────────────────────────────────────────────────────────────
UPDATE "Survey"
SET styling = (
  styling
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'elementHeadlineColor')
     THEN jsonb_build_object('elementHeadlineColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'elementDescriptionColor')
     THEN jsonb_build_object('elementDescriptionColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'elementUpperLabelColor')
     THEN jsonb_build_object('elementUpperLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'inputTextColor')
     THEN jsonb_build_object('inputTextColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'questionColor' AND NOT (styling ? 'optionLabelColor')
     THEN jsonb_build_object('optionLabelColor', styling->'questionColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'brandColor' AND NOT (styling ? 'buttonBgColor')
     THEN jsonb_build_object('buttonBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'brandColor' AND NOT (styling ? 'progressIndicatorBgColor')
     THEN jsonb_build_object('progressIndicatorBgColor', styling->'brandColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputColor' AND NOT (styling ? 'optionBgColor')
     THEN jsonb_build_object('optionBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputColor' AND NOT (styling ? 'inputBgColor')
     THEN jsonb_build_object('inputBgColor', styling->'inputColor') ELSE '{}'::jsonb END
  || CASE WHEN styling ? 'inputBorderColor' AND NOT (styling ? 'optionBorderColor')
     THEN jsonb_build_object('optionBorderColor', styling->'inputBorderColor') ELSE '{}'::jsonb END
) - 'questionColor' - 'inputColor'
WHERE styling IS NOT NULL
  AND styling != 'null'::jsonb
  AND jsonb_typeof(styling) = 'object';
