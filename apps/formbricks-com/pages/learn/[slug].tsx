import fetch from 'node-fetch';
import MetaInformation from "../../components/shared/MetaInformation";

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

  console.log(response);

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  console.log("articles.data", JSON.stringify(articles.data, null, 2));
  console.log("articles", articles);

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
  console.log("article", article);
  return { props: { article } };
}

export default function ArticlePage({ article }) {
  if (!article) return <div>Loading...</div>;

  return (
    <div>
      <MetaInformation
        title={article.attributes.Metadata.metaTitle}
        description={article.attributes.Metadata.metaDescription}
        publishedTime={article.attributes.publishedAt}
        authors={undefined}
        section={article.attributes.Metadata.metaSection}
        tags={[
          article.attributes.Metadata.tag1,
          article.attributes.Metadata.tag2,
          article.attributes.Metadata.tag3,
          article.attributes.Metadata.tag3,
          article.attributes.Metadata.tag3,
        ]}
      />
      <pre>{JSON.stringify(article, null, 2)}</pre>
    </div>
  );
}
