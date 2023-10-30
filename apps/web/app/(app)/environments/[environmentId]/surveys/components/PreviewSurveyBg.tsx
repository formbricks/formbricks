export default function PreviewSurveyBg({ children, survey, ContentRef }) {
  return survey.surveyBackground && survey.surveyBackground.bgType === "color" ? (
    <div
      className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500"
      style={{ backgroundColor: survey.surveyBackground.bgColor }}>
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col overflow-y-auto"
        ref={ContentRef}>
        <div className="relative flex w-full flex-grow flex-col items-center justify-center">{children}</div>
      </div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "animation" ? (
    <div className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500">
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col overflow-y-auto"
        ref={ContentRef}
        style={{ position: "relative" }}>
        <div className="relative flex w-full flex-grow flex-col items-center justify-center">
          <div className="absolute inset-0 h-full w-full object-cover">
            <video
              muted
              loop
              autoPlay
              className="h-full w-full object-cover"
              style={{ width: "100%", height: "100%" }}>
              <source src={survey.surveyBackground.bgColor} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          {children}
        </div>
      </div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "image" ? (
    <div
      className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500"
      style={{ backgroundImage: `url(${survey.surveyBackground.bgColor})` }}>
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col overflow-y-auto"
        ref={ContentRef}>
        <div className="relative flex w-full flex-grow flex-col items-center justify-center">{children}</div>
      </div>
    </div>
  ) : (
    <div
      className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500"
      style={{ backgroundColor: "#ffff" }}>
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col overflow-y-auto"
        ref={ContentRef}>
        <div className="relative flex w-full flex-grow flex-col items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
