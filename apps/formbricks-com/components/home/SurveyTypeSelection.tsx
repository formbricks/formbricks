import InappMockup from "@/images/survey-type-inapp.png";
import LinkMockup from "@/images/survey-type-link.webp";
import WebsiteMockup from "@/images/survey-type-website.png";
import Image from "next/image";
import { useRouter } from "next/router";

import { OptionCard } from "@formbricks/ui/OptionCard";

import HeadingCentered from "../shared/HeadingCentered";

export const SurveyTypeSelection: React.FC = () => {
  const router = useRouter();

  return (
    <div className="relative">
      <HeadingCentered
        teaser="Measure satisfaction continuously"
        heading="Ask anywhere, get insights in one place"
        subheading="Follow individual feedback trails or zoom out for the big picture. All in one place."
      />

      <div className="flex space-x-8 text-center">
        <OptionCard
          size="lg"
          title="On your website"
          description="Target specific visitors on your websites."
          onSelect={() => {
            router.push("/website-survey");
          }}>
          <Image src={WebsiteMockup} alt="" height={350} />
        </OptionCard>
        <OptionCard
          size="lg"
          title="In emails"
          description="Create on brand surveys, embedded in your emails."
          onSelect={() => {
            router.push("/open-source-form-builder");
          }}>
          <Image src={LinkMockup} alt="" height={350} />
        </OptionCard>
        <OptionCard
          size="lg"
          title="In your app"
          description="Research any user cohort in your app."
          onSelect={() => {
            router.push("/in-app-survey");
          }}>
          <Image src={InappMockup} alt="" height={350} />
        </OptionCard>
      </div>
    </div>
  );
};

export default SurveyTypeSelection;
