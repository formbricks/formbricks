import SummaryPage from "@/components/forms/summary/SummaryPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperCustomForm";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function Submissions({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <LayoutWrapperForm>
          <SummaryPage />
        </LayoutWrapperForm>
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
