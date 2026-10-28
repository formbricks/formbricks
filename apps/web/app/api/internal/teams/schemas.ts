import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";

/** `/api/internal/teams?organizationId=`: the organization the teams are listed or created in. */
export const ZTeamsQuery = z.object({ organizationId: ZId }).strict();
export type TTeamsQuery = z.infer<typeof ZTeamsQuery>;

/** `/api/internal/teams/{teamId}` path. */
export const ZTeamIdParams = z.object({ teamId: ZId }).strict();

/** `POST /api/internal/teams` body: a new team starts with a name and nothing else. */
export const ZTeamCreateBody = z.object({ name: z.string().trim().min(1, "Team name is required") }).strict();
export type TTeamCreateBody = z.infer<typeof ZTeamCreateBody>;

/**
 * `PATCH /api/internal/teams/{teamId}` body: the team settings form, whole. Members and workspace grants
 * are replaced by what is sent, so a client sends the full lists back, changed or not.
 */
export const ZTeamUpdateBody = ZTeamSettingsFormSchema.strict();
export type TTeamUpdateBody = z.infer<typeof ZTeamUpdateBody>;
