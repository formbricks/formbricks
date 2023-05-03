"use client";

import { cn } from "@/../../packages/lib/cn";
import { Button } from "@/../../packages/ui";
import Headline from "@/components/preview/Headline";
import Subheader from "@/components/preview/Subheader";
import { useProfile } from "@/lib/profile";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { useState } from "react";
import { toast } from "react-hot-toast";

type Role = {
  next: () => void;
  skip: () => void;
};

type RoleChoice = {
  label: string;
  id: "project_manager" | "engineer" | "founder" | "marketing_specialist" | "other";
};

const Role: React.FC<Role> = ({ next, skip }) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const { profile } = useProfile();
  const { triggerProfileMutate, isMutatingProfile } = useProfileMutation();

  const roles: Array<RoleChoice> = [
    { label: "Project Manager", id: "project_manager" },
    { label: "Engineer", id: "engineer" },
    { label: "Founder", id: "founder" },
    { label: "Marketing Specialist", id: "marketing_specialist" },
    { label: "Other", id: "other" },
  ];

  const handleNextClick = async () => {
    if (selectedChoice) {
      const selectedRole = roles.find((role) => role.label === selectedChoice);
      if (selectedRole) {
        try {
          const updatedProfile = { ...profile, role: selectedRole.id };
          await triggerProfileMutate(updatedProfile);
        } catch (e) {
          toast.error("An error occured saving your settings");
          console.error(e);
        }
        next();
      }
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="What is your role?" questionId="none" />
        <Subheader subheader="Make your Formbricks experience more personalised." questionId="none" />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className=" relative space-y-2 rounded-md">
              {roles.map((choice) => (
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
                      className="checked:text-brand-dark  focus:text-brand-dark h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
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
        <Button size="lg" className="text-slate-400" variant="minimal" onClick={skip}>
          Skip
        </Button>
        <Button
          size="lg"
          variant="darkCTA"
          loading={isMutatingProfile}
          disabled={!selectedChoice}
          onClick={handleNextClick}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default Role;
