"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

import { finishOnboardingAction, inviteTeamMateAction } from "../actions";

interface InviteTeamMateProps {
  team: TTeam;
  environmentId: string;
}

const DEFAULT_INVITE_MESSAGE =
  "I'm checking out Formbricks to run targeted surveys. Would appreciate your help in setting it up.";
const INITIAL_FORM_STATE = { email: "", inviteMessage: DEFAULT_INVITE_MESSAGE };

function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
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

export function InviteTeamMate({ team, environmentId }: InviteTeamMateProps) {
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
      await finishOnboardingAction();
      router.push(`/environments/${environmentId}/surveys`);
    } catch (error) {
      toast.error("An error occurred saving your settings.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-between p-6">
      <div className="mt-12 w-[30rem] space-y-4 text-center">
        <div className="space-y-4">
          <p className="text-2xl font-medium">Invite your team to help out</p>
          <p>Ask your tech-savvy co-worker to finish the setup:</p>
          <Input
            placeholder="engineering@acme.com"
            className="w-full bg-white"
            value={formState.email}
            onChange={(e) => handleInputChange(e, "email")}
          />
        </div>
        <div className="space-y-4 text-left">
          <p>Adjust invite message:</p>
          <InviteMessageInput
            value={formState.inviteMessage}
            onChange={(e) => handleInputChange(e, "inviteMessage")}
          />
        </div>
        <div className="flex w-full justify-between">
          <Button variant="minimal" onClick={() => router.push(`/onboarding/inApp/connect`)}>
            Back
          </Button>
          <Button variant="primary" onClick={handleInvite}>
            Invite co-worker
          </Button>
        </div>
      </div>
      <Button variant="minimal" onClick={goToProduct} loading={isLoading}>
        I want to have a look around first <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
