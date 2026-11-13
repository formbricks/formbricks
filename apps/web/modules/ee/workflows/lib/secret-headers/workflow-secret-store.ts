import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { collectWorkflowSecretIds } from "@formbricks/workflows";
import type { WorkflowSecretStore } from "@formbricks/workflows/server";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";

/**
 * Secret header values (ENG-7168, ADR 0043), encrypted with the app's `ENCRYPTION_KEY`
 * (AES-256-GCM via `symmetricEncrypt`). Every query is scoped to one workflow and workspace, so a
 * secret id from anywhere else never reads, replaces or deletes another workflow's value. Plaintext
 * leaves this module only to the code that sends the request.
 */

const encrypt = (value: string): string => symmetricEncrypt(value, ENCRYPTION_KEY);

/** The Prisma client, or the transaction client of a write that must commit together with the secret. */
type TSecretStoreClient = Pick<Prisma.TransactionClient, "workflowSecret" | "workflowVersion">;

const readVersionSecretIds = async (
  client: TSecretStoreClient,
  workflowId: string,
  workspaceId: string
): Promise<string[]> => {
  // Enable is rare and a workflow's versions are few, so reading their definitions here is cheap.
  const versions = await client.workflowVersion.findMany({
    where: { workflowId, workspaceId },
    select: { definition: true },
  });
  return versions.flatMap((version) => collectWorkflowSecretIds(version.definition));
};

/** The store over `client`; pass a transaction client to write secrets inside that transaction. */
export const createWorkflowSecretStore = (client: TSecretStoreClient): WorkflowSecretStore => ({
  create: async ({ workflowId, workspaceId, value }) => {
    const created = await client.workflowSecret.create({
      data: { workflowId, workspaceId, value: encrypt(value) },
      select: { id: true },
    });
    return { id: created.id };
  },

  replace: async ({ secretId, workflowId, workspaceId, value }) => {
    const updated = await client.workflowSecret.updateMany({
      where: { id: secretId, workflowId, workspaceId },
      data: { value: encrypt(value) },
    });
    if (updated.count === 0) {
      throw new Error("Workflow secret to replace was not found");
    }
  },

  deleteUnreferenced: async ({ workflowId, workspaceId, referencedSecretIds }) => {
    const keep = new Set([
      ...referencedSecretIds,
      ...(await readVersionSecretIds(client, workflowId, workspaceId)),
    ]);
    await client.workflowSecret.deleteMany({
      where: { workflowId, workspaceId, id: { notIn: [...keep] } },
    });
  },
});

export const workflowSecretStore: WorkflowSecretStore = createWorkflowSecretStore(prisma);

/** The plaintext values of a workflow's secrets by id; ids it does not own are simply absent. */
export const loadWorkflowSecretValues = async ({
  workflowId,
  workspaceId,
  secretIds,
}: {
  workflowId: string;
  workspaceId: string;
  secretIds: string[];
}): Promise<Map<string, string>> => {
  if (secretIds.length === 0) return new Map();
  const rows = await prisma.workflowSecret.findMany({
    where: { id: { in: secretIds }, workflowId, workspaceId },
    select: { id: true, value: true },
  });
  return new Map(rows.map((row) => [row.id, symmetricDecrypt(row.value, ENCRYPTION_KEY)]));
};
