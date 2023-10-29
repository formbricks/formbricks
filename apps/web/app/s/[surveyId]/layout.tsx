import LegalFooter from "@/app/s/[surveyId]/components/LegalFooter";
import SurveyBg from "@/app/s/[surveyId]/components/SurveyBg";

export default async function SurveyLayout({ children }) {
  return (
    <div>
      <div className="h-screen">{children}</div>
      <LegalFooter />
    </div>
  );
}
