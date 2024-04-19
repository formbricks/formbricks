export async function GET(_: Request, { params }: { params: { surveyId: string } }) {
  const surveyId = params.surveyId;
  // redirect to Formbricks Cloud
  return Response.redirect(`https://app.formbricks.com/s/${surveyId}`, 301);
}
