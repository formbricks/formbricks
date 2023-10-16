import LegalFooter from "@/app/s/[surveyId]/components/LegalFooter";
import { type Metadata } from "next/types";

export const metadata: Metadata = {
  title: "Formbricks",
  description: "Open-Source In-Product Survey Platform",
  openGraph: {
    title: "Formbricks",
    description: "Open-Source In-Product Survey Platform",
  },
  twitter: {
    title: "Formbricks",
    description: "Open-Source In-Product Survey Platform",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function SurveyLayout({ children }) {
  return (
    <div className="flex h-full flex-col justify-between bg-white">
      <div className="h-full overflow-y-auto">{children}</div>
      <LegalFooter />
    </div>
  );
}
