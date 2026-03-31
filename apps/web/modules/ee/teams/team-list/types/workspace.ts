import { z } from "zod";

export const ZOrganizationWorkspace = z.object({
  id: z.string(),
  name: z.string(),
});

export type TOrganizationWorkspace = z.infer<typeof ZOrganizationWorkspace>;
