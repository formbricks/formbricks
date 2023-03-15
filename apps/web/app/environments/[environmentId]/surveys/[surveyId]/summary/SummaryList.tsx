import OpenTextSummary from "./OpenTextSummary";
import RadioSummary from "./RadioSummary";

export default function SummaryList() {
  return (
    <div className="space-y-4">
      <OpenTextSummary />
      <RadioSummary />
    </div>
  );
}
