import { z } from "zod";

export const ZOrganizationTeam = z.object({
  id: z.cuid2(),
  name: z.string(),
});

export type TOrganizationTeam = z.infer<typeof ZOrganizationTeam>;
