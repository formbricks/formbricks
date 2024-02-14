"use client";

import { ArrowRight, Copy, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";

import { Button } from "../../Button";
import { fetchEnvironment, updateUserAction } from "../actions";

export function Connect({ environment, webAppUrl }: { environment: TEnvironment; webAppUrl: string }) {
  const router = useRouter();
  const [loading, setloading] = useState(false);
  const [localEnvironment, setLocalEnvironment] = useState(environment);

  const goToProduct = () => {
    finishOnboarding();
    router.push("/");
  };
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
  }, []);

  const goToTeamInvitePage = () => {
    try {
      setloading(true);
      router.push("/onboarding/inApp/inviteTeamMate");
    } catch (error) {
      setloading(false);
    }
  };

  const finishOnboarding = async () => {
    try {
      const updatedProfile = { onboardingCompleted: true };
      await updateUserAction(updatedProfile);
    } catch (e) {
      toast.error("An error occured saving your settings.");
      console.error(e);
    }
  };

  const codeSnippet = `<!-- START Formbricks Surveys -->
    <script type="text/javascript">
        !function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="https://unpkg.com/@formbricks/js@^1.4.0/dist/index.umd.js";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init({environmentId: "${environment.id}", apiHost: "${webAppUrl}"})},500)}();
        </script>
    <!-- END Formbricks Surveys -->`;

  if (localEnvironment.widgetSetupCompleted) {
    return (
      <div className="mt-12 w-[40rem] text-center">
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
          <Button variant="primary" className="mt-4" onClick={goToProduct}>
            See example survey in you app <Eye className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 text-right">
          <Button
            variant="minimal"
            onClick={() => {
              finishOnboarding();
              router.push("/");
            }}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  } else {
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
          <Button variant="secondary">Use NPM</Button>
        </div>
        <Button className="mt-6" variant="minimal" onClick={goToTeamInvitePage} loading={loading}>
          I am not sure how to do this
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }
}
