import LegalFooter from "@/app/s/[surveyId]/LegalFooter";

export default function SurveyLayout({ children }) {
  return (
    <div className="flex h-full flex-col justify-between bg-white">
      <div className="h-full overflow-y-auto">{children}</div>
      <LegalFooter />
    </div>
  );
}
