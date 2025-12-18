import { notFound, redirect } from "next/navigation";
import { getSurveyBySlug } from "@/modules/survey/lib/slug";

interface PrettyUrlPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PrettyUrlPage(props: PrettyUrlPageProps) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  const result = await getSurveyBySlug(slug);
  if (!result.ok || !result.data) {
    return notFound();
  }

  const survey = result.data;

  // Preserve query params (suId, lang, etc.)
  const queryString = new URLSearchParams(
    Object.entries(searchParams).filter(([_, v]) => v !== undefined) as [string, string][]
  ).toString();

  const redirectUrl = `/s/${survey.id}${queryString ? `?${queryString}` : ""}`;

  redirect(redirectUrl);
}
