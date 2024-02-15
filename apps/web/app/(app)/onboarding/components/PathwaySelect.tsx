import { OptionCard } from "@formbricks/ui/OptionCard";

interface PathwaySelectProps {
  setSelectedPathway: (pathway: "link" | "in-app" | null) => void;
}

type PathwayOptionType = "link" | "in-app";

export default function PathwaySelect({ setSelectedPathway }: PathwaySelectProps) {
  // Helper function to handle selection
  const handleSelect = (pathway: PathwayOptionType) => {
    if (pathway === "link") {
      localStorage.setItem("isNewUser", "true");
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
          onSelect={() => handleSelect("link")}
        />
        <OptionCard
          title="In-app Surveys"
          description="Run a survey on a website or in-app."
          onSelect={() => handleSelect("in-app")}
        />
      </div>
    </div>
  );
}
