-- Rename billing plan from 'enterprise' to 'custom' for all existing organizations
UPDATE "Organization"
SET billing = jsonb_set(
  billing,
  '{plan}',
  '"custom"'
)
WHERE billing->>'plan' = 'enterprise';
