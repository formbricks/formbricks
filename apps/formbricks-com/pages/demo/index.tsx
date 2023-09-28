import DemoView from "@/components/dummyUI/DemoView";
import LayoutWaitlist from "@/pages/formtribe/LayoutLight";

export default function DemoPage() {
  return (
    <LayoutWaitlist
      title="Formbricks Demo"
      description="Leverage 30+ templates to kick-start your experience management.">
      <DemoView />
    </LayoutWaitlist>
  );
}
