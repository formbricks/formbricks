import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZTeamsQuery = z.object({ organizationId: ZId }).strict();
export type TTeamsQuery = z.infer<typeof ZTeamsQuery>;
