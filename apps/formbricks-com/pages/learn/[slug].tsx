import LayoutMdx from "@/components/shared/LayoutMdx";
import fetch from "node-fetch";
import ReactMarkdown from "react-markdown";

type ArticleAttributes = {
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  Article: {
    id: number;
    slug: string;
    author: string;
  };
  Metadata?: {
    metaTitle: string;
    metaDescription: string;
    metaSection: string;
    tag1: string;
    tag2: string;
    tag3: string;
  };
};

type Article = {
  id: number;
  attributes: ArticleAttributes;
};

type APIResponse = {
  data: Article[];
};

export async function getStaticPaths() {
  const response = await fetch("http://127.0.0.1:1337/api/learn-articles?populate=*");
  const articles: APIResponse = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const paths = articles.data.map((article) => ({
    params: { slug: article.attributes.Article.slug },
  }));

  return { paths, fallback: true };
}

export async function getStaticProps({ params }) {
  const res = await fetch(`http://127.0.0.1:1337/api/learn-articles?populate=*`);
  if (!res.ok) {
    throw new Error("Something went wrong");
  }
  const resData: APIResponse = await res.json();
  const articles = resData.data;
  // find article by slug attribute
  const article = articles.find((a) => a.attributes.Article.slug === params.slug);
  return { props: { article } };
}

export default function ArticlePage({ article }) {
  if (!article) return <div>Loading...</div>;

  const { Article, Metadata } = article.attributes;

  const meta = {
    title: Article.title,
    description: Metadata.metaDescription,
    publishedTime: article.attributes.publishedAt,
    authors: [Article.author],
    section: Metadata.metaSection,
    tags: [Metadata.tag1, Metadata.tag2, Metadata.tag3, Metadata.tag4].filter(Boolean),
  };

  return (
    <LayoutMdx meta={meta}>
      <ReactMarkdown>{Article.content}</ReactMarkdown>
    </LayoutMdx>
  );
}
