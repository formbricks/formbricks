import LayoutWaitlist from "@/components/shared/LayoutLight";
import TemplateList from "@/components/dummyUI/TemplateList";

export default function DemoPage() {
  return (
    <LayoutWaitlist
      title="Formbricks Demo"
      description="Leverage 30+ templates to kick-start your experience management.">
      <TemplateList />
    </LayoutWaitlist>
  );
}
