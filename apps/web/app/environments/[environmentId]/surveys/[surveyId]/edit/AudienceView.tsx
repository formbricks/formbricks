import HowToSendCard from "./HowToSendCard";
import RecontactOptionsCard from "./RecontactOptionsCard";
import WhenToSendCard from "./WhenToSendCard";

interface AudienceViewProps {
  environmentId: string;
  triggers: string[];
  setTriggers: (triggers: string[]) => void;
  showSetting: "once" | "always";
  setShowSetting: (showSetting: "once" | "always") => void;
}

export default function AudienceView({
  environmentId,
  triggers,
  setTriggers,
  showSetting,
  setShowSetting,
}: AudienceViewProps) {
  return (
    <div className="p-5">
      <div className="mb-5">
        <HowToSendCard />
      </div>
      <div className="mb-5">
        <WhenToSendCard triggers={triggers} setTriggers={setTriggers} environmentId={environmentId} />
      </div>
      <div className="mb-5">
        <RecontactOptionsCard showSetting={showSetting} setShowSetting={setShowSetting} />
      </div>
    </div>
  );
}
