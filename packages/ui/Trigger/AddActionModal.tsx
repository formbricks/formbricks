"use client";

import { createId } from "@paralleldrive/cuid2";
import { Code2Icon, MousePointerClickIcon, SparklesIcon, Terminal } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { MatchType, testURLmatch } from "@formbricks/lib/utils/textUrlMatch";
import { TActionClass, TActionClassInput, TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
import { TSurvey } from "@formbricks/types/surveys";

import { CssSelector, InnerHtmlSelector, PageUrlSelector } from "../Actions";
import { Alert, AlertDescription, AlertTitle } from "../Alert";
import { Button } from "../Button";
import { Input } from "../Input";
import { Label } from "../Label";
import { ModalWithTabs } from "../ModalWithTabs";
import { TabBar } from "../TabBar";

interface SavedActionsTabProps {
  actionClasses: TActionClass[];
  setActionClasses: (v: TActionClass[]) => void;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SavedActionsTab = ({
  actionClasses,
  setActionClasses,
  localSurvey,
  setLocalSurvey,
  setOpen,
}: SavedActionsTabProps) => {
  // diff actions that are not in local survey triggers
  const diffActions = actionClasses.filter(
    (actionClass) => !localSurvey.triggers.some((trigger) => trigger.id === actionClass.id)
  );
  const [filteredActionClasses, setFilteredActionClasses] = useState<TActionClass[]>(diffActions);

  // const [filteredActionClasses, setFilteredActionClasses] = useState<TActionClass[]>(actionClasses);

  const [code, noCode, automatic] = filteredActionClasses.reduce(
    (acc, actionClass) => {
      if (actionClass.type === "code") {
        acc[0].push(actionClass);
      }
      if (actionClass.type === "noCode") {
        acc[1].push(actionClass);
      }
      if (actionClass.type === "automatic") {
        acc[2].push(actionClass);
      }
      return acc;
    },
    [[], [], []] as [TActionClass[], TActionClass[], TActionClass[]]
  );

  const handleActionClick = (action: TActionClass) => {
    setLocalSurvey((prev) => ({
      ...prev,
      triggers: prev.triggers.concat({
        id: action.id,
        name: action.name,
        type: action.type,
        // isPrivate: false,
        description: action.description,
      }),
    }));
    setOpen(false);
  };

  return (
    <div>
      <Input
        type="text"
        onChange={(e) => {
          setFilteredActionClasses(
            actionClasses.filter((actionClass) =>
              actionClass.name.toLowerCase().includes(e.target.value.toLowerCase())
            )
          );
        }}
        className="mb-2 bg-white"
        placeholder="search actions"
        id="search-actions"
      />
      <div className="max-h-96 overflow-y-auto">
        {[automatic, noCode, code].map(
          (actions, i) =>
            actions.length > 0 && (
              <div key={i}>
                <h2 className="mb-2 mt-4 font-semibold">
                  {i === 0 ? "Automatic" : i === 1 ? "No code" : "Code"}
                </h2>
                <div className="flex flex-col gap-2">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100"
                      onClick={() => handleActionClick(action)}>
                      <div className="mt-1 flex items-center">
                        <div className="mr-1.5 h-4 w-4 text-slate-600">
                          {action.type === "code" ? (
                            <Code2Icon className="h-4 w-4" />
                          ) : action.type === "noCode" ? (
                            <MousePointerClickIcon className="h-4 w-4" />
                          ) : action.type === "automatic" ? (
                            <SparklesIcon className="h-4 w-4" />
                          ) : null}
                        </div>

                        <h4 className="text-sm font-semibold text-slate-600">{action.name}</h4>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{action.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
};

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

interface CreateNewActionTabProps {
  actionClasses: TActionClass[];
  isViewer: boolean;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const CreateNewActionTab = ({
  actionClasses,
  setOpen,
  isViewer,
  localSurvey,
  setLocalSurvey,
}: CreateNewActionTabProps) => {
  const { register, control, handleSubmit, watch, reset } = useForm<TActionClassInput>({
    defaultValues: {
      name: "",
      description: "",
      type: "noCode",
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

  const [type, setType] = useState("noCode");
  const [visibility, setVisibility] = useState("public");

  const [isPageUrl, setIsPageUrl] = useState(false);
  const [isCssSelector, setIsCssSelector] = useState(false);
  const [isInnerHtml, setIsInnerText] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");
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
      watch("noCodeConfig.pageUrl.value"),
      watch("noCodeConfig.pageUrl.rule") as MatchType
    );

    setIsMatch(match);
    if (match === "yes") toast.success("Your survey would be shown on this URL.");
    if (match === "no") toast.error("Your survey would not be shown.");
  };

  const submitHandler = (data: Partial<TActionClassInput>) => {
    const { noCodeConfig } = data;
    if (isViewer) {
      return toast.error("You are not authorised to perform this action.");
    }
    if (!data.name || data.name?.trim() === "") {
      return toast.error("Please give your action a name");
    }
    if (data.name && actionClassNames.includes(data.name)) {
      return toast.error(`Action with name ${data.name} already exist`);
    }
    if (type === "noCode") {
      if (!isPageUrl && !isCssSelector && !isInnerHtml)
        return toast.error("Please select at least one selector");

      if (isCssSelector && !isValidCssSelector(noCodeConfig?.cssSelector?.value)) {
        return toast.error("Please enter a valid CSS Selector");
      }

      if (isPageUrl && noCodeConfig?.pageUrl?.rule === undefined) {
        return toast.error("Please select a rule for page URL");
      }
    }

    const updatedAction: Partial<TActionClassInput> & { id: string; _isDraft: boolean } = {
      id: createId(),
      name: data.name,
      description: data.description,
      type: type as TActionClass["type"],
      isPrivate: visibility === "private",
      _isDraft: true,
    };

    if (type === "noCode") {
      const filteredNoCodeConfig = filterNoCodeConfig(noCodeConfig as TActionClassNoCodeConfig);
      updatedAction.noCodeConfig = filteredNoCodeConfig;
    }

    setLocalSurvey((prev) => ({
      ...prev,
      triggers: prev.triggers.concat(updatedAction),
    }));

    reset();
    resetAllStates();
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
  };

  return (
    <div>
      <form onSubmit={handleSubmit(submitHandler)}>
        <div className="w-full space-y-4">
          <div className="grid w-full grid-cols-2 gap-x-4">
            <div className="col-span-1">
              <Label htmlFor="actionNameInput">{type === "code" ? "Code" : "What did your user do?"}</Label>
              <Input
                id="actionNameInput"
                placeholder={type === "code" ? "E.g. clicked-download" : "E.g. Clicked Download"}
                {...register("name")}
              />
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
              />
            </div>
          </div>

          <div>
            <Label>Type</Label>
            <div className="w-3/5">
              <TabBar
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
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {type === "code" ? (
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
              Create Action
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

interface AddActionModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  environmentId: string;
  actionClasses: TActionClass[];
  setActionClasses: (v: TActionClass[]) => void;
  isViewer: boolean;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}

export const AddActionModal = ({
  open,
  setOpen,
  actionClasses,
  setActionClasses,
  localSurvey,
  setLocalSurvey,
  isViewer,
}: AddActionModalProps) => {
  const tabs = [
    {
      title: "Select saved action",
      children: (
        <SavedActionsTab
          actionClasses={actionClasses}
          setActionClasses={setActionClasses}
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setOpen={setOpen}
        />
      ),
    },
    {
      title: "Create new action",
      children: (
        <CreateNewActionTab
          actionClasses={actionClasses}
          setOpen={setOpen}
          isViewer={isViewer}
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
        />
      ),
    },
  ];
  return (
    <ModalWithTabs
      label="Add action"
      open={open}
      setOpen={setOpen}
      tabs={tabs}
      size="md"
      closeOnOutsideClick={false}
    />
  );
};
