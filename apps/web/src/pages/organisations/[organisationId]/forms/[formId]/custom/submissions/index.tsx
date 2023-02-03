import SubmissionsPage from "@/components/forms/submissions/SubmissionsPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperCustomForm";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function Submissions({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <LayoutWrapperForm>
          <SubmissionsPage />
        </LayoutWrapperForm>
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
