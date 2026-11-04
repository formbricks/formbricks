import { z } from "zod";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { strictDeep } from "@/app/api/internal/lib/strict-schema";

export const ZActionClassParams = z.object({ actionClassId: ZId }).strict();

const [ZCodeInput, ZNoCodeInput] = ZActionClassInput.options;

/**
 * The whole action as the settings form edits it, strict at every level. No `workspaceId`: an action
 * always stays in the workspace it belongs to, so the operation reads it off the stored row.
 */
export const ZActionClassPatchBody = z.discriminatedUnion("type", [
  strictDeep(ZCodeInput.omit({ workspaceId: true })),
  strictDeep(ZNoCodeInput.omit({ workspaceId: true })),
]);

/** The survey the editor is open on, left out of the list of other surveys using the action. */
export const ZActionClassSurveysQuery = z.object({ excludeSurveyId: ZId.optional() }).strict();

export type TActionClassPatchBody = z.infer<typeof ZActionClassPatchBody>;

/** The names of the surveys an action triggers, split by whether they are running. */
export type TActionClassSurveysResource = { activeSurveys: string[]; inactiveSurveys: string[] };
