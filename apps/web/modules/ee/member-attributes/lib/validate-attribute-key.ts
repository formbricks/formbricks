import type { TFunction } from "i18next";
import { z } from "zod";
import {
  MEMBER_ATTRIBUTE_MAX_DESCRIPTION_LENGTH,
  MEMBER_ATTRIBUTE_MAX_KEY_LENGTH,
  MEMBER_ATTRIBUTE_MAX_LABEL_LENGTH,
} from "./limits";
import { getMemberAttributeKeyProblem } from "./values";

/** The Create / Edit attribute form, with translated messages. The key is only checked when creating. */
export const getAttributeKeyFormSchema = (t: TFunction, { isEditing }: { isEditing: boolean }) =>
  z.object({
    label: z
      .string()
      .trim()
      .min(1, t("workspace.settings.member_attributes.label_required"))
      .max(
        MEMBER_ATTRIBUTE_MAX_LABEL_LENGTH,
        t("workspace.settings.member_attributes.too_long", { max: MEMBER_ATTRIBUTE_MAX_LABEL_LENGTH })
      ),
    key: isEditing
      ? z.string()
      : z.string().superRefine((key, ctx) => {
          const problem = getMemberAttributeKeyProblem(key);
          if (!problem) return;
          const messages = {
            empty: t("workspace.settings.member_attributes.key_required"),
            too_long: t("workspace.settings.member_attributes.too_long", {
              max: MEMBER_ATTRIBUTE_MAX_KEY_LENGTH,
            }),
            invalid_format: t("workspace.settings.member_attributes.key_format"),
            reserved: t("workspace.settings.member_attributes.key_reserved"),
          } as const;
          ctx.addIssue({ code: "custom", message: messages[problem] });
        }),
    description: z
      .string()
      .trim()
      .max(
        MEMBER_ATTRIBUTE_MAX_DESCRIPTION_LENGTH,
        t("workspace.settings.member_attributes.too_long", { max: MEMBER_ATTRIBUTE_MAX_DESCRIPTION_LENGTH })
      ),
  });

export type TAttributeKeyFormData = z.infer<ReturnType<typeof getAttributeKeyFormSchema>>;
