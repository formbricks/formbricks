import nextMDX from "@next/mdx";
import { withPlausibleProxy } from "next-plausible";
import remarkGfm from "remark-gfm";
import rehypePrism from "@mapbox/rehype-prism";

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@formbricks/ui"],
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  async redirects() {
    return [
      {
        source: "/discord",
        destination: "https://discord.gg/3YFcABF2Ts",
        permanent: false,
      },
      {
        source: "/roadmap",
        destination: "https://github.com/orgs/formbricks/projects/1",
        permanent: false,
      },
      {
        source: "/github",
        destination: "https://github.com/formbricks/formbricks",
        permanent: false,
      },
      {
        source: "/privacy",
        destination: "/privacy-policy",
        permanent: false,
      },
      {
        source: "/form-hq",
        destination: "/formbricks-hq",
        permanent: false,
      },
      {
        source: "/docs",
        destination: "/docs/introduction/what-is-formbricks",
        permanent: false,
      },
      {
        source: "/docs/formbricks-hq/self-hosting",
        destination: "/docs",
        permanent: false,
      },
      {
        source: "/docs/react-form-library/getting-started",
        destination: "/docs",
        permanent: false,
      },
      {
        source: "/docs/react-form-library/work-with-components",
        destination: "/docs",
        permanent: false,
      },
      {
        source: "/docs/react-form-library/introduction",
        destination: "/docs",
        permanent: false,
      },
      {
        source: "/docs/formbricks-hq/schema",
        destination: "/docs",
        permanent: false,
      },
      {
        source: "/demo",
        destination: "https://app.formbricks.com/",
        permanent: false,
      },
      {
        source: "/pmf",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

const withMDX = nextMDX({
  extension: /\.mdx?$/,
  options: {
    // If you use remark-gfm, you'll need to use next.config.mjs
    // as the package is ESM only
    // https://github.com/remarkjs/remark-gfm#install
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypePrism],
    // If you use `MDXProvider`, uncomment the following line.
    // providerImportSource: "@mdx-js/react",
  },
});

export default withPlausibleProxy({ customDomain: "https://plausible.formbricks.com" })(withMDX(nextConfig));
