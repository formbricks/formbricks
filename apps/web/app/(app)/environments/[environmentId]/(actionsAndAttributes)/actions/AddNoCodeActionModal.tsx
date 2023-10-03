"use client";

import Modal from "@/components/shared/Modal";
import { Button, Input, Label } from "@formbricks/ui";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { testURLmatch } from "./testURLmatch";
import {
  TActionClassInput,
  TActionClassNoCodeConfig,
  TActionClass,
} from "@formbricks/types/v1/actionClasses";
import { CssSelector } from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/(selectors)/CssSelector";
import { PageUrlSelector } from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/(selectors)/PageUrlSelector";
import { InnerHtmlSelector } from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/(selectors)/InnerHtmlSelector";
import { createActionClassAction } from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/actions";

interface AddNoCodeActionModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  setActionClassArray?;
}

export default function AddNoCodeActionModal({
  environmentId,
  open,
  setOpen,
  setActionClassArray,
}: AddNoCodeActionModalProps) {
  const { register, control, handleSubmit, watch, reset } = useForm();
  const [isPageUrl, setIsPageUrl] = useState(false);
  const [isCssSelector, setIsCssSelector] = useState(false);
  const [isInnerHtml, setIsInnerText] = useState(false);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");

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
      watch("noCodeConfig.[pageUrl].value"),
      watch("noCodeConfig.[pageUrl].rule")
    );
    setIsMatch(match);
    if (match === "yes") toast.success("Your survey would be shown on this URL.");
    if (match === "no") toast.error("Your survey would not be shown.");
  };

  const submitEventClass = async (data: Partial<TActionClassInput>): Promise<void> => {
    try {
      setIsCreatingAction(true);
      if (data.name === "") throw new Error("Please give your action a name");
      if (!isPageUrl && !isCssSelector && !isInnerHtml) throw new Error("Please select atleast one selector");

      if (isPageUrl && data.noCodeConfig?.pageUrl?.rule === undefined) {
        throw new Error("Please select a rule for page URL");
      }

      const filteredNoCodeConfig = filterNoCodeConfig(data.noCodeConfig as TActionClassNoCodeConfig);
      const updatedData: TActionClassInput = {
        ...data,
        environmentId,
        noCodeConfig: filteredNoCodeConfig,
        type: "noCode",
      } as TActionClassInput;

      const newActionClass: TActionClass = await createActionClassAction(updatedData);
      if (setActionClassArray) {
        setActionClassArray((prevActionClassArray: TActionClass[]) => [
          ...prevActionClassArray,
          newActionClass,
        ]);
      }
      reset();
      resetAllStates(false);
      toast.success("Action added successfully.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsCreatingAction(false);
    }
  };

  const resetAllStates = (open: boolean) => {
    setIsCssSelector(false);
    setIsPageUrl(false);
    setIsInnerText(false);
    setTestUrl("");
    setIsMatch("");
    reset();
    setOpen(open);
  };

  return (
    <Modal open={open} setOpen={() => resetAllStates(false)} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <CursorArrowRaysIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Track New User Action</div>
                <div className="text-sm text-slate-500">
                  Track a user action to display surveys or create user segment.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitEventClass)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div className="grid w-full grid-cols-2 gap-x-4">
                <div className="col-span-1">
                  <Label>What did your user do?</Label>
                  <Input placeholder="E.g. Clicked Download" {...register("name", { required: true })} />
                </div>
                <div className="col-span-1">
                  <Label>Description</Label>
                  <Input placeholder="User clicked Download Button " {...register("description")} />
                </div>
              </div>
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
                setIsInnerHtml={setIsInnerText}
                register={register}
              />
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button type="button" variant="minimal" onClick={() => resetAllStates(false)}>
                Cancel
              </Button>
              <Button variant="darkCTA" type="submit" loading={isCreatingAction}>
                Track Action
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
