"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Project } from "@prisma/client";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormProvider } from "@/modules/ui/components/form";
import { Label } from "@/modules/ui/components/label";
import { getPlacementStyle } from "@/modules/ui/components/preview-survey/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";

interface EditPlacementProps {
  project: Project;
  environmentId: string;
  isReadOnly: boolean;
}

const ZProjectPlacementInput = z.object({
  placement: z.enum(["bottomRight", "topRight", "topLeft", "bottomLeft", "center"]),
  overlay: z.enum(["none", "light", "dark"]),
  clickOutsideClose: z.boolean(),
});

type EditPlacementFormValues = z.infer<typeof ZProjectPlacementInput>;

export const EditPlacementForm = ({ project, isReadOnly }: EditPlacementProps) => {
  const { t } = useTranslation();

  const placements = [
    { name: t("common.bottom_right"), value: "bottomRight", disabled: false },
    { name: t("common.top_right"), value: "topRight", disabled: false },
    { name: t("common.top_left"), value: "topLeft", disabled: false },
    { name: t("common.bottom_left"), value: "bottomLeft", disabled: false },
    { name: t("common.centered_modal"), value: "center", disabled: false },
  ];

  const form = useForm<EditPlacementFormValues>({
    defaultValues: {
      placement: project.placement,
      overlay: project.overlay ?? "none",
      clickOutsideClose: project.clickOutsideClose ?? false,
    },
    resolver: zodResolver(ZProjectPlacementInput),
  });

  const currentPlacement = form.watch("placement");
  const overlay = form.watch("overlay");
  const clickOutsideClose = form.watch("clickOutsideClose");
  const isSubmitting = form.formState.isSubmitting;

  const hasOverlay = overlay !== "none";

  const getOverlayStyle = () => {
    if (overlay === "dark") return "bg-slate-700/80";
    if (overlay === "light") return "bg-slate-400/50";
    return "bg-slate-200";
  };

  const onSubmit: SubmitHandler<EditPlacementFormValues> = async (data) => {
    const updatedProjectResponse = await updateProjectAction({
      projectId: project.id,
      data: {
        placement: data.placement,
        overlay: data.overlay,
        clickOutsideClose: data.clickOutsideClose,
      },
    });
    if (updatedProjectResponse?.data) {
      toast.success(t("environments.workspace.look.placement_updated_successfully"));
    } else {
      const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <FormProvider {...form}>
        <form className="w-full items-center" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex">
            <FormField
              control={form.control}
              name="placement"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      {...field}
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                      disabled={isReadOnly}
                      className="h-full">
                      {placements.map((placement) => (
                        <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
                          <RadioGroupItem
                            id={placement.value}
                            value={placement.value}
                            disabled={placement.disabled}
                            checked={field.value === placement.value}
                          />
                          <Label
                            htmlFor={placement.value}
                            className={`text-slate-900 ${isReadOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                            {placement.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            <div
              className={cn(
                hasOverlay && !clickOutsideClose ? "cursor-not-allowed" : "",
                "relative ml-8 h-40 w-full rounded",
                getOverlayStyle()
              )}>
              <div
                className={cn(
                  "absolute h-16 w-16 cursor-default rounded bg-slate-700",
                  getPlacementStyle(currentPlacement)
                )}></div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <FormField
              control={form.control}
              name="overlay"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <StylingTabs
                      id="overlay"
                      options={[
                        { value: "none", label: t("common.no_overlay") },
                        { value: "light", label: t("common.light_overlay") },
                        { value: "dark", label: t("common.dark_overlay") },
                      ]}
                      defaultSelected={field.value}
                      onChange={(value) => field.onChange(value)}
                      label={t("common.overlay_color")}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {hasOverlay && (
            <div className="mt-6 space-y-2">
              <FormField
                control={form.control}
                name="clickOutsideClose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">
                      {t("common.allow_users_to_exit_by_clicking_outside_the_survey")}
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        disabled={isReadOnly}
                        onValueChange={(value) => {
                          field.onChange(value === "allow");
                        }}
                        className="flex space-x-4">
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <RadioGroupItem id="disallow" value="disallow" checked={!field.value} />
                          <Label
                            htmlFor="disallow"
                            className={`text-slate-900 ${isReadOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                            {t("common.disallow")}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <RadioGroupItem id="allow" value="allow" checked={field.value} />
                          <Label
                            htmlFor="allow"
                            className={`text-slate-900 ${isReadOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                            {t("common.allow")}
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}

          <Button className="mt-4 w-fit" size="sm" loading={isSubmitting} disabled={isReadOnly}>
            {t("common.save")}
          </Button>
        </form>
      </FormProvider>
      {isReadOnly && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
