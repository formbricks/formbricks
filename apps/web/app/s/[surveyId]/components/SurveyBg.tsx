export default async function SurveyBg({ children, survey }) {
  const bgColour = survey.surveyBackground?.bgColor || "#ffff";

  console.log("----", survey.surveyBackground);
  return (
    <div
      className={`flex h-full items-center justify-center `}
      // style={{ backgroundColor: `${bgColour}` }}
      // style={{
      //   backgroundImage: `url(${bgColour})`,
      //   backgroundSize: "inherit"
      // }}
    >
      <video muted loop autoPlay className="fixed left-0 top-0 -z-50 h-full w-full object-cover">
        <source src="/animated-bgs/4K/1_4k.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="h-[60%]">{children}</div>
    </div>
  );
}
