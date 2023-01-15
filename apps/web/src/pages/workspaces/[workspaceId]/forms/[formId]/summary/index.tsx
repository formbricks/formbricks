import SummaryPage from "@/components/forms/summary/SummaryPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperForm";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function Submissions({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <LayoutWrapperForm>
          <SummaryPage />
        </LayoutWrapperForm>
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
