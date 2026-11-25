import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@formbricks/database";
import { UsersFixture } from "../fixtures/users";
import { waitForAuthzedOutbox } from "./authzed";

/**
 * Creates a user with a workspace and an API key for it, without a browser.
 *
 * The key is stored the way `createApiKey` (`modules/organization/settings/api-keys/lib/api-key.ts`)
 * stores one: a random 32-byte secret, its SHA-256 as the `lookupHash` and its bcrypt hash as the
 * `hashedKey`, handed out as `fbk_{secret}`. It carries what the settings dialog used to grant: Manage
 * on the user's one workspace, and read and write on access control.
 *
 * The key is scoped to that workspace only, so a list call returns this test's data and nobody else's.
 *
 * `api-keys.spec.ts` is the one spec that creates a key through the settings dialog; every other spec
 * seeds it here.
 */
export const createUserWithApiKey = async (
  users: UsersFixture
): Promise<{ workspaceId: string; organizationId: string; apiKey: string }> => {
  const user = await users.create();
  const { workspaceId, organizationId } = user;
  if (!workspaceId || !organizationId) {
    throw new Error("The user fixture did not seed a workspace");
  }

  const secret = randomBytes(32).toString("base64url");
  const apiKey = await prisma.apiKey.create({
    data: {
      label: "E2E Test API Key",
      lookupHash: createHash("sha256").update(secret).digest("hex"),
      // Never compared for an `fbk_` key (the lookup hash is), so the cheapest cost will do.
      hashedKey: await bcrypt.hash(secret, 4),
      createdBy: user.id,
      organizationId,
      organizationAccess: { accessControl: { read: true, write: true } },
      apiKeyWorkspaces: { create: { workspaceId, permission: "manage" } },
    },
    select: { id: true },
  });

  // The key's grants reach SpiceDB through the projection outbox, like the user's own tenant does.
  await waitForAuthzedOutbox([user.id, organizationId, workspaceId, apiKey.id]);

  return { workspaceId, organizationId, apiKey: `fbk_${secret}` };
};
