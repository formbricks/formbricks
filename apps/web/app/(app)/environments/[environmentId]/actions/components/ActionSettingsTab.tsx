"use client";

import {
  deleteActionClassAction,
  updateActionClassAction,
} from "@/app/(app)/environments/[environmentId]/actions/actions";
import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { testURLmatch } from "@formbricks/lib/utils/testUrlMatch";
import {
  TActionClass,
  TActionClassInput,
  TActionClassNoCodeConfig,
  TNoCodeConfig,
} from "@formbricks/types/actionClasses";
import { TMembershipRole } from "@formbricks/types/memberships";
import { CssSelector, InnerHtmlSelector, PageUrlSelector } from "@formbricks/ui/Actions";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

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
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");
  const [isPageUrl, setIsPageUrl] = useState(actionClass.noCodeConfig?.pageUrl ? true : false);
  const [isCssSelector, setIsCssSelector] = useState(actionClass.noCodeConfig?.cssSelector ? true : false);
  const [isInnerHtml, setIsInnerHtml] = useState(actionClass.noCodeConfig?.innerHtml ? true : false);
  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);
  const { isViewer } = getAccessFlags(membershipRole);
  const actionClassNames = useMemo(
    () =>
      actionClasses.filter((action) => action.id !== actionClass.id).map((actionClass) => actionClass.name),
    [actionClass.id, actionClasses]
  );

  const { register, handleSubmit, control, watch } = useForm<TActionClass>({
    defaultValues: {
      name: actionClass.name,
      description: actionClass.description,
      key: actionClass.key,
      noCodeConfig: actionClass.noCodeConfig,
    },
  });

  const filterNoCodeConfig = (noCodeConfig: TActionClassNoCodeConfig): TActionClassNoCodeConfig => {
    const { pageUrl, innerHtml, cssSelector } = noCodeConfig;
    const filteredNoCodeConfig: TActionClassNoCodeConfig = {};

    if (isPageUrl && pageUrl?.rule && pageUrl?.value) {
      filteredNoCodeConfig.pageUrl = { rule: pageUrl.rule, value: pageUrl.value };
    }
    if (isInnerHtml && innerHtml?.value) {
      filteredNoCodeConfig.innerHtml = { value: innerHtml.value };
    }
    if (isCssSelector && cssSelector?.value) {
      filteredNoCodeConfig.cssSelector = { value: cssSelector.value };
    }

    return filteredNoCodeConfig;
  };

  const handleMatchClick = () => {
    const match = testURLmatch(
      testUrl,
      watch("noCodeConfig.pageUrl.value"),
      watch("noCodeConfig.pageUrl.rule")
    );
    setIsMatch(match);
    if (match === "yes") toast.success("Your survey would be shown on this URL.");
    if (match === "no") toast.error("Your survey would not be shown.");
  };

  const onSubmit = async (data) => {
    try {
      if (isViewer) {
        throw new Error("You are not authorised to perform this action.");
      }
      setIsUpdatingAction(true);
      if (!data.name || data.name?.trim() === "") {
        throw new Error("Please give your action a name");
      }
      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(`Action with name ${data.name} already exist`);
      }

      if (actionClass.type === "noCode") {
        if (!isPageUrl && !isCssSelector && !isInnerHtml)
          throw new Error("Please select at least one selector");

        if (isCssSelector && !isValidCssSelector(actionClass.noCodeConfig?.cssSelector?.value))
          throw new Error("Please enter a valid CSS Selector");

        if (isPageUrl && actionClass.noCodeConfig?.pageUrl?.rule === undefined)
          throw new Error("Please select a rule for page URL");
      }

      let filteredNoCodeConfig = data.noCodeConfig;
      const isCodeAction = actionClass.type === "code";
      if (!isCodeAction) {
        filteredNoCodeConfig = filterNoCodeConfig(data.noCodeConfig as TNoCodeConfig);
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
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
          <div className="max-h-60 overflow-auto">
            <div>
              <Label>Select By</Label>
            </div>
            <CssSelector
              isCssSelector={isCssSelector}
              setIsCssSelector={setIsCssSelector}
              register={register}
            />
            <PageUrlSelector
              isPageUrl={isPageUrl}
              setIsPageUrl={setIsPageUrl}
              register={register}
              control={control}
              testUrl={testUrl}
              setTestUrl={setTestUrl}
              isMatch={isMatch}
              setIsMatch={setIsMatch}
              handleMatchClick={handleMatchClick}
            />
            <InnerHtmlSelector
              isInnerHtml={isInnerHtml}
              setIsInnerHtml={setIsInnerHtml}
              register={register}
            />
          </div>
        ) : actionClass.type === "automatic" ? (
          <p className="text-sm text-slate-600">
            This action was created automatically. You cannot make changes to it.
          </p>
        ) : null}
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
