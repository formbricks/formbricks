export default async function SurveyBg({ children, survey }) {
  const bgColour = survey.surveyBackground?.bgColor || "#ffff";

  console.log("----", survey.surveyBackground);
  return (
    <div className={`flex h-full items-center justify-center `} style={{ backgroundColor: `${bgColour}` }}>
      <div className="h-[60%]">{children}</div>
    </div>
  );
}
