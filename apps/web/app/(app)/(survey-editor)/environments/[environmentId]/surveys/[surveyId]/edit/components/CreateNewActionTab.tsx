import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { MatchType, testURLmatch } from "@formbricks/lib/utils/testUrlMatch";
import { TActionClass, TActionClassInput, TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
import { TSurvey } from "@formbricks/types/surveys";
import { CssSelector, InnerHtmlSelector, PageUrlSelector } from "@formbricks/ui/Actions";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { TabToggle } from "@formbricks/ui/TabToggle";

import { createActionClassAction } from "../actions";

interface CreateNewActionTabProps {
  actionClasses: TActionClass[];
  setActionClasses: React.Dispatch<React.SetStateAction<TActionClass[]>>;
  isViewer: boolean;
  setLocalSurvey?: React.Dispatch<React.SetStateAction<TSurvey>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  environmentId: string;
}

export const CreateNewActionTab = ({
  actionClasses,
  setActionClasses,
  setOpen,
  isViewer,
  setLocalSurvey,
  environmentId,
}: CreateNewActionTabProps) => {
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

  const [type, setType] = useState<"code" | "noCode">("noCode");
  const [userAction, setUserAction] = useState<TActionClassNoCodeConfig["type"]>("click");

  const [isPageUrl, setIsPageUrl] = useState(false);
  const [isCssSelector, setIsCssSelector] = useState(false);
  const [isInnerHtml, setIsInnerText] = useState(false);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");
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
      watch("noCodeConfig.pageUrl.rule") as MatchType
    );

    setIsMatch(match);
    if (match === "yes") toast.success("Your survey would be shown on this URL.");
    if (match === "no") toast.error("Your survey would not be shown.");
  };

  const submitHandler = async (data: Partial<TActionClass>) => {
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

      if (setLocalSurvey) {
        setLocalSurvey((prev) => ({
          ...prev,
          triggers: prev.triggers.concat({ actionClass: newActionClass }),
        }));
      }

      reset();
      resetAllStates();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCreatingAction(false);
    }
  };

  const resetAllStates = () => {
    setType("noCode");
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
        <div className="max-h-[600px] w-full space-y-4 overflow-y-auto">
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

          <div className="w-3/5">
            <TabToggle
              id="type"
              label="Type"
              onChange={(value) => setType(value)}
              options={[
                { value: "noCode", label: "No code" },
                { value: "code", label: "Code" },
              ]}
              defaultSelected={type}
            />
          </div>

          {type === "code" ? (
            <>
              <div className="col-span-1">
                <Label htmlFor="codeActionKeyInput">Key</Label>
                <Input
                  id="codeActionKeyInput"
                  placeholder="e.g. download_cta_click_on_home"
                  {...register("key")}
                  className="mb-2 w-1/2"
                />
              </div>
              <Alert className="bg-slate-100">
                <Terminal className="h-4 w-4" />
                <AlertTitle>How do Code Actions work?</AlertTitle>
                <AlertDescription>
                  You can track code action anywhere in your app using{" "}
                  <span className="rounded bg-white px-2 py-1 text-xs">
                    formbricks.track(&quot;{watch("key")}&quot;)
                  </span>{" "}
                  in your code. Read more in our{" "}
                  <a href="https://formbricks.com/docs/actions/code" target="_blank" className="underline">
                    docs
                  </a>
                  .
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <div>
              <TabToggle
                id="userAction"
                label="What is the user doing?"
                onChange={(value) => setUserAction(value)}
                options={[
                  { value: "click", label: "Click" },
                  { value: "pageView", label: "Page View" },
                  { value: "exitIntent", label: "Exit Intent" },
                  { value: "50PercentScroll", label: "50% Scroll" },
                ]}
                defaultSelected={userAction}
              />

              <div className="mt-2">
                {userAction === "click" && (
                  <>
                    <CssSelector
                      isCssSelector={isCssSelector}
                      setIsCssSelector={setIsCssSelector}
                      register={register}
                    />
                    <InnerHtmlSelector
                      isInnerHtml={isInnerHtml}
                      setIsInnerHtml={setIsInnerText}
                      register={register}
                    />
                  </>
                )}
                <PageUrlSelector
                  register={register}
                  control={control}
                  testUrl={testUrl}
                  setTestUrl={setTestUrl}
                  isMatch={isMatch}
                  setIsMatch={setIsMatch}
                  handleMatchClick={handleMatchClick}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end pt-6">
          <div className="flex space-x-2">
            <Button type="button" variant="minimal" onClick={resetAllStates}>
              Cancel
            </Button>
            <Button variant="darkCTA" type="submit" loading={isCreatingAction}>
              Create action
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
