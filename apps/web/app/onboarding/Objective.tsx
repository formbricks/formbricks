"use client";

import { cn } from "@/../../packages/lib/cn";
import { Objective } from "@/../../packages/types/templates";
import { Button } from "@/../../packages/ui";
import Headline from "@/components/preview/Headline";
import Subheader from "@/components/preview/Subheader";
import { useProfile } from "@/lib/profile";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { useState } from "react";
import { toast } from "react-hot-toast";

type ObjectiveProps = {
  next: () => void;
  skip: () => void;
};

type ObjectiveChoice = {
  label: string;
  id: Objective;
};

const Objective: React.FC<ObjectiveProps> = ({ next, skip }) => {
  const objectives: Array<ObjectiveChoice> = [
    { label: "Increase conversion", id: "increase_conversion" },
    { label: "Improve user retention", id: "improve_user_retention" },
    { label: "Increase user adoption", id: "increase_user_adoption" },
    { label: "Sharpen marketing messaging", id: "sharpen_marketing_messaging" },
    { label: "Support sales", id: "support_sales" },
    { label: "Other", id: "other" },
  ];

  const { profile } = useProfile();
  const { triggerProfileMutate, isMutatingProfile } = useProfileMutation();

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const handleNextClick = async () => {
    if (selectedChoice) {
      const selectedObjective = objectives.find((objective) => objective.label === selectedChoice);
      if (selectedObjective) {
        try {
          const updatedProfile = { ...profile, objective: selectedObjective.id };
          await triggerProfileMutate(updatedProfile);
        } catch (e) {
          console.error(e);
          toast.error("An error occured saving your settings");
        }
        next();
      }
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="What do you want to achieve?" questionId="none" />
        <Subheader
          subheader="We have 85+ templates, help us select the best for your need:"
          questionId="none"
        />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className=" relative space-y-2 rounded-md">
              {objectives.map((choice) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === choice.label
                      ? "z-10 border-slate-400 bg-slate-100"
                      : "border-gray-200",
                    "relative flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-100 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      value={choice.label}
                      checked={choice.label === selectedChoice}
                      className="checked:text-brand-dark  focus:text-brand-dark  h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        setSelectedChoice(e.currentTarget.value);
                      }}
                    />
                    <span id={`${choice.id}-label`} className="ml-3 font-medium">
                      {choice.label}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <div className="mb-24 flex justify-between">
        <Button size="lg" className="text-slate-400" variant="minimal" onClick={skip} id="objective-skip">
          Skip
        </Button>
        <Button
          size="lg"
          variant="darkCTA"
          loading={isMutatingProfile}
          disabled={!selectedChoice}
          onClick={handleNextClick}
          id="objective-next">
          Next
        </Button>
      </div>
    </div>
  );
};

export default Objective;
