"use client";

import { customSurvey } from "@/app/(app)/environments/[environmentId]/surveys/templates/templates";
import { ArrowRight, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { Button } from "@formbricks/ui/Button";

import { createSurveyFromTemplate, fetchEnvironment, finishOnboardingAction } from "../actions";

const goToProduct = async (router) => {
  await finishOnboardingAction();
  router.push("/");
};

const goToTeamInvitePage = async () => {
  localStorage.setItem("CURRENT_STEP", "5");
};

// Custom hook for visibility change logic
const useVisibilityChange = (environment, setLocalEnvironment) => {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const refetchedEnvironment = await fetchEnvironment(environment.id);
        if (!refetchedEnvironment) return;
        setLocalEnvironment(refetchedEnvironment);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [environment, setLocalEnvironment]);
};

const ConnectedState = ({ goToProduct }) => {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <div className="mt-12 h-full w-[40rem] text-center">
      <div className="space-y-2 text-center">
        <p className="text-2xl font-medium">You&apos;re Connected!</p>
        <p>From now, it only gets easier</p>
      </div>
      <div className="border-brand mt-4 rounded-xl border bg-teal-50 p-8">
        <div className="h-24 rounded-xl bg-black">hello</div>
        <div className="mt-8 space-y-2">
          <p className="text-lg font-semibold">Good job, we&apos;re connected!</p>
          <p>You&apos;re ready to see Formbricks in action:</p>
        </div>
      </div>
      <div className="mt-4 text-right">
        <Button
          variant="minimal"
          loading={isLoading}
          onClick={() => {
            setIsLoading(true);
            goToProduct();
          }}>
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const NotConnectedState = ({ codeSnippet, goToTeamInvitePage }) => {
  return (
    <div className="flex w-[40rem] flex-col items-center justify-center p-6">
      <div className="space-y-2 text-center">
        <p className="text-2xl font-medium">Connect your app or website</p>
        <p>See formbricks in action in less than 2 minutes:</p>
      </div>
      <div className="mt-6 w-full rounded-lg border bg-white p-8">Waiting for your signal...</div>
      <div className="mt-8 w-full space-y-4">
        <p className="text-lg font-medium">Add this code snippet to your website</p>
        <p>Insert this code into the &lt;head&gt; of your website:</p>
        <div className="relative">
          <div className="w-full overflow-hidden overflow-ellipsis  rounded-xl border bg-white p-8">
            {codeSnippet}
          </div>
          <div
            className="absolute right-2 top-2 cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(codeSnippet);
              toast.success("Copied to clipboard");
            }}>
            <Copy className=" h-10 w-10 rounded-lg bg-slate-50 p-2" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex w-full space-x-2">
        <Button
          variant="primary"
          href="https://formbricks.com/docs/getting-started/framework-guides"
          target="_blank">
          Step by step manual
        </Button>
        <Button
          variant="minimal"
          href="https://formbricks.com/docs/getting-started/framework-guides"
          target="_blank">
          Use NPM
        </Button>
      </div>
      <Button className="mt-6" variant="minimal" onClick={goToTeamInvitePage}>
        I am not sure how to do this
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

interface ConnectProps {
  environment: TEnvironment;
  webAppUrl: string;
  SET_CURRENT_STEP: (currentStep: number) => void;
}

export function Connect({ environment, webAppUrl, SET_CURRENT_STEP }: ConnectProps) {
  const router = useRouter();
  const [localEnvironment, setLocalEnvironment] = useState(environment);

  useVisibilityChange(environment, setLocalEnvironment);

  useEffect(() => {
    if (localEnvironment.widgetSetupCompleted) {
      createSurvey();
    }
  }, [localEnvironment.widgetSetupCompleted]);

  useEffect(() => {
    const fetchLatestEnvironmentOnFirstLoad = async () => {
      const refetchedEnvironment = await fetchEnvironment(environment.id);
      if (!refetchedEnvironment) return;
      setLocalEnvironment(refetchedEnvironment);
    };
    fetchLatestEnvironmentOnFirstLoad();
  }, []);

  const createSurvey = async () => {
    await createSurveyFromTemplate(customSurvey, localEnvironment, "in-app");
  };

  const codeSnippet = `<!-- START Formbricks Surveys -->
    <script type="text/javascript">
        !function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="https://unpkg.com/@formbricks/js@^1.4.0/dist/index.umd.js";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init({environmentId: "${environment.id}", apiHost: "${webAppUrl}"})},500)}();
        </script>
    <!-- END Formbricks Surveys -->`;

  return localEnvironment.widgetSetupCompleted ? (
    <ConnectedState
      goToProduct={() => {
        localStorage.removeItem("CURRENT_STEP");
        localStorage.removeItem("pathway");
        goToProduct(router);
      }}
    />
  ) : (
    <NotConnectedState
      codeSnippet={codeSnippet}
      goToTeamInvitePage={() => {
        SET_CURRENT_STEP(5);
        localStorage.setItem("CURRENT_STEP", "5");
        goToTeamInvitePage();
      }}
    />
  );
}
