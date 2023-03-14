import WhenToSendCard from "./WhenToSendCard";

export default function AudienceView({ environmentId, triggers, setTriggers }) {
  return (
    <div className="p-5">
      <WhenToSendCard triggers={triggers} setTriggers={setTriggers} environmentId={environmentId} />
    </div>
  );
}
