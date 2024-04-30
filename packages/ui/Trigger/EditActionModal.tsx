import { MousePointerClickIcon, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { MatchType, testURLmatch } from "@formbricks/lib/utils/textUrlMatch";
import { TActionClass, TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
import { TSurvey } from "@formbricks/types/surveys";

import { CssSelector, InnerHtmlSelector, PageUrlSelector } from "../Actions";
import { Alert, AlertDescription, AlertTitle } from "../Alert";
import { Button } from "../Button";
import { Input } from "../Input";
import { Label } from "../Label";
import { Modal } from "../Modal";
import { TabBar } from "../TabBar";

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

interface EditActionModalProps {
  selectedAction: TActionClass;
  setSelectedAction: React.Dispatch<React.SetStateAction<(TActionClass & { _isDraft: boolean }) | null>>;
  actionClasses: TActionClass[];
  setActionClasses?: React.Dispatch<React.SetStateAction<TActionClass[]>>;
  isViewer: boolean;
  environmentId: string;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const EditActionModal = ({
  selectedAction,
  setSelectedAction,
  actionClasses,
  setActionClasses,
  environmentId,
  setOpen,
  isViewer,
  open,
  setLocalSurvey,
}: EditActionModalProps) => {
  const { register, control, handleSubmit, watch, reset } = useForm<TActionClass>({
    defaultValues: {
      name: selectedAction.name,
      description: selectedAction.description || "",
      key: selectedAction.key || "",
      noCodeConfig: selectedAction.noCodeConfig,
    },
  });

  const isDraft = selectedAction._isDraft;

  const [type, setType] = useState<string>(selectedAction.type);
  const [visibility, setVisibility] = useState(selectedAction.isPrivate ? "private" : "public");

  const [isPageUrl, setIsPageUrl] = useState(selectedAction.noCodeConfig?.pageUrl ? true : false);
  const [isCssSelector, setIsCssSelector] = useState(selectedAction.noCodeConfig?.cssSelector ? true : false);
  const [isInnerHtml, setIsInnerText] = useState(selectedAction.noCodeConfig?.innerHtml ? true : false);
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");

  const actionClassNames = useMemo(
    () =>
      actionClasses
        .filter((actionClass) => !actionClass.isPrivate && actionClass.id !== selectedAction.id)
        .map((actionClass) => actionClass.name),
    [actionClasses, selectedAction]
  );

  const actionClassKeys = useMemo(
    () =>
      actionClasses
        .filter((actionClass) => actionClass.type === "code" && actionClass.id !== selectedAction.id)
        .map((actionClass) => actionClass.key),
    [actionClasses, selectedAction]
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
      watch("noCodeConfig.pageUrl.rule") as MatchType
    );

    setIsMatch(match);
    if (match === "yes") toast.success("Your survey would be shown on this URL.");
    if (match === "no") toast.error("Your survey would not be shown.");
  };

  const submitHandler = (data: Partial<TActionClass>) => {
    const { noCodeConfig } = data;
    try {
      if (isViewer) {
        throw new Error("You are not authorised to perform this action.");
      }
      if (!data.name || data.name?.trim() === "") {
        throw new Error("Please give your action a name");
      }
      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(`Action with name ${data.name} already exist`);
      }
      const isPrivate = visibility === "private";

      if (type === "noCode") {
        if (!isPageUrl && !isCssSelector && !isInnerHtml)
          throw new Error("Please select at least one selector");

        if (isCssSelector && !isValidCssSelector(noCodeConfig?.cssSelector?.value))
          throw new Error("Please enter a valid CSS Selector");

        if (isPageUrl && noCodeConfig?.pageUrl?.rule === undefined)
          throw new Error("Please select a rule for page URL");
      }
      if (type === "code" && !data.key) {
        throw new Error("Please enter a code key");
      }
      if (data.key && actionClassKeys.includes(data.key)) {
        throw new Error(`Action with key ${data.key} already exist`);
      }

      const updatedAction: TActionClass = {
        id: selectedAction.id,
        name: data.name,
        description: data.description,
        environmentId,
        type: type as TActionClass["type"],
        isPrivate,
        createdAt: selectedAction.createdAt,
        updatedAt: new Date(),
      };

      if (type === "noCode") {
        const filteredNoCodeConfig = filterNoCodeConfig(noCodeConfig as TActionClassNoCodeConfig);
        updatedAction.noCodeConfig = filteredNoCodeConfig;
      } else {
        updatedAction.key = data.key;
      }

      if (selectedAction._isDraft) {
        updatedAction._isDraft = selectedAction._isDraft;
      }

      setLocalSurvey((prev) => ({
        ...prev,
        triggers: prev.triggers.map((trigger) =>
          trigger.id === selectedAction.id ? updatedAction : trigger
        ),
      }));

      if (setActionClasses) {
        setActionClasses((prev) =>
          prev.map((actionClass) => (actionClass.id === selectedAction.id ? updatedAction : actionClass))
        );
      }

      reset();
      resetAllStates();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resetAllStates = () => {
    setType("noCode");
    setVisibility("public");
    setIsCssSelector(false);
    setIsPageUrl(false);
    setIsInnerText(false);
    setTestUrl("");
    setIsMatch("");
    reset();
    setOpen(false);
    setSelectedAction(null);
  };

  return (
    <Modal
      open={open}
      setOpen={(value) => {
        setOpen(value);
        setSelectedAction(null);
      }}
      noPadding
      closeOnOutsideClick={false}>
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
      <div className="flex h-full flex-col rounded-lg px-6 py-4">
        <form onSubmit={handleSubmit(submitHandler)}>
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
              <Label>Visibility</Label>
              <div className="w-4/5">
                <TabBar
                  key="visibility"
                  tabs={[
                    {
                      id: "public",
                      label: "Save for all surveys",
                    },
                    {
                      id: "private",
                      label: "Only for this survey",
                    },
                  ]}
                  activeId={visibility}
                  setActiveId={setVisibility}
                  tabStyle="button"
                  className="bg-white"
                  activeTabClassName="bg-slate-100"
                  disabled={!isDraft}
                />
              </div>
            </div>

            <div>
              <Label>Type</Label>
              <div className="w-3/5">
                <TabBar
                  key="type"
                  tabs={[
                    {
                      id: "noCode",
                      label: "No code",
                    },
                    {
                      id: "code",
                      label: "Code",
                    },
                  ]}
                  activeId={type}
                  setActiveId={setType}
                  tabStyle="button"
                  className="bg-white"
                  activeTabClassName="bg-slate-100"
                  disabled={!isDraft}
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {type === "code" ? (
                <>
                  <div className="col-span-1">
                    <Label htmlFor="codeKeyInput">Code</Label>
                    <Input
                      id="codeKeyInput"
                      placeholder="Enter your code key"
                      disabled={!isDraft}
                      {...register("key")}
                      className="mb-2 w-1/2"
                    />
                  </div>
                  <Alert>
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>How do Code Actions work?</AlertTitle>
                    <AlertDescription>
                      You can track code action anywhere in your app using{" "}
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                        formbricks.track(&quot;{watch("key")}&quot;)
                      </span>{" "}
                      in your code. Read more in our{" "}
                      <a
                        href="https://formbricks.com/docs/actions/code"
                        target="_blank"
                        className="underline">
                        docs
                      </a>
                      .
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-6">
            <div className="flex space-x-2">
              <Button type="button" variant="minimal" onClick={resetAllStates}>
                Cancel
              </Button>
              <Button variant="darkCTA" type="submit">
                Update Action
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
