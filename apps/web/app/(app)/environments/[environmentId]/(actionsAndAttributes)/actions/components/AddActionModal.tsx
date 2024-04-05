"use client";

import { createActionClassAction } from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/actions";
import { MousePointerClickIcon } from "lucide-react";
import { Terminal } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { TActionClass, TActionClassInput, TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
import { CssSelector, InnerHtmlSelector, PageUrlSelector } from "@formbricks/ui/Actions";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";
import { TabBar } from "@formbricks/ui/TabBar";

import { testURLmatch } from "../lib/testURLmatch";

interface AddNoCodeActionModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClasses: TActionClass[];
  setActionClasses?;
  isViewer: boolean;
}

function isValidCssSelector(selector?: string) {
  if (!selector || selector.length === 0) {
    return false;
  }
  const element = document.createElement("div");
  try {
    element.querySelector(selector);
  } catch (err) {
    return false;
  }
  return true;
}

export default function AddNoCodeActionModal({
  environmentId,
  open,
  setOpen,
  actionClasses,
  setActionClasses,
  isViewer,
}: AddNoCodeActionModalProps) {
  const { register, control, handleSubmit, watch, reset } = useForm();
  const [isPageUrl, setIsPageUrl] = useState(false);
  const [isCssSelector, setIsCssSelector] = useState(false);
  const [isInnerHtml, setIsInnerText] = useState(false);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");
  const [type, setType] = useState("noCode");
  const actionClassNames = actionClasses.map((actionClass) => actionClass.name);

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
    const { noCodeConfig } = data;
    try {
      if (isViewer) {
        throw new Error("You are not authorised to perform this action.");
      }
      setIsCreatingAction(true);
      if (!data.name || data.name?.trim() === "") {
        throw new Error("Please give your action a name");
      }
      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(`Action with name ${data.name} already exist`);
      }
      if (type === "noCode") {
        if (!isPageUrl && !isCssSelector && !isInnerHtml)
          throw new Error("Please select at least one selector");

        if (isCssSelector && !isValidCssSelector(noCodeConfig?.cssSelector?.value)) {
          throw new Error("Please enter a valid CSS Selector");
        }

        if (isPageUrl && noCodeConfig?.pageUrl?.rule === undefined) {
          throw new Error("Please select a rule for page URL");
        }
      }

      const updatedAction: TActionClassInput = {
        name: data.name,
        description: data.description,
        environmentId,
        type,
      } as TActionClassInput;

      if (type === "noCode") {
        const filteredNoCodeConfig = filterNoCodeConfig(noCodeConfig as TActionClassNoCodeConfig);
        updatedAction.noCodeConfig = filteredNoCodeConfig;
      }

      const newActionClass: TActionClass = await createActionClassAction(updatedAction);
      if (setActionClasses) {
        setActionClasses((prevActionClasses: TActionClass[]) => [...prevActionClasses, newActionClass]);
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
                <MousePointerClickIcon className="h-5 w-5" />
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
        <TabBar
          tabs={[
            { id: "noCode", label: "No Code" },
            { id: "code", label: "Code" },
          ]}
          activeId={type}
          setActiveId={setType}
        />
        {type === "noCode" ? (
          <form onSubmit={handleSubmit(submitEventClass)}>
            <div className="flex justify-between rounded-lg p-6">
              <div className="w-full space-y-4">
                <div className="grid w-full grid-cols-2 gap-x-4">
                  <div className="col-span-1">
                    <Label htmlFor="actionNameInput">What did your user do?</Label>
                    <Input id="actionNameInput" placeholder="E.g. Clicked Download" {...register("name")} />
                  </div>
                  <div className="col-span-1">
                    <Label htmlFor="actionDescriptionInput">Description</Label>
                    <Input
                      id="actionDescriptionInput"
                      placeholder="User clicked Download Button "
                      {...register("description")}
                    />
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
                  Create Action
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit(submitEventClass)}>
            <div className="flex justify-between rounded-lg p-6">
              <div className="w-full space-y-4">
                <div className="grid w-full grid-cols-2 gap-x-4">
                  <div className="col-span-1">
                    <Label htmlFor="codeActionNameInput">Identifier</Label>
                    <Input
                      id="codeActionNameInput"
                      placeholder="E.g. clicked-download"
                      {...register("name", { required: true })}
                    />
                  </div>
                  <div className="col-span-1">
                    <Label htmlFor="codeActionDescriptionInput">Description</Label>
                    <Input
                      id="codeActionDescriptionInput"
                      placeholder="User clicked Download Button"
                      {...register("description")}
                    />
                  </div>
                </div>
                <hr />
                <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>How do Code Actions work?</AlertTitle>
                  <AlertDescription>
                    You can track code action anywhere in your app using{" "}
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                      formbricks.track(&quot;{watch("name")}&quot;)
                    </span>{" "}
                    in your code. Read more in our{" "}
                    <a href="https://formbricks.com/docs/actions/code" target="_blank" className="underline">
                      docs
                    </a>
                    .
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 p-6">
              <div className="flex space-x-2">
                <Button type="button" variant="minimal" onClick={() => resetAllStates(false)}>
                  Cancel
                </Button>
                <Button variant="darkCTA" type="submit" loading={isCreatingAction}>
                  Create Action
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
