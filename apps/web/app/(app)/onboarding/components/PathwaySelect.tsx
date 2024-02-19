import { finishOnboardingAction } from "@/app/(app)/onboarding/actions";
import { useRouter } from "next/navigation";

import { OptionCard } from "@formbricks/ui/OptionCard";

interface PathwaySelectProps {
  setSelectedPathway: (pathway: "link" | "in-app" | null) => void;
  SET_CURRENT_STEP: (currentStep: number) => void;
  isFormbricksCloud: boolean;
}

type PathwayOptionType = "link" | "in-app";

export default function PathwaySelect({
  setSelectedPathway,
  SET_CURRENT_STEP,
  isFormbricksCloud,
}: PathwaySelectProps) {
  const router = useRouter();

  const handleSelect = async (pathway: PathwayOptionType) => {
    if (pathway === "link") {
      if (isFormbricksCloud) {
        SET_CURRENT_STEP(2);
        localStorage.setItem("CURRENT_STEP", "2");
      } else {
        await finishOnboardingAction();
        localStorage.setItem("pathway", "link");
        router.push("/");
      }
      localStorage.setItem("pathway", "link");
    } else {
      localStorage.setItem("pathway", "in-app");
      if (isFormbricksCloud) {
        SET_CURRENT_STEP(2);
        localStorage.setItem("CURRENT_STEP", "2");
      } else {
        SET_CURRENT_STEP(4);
        localStorage.setItem("CURRENT_STEP", "4");
      }
    }
    setSelectedPathway(pathway);
  };

  return (
    <div className="space-y-16 text-center">
      <div className="space-y-4">
        <p className="text-4xl font-medium text-slate-800">How would you like to start?</p>
        <p className="text-sm text-slate-500">Later, you can always use all types of surveys.</p>
      </div>
      <div className="flex space-x-8">
        <OptionCard
          title="Link Surveys"
          description="Create a new survey and share a link."
          onSelect={() => {
            handleSelect("link");
          }}
        />
        <OptionCard
          title="In-app Surveys"
          description="Run a survey on a website or in-app."
          onSelect={() => {
            handleSelect("in-app");
          }}
        />
      </div>
    </div>
  );
}
