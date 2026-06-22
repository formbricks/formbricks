import { TFunction } from "i18next";
import { z } from "zod";

export const WORKFLOW_NAME_MAX_LENGTH = 120;
export const WORKFLOW_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Zod schema for the create-workflow dialog, used with `useForm({ resolver: zodResolver(...) })`. The
 * factory takes `t` so the validation messages are translated. The name is trimmed before its length
 * checks, mirroring the server contract.
 */
export const getCreateWorkflowFormSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, t("workspace.workflows.name_required"))
      .max(
        WORKFLOW_NAME_MAX_LENGTH,
        t("workspace.workflows.name_too_long", { max: WORKFLOW_NAME_MAX_LENGTH })
      ),
    description: z
      .string()
      .max(
        WORKFLOW_DESCRIPTION_MAX_LENGTH,
        t("workspace.workflows.description_too_long", { max: WORKFLOW_DESCRIPTION_MAX_LENGTH })
      ),
  });

export type TCreateWorkflowFormData = z.infer<ReturnType<typeof getCreateWorkflowFormSchema>>;
