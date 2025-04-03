import { ZGetFilter } from "@/modules/api/v2/types/api-filter";
import { z } from "zod";
import { ZTeam } from "@formbricks/database/zod/teams";

export const ZGetTeamsFilter = ZGetFilter.refine(
  (data) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      return false;
    }
    return true;
  },
  {
    message: "startDate must be before endDate",
  }
);

export type TGetTeamsFilter = z.infer<typeof ZGetTeamsFilter>;

export const ZTeamInput = ZTeam.pick({
  name: true,
});

export type TTeamInput = z.infer<typeof ZTeamInput>;
