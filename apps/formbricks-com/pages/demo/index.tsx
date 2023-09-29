import DemoView from "@/components/dummyUI/DemoView";
import LayoutWaitlist from "@/pages/formtribe/LayoutLight";

export default function DemoPage() {
  return (
    <LayoutWaitlist
      title="Formbricks Demo"
      description="Play around with our pre-defined 30+ templates and them to kick-start your survey & experience management.">
      <DemoView />
    </LayoutWaitlist>
  );
}
