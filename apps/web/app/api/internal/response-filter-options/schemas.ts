import { z } from "zod";
import { ZId } from "@formbricks/types/common";

/** `?surveyId=`: the survey whose Responses / Summary filter is being built. */
export const ZResponseFilterOptionsQuery = z.object({ surveyId: ZId }).strict();
