import { ZTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { z } from "zod";

export const ZTeamMember = z.object({
  role: ZTeamRole,
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export type TTeamMember = z.infer<typeof ZTeamMember>;

export const ZTeam = z.object({
  id: z.string(),
  name: z.string({ message: "Team name is required" }).trim().min(1, {
    message: "Team name must be at least 1 character long",
  }),
  teamMembers: z.array(ZTeamMember),
});

export type TTeam = z.infer<typeof ZTeam>;
