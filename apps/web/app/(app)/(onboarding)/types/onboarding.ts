import { z } from "zod";

export const ZOrganizationTeam = z.object({
  id: z.string().cuid2(),
  name: z.string(),
});

export type TOrganizationTeam = z.infer<typeof ZOrganizationTeam>;
