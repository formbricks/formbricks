import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { findLinkedCreatives } from "@/modules/creatives/lib/linked-creatives";

/** An outbound connection that makes `restricted` refusable (contract §3, Decision 13). */
export type TSurveyVisibilityBlocker = Readonly<{
  id: string;
  name: string;
  type: "creative" | "dashboard" | "feedbackSource" | "integration" | "webhook" | "workflow";
}>;

const INTEGRATION_NAMES: Readonly<Record<string, string>> = {
  airtable: "Airtable",
  googleSheets: "Google Sheets",
  notion: "Notion",
  slack: "Slack",
};

const nonEmpty = (name: string | null | undefined, fallback: string): string =>
  name && name.trim() !== "" ? name : fallback;

/**
 * The survey's linked creatives (ENG-3868): a creative is visible to the whole workspace, so its
 * Destination can't be restricted. Archived ones don't block; a restriction unlinks them. Takes the
 * client so the visibility change can re-read them under the lock a creative link also takes.
 */
export const findCreativeBlockers = async (
  client: Pick<Prisma.TransactionClient, "creative">,
  surveyId: string,
  workspaceId: string
): Promise<TSurveyVisibilityBlocker[]> =>
  (await findLinkedCreatives(client, { surveyId, workspaceId })).map(({ id, name }) => ({
    id,
    name: nonEmpty(name, "Creative"),
    type: "creative" as const,
  }));

/**
 * Every outbound connection that references this survey by id, in a stable order. Workspace-scoped on
 * every query: a connection is only ever compared with surveys of its own workspace.
 *
 * Wildcard webhooks (`surveyIds: []`, "every survey") never block: they cannot be resolved at flip time
 * and are skipped at dispatch instead (ENG-3283). Workflows block while they can still run: draft or
 * enabled. A disabled or archived one does not: it sends nothing, `enable` re-checks its trigger survey
 * (and dispatch again), and its builder page loads the survey only for someone who may read it — so
 * refusing a restriction over it would block the owner for no exposure.
 */
export const findSurveyOutboundBlockers = async (
  surveyId: string,
  workspaceId: string
): Promise<TSurveyVisibilityBlocker[]> => {
  const [webhooks, integrations, feedbackSources, workflows, creatives] = await Promise.all([
    prisma.webhook.findMany({
      where: { surveyIds: { has: surveyId }, workspaceId },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    prisma.$queryRaw<Array<{ id: string; type: string }>>`
      SELECT i.id, i.type::text AS type
      FROM "Integration" i
      WHERE i."workspaceId" = ${workspaceId}
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(i.config -> 'data', '[]'::jsonb)) AS item
          WHERE item ->> 'surveyId' = ${surveyId}
        )
      ORDER BY i.id
    `,
    prisma.feedbackSource.findMany({
      where: { formbricksMappings: { some: { surveyId } }, status: "active", workspaceId },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    prisma.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT w.id, w.name
      FROM "Workflow" w
      WHERE w."workspaceId" = ${workspaceId}
        AND w.status IN ('draft', 'enabled')
        AND w.definition -> 'trigger' -> 'config' ->> 'surveyId' = ${surveyId}
      ORDER BY w.id
    `,
    findCreativeBlockers(prisma, surveyId, workspaceId),
  ]);

  return [
    ...webhooks.map(({ id, name }) => ({ id, name: nonEmpty(name, "Webhook"), type: "webhook" as const })),
    ...integrations.map(({ id, type }) => ({
      id,
      name: INTEGRATION_NAMES[type] ?? "Integration",
      type: "integration" as const,
    })),
    ...feedbackSources.map(({ id, name }) => ({
      id,
      name: nonEmpty(name, "Feedback source"),
      type: "feedbackSource" as const,
    })),
    ...workflows.map(({ id, name }) => ({ id, name: nonEmpty(name, "Workflow"), type: "workflow" as const })),
    ...creatives,
  ];
};
