import Head from "next/head";
import { WEBAPP_URL } from "@formbricks/lib/constants";

interface Props {
  title: string;
  description: string;
  publishedTime?: string;
  updatedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
}

export default function MetaInformation({
  title,
  description,
  publishedTime,
  updatedTime,
  authors,
  section,
  tags,
}: Props) {
  const pageTitle = `${title}`;
  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`https://${WEBAPP_URL}/social-image.png`} />
      <meta property="og:image:alt" content="Open Source Experience Management, Privacy-first" />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Formbricks Privacy-first Experience Management Solution" />
      <meta property="article:publisher" content="Formbricks GmbH" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {updatedTime && <meta property="article:updated_time" content={updatedTime} />}
      {authors && <meta property="article:author" content={authors.join(", ")} />}
      {section && <meta property="article:section" content={section} />}
      {tags && <meta property="article:tag" content={tags.join(", ")} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@formbricks" />
      <meta name="twitter:creator" content="@formbricks" />
      <meta name="theme-color" content="#00C4B8" />
    </Head>
  );
}
