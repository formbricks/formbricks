import Image from "next/image";

interface PathwaySelectProps {
  setSelectedPathway: (pathway: "link" | "in-app" | null) => void;
}

type PathwayOptionType = "link" | "in-app";

interface PathwayOptionProps {
  title: string;
  description: string;
  imgSrc?: string;
  onSelect: () => void;
}

const PathwayOption: React.FC<PathwayOptionProps> = ({ title, description, imgSrc, onSelect }) => (
  <div
    className="flex h-96 w-80 cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-300 bg-white p-3 shadow-lg transition ease-in-out hover:scale-105"
    onClick={onSelect}
    role="button" // Improve accessibility
    tabIndex={0} // Make it focusable
  >
    {imgSrc && <Image src={imgSrc} alt={title} className="rounded-md" />}

    <div className="my-4 space-y-2">
      <p className="text-xl font-medium text-slate-800">{title}</p>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  </div>
);

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
        <PathwayOption
          title="Link Surveys"
          description="Create a new survey and share a link."
          onSelect={() => handleSelect("link")}
        />
        <PathwayOption
          title="In-app Surveys"
          description="Run a survey on a website or in-app."
          onSelect={() => handleSelect("in-app")}
        />
      </div>
    </div>
  );
}
