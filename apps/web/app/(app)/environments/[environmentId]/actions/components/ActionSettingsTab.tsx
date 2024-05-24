"use client";

import {
  deleteActionClassAction,
  updateActionClassAction,
} from "@/app/(app)/environments/[environmentId]/actions/actions";
import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/actionClasses";
import { TMembershipRole } from "@formbricks/types/memberships";
import { CssSelector, InnerHtmlSelector, PageUrlSelector } from "@formbricks/ui/Actions";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { TabToggle } from "@formbricks/ui/TabToggle";

interface ActionSettingsTabProps {
  environmentId: string;
  actionClass: TActionClass;
  actionClasses: TActionClass[];
  setOpen: (v: boolean) => void;
  membershipRole?: TMembershipRole;
}

export const ActionSettingsTab = ({
  environmentId,
  actionClass,
  actionClasses,
  setOpen,
  membershipRole,
}: ActionSettingsTabProps) => {
  const router = useRouter();
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isCssSelector, setIsCssSelector] = useState(
    !!(actionClass.noCodeConfig?.type === "click" && actionClass.noCodeConfig.elementSelector.cssSelector)
  );
  const [isInnerHtml, setIsInnerHtml] = useState(
    !!(actionClass.noCodeConfig?.type === "click" && actionClass.noCodeConfig.elementSelector.innerHtml)
  );

  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);
  const { isViewer } = getAccessFlags(membershipRole);
  const actionClassNames = useMemo(
    () =>
      actionClasses.filter((action) => action.id !== actionClass.id).map((actionClass) => actionClass.name),
    [actionClass.id, actionClasses]
  );

  const { register, handleSubmit, control, watch } = useForm<TActionClassInput>({
    defaultValues: {
      name: actionClass.name,
      description: actionClass.description,
      type: actionClass.type as any,
      // key: actionClass.key,
      ...(actionClass.type === "code"
        ? { key: actionClass.key }
        : actionClass.type === "noCode"
          ? { noCodeConfig: actionClass.noCodeConfig }
          : {}),
    },
    resolver: zodResolver(ZActionClassInput),
  });

  // const filterNoCodeConfig = (noCodeConfig: TActionClassNoCodeConfig): TActionClassNoCodeConfig => {
  //   const { pageUrl, innerHtml, cssSelector } = noCodeConfig;
  //   const filteredNoCodeConfig: TActionClassNoCodeConfig = {};

  //   if (isPageUrl && pageUrl?.rule && pageUrl?.value) {
  //     filteredNoCodeConfig.pageUrl = { rule: pageUrl.rule, value: pageUrl.value };
  //   }
  //   if (isInnerHtml && innerHtml?.value) {
  //     filteredNoCodeConfig.innerHtml = { value: innerHtml.value };
  //   }
  //   if (isCssSelector && cssSelector?.value) {
  //     filteredNoCodeConfig.cssSelector = { value: cssSelector.value };
  //   }

  //   return filteredNoCodeConfig;
  // };

  const onSubmit = async (data) => {
    try {
      if (isViewer) {
        throw new Error("You are not authorised to perform this action.");
      }
      setIsUpdatingAction(true);

      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(`Action with name ${data.name} already exist`);
      }

      if (data.type === "noCode" && data.noCodeConfig?.type === "click") {
        if (!isCssSelector && !isInnerHtml) throw new Error("Please select at least one selector");

        if (isCssSelector && !isValidCssSelector(data.noCodeConfig?.elementSelector?.cssSelector))
          throw new Error("Please enter a valid CSS Selector");

        if (isInnerHtml && !data.noCodeConfig?.elementSelector?.innerHtml)
          throw new Error("Please enter a valid Inner HTML");
      }

      let filteredNoCodeConfig = data.noCodeConfig;
      const isCodeAction = actionClass.type === "code";
      if (!isCodeAction) {
        // filteredNoCodeConfig = filterNoCodeConfig(data.noCodeConfig );
        filteredNoCodeConfig = data.noCodeConfig;
      }
      const updatedData: TActionClassInput = {
        ...data,
        ...(isCodeAction ? {} : { noCodeConfig: filteredNoCodeConfig }),
        name: data.name.trim(),
      };
      await updateActionClassAction(environmentId, actionClass.id, updatedData);
      setOpen(false);
      router.refresh();
      toast.success("Action updated successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUpdatingAction(false);
    }
  };

  const handleDeleteAction = async () => {
    try {
      setIsDeletingAction(true);
      await deleteActionClassAction(environmentId, actionClass.id);
      router.refresh();
      toast.success("Action deleted successfully");
      setOpen(false);
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsDeletingAction(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="max-h-[600px] w-full space-y-4 overflow-y-auto">
          <div className="grid w-full grid-cols-2 gap-x-4">
            <div className="col-span-1">
              <Label htmlFor="actionNameSettingsInput">
                {actionClass.type === "noCode" ? "What did your user do?" : "Display name"}
              </Label>
              <Input
                id="actionNameSettingsInput"
                placeholder="E.g. Clicked Download"
                {...register("name", {
                  disabled: actionClass.type === "automatic" ? true : false,
                })}
              />
            </div>
            {!isViewer && (
              <div className="col-span-1">
                <Label htmlFor="actionDescriptionSettingsInput">Description</Label>
                <Input
                  id="actionDescriptionSettingsInput"
                  placeholder="User clicked Download Button "
                  {...register("description", {
                    disabled: actionClass.type === "automatic" ? true : false,
                  })}
                />
              </div>
            )}

            {actionClass.type === "code" && (
              <div className="col-span-1 mt-4">
                <Label htmlFor="actionKeySettingsInput">Key</Label>
                <Input
                  id="actionKeySettingsInput"
                  placeholder="E.g. download_button_clicked"
                  {...register("key")}
                  readOnly
                  disabled
                />
              </div>
            )}
          </div>

          {actionClass.type === "code" ? (
            <p className="text-sm text-slate-600">
              This is a code action. Please make changes in your code base.
            </p>
          ) : actionClass.type === "noCode" ? (
            <div>
              <Controller
                name={`noCodeConfig.type`}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TabToggle
                    id="userAction"
                    label="What is the user doing?"
                    onChange={onChange}
                    options={[
                      { value: "click", label: "Click" },
                      { value: "pageView", label: "Page View" },
                      { value: "exitIntent", label: "Exit Intent" },
                      { value: "50PercentScroll", label: "50% Scroll" },
                    ]}
                    defaultSelected={value}
                  />
                )}
              />

              <div className="mt-2">
                {watch("noCodeConfig.type") === "click" && (
                  <>
                    <CssSelector
                      isCssSelector={isCssSelector}
                      setIsCssSelector={setIsCssSelector}
                      register={register}
                    />
                    <InnerHtmlSelector
                      isInnerHtml={isInnerHtml}
                      setIsInnerHtml={setIsInnerHtml}
                      register={register}
                    />
                  </>
                )}
                {watch("noCodeConfig.type") === "pageView" && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <InfoIcon className=" h-4 w-4 " />
                    <p>This action will be triggered when the page is loaded.</p>
                  </div>
                )}
                {watch("noCodeConfig.type") === "exitIntent" && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <InfoIcon className=" h-4 w-4 " />
                    <p>This action will be triggered when the user tries to leave the page.</p>
                  </div>
                )}
                {watch("noCodeConfig.type") === "50PercentScroll" && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <InfoIcon className=" h-4 w-4 " />
                    <p>This action will be triggered when the user scrolls 50% of the page.</p>
                  </div>
                )}
                <PageUrlSelector watch={watch} register={register} control={control} />
              </div>
            </div>
          ) : actionClass.type === "automatic" ? (
            <p className="text-sm text-slate-600">
              This action was created automatically. You cannot make changes to it.
            </p>
          ) : null}
        </div>

        <div className="flex justify-between border-t border-slate-200 py-6">
          <div>
            {!isViewer && actionClass.type !== "automatic" && (
              <Button
                type="button"
                variant="warn"
                onClick={() => setOpenDeleteDialog(true)}
                StartIcon={TrashIcon}
                className="mr-3"
                id="deleteActionModalTrigger">
                Delete
              </Button>
            )}

            <Button variant="secondary" href="https://formbricks.com/docs/actions/no-code" target="_blank">
              Read Docs
            </Button>
          </div>

          {actionClass.type !== "automatic" && (
            <div className="flex space-x-2">
              <Button type="submit" variant="darkCTA" loading={isUpdatingAction}>
                Save changes
              </Button>
            </div>
          )}
        </div>
      </form>
      <DeleteDialog
        open={openDeleteDialog}
        setOpen={setOpenDeleteDialog}
        isDeleting={isDeletingAction}
        deleteWhat={"Action"}
        text="Are you sure you want to delete this action? This also removes this action as a trigger from all your surveys."
        onDelete={handleDeleteAction}
      />
    </div>
  );
};
