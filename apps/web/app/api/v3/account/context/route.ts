/**
 * GET /api/v3/account/context — what an agent can learn about the person it works for: who they are, their
 * role in each organization, the organizations and workspaces they can reach, and the setup facts derived
 * from them (ADR 0018). Nothing is stored for setup progress; every field is read on each call.
 *
 * Session cookie or x-api-key. An API key has grants but no person, so its answer carries no `user` and a
 * `null` role. Reads are not audited.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { getV3AccountContext } from "../lib/context";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3EmptyQuery },
  handler: async ({ authentication, requestId, instance }) =>
    getV3AccountContext({ authentication, requestId, instance }),
});
