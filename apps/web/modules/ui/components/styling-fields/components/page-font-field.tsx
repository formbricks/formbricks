"use client";

import { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface PageFontFieldProps {
  form: UseFormReturn<TWorkspaceStyling | TSurveyStyling>;
  description: string;
  /** What an unset `pageFont` means here: off for a workspace, the workspace's setting for a survey. */
  fallback: boolean;
  disabled?: boolean;
}

/**
 * The Font field (ENG-3864): Page font (the host page's font) or the survey font, stored as the styling's
 * `pageFont`. Shared by the workspace Look & Feel and the Styling tab of app surveys.
 */
export const PageFontField = ({
  form,
  description,
  fallback,
  disabled = false,
}: Readonly<PageFontFieldProps>) => {
  const { t } = useTranslation();

  return (
    <FormField
      control={form.control}
      name="pageFont"
      render={({ field }) => (
        <FormItem className="space-y-1">
          <FormLabel>{t("workspace.look.font")}</FormLabel>
          <FormDescription>{description}</FormDescription>
          <Select
            value={(field.value ?? fallback) ? "page" : "survey"}
            onValueChange={(value) => field.onChange(value === "page")}
            disabled={disabled}>
            <FormControl>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="page">{t("workspace.look.font_page")}</SelectItem>
              <SelectItem value="survey">{t("workspace.look.font_survey")}</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
};
