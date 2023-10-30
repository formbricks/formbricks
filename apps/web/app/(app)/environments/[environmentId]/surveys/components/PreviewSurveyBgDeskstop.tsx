export default function PreviewSurveyBgDeskstop({ children, survey, ContentRef }) {
  return survey.surveyBackground && survey.surveyBackground.bgType === "color" ? (
    <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
      <div
        className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6"
        style={{ backgroundColor: survey.surveyBackground.bg || "#ffff" }}>
        {children}
      </div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "animation" ? (
    <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
      <div
        className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6"
        style={{
          background: `url(${survey.surveyBackground.bg}) no-repeat center center fixed`,
          // backgroundSize: 'cover',
        }}>
        <video muted loop autoPlay className="absolute inset-0 h-full w-full object-cover">
          <source src={survey.surveyBackground.bg} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {children}
      </div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "image" ? (
    <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
      <div
        className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6"
        style={{ backgroundImage: `url(${survey.surveyBackground.bg})` }}>
        {children}
      </div>
    </div>
  ) : (
    <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
      <div
        className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6"
        style={{ backgroundColor: "#ffff" }}>
        {children}
      </div>
    </div>
  );
}
