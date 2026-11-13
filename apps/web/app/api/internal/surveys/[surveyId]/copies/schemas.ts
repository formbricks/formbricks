import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZSurveyCopyParams = z.object({ surveyId: ZId }).strict();

/** Where the copy goes: a workspace in the survey's own organization, which may be the survey's own. */
export const ZSurveyCopyBody = z.object({ targetWorkspaceId: ZId }).strict();

export type TSurveyCopyBody = z.infer<typeof ZSurveyCopyBody>;
