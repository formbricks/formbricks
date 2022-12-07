import SubmissionsPage from "@/components/forms/submissions/SubmissionsPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperForm";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function Submissions({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <LayoutWrapperForm>
          <SubmissionsPage />
        </LayoutWrapperForm>
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
