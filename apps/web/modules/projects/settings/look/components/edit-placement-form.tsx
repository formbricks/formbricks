"use client";

import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormProvider } from "@/modules/ui/components/form";
import { Label } from "@/modules/ui/components/label";
import { getPlacementStyle } from "@/modules/ui/components/preview-survey/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { zodResolver } from "@hookform/resolvers/zod";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

const placements = [
  { name: "common.bottom_right", value: "bottomRight", disabled: false },
  { name: "common.top_right", value: "topRight", disabled: false },
  { name: "common.top_left", value: "topLeft", disabled: false },
  { name: "common.bottom_left", value: "bottomLeft", disabled: false },
  { name: "common.centered_modal", value: "center", disabled: false },
];

interface EditPlacementProps {
  project: Project;
  environmentId: string;
  isReadOnly: boolean;
}

const ZProjectPlacementInput = z.object({
  placement: z.enum(["bottomRight", "topRight", "topLeft", "bottomLeft", "center"]),
  darkOverlay: z.boolean(),
  clickOutsideClose: z.boolean(),
});

type EditPlacementFormValues = z.infer<typeof ZProjectPlacementInput>;

export const EditPlacementForm = ({ project, isReadOnly }: EditPlacementProps) => {
  const { t } = useTranslate();
  const form = useForm<EditPlacementFormValues>({
    defaultValues: {
      placement: project.placement,
      darkOverlay: project.darkOverlay ?? false,
      clickOutsideClose: project.clickOutsideClose ?? false,
    },
    resolver: zodResolver(ZProjectPlacementInput),
  });

  const currentPlacement = form.watch("placement");
  const darkOverlay = form.watch("darkOverlay");
  const clickOutsideClose = form.watch("clickOutsideClose");
  const isSubmitting = form.formState.isSubmitting;

  const overlayStyle = currentPlacement === "center" && darkOverlay ? "bg-slate-700/80" : "bg-slate-200";

  const onSubmit: SubmitHandler<EditPlacementFormValues> = async (data) => {
    const updatedProjectResponse = await updateProjectAction({
      projectId: project.id,
      data: {
        placement: data.placement,
        darkOverlay: data.darkOverlay,
        clickOutsideClose: data.clickOutsideClose,
      },
    });
    if (updatedProjectResponse?.data) {
      toast.success(t("environments.project.look.placement_updated_successfully"));
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
                            {t(placement.name)}
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
                clickOutsideClose ? "" : "cursor-not-allowed",
                "relative ml-8 h-40 w-full rounded",
                overlayStyle
              )}>
              <div
                className={cn(
                  "absolute h-16 w-16 cursor-default rounded bg-slate-700",
                  getPlacementStyle(currentPlacement)
                )}></div>
            </div>
          </div>

          {currentPlacement === "center" && (
            <>
              <div className="mt-6 space-y-2">
                <FormField
                  control={form.control}
                  name="darkOverlay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">
                        {t("environments.project.look.centered_modal_overlay_color")}
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value === "darkOverlay");
                          }}
                          disabled={isReadOnly}
                          className="flex space-x-4">
                          <div className="flex items-center space-x-2 whitespace-nowrap">
                            <RadioGroupItem id="lightOverlay" value="lightOverlay" checked={!field.value} />
                            <Label
                              htmlFor="lightOverlay"
                              className={`text-slate-900 ${isReadOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                              {t("common.light_overlay")}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 whitespace-nowrap">
                            <RadioGroupItem id="darkOverlay" value="darkOverlay" checked={field.value} />
                            <Label
                              htmlFor="darkOverlay"
                              className={`text-slate-900 ${isReadOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                              {t("common.dark_overlay")}
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
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
            </>
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
