"use client";

import QuestionFormInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import * as Collapsible from "@radix-ui/react-collapsible";

import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";

interface EditThankYouCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId: string | null;
}

export default function EditThankYouCard({
  localSurvey,
  setLocalSurvey,
  setActiveQuestionId,
  activeQuestionId,
}: EditThankYouCardProps) {
  // const [open, setOpen] = useState(false);
  let open = activeQuestionId == "end";
  const setOpen = (e) => {
    if (e) {
      setActiveQuestionId("end");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data) => {
    setLocalSurvey({
      ...localSurvey,
      thankYouCard: {
        ...localSurvey.thankYouCard,
        ...data,
      },
    });
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg " : "scale-97 shadow-md",
        "z-20 flex flex-row rounded-lg bg-white transition-transform duration-300 ease-in-out"
      )}>
      <div
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "flex w-10 items-center justify-center rounded-l-lg hover:bg-slate-600 group-aria-expanded:rounded-bl-none"
        )}>
        <p>🙏</p>
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
                <p className="text-sm font-semibold">Thank You Card</p>
                {!open && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {localSurvey?.thankYouCard?.enabled ? "Shown" : "Hidden"}
                  </p>
                )}
              </div>
            </div>

            {localSurvey.type !== "link" && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="thank-you-toggle">Show</Label>

                <Switch
                  id="thank-you-toggle"
                  checked={localSurvey?.thankYouCard?.enabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSurvey({ enabled: !localSurvey.thankYouCard?.enabled });
                  }}
                />
              </div>
            )}
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <form>
            <QuestionFormInput
              localSurvey={localSurvey}
              environmentId={localSurvey.environmentId}
              isInValid={false}
              questionId="end"
              questionIdx={localSurvey.questions.length}
              updateQuestion={updateSurvey}
              type="headline"
            />

            <div>
              <div className="flex w-full items-center">
                <QuestionFormInput
                  localSurvey={localSurvey}
                  environmentId={localSurvey.environmentId}
                  isInValid={false}
                  questionId="end"
                  questionIdx={localSurvey.questions.length}
                  updateQuestion={updateSurvey}
                  type="subheader"
                />
              </div>
            </div>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
}
