
import LegalFooter from "@/app/s/[surveyId]/components/LegalFooter";
import { GoogleTagManager } from "@next/third-parties/google";
import { GTM_ID } from "@formbricks/lib/constants";

export default async function SurveyLayout({ children }) {
  return (
    <div className="flex h-full flex-col justify-between bg-white">
      <GoogleTagManager gtmId={GTM_ID} />
      <div className="h-full overflow-y-auto">{children}</div>
      <LegalFooter />
    </div>
  );

