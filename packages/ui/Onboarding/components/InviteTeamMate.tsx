"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TTeam } from "@formbricks/types/teams";

import { Button } from "../../Button";
import { Input } from "../../Input";
import { inviteTeamMateAction } from "../actions";
import { updateUserAction } from "../actions";

interface InviteTeamMateProps {
  team: TTeam;
  environmentId: string;
}

export function InviteTeamMate({ team, environmentId }: InviteTeamMateProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [inviteMessage, setInviteMessage] = useState(
    "I'm checking out Formbricks to run targeted surveys. Would appreciate your help in setting it up."
  );

  const isValidEmail = (email: string) => {
    var regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return regex.test(email);
  };

  const handleInvite = async () => {
    try {
      if (!isValidEmail(email)) {
        toast.error("Invalid Email");
        return;
      }
      await inviteTeamMateAction(team.id, email, "developer", inviteMessage);
      toast.success("Invite sent successful");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred");
      }
    }
  };

  const goBack = () => {
    router.push(`/onboarding/inApp/connect`);
  };

  const finishOnboarding = async () => {
    setIsLoading(true);

    try {
      const updatedProfile = { onboardingCompleted: true };
      await updateUserAction(updatedProfile);

      if (team) {
        router.push(`/environments/${environmentId}/surveys`);
        return;
      }
    } catch (e) {
      toast.error("An error occured saving your settings.");
      setIsLoading(false);
      console.error(e);
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-4 text-left">
          <p>Adjust invite message:</p>
          <textarea
            rows={5}
            placeholder="engineering@acme.com"
            className="focus:border-brand-dark flex w-full rounded-md border border-slate-300 bg-transparent bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
          />
        </div>

        <div className="flex w-full justify-between">
          <Button variant="minimal" onClick={goBack}>
            Back
          </Button>
          <Button variant="primary" onClick={handleInvite}>
            Invite co-worker
          </Button>
        </div>
      </div>
      <Button variant="minimal" onClick={finishOnboarding} loading={isLoading}>
        I want to have a look around first <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
