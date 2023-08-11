import fetch from 'node-fetch';
import MetaInformation from "../../components/shared/MetaInformation";

export async function getStaticPaths() {
  const response = await fetch("http://localhost:1337/api/blog-articles?populate=*");
  const articles = await response.json();

  console.log("articles.data", JSON.stringify(articles.data, null, 2));
  console.log("articles", articles);

  const paths = articles.data.map((article) => ({
    params: { slug: article.attributes.article[0].slug },
  }));

  return { paths, fallback: true };
}

export async function getStaticProps({ params }) {
  const res = await fetch(`http://localhost:1337/api/blog-articles?populate=*`);
  if (!res.ok) {
    throw new Error("Something went wrong");
  }
  const resData = await res.json();
  const articles = resData.data;
  // find article by slug attribute
  const article = articles.find((a) => a.attributes.article[0].slug === params.slug);
  return { props: { article } };
}

export default function ArticlePage({ article }) {
  if (!article) return <div>Loading...</div>; // Render a loading state if data hasn't been fetched yet

  return (
    <div>
      <MetaInformation
        title={article.attributes.metadata[0].metaTitle}
        description={article.attributes.metadata[0].metaDescription}
        publishedTime={article.attributes.publishedAt} // Or however you want to handle this
        authors={undefined} // You'll need to provide this value
        section={article.attributes.metadata[0].metaSection}
        tags={[
          article.attributes.metadata[0].tag1,
          article.attributes.metadata[0].tag2,
          article.attributes.metadata[0].tag3,
          article.attributes.metadata[0].tag3,
          article.attributes.metadata[0].tag3,
        ]}
      />
      <pre>{JSON.stringify(article, null, 2)}</pre>
    </div>
  );
}
