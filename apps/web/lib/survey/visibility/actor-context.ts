import "server-only";
import { cache as reactCache } from "react";
import { can } from "@/lib/authorization";
import type { TAuthorizationActor } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";

/**
 * Who is asking, in the terms the visibility predicate needs (ENG-3282). Resolved once per request and
 * organization, then shared by the list predicate, the counts and the serializers.
 *
 * `enforced` is the readiness marker. While it is off the predicate restricts nothing and the
 * organization-admin check is skipped entirely, so a deployment that has not opted in pays no extra
 * authorization check for it.
 */
export type TSurveyActorContext =
  | Readonly<{ enforced: boolean; isOrganizationAdmin: boolean; kind: "user"; userId: string }>
  | Readonly<{ enforced: boolean; kind: "apiKey" }>;

const resolveSurveyActorContextCached = reactCache(
  async (actorType: TAuthorizationActor["type"], actorId: string, organizationId: string) => {
    const enforced = await isSurveyVisibilityReady();
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
