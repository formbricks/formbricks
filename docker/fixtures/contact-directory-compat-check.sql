-- Checks the rows the 6.2 image wrote after the new migrations ran (docker/contact-directory-compat-smoke.sh).
-- Each must carry its workspace's directory, which only the `contact_directory_from_workspace` trigger
-- can have set: 6.2 knows nothing of directories. Raises, so psql exits non-zero, if any row lacks it.
DO $$
DECLARE
  directory_id TEXT;
  problems TEXT[] := '{}';
  total INTEGER;
  wrong INTEGER;
BEGIN
  SELECT "contactDirectoryId" INTO directory_id FROM "Workspace" WHERE id = 'dircompatworkspace';
  IF directory_id IS NULL THEN
    RAISE EXCEPTION 'The workspace has no contact directory after the migrations, so the check would prove nothing';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE "directoryId" IS DISTINCT FROM directory_id)
    INTO total, wrong FROM "Contact" WHERE "workspaceId" = 'dircompatworkspace';
  IF total <> 1 OR wrong <> 0 THEN
    problems := problems || format('Contact: %s row(s) written by 6.2 identify, %s without the directory', total, wrong);
  ELSE
    RAISE NOTICE 'Contact: the row written by 6.2 identify has the directory';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE "directoryId" IS DISTINCT FROM directory_id)
    INTO total, wrong FROM "ContactAttributeKey" WHERE "workspaceId" = 'dircompatworkspace' AND key = 'ci_plan';
  IF total <> 1 OR wrong <> 0 THEN
    problems := problems || format('ContactAttributeKey: %s row(s) written by 6.2 identify, %s without the directory', total, wrong);
  ELSE
    RAISE NOTICE 'ContactAttributeKey: the row written by 6.2 identify has the directory';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE "directoryId" IS DISTINCT FROM directory_id)
    INTO total, wrong FROM "Segment" WHERE "workspaceId" = 'dircompatworkspace' AND title = 'directory-compat';
  IF total <> 1 OR wrong <> 0 THEN
    problems := problems || format('Segment: %s row(s) written by the 6.2 Prisma client, %s without the directory', total, wrong);
  ELSE
    RAISE NOTICE 'Segment: the row written by the 6.2 Prisma client has the directory';
  END IF;

  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION E'Rows written by 6.2 after the migration did not get their directory:\n%', array_to_string(problems, E'\n');
  END IF;
END $$;
