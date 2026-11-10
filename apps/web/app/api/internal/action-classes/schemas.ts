import { z } from "zod";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { strictDeep } from "@/app/api/internal/lib/strict-schema";

export const ZActionClassParams = z.object({ actionClassId: ZId }).strict();

const [ZCodeInput, ZNoCodeInput] = ZActionClassInput.options;

/** The workspace a new action is created in: the query's, authorized, never the body's. */
export const ZActionClassWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

/**
 * An action as the forms build it, strict at every level. No `workspaceId`: a new action goes into the
 * query's workspace, and an edited one always stays in the workspace it belongs to.
 */
const ZActionClassBody = z.discriminatedUnion("type", [
  strictDeep(ZCodeInput.omit({ workspaceId: true })),
  strictDeep(ZNoCodeInput.omit({ workspaceId: true })),
]);

/** A new action as the survey editor's "Create new action" form builds it. */
export const ZActionClassCreateBody = ZActionClassBody;

/** The whole action as the settings form edits it. */
export const ZActionClassPatchBody = ZActionClassBody;

/** The survey the editor is open on, left out of the list of other surveys using the action. */
export const ZActionClassSurveysQuery = z.object({ excludeSurveyId: ZId.optional() }).strict();

export type TActionClassPatchBody = z.infer<typeof ZActionClassPatchBody>;
export type TActionClassCreateBody = z.infer<typeof ZActionClassCreateBody>;

/** The names of the surveys an action triggers, split by whether they are running. */
export type TActionClassSurveysResource = { activeSurveys: string[]; inactiveSurveys: string[] };
