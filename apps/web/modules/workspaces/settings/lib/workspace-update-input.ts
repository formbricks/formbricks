import { z } from "zod";
import { isSurveyRuntimeLanguage } from "@formbricks/i18n-utils/src/survey-runtime-languages";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";

/**
 * `ZWorkspaceUpdateInput` plus the checks that need to know about other workspace packages.
 *
 * `config.defaultSurveyLanguage` is limited to the languages the survey runtime ships strings for. The
 * set cannot live in `ZWorkspaceConfig` itself, because `packages/types` deliberately depends on no
 * other workspace package — so it is enforced here, at the write boundary. Picking a language the
 * runtime has no strings for would render translated questions with English buttons and validation
 * errors (ENG-2325), so the write is rejected rather than silently ignored on read.
 */
export const ZWorkspaceUpdateActionInput = ZWorkspaceUpdateInput.refine(
  (data) =>
    data.config?.defaultSurveyLanguage == null || isSurveyRuntimeLanguage(data.config.defaultSurveyLanguage),
  {
    path: ["config", "defaultSurveyLanguage"],
    error: "Unsupported default survey language",
  }
);

export type TWorkspaceUpdateActionInput = z.infer<typeof ZWorkspaceUpdateActionInput>;
