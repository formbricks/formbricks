/*
  Warnings:

  - You are about to drop the column `accepted` on the `Invite` table. All the data in the column will be lost.
*/

-- Drop the `accepted` column on "Invite"
ALTER TABLE "Invite" 
DROP COLUMN "accepted";

-- Rename the `role` column on "Invite" to `deprecatedRole`
ALTER TABLE "Invite" 
RENAME COLUMN "role" TO "deprecatedRole";

-- Drop NOT NULL constraint on `deprecatedRole` in "Invite"
ALTER TABLE "Invite" 
ALTER COLUMN "deprecatedRole" DROP NOT NULL;

-- Drop DEFAULT constraint on `deprecatedRole` in "Invite"
ALTER TABLE "Invite" 
ALTER COLUMN "deprecatedRole" DROP DEFAULT;

-- Rename the `role` column on "Membership" to `deprecatedRole`
ALTER TABLE "Membership" 
RENAME COLUMN "role" TO "deprecatedRole";

-- Drop NOT NULL constraint on `deprecatedRole` in "Membership"
ALTER TABLE "Membership" 
ALTER COLUMN "deprecatedRole" DROP NOT NULL;
