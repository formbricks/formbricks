"use client";

import { updateUserAction } from "@/app/(app)/onboarding/actions";
import OnboardingTitle from "@/app/(app)/onboarding/components/OnboardingTitle";
import { handleTabNavigation } from "@/app/(app)/onboarding/utils";
import { createResponse, formbricksEnabled } from "@/app/lib/formbricks";
import { Session } from "next-auth";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { env } from "@formbricks/lib/env";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

type RoleProps = {
  setFormbricksResponseId: (id: string) => void;
  session: Session;
  setCurrentStep: (currentStep: number) => void;
};

type RoleChoice = {
  label: string;
  id: "project_manager" | "engineer" | "founder" | "marketing_specialist" | "other";
};

export const Role: React.FC<RoleProps> = ({ setFormbricksResponseId, session, setCurrentStep }) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const [otherValue, setOtherValue] = useState("");

  useEffect(() => {
    const onKeyDown = handleTabNavigation(fieldsetRef, setSelectedChoice);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fieldsetRef, setSelectedChoice]);

  const roles: Array<RoleChoice> = [
    { label: "Project Manager", id: "project_manager" },
    { label: "Engineer", id: "engineer" },
    { label: "Founder", id: "founder" },
    { label: "Marketing Specialist", id: "marketing_specialist" },
    { label: "Other", id: "other" },
  ];

  const next = () => {
    setCurrentStep(3);
    localStorage.setItem("onboardingCurrentStep", "3");
  };

  const handleNextClick = async () => {
    if (selectedChoice === "Other" && otherValue.trim() === "") {
      toast.error("Other value missing");
      return;
    }
    if (selectedChoice) {
      const selectedRole = roles.find((role) => role.label === selectedChoice);
      if (selectedRole) {
        try {
          setIsUpdating(true);
          await updateUserAction({
            role: selectedRole.id,
          });
          setIsUpdating(false);
        } catch (e) {
          setIsUpdating(false);
          toast.error("An error occured saving your settings");
          console.error(e);
        }
        if (formbricksEnabled && env.NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID) {
          const res = await createResponse(env.NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID, session.user.id, {
            role: selectedRole.id === "other" ? otherValue : selectedRole.label,
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
    <div className="flex w-full max-w-xl flex-col gap-8">
      <OnboardingTitle
        title="What is your role?"
        subtitle="Make your Formbricks experience more personalised."
      />
      <fieldset id="choices" aria-label="What is your role?" ref={fieldsetRef}>
        <legend className="sr-only">Choices</legend>
        <div className="relative space-y-2 rounded-md">
          {roles.map((choice) => (
            <label
              key={choice.id}
              htmlFor={choice.id}
              className={cn(
                selectedChoice === choice.label
                  ? "z-10 border-slate-400 bg-slate-100"
                  : "border-slate-200  bg-white hover:bg-slate-50",
                "relative flex cursor-pointer flex-col rounded-md border  p-4 focus:outline-none"
              )}>
              <span className="flex items-center">
                <input
                  type="radio"
                  id={choice.id}
                  value={choice.label}
                  name="role"
                  checked={choice.label === selectedChoice}
                  className="checked:text-brand-dark focus:text-brand-dark h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
                  aria-labelledby={`${choice.id}-label`}
                  onChange={(e) => {
                    setSelectedChoice(e.currentTarget.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNextClick();
                    }
                  }}
                />
                <span id={`${choice.id}-label`} className="ml-3 text-sm text-slate-700">
                  {choice.label}
                </span>
              </span>
              {choice.id === "other" && selectedChoice === "Other" && (
                <div className="mt-4 w-full">
                  <Input
                    className="bg-white"
                    autoFocus
                    placeholder="Please specify"
                    value={otherValue}
                    onChange={(e) => setOtherValue(e.target.value)}
                  />
                </div>
              )}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-between">
        <Button className="text-slate-500" variant="minimal" onClick={next} id="role-skip">
          Skip
        </Button>
        <Button
          variant="darkCTA"
          loading={isUpdating}
          disabled={!selectedChoice}
          onClick={handleNextClick}
          id="onboarding-inapp-role-next">
          Next
        </Button>
      </div>
    </div>
  );
};
