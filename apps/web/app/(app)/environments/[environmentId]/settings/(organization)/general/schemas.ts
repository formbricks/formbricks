import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";

export const ZOrganizationAISettingsInput = ZOrganizationUpdateInput.pick({
  isAISmartToolsEnabled: true,
  isAIDataAnalysisEnabled: true,
});

export const ZUpdateOrganizationAISettingsAction = z.object({
  organizationId: ZId,
  data: ZOrganizationAISettingsInput,
});
