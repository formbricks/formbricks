import SubmissionsPage from "@/components/forms/submissions/SubmissionsPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperForm";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function Submissions({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <LayoutWrapperForm>
          <SubmissionsPage />
        </LayoutWrapperForm>
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
