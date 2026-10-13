import "server-only";
import { cache as reactCache } from "react";
import type { Prisma } from "@formbricks/database/prisma";
import { can } from "@/lib/authorization";
import type { TAuthorizationActor } from "@/lib/authorization";
import { buildVisibleSurveyWhere } from "./predicate";

/**
 * Who is asking, in the terms the visibility predicate needs (ENG-3282). Resolved once per request and
 * organization, then shared by the list predicate, the counts and the serializers.
 *
 * Visibility predicates always enforce stored facts, regardless of graph readiness.
 */
export type TSurveyActorContext =
  | Readonly<{ enforced: boolean; isOrganizationAdmin: boolean; kind: "user"; userId: string }>
  | Readonly<{ enforced: boolean; kind: "apiKey" }>;

const resolveSurveyActorContextCached = reactCache(
  async (actorType: TAuthorizationActor["type"], actorId: string, organizationId: string) => {
    const enforced = true;
    if (actorType === "apiKey") return { enforced, kind: "apiKey" } as const;

    const isOrganizationAdmin =
      enforced &&
      (await can({ id: actorId, type: "user" }, "organization.manage", {
        id: organizationId,
        type: "organization",
      }));
    return { enforced, isOrganizationAdmin, kind: "user", userId: actorId } as const;
  }
);

export const resolveSurveyActorContext = (
  actor: TAuthorizationActor,
  organizationId: string
): Promise<TSurveyActorContext> => resolveSurveyActorContextCached(actor.type, actor.id, organizationId);

/** The `Survey` clause for a signed-in user's pickers and lists in one organization. */
export const getUserVisibleSurveyWhere = async (
  userId: string,
  organizationId: string
): Promise<Prisma.SurveyWhereInput> =>
  buildVisibleSurveyWhere(await resolveSurveyActorContext({ id: userId, type: "user" }, organizationId));
