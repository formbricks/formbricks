-- Disposable database of docker/contact-directory-compat-smoke.sh only. Written against the 6.2 schema.
-- One Cloud organization whose billing grants contacts without a Stripe customer, so the 6.2 identify
-- route accepts it with no license and no Stripe call, and one workspace with its `userId` key, which
-- identify connects every new contact to. The workspace has the SDK set up (`appSetupCompleted`), as any
-- workspace that receives identify calls does, so the migration gives it a directory and keeps its keys.
INSERT INTO "Organization" (id, name, updated_at)
VALUES ('dircompatorganization', 'Directory compat', NOW());

INSERT INTO "OrganizationBilling" (organization_id, limits, stripe, updated_at)
VALUES ('dircompatorganization', '{}', '{"features": ["contacts"]}', NOW());

INSERT INTO "Workspace" (id, name, "organizationId", "appSetupCompleted", updated_at)
VALUES ('dircompatworkspace', 'Directory compat', 'dircompatorganization', true, NOW());

INSERT INTO "ContactAttributeKey" (id, key, name, type, "isUnique", "workspaceId", updated_at)
VALUES ('dircompatuseridkey', 'userId', 'User Id', 'default', true, 'dircompatworkspace', NOW());
