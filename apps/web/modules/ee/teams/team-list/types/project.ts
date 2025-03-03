import { z } from "zod";

export const ZOrganizationProject = z.object({
  id: z.string(),
  name: z.string(),
});

export type TOrganizationProject = z.infer<typeof ZOrganizationProject>;
