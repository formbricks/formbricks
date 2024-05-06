"use client";

import { createActionClassAction } from "@/app/(app)/environments/[environmentId]/actions/actions";
import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { MousePointerClickIcon, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { testURLmatch } from "@formbricks/lib/utils/testUrlMatch";
import { TActionClass, TActionClassInput, TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
import { CssSelector, InnerHtmlSelector, PageUrlSelector } from "@formbricks/ui/Actions";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";
import { TabBar } from "@formbricks/ui/TabBar";

interface AddNoCodeActionModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClasses: TActionClass[];
  setActionClasses?;
  isViewer: boolean;
}

export default function AddNoCodeActionModal({
  environmentId,
  open,
  setOpen,
  actionClasses,
  setActionClasses,
  isViewer,
}: AddNoCodeActionModalProps) {
  const { register, control, handleSubmit, watch, reset } = useForm<TActionClass>({
    defaultValues: {
      name: "",
      description: "",
      type: "noCode",
      key: "",
      noCodeConfig: {
        pageUrl: {
          rule: "contains",
          value: "",
        },
        cssSelector: {
          value: "",
        },
        innerHtml: {
          value: "",
        },
      },
    },
  });
  const [isPageUrl, setIsPageUrl] = useState(false);
  const [isCssSelector, setIsCssSelector] = useState(false);
  const [isInnerHtml, setIsInnerText] = useState(false);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");
  const [type, setType] = useState("noCode");
  const actionClassNames = useMemo(
    () => actionClasses.map((actionClass) => actionClass.name),
    [actionClasses]
  );

  const actionClassKeys = useMemo(
    () =>
      actionClasses
        .filter((actionClass) => actionClass.type === "code")
        .map((actionClass) => actionClass.key),
    [actionClasses]
  );

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
      if (type === "code" && !data.key) {
        throw new Error("Please enter a code key");
      }
      if (data.key && actionClassKeys.includes(data.key)) {
        throw new Error(`Action with key ${data.key} already exist`);
      }

      const updatedAction: TActionClassInput = {
        name: data.name.trim(),
        description: data.description,
        environmentId,
        type: type as TActionClass["type"],
      };

      if (type === "noCode") {
        const filteredNoCodeConfig = filterNoCodeConfig(noCodeConfig as TActionClassNoCodeConfig);
        updatedAction.noCodeConfig = filteredNoCodeConfig;
      } else {
        updatedAction.key = data.key;
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
                  Create action
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
                    <Label htmlFor="codeActionNameInput">Display name</Label>
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

                <div className="col-span-1">
                  <Label htmlFor="codeActionKeyInput">Key</Label>
                  <Input
                    id="codeActionKeyInput"
                    placeholder="Enter your key"
                    {...register("key")}
                    className="mb-2 w-1/2"
                  />
                </div>
                <Alert className="bg-slate-100">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>How do Code Actions work?</AlertTitle>
                  <AlertDescription>
                    You can track code action anywhere in your app using{" "}
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                      formbricks.track(&quot;{watch("key")}&quot;)
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
                  Create action
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
