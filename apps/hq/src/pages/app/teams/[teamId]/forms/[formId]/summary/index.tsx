import SummaryPage from "@/components/forms/summary/SummaryPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperForm";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function Submissions({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <LayoutWrapperForm>
          <SummaryPage />
        </LayoutWrapperForm>
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
