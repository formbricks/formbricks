"use client";

import { cn } from "@formbricks/lib/cn";
import { updateProfileAction } from "@/app/(app)/onboarding/actions";
import { env } from "@/env.mjs";
import { createResponse, formbricksEnabled } from "@/lib/formbricks";
import { TProfile } from "@formbricks/types/v1/profile";
import { Button } from "@formbricks/ui";
import { useState } from "react";
import { toast } from "react-hot-toast";

type RoleProps = {
  next: () => void;
  skip: () => void;
  setFormbricksResponseId: (id: string) => void;
  profile: TProfile;
};

type RoleChoice = {
  label: string;
  id: "project_manager" | "engineer" | "founder" | "marketing_specialist" | "other";
};

const Role: React.FC<RoleProps> = ({ next, skip, setFormbricksResponseId, profile }) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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
          setIsUpdating(true);
          const updatedProfile = { ...profile, role: selectedRole.id };
          await updateProfileAction(updatedProfile);
          setIsUpdating(false);
        } catch (e) {
          setIsUpdating(false);
          toast.error("An error occured saving your settings");
          console.error(e);
        }
        if (formbricksEnabled && env.NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID) {
          const res = await createResponse(env.NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID, {
            role: selectedRole.label,
          });
          if (res.ok) {
            const response = res.data;
            setFormbricksResponseId(response.id);
          } else {
            console.error("Error sending response to Formbricks", res.error);
          }
        }
        next();
      }
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <label className="mb-1.5 block text-base font-semibold leading-6 text-slate-900">
          What is your role?
        </label>
        <label className="block text-sm font-normal leading-6 text-slate-500">
          Make your Formbricks experience more personalised.
        </label>
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
        <Button size="lg" className="text-slate-400" variant="minimal" onClick={skip} id="role-skip">
          Skip
        </Button>
        <Button
          size="lg"
          variant="darkCTA"
          loading={isUpdating}
          disabled={!selectedChoice}
          onClick={handleNextClick}
          id="role-next">
          Next
        </Button>
      </div>
    </div>
  );
};

export default Role;
