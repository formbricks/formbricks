import glob from "fast-glob";
import * as path from "path";

async function importArticle(articleFilename: string) {
  let { meta, default: component } = await import(`../pages/blog/${articleFilename}`);
  return {
    slug: articleFilename.replace(/(\/index)?\.mdx$/, ""),
    ...meta,
    component,
  };
}

export async function getAllArticles() {
  let articleFilenames = await glob(["*.mdx", "*/index.mdx"], {
    cwd: path.join(process.cwd(), "pages/blog"),
  });

  let articles = await Promise.all(articleFilenames.map(importArticle));

  return articles.sort((a, z) => new Date(z.date).valueOf() - new Date(a.date).valueOf());
}
