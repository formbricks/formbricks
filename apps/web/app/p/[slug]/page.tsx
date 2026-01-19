import { notFound, redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getSurveyBySlug } from "@/modules/survey/lib/slug";

interface PrettyUrlPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PrettyUrlPage(props: PrettyUrlPageProps) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  if (IS_FORMBRICKS_CLOUD) {
    return notFound();
  }

  const survey = await getSurveyBySlug(slug);
  if (!survey) {
    return notFound();
  }

  // Preserve query params (suId, lang, etc.)
  const queryString = new URLSearchParams(
    Object.entries(searchParams).filter(([_, v]) => v !== undefined) as [string, string][]
  ).toString();

  const baseUrl = `/s/${survey.id}`;
  const redirectUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  redirect(redirectUrl);
}
