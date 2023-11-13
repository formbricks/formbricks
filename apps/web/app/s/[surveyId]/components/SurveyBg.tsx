import LegalFooter from "@/app/s/[surveyId]/components/LegalFooter";
import { TSurvey } from "@formbricks/types/surveys";

export default async function SurveyBg({ children, survey }: { children: React.ReactNode; survey: TSurvey }) {
  return survey.surveyBackground && survey.surveyBackground.bgType === "color" ? (
    <div>
      <div
        className={`flex  min-h-screen flex-col items-center justify-center px-2`}
        style={{
          backgroundColor: `${survey.surveyBackground?.bg}`,
          filter: survey.surveyBackground.brightness
            ? `brightness(${survey.surveyBackground.brightness}%)`
            : "none",
        }}>
        <div className="relative w-full">{children}</div>
      </div>
      <LegalFooter bgColor={survey.surveyBackground?.bg || "#ffff"} />
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "animation" ? (
    <div>
      <div className={`flex  min-h-screen flex-col items-center justify-center px-2`}>
        <video
          muted
          loop
          autoPlay
          className="fixed left-0 top-0 -z-50 h-full w-full  object-cover"
          style={{
            filter: survey.surveyBackground?.brightness
              ? `brightness(${survey.surveyBackground.brightness}%)`
              : "none",
          }}>
          <source src={survey.surveyBackground?.bg || ""} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="relative w-full">{children}</div>
      </div>
      <LegalFooter bgColor={survey.surveyBackground?.bg || "#ffff"} />
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "image" ? (
    <div>
      <div
        className={`flex  min-h-screen flex-col items-center justify-center px-2`}
        style={{
          backgroundImage: `url(${survey.surveyBackground?.bg})`,
          backgroundSize: "cover",
          filter: survey.surveyBackground?.brightness
            ? `brightness(${survey.surveyBackground.brightness}%)`
            : "none",
        }}>
        <div className="relative w-full">{children}</div>
      </div>
      <LegalFooter bgColor={survey.surveyBackground?.bg || "#ffff"} />
    </div>
  ) : (
    <div>
      <div
        className={`flex  min-h-screen flex-col items-center justify-center px-2`}
        style={{
          backgroundColor: `#ffff`,
          filter: survey.surveyBackground?.brightness
            ? `brightness(${survey.surveyBackground.brightness}%)`
            : "none",
        }}>
        <div className="relative w-full">{children}</div>
      </div>
      <LegalFooter bgColor={"#ffff"} />
    </div>
  );
}
