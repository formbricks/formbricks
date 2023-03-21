import HowToSendCard from "./HowToSendCard";
import RecontactOptionsCard from "./RecontactOptionsCard";
import WhenToSendCard from "./WhenToSendCard";

export default function AudienceView({ environmentId, triggers, setTriggers }) {
  return (
    <div className="p-5">
      <div className="mb-5">
        <HowToSendCard />
      </div>
      <div className="mb-5">
        <WhenToSendCard triggers={triggers} setTriggers={setTriggers} environmentId={environmentId} />
      </div>
      <div className="mb-5">
        <RecontactOptionsCard />
      </div>
    </div>
  );
}
