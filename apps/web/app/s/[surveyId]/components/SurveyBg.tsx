export default async function SurveyBg({ children, survey }) {
  return survey.surveyBackground && survey.surveyBackground.bgType === "color" ? (
    <div
      className={`flex h-full items-center justify-center `}
      style={{ backgroundColor: `${survey.surveyBackground?.bg}` }}>
      <div className="h-[60%]">{children}</div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "animation" ? (
    <div className={`flex h-full items-center justify-center `}>
      <video muted loop autoPlay className="fixed left-0 top-0 -z-50 h-full w-full object-cover">
        <source src={survey.surveyBackground?.bg} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="h-[60%]">{children}</div>
    </div>
  ) : survey.surveyBackground && survey.surveyBackground.bgType === "image" ? (
    <div
      className={`flex h-full items-center justify-center `}
      style={{
        backgroundImage: `url(${survey.surveyBackground?.bg})`,
        backgroundSize: "inherit",
      }}>
      <div className="h-[60%]">{children}</div>
    </div>
  ) : (
    <div className={`flex h-full items-center justify-center `} style={{ backgroundColor: "#ffff" }}>
      <div className="h-[60%]">{children}</div>
    </div>
  );
}
