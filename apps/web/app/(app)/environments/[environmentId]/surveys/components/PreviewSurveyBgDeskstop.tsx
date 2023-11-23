import BackgroundView from "@/app/s/[surveyId]/components/BackgroundView";

export default function PreviewSurveyBgDeskstop({ children, survey, ContentRef }) {
  return (
    <>
      <BackgroundView survey={survey} isPreview={true} ContentRef={ContentRef}>
        {children}
      </BackgroundView>
    </>
  );
}
