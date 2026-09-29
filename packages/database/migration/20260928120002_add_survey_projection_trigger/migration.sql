-- ENG-3282: project survey ownership and visibility into SpiceDB through the existing outbox.
--
-- This file must sort AFTER the owner backfill (the data migration before it): the trigger fires on
-- every `ownerId` write, and the backfill would otherwise enqueue one revocation per existing survey.
--
-- Both functions are re-declared whole from 20260818120000_add_authzed_projection_outbox. The only
-- changes are the `survey` case of the grant classifier and the DELETE classification; everything
-- else is byte-identical, so the other eleven triggers behave exactly as before.
--
-- The app must already know the `survey` outbox target type when this runs (outbox-types.ts ships in
-- the same release): the claim dead-letters unknown types, and a dead-lettered revocation arms the
-- freshness guard.

SET lock_timeout = '1s';

CREATE OR REPLACE FUNCTION authzed_projection_is_grant(
  target_type text,
  previous_source jsonb,
  source jsonb
) RETURNS boolean AS $$
  SELECT CASE target_type
    -- reconcileUser deletes every relationship while `isActive` is false, so false -> true can only
    -- add them back. `isActive` is the only column the User trigger watches.
    WHEN 'user' THEN
      (previous_source ->> 'isActive') IS DISTINCT FROM 'true'
      AND (source ->> 'isActive') = 'true'

    -- feedback-directory.ts writes assignment edges as `delete` while the directory is archived and
    -- `touch` once it is not. Its parent edge is only ever touched, never re-pointed, so an
    -- organizationId move leaves the old organization's administrators in place: still a revocation.
    WHEN 'feedback_directory' THEN
      (previous_source ->> 'isArchived') = 'true'
      AND (source ->> 'isArchived') IS DISTINCT FROM 'true'
      AND previous_source ->> 'organizationId' IS NOT DISTINCT FROM source ->> 'organizationId'

    -- organization-membership.ts projects every membership row regardless of `accepted` (see the
    -- comment on its readSnapshot), so accepting an invite writes byte-identical relationships.
    -- A `role` move always deletes the relation for the old role, so it stays a revocation.
    WHEN 'membership' THEN
      previous_source ->> 'role' IS NOT DISTINCT FROM source ->> 'role'

    -- survey.ts reconciles the survey's edges to exactly what its row implies. Only restricted -> workspace
    -- on the same owner and workspace provably adds edges without removing any; a write that leaves all
    -- three facts as they were projects byte-identical relationships. Every other move takes access
    -- away from someone: an owner change drops the old owner, a workspace move drops the old workspace,
    -- and workspace -> restricted drops the shared edge.
    WHEN 'survey' THEN
      (previous_source ->> 'workspaceId') IS NOT DISTINCT FROM (source ->> 'workspaceId')
      AND (previous_source ->> 'ownerId') IS NOT DISTINCT FROM (source ->> 'ownerId')
      AND (
        (previous_source ->> 'visibility') IS NOT DISTINCT FROM (source ->> 'visibility')
        OR (
          (previous_source ->> 'visibility') = 'restricted'
          AND (source ->> 'visibility') = 'workspace'
        )
      )

    ELSE false
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION enqueue_authzed_projection()
RETURNS trigger AS $$
DECLARE
  source jsonb;
  previous_source jsonb;
  is_revocation boolean;
  target_type text := TG_ARGV[0];
  primary_field text := TG_ARGV[1];
  secondary_field text := NULLIF(TG_ARGV[2], '');
BEGIN
  source := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  -- A relationship source can move from one logical pair to another. Reconcile the old pair as a
  -- revocation before reconciling the current pair; otherwise the old edge is no longer discoverable
  -- from PostgreSQL and could survive with stale access.
  IF TG_OP = 'UPDATE' THEN
    previous_source := to_jsonb(OLD);
    IF previous_source ->> primary_field IS DISTINCT FROM source ->> primary_field
      OR (
        secondary_field IS NOT NULL
        AND previous_source ->> secondary_field IS DISTINCT FROM source ->> secondary_field
      )
    THEN
      INSERT INTO "AuthzedProjectionOutbox" (
        "id",
        "targetType",
        "primaryId",
        "secondaryId",
        "isRevocation",
        "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        target_type,
        previous_source ->> primary_field,
        CASE WHEN secondary_field IS NULL THEN NULL ELSE previous_source ->> secondary_field END,
        true,
        NOW()
      );
    END IF;
  END IF;

  is_revocation := CASE
    WHEN TG_OP = 'INSERT' THEN false
    -- A deleted survey is not a revocation: every survey-scoped decision resolves the survey row
    -- first and denies once it is gone, so leftover edges grant nothing and are hygiene for the
    -- projector. Counting it would let deleting a workspace with many surveys arm the freshness guard.
    WHEN TG_OP = 'DELETE' THEN (target_type <> 'survey')
    ELSE NOT authzed_projection_is_grant(target_type, previous_source, source)
  END;

  INSERT INTO "AuthzedProjectionOutbox" (
    "id",
    "targetType",
    "primaryId",
    "secondaryId",
    "isRevocation",
    "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    target_type,
    source ->> primary_field,
    CASE WHEN secondary_field IS NULL THEN NULL ELSE source ->> secondary_field END,
    is_revocation,
    NOW()
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "authzed_projection_survey" ON "Survey";
CREATE TRIGGER "authzed_projection_survey"
AFTER INSERT OR DELETE OR UPDATE OF "visibility", "ownerId", "workspaceId" ON "Survey"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('survey', 'id', '');

RESET lock_timeout;
