import { z } from "zod";

const ZRole = z.enum(["owner", "manager", "member", "billing"]);

export const ZV3AccountWorkspace = z.object({
  id: z.string(),
  name: z.string(),
  surveyCount: z.number().int(),
  appSetupCompleted: z.boolean(),
  branding: z.object({
    logoSet: z.boolean(),
    brandColor: z.string().nullable(),
  }),
});

export const ZV3AccountOrganization = z.object({
  id: z.string(),
  name: z.string(),
  /** The caller's organization role. `null` for an API key, which has grants but no role. */
  role: ZRole.nullable(),
  /** Derived from the role alone: an owner set the organization up, everyone else was invited into it. */
  joinedAs: z.enum(["owner", "invited"]).nullable(),
  canManage: z.boolean(),
  /** Owner or manager, and the plan's workspace limit is not yet reached. */
  canCreateWorkspace: z.boolean(),
  /** Pending invites; only counted for an owner or manager, `null` otherwise. */
  pendingInviteCount: z.number().int().nullable(),
  workspaces: z.array(ZV3AccountWorkspace),
});

/** What an agent can learn about the person it works for. Derived on every call; no stored setup state. */
export const ZV3AccountContext = z.object({
  principal: z.enum(["user", "apiKey"]),
  /**
   * A signed-in person may create another organization here: the multi-organization licence is on, or the
   * instance has none yet. Always false for an API key. The rule `create_organization` enforces.
   */
  canCreateOrganization: z.boolean(),
  user: z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }).nullable(),
  organizations: z.array(ZV3AccountOrganization),
  setup: z.object({
    organizationCount: z.number().int(),
    workspaceCount: z.number().int(),
    surveyCount: z.number().int(),
    /** Some workspace has a logo or a brand colour. */
    brandingSet: z.boolean(),
  }),
});
export type TV3AccountContext = z.infer<typeof ZV3AccountContext>;
export type TV3AccountOrganization = z.infer<typeof ZV3AccountOrganization>;
