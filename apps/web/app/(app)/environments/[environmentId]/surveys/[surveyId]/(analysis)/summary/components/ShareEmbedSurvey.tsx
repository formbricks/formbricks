import { useMemo } from "react";
import { useProfile } from "@/lib/profile";
import { TProduct } from "@formbricks/types/v1/product";
import { TSurvey } from "@formbricks/types/v1/surveys";
import EmbedSurveyModal from "./EmbedSurveyModal";
import EmbedSurveySheet from "./EmbedSurveySheet";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyBaseUrl: string;
  product: TProduct;
}

export default function ShareEmbedSurvey({
  survey,
  open,
  setOpen,
  surveyBaseUrl,
  product,
}: ShareEmbedSurveyProps) {
  const surveyUrl = useMemo(() => surveyBaseUrl + survey.id, [survey]);
  const { profile } = useProfile();

  console.log({ survey, open, setOpen, surveyBaseUrl, product });
  return (
    <div className="">
      <div className="hidden lg:hidden">
        {/* <EmbedSurveyModal
          survey={survey}
          open={open}
          setOpen={setOpen}
          product={product}
          surveyBaseUrl={surveyBaseUrl}
          profile = {profile}
        /> */}
      </div>
      <div className="invisible hidden lg:hidden">
        <EmbedSurveySheet
          survey={survey}
          open={open}
          setOpen={setOpen}
          product={product}
          surveyUrl={surveyUrl}
          profile={profile}
        />
      </div>
    </div>
  );
}
