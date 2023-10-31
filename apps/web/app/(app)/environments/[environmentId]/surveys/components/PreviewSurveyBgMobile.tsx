export default function PreviewSurveyBgMobile({ children, survey, ContentRef }) {
  return survey.surveyBackground && survey.surveyBackground.bgType === "color" ? (
    <div className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500">
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col"
        ref={ContentRef}
        style={{
          backgroundColor: survey.surveyBackground.bg,
          filter: survey.surveyBackground?.brightness
            ? `brightness(${survey.surveyBackground.brightness}%)`
            : "none",
        }}></div>
      <div className="absolute flex h-full w-full items-center justify-center overflow-y-auto">
        {children}
      </div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "animation" ? (
    <div className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500">
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col overflow-y-auto"
        ref={ContentRef}>
        <div className="relative flex w-full flex-grow flex-col items-center justify-center">
          <div className="absolute inset-0 h-full w-full object-cover">
            <video
              muted
              loop
              autoPlay
              className="h-full w-full object-cover"
              style={{
                width: "100%",
                height: "100%",
                filter: survey.surveyBackground?.brightness
                  ? `brightness(${survey.surveyBackground.brightness}%)`
                  : "none",
              }}>
              <source src={survey.surveyBackground.bg} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          {children}
        </div>
      </div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "image" ? (
    <div className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500">
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col overflow-y-auto"
        ref={ContentRef}
        style={{
          backgroundImage: `url(${survey.surveyBackground.bg})`,
          filter: survey.surveyBackground?.brightness
            ? `brightness(${survey.surveyBackground.brightness}%)`
            : "none",
        }}></div>
      <div className="absolute flex h-full w-full items-center justify-center overflow-y-auto">
        {children}
      </div>
    </div>
  ) : (
    <div className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500">
      <div
        className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col"
        ref={ContentRef}
        style={{
          backgroundColor: "#ffff",
          filter: survey.surveyBackground?.brightness
            ? `brightness(${survey.surveyBackground.brightness}%)`
            : "none",
        }}></div>
      <div className="absolute flex h-full w-full items-center justify-center overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
