-- Migration to add unique IDs to Matrix question rows and columns
-- This migration transforms existing Matrix questions from simple TI18nString arrays
-- to structured objects with unique IDs for drag and drop functionality
-- Function to generate a unique ID (similar to cuid2)
CREATE OR REPLACE FUNCTION generate_unique_id() RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate a 25-character unique ID
    FOR i IN 1..25 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;
-- Update Matrix questions to add unique IDs to rows and columns
UPDATE "Survey"
SET "questions" = (
    SELECT jsonb_agg(
        CASE
            WHEN question->>'type' = 'matrix' THEN
                jsonb_set(
                    jsonb_set(
                        question,
                        '{rows}',
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', generate_unique_id(),
                                    'label', row_item
                                )
                            )
                            FROM jsonb_array_elements(question->'rows') AS row_item
                        )
                    ),
                    '{columns}',
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', generate_unique_id(),
                                'label', column_item
                            )
                        )
                        FROM jsonb_array_elements(question->'columns') AS column_item
                    )
                )
            ELSE question
        END
    )
    FROM jsonb_array_elements("questions") AS question
)
WHERE jsonb_path_exists("questions", '$[*] ? (@.type == "matrix")');
-- Drop the temporary function
DROP FUNCTION generate_unique_id();
