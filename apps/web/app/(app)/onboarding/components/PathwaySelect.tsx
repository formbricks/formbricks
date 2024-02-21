import InappMockup from "@/images/onboarding-in-app-survey.png";
import LinkMockup from "@/images/onboarding-link-survey.webp";
import Image from "next/image";

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
  const handleSelect = async (pathway: PathwayOptionType) => {
    if (pathway === "link") {
      SET_CURRENT_STEP(2);
      localStorage.setItem("CURRENT_STEP", "2");
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
          size="lg"
          title="Link Surveys"
          description="Create a new survey and share a link."
          onSelect={() => {
            handleSelect("link");
          }}>
          <Image src={LinkMockup} alt="" height={350} />
        </OptionCard>
        <OptionCard
          size="lg"
          title="In-app Surveys"
          description="Run a survey on a website or in-app."
          onSelect={() => {
            handleSelect("in-app");
          }}>
          <Image src={InappMockup} alt="" height={350} />
        </OptionCard>
      </div>
    </div>
  );
}
