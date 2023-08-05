export async function getStaticPaths() {
  const response = await fetch("http://localhost:1337/api/learn-articles?populate=");
  const articles = await response.json();

  console.log("articles.data", articles.data);

  const firstArticle = await fetch("http://localhost:1337/api/learn-articles/1?populate=*");
  const firstArticleJSON = await firstArticle.json();

  console.log("firstArticleJSON", firstArticleJSON);

  if (!Array.isArray(articles.data)) {
    console.error("Expected articles.data to be an array but got:", articles.data);
    return { paths: [], fallback: true };
  }

  const paths = articles.data.map((article) => ({
    params: { slug: article.attributes.slug }, // Adjust this to match the actual path to the slug in your data
  }));

  return { paths, fallback: true };
}

export async function getStaticProps({ params }) {
  const article = await fetch(`http://localhost:1337/api/learn-articles?slug=${params.slug}`)
    .then((response) => response.json())
    .then((data) => data[0]);

  return { props: { article } };
}

export default function ArticlePage({ article }) {
  if (!article) return <div>Loading...</div>; // Render a loading state if data hasn't been fetched yet

  return (
    <div>
      <h1>{article.title}</h1>
      <p>By {article.author}</p>
      {/* Render the rest of the article data here */}
    </div>
  );
}
