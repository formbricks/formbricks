"use client";

import OnboardingTitle from "@/app/(app)/onboarding/components/OnboardingTitle";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

import { finishOnboardingAction, inviteTeamMateAction } from "../../actions";

interface InviteTeamMateProps {
  team: TTeam;
  environmentId: string;
  setCurrentStep: (currentStep: number) => void;
}

const DEFAULT_INVITE_MESSAGE =
  "I'm looking into Formbricks to run targeted surveys. Can you help me set it up? 🙏";
const INITIAL_FORM_STATE = { email: "", inviteMessage: DEFAULT_INVITE_MESSAGE };

function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return regex.test(email);
}

function InviteMessageInput({ value, onChange }) {
  return (
    <textarea
      rows={5}
      placeholder="engineering@acme.com"
      className="focus:border-brand-dark flex w-full rounded-md border border-slate-300 bg-transparent bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
      value={value}
      onChange={onChange}
    />
  );
}

export function InviteTeamMate({ team, environmentId, setCurrentStep }: InviteTeamMateProps) {
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleInputChange = (e, name) => {
    const value = e.target.value;
    setFormState({ ...formState, [name]: value });
  };

  const handleInvite = async () => {
    if (!isValidEmail(formState.email)) {
      toast.error("Invalid Email");
      return;
    }
    try {
      await inviteTeamMateAction(team.id, formState.email, "developer", formState.inviteMessage);
      toast.success("Invite sent successful");
      goToProduct();
    } catch (error) {
      toast.error(error.message || "An unexpected error occurred");
    }
  };

  const goToProduct = async () => {
    setIsLoading(true);
    try {
      if (typeof localStorage !== undefined) {
        localStorage.removeItem("onboardingPathway");
        localStorage.removeItem("onboardingCurrentStep");
      }
      await finishOnboardingAction();
      router.push(`/environments/${environmentId}/surveys`);
    } catch (error) {
      toast.error("An error occurred saving your settings.");
      console.error(error);
    }
  };

  const goBackToConnectPage = () => {
    setCurrentStep(4);
    localStorage.setItem("onboardingCurrentStep", "4");
  };

  return (
    <div className="mb-8 w-full max-w-xl space-y-8">
      <OnboardingTitle
        title="Invite your team to help out"
        subtitle="Ask your tech-savvy co-worker to finish the setup:"
      />
      <div className="flex h-[65vh] flex-col justify-between">
        <div className="space-y-4">
          <Input
            tabIndex={0}
            placeholder="engineering@acme.com"
            className="w-full bg-white"
            value={formState.email}
            onChange={(e) => handleInputChange(e, "email")}
          />

          <InviteMessageInput
            value={formState.inviteMessage}
            onChange={(e) => handleInputChange(e, "inviteMessage")}
          />

          <div className="flex w-full justify-between">
            <Button id="onboarding-inapp-invite-back" variant="minimal" onClick={() => goBackToConnectPage()}>
              Back
            </Button>
            <Button id="onboarding-inapp-invite-send-invite" variant="darkCTA" onClick={handleInvite}>
              Invite
            </Button>
          </div>
        </div>
        <div className="mt-auto flex justify-center">
          <Button
            id="onboarding-inapp-invite-have-a-look-first"
            className="font-normal text-slate-400"
            variant="minimal"
            onClick={goToProduct}
            loading={isLoading}>
            I want to have a look around first <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
