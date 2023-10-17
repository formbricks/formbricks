"use client";
import { cn } from "@formbricks/lib/cn";
import { md } from "@formbricks/lib/markdownIt";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Editor } from "@formbricks/ui/Editor";
import FileInput from "@formbricks/ui/FileInput";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import * as Collapsible from "@radix-ui/react-collapsible";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface EditWelcomeCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId: string | null;
}

export default function EditWelcomeCard({
  localSurvey,
  setLocalSurvey,
  setActiveQuestionId,
  activeQuestionId,
}: EditWelcomeCardProps) {
  const [firstRender, setFirstRender] = useState(true);
  const path = usePathname();
  const environmentId = path?.split("/environments/")[1]?.split("/")[0];
  // const [open, setOpen] = useState(false);
  let open = activeQuestionId == "start";
  const setOpen = (e) => {
    if (e) {
      setActiveQuestionId("start");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data) => {
    setLocalSurvey({
      ...localSurvey,
      welcomeCard: {
        ...localSurvey.welcomeCard,
        ...data,
      },
    });
  };
  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg " : "scale-97 shadow-md",
        "flex flex-row rounded-lg bg-white transition-transform duration-300 ease-in-out"
      )}>
      <div
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "flex w-10 items-center justify-center rounded-l-lg hover:bg-slate-600 group-aria-expanded:rounded-bl-none"
        )}>
        <p>✋</p>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Welcome Card</p>
                {!open && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {localSurvey?.welcomeCard?.enabled ? "Shown" : "Hidden"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="welcome-toggle">Enabled</Label>

              <Switch
                id="welcome-toggle"
                checked={localSurvey?.welcomeCard?.enabled}
                onClick={(e) => {
                  e.stopPropagation();
                  updateSurvey({ enabled: !localSurvey.welcomeCard?.enabled });
                }}
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <form>
            <div className="mt-2">
              <Label htmlFor="companyLogo">Company Logo</Label>
            </div>
            <div className="mt-3 flex w-full items-center justify-center">
              <FileInput
                allowedFileExtensions={["png", "jpeg", "jpg"]}
                environmentId={environmentId}
                onFileUpload={(url: string) => {
                  updateSurvey({ fileUrl: url });
                }}
                fileUrl={localSurvey?.welcomeCard?.fileUrl}
              />
            </div>
            <div className="mt-3">
              <Label htmlFor="headline">Headline</Label>
              <div className="mt-2">
                <Input
                  id="headline"
                  name="headline"
                  defaultValue={localSurvey?.welcomeCard?.headline}
                  onChange={(e) => {
                    updateSurvey({ headline: e.target.value });
                  }}
                />
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="subheader">Welcome Message</Label>
              <div className="mt-2">
                <Editor
                  getText={() =>
                    md.render(
                      localSurvey?.welcomeCard?.html || "Thanks for providing your feedback - let's go!"
                    )
                  }
                  setText={(value: string) => {
                    updateSurvey({ html: value });
                  }}
                  excludedToolbarItems={["blockType"]}
                  disableLists
                  firstRender={firstRender}
                  setFirstRender={setFirstRender}
                />
              </div>
            </div>

            <div className="mt-3 flex justify-between gap-8">
              <div className="flex w-full space-x-2">
                <div className="w-full">
                  <Label htmlFor="buttonLabel">Button Label</Label>
                  <div className="mt-2">
                    <Input
                      id="buttonLabel"
                      name="buttonLabel"
                      value={localSurvey?.welcomeCard?.buttonLabel || "Next"}
                      onChange={(e) => updateSurvey({ buttonLabel: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/*             <div className="mt-8 flex items-center">
              <div className="mr-2">
                <Switch
                  id="timeToFinish"
                  name="timeToFinish"
                  checked={localSurvey?.welcomeCard?.timeToFinish}
                  onCheckedChange={() =>
                    updateSurvey({ timeToFinish: !localSurvey.welcomeCard.timeToFinish })
                  }
                />
              </div>
              <div className="flex-column">
                <Label htmlFor="timeToFinish" className="">
                  Time to Finish
                </Label>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Display an estimate of completion time for survey
                </div>
              </div>
            </div> */}
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
}
