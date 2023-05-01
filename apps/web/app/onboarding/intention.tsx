"use client";

import { cn } from "@/../../packages/lib/cn";
import { Button } from "@/../../packages/ui";
import Headline from "@/components/preview/Headline";
import Subheader from "@/components/preview/Subheader";
import { useProfile } from "@/lib/profile";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { useState } from "react";
import { toast } from "react-hot-toast";

type Intention = {
  next: () => void;
  skip: () => void;
};

type IntentionChoice = {
  label: string;
  id:
    | "survey_user_segments"
    | "survey_at_specific_point_in_user_journey"
    | "enrich_customer_profiles"
    | "collect_all_user_feedback_on_one_platform"
    | "other";
};

const Intention: React.FC<Intention> = ({ next, skip }) => {
  const { profile } = useProfile();
  const { triggerProfileMutate, isMutatingProfile } = useProfileMutation();

  const intentions: Array<IntentionChoice> = [
    { label: "Survey user segments", id: "survey_user_segments" },
    { label: "Survey at specific point in user journey", id: "survey_at_specific_point_in_user_journey" },
    { label: "Enrich customer profiles", id: "enrich_customer_profiles" },
    { label: "Collect all user feedback on one platform", id: "collect_all_user_feedback_on_one_platform" },
    { label: "Other", id: "other" },
  ];

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const handleNextClick = async () => {
    if (selectedChoice) {
      const selectedIntention = intentions.find((intention) => intention.label === selectedChoice);
      if (selectedIntention) {
        try {
          const updatedProfile = { ...profile, intention: selectedIntention.id };
          await triggerProfileMutate(updatedProfile);
        } catch (e) {
          toast.error('An error occured saving your settings')
          console.log(e);
        }
        next();
      }
    }
  };

  return (
    <div className="animate-fadeIn flex w-full max-w-xl flex-col gap-8 px-8 duration-500">
      <div className="px-4">
        <Headline headline="What are you planning to use Formbricks for?" questionId="none" />
        <Subheader subheader="Help us recommend you tried and tested best practices." questionId="none" />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className=" relative space-y-2 rounded-md">
              {intentions.map((choice) => (
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
                      className=" checked:text-brand-dark  focus:text-brand-dark h-4 w-4 border border-gray-300  focus:ring-0 focus:ring-offset-0"
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
      <div className="flex justify-between">
        <Button size="lg" variant="minimal" className="text-slate-400" onClick={skip}>
          Skip
        </Button>
        <Button
          size="lg"
          variant="primary"
          loading={isMutatingProfile}
          disabled={!selectedChoice}
          onClick={handleNextClick}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default Intention;
