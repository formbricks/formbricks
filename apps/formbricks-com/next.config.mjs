/** @type {import('next').NextConfig} */

import nextMDX from "@next/mdx";
import { withPlausibleProxy } from "next-plausible";
import remarkGfm from "remark-gfm";
import rehypePrism from "@mapbox/rehype-prism";

const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  transpilePackages: ["@formbricks/ui", "@formbricks/lib"],
  async redirects() {
    return [
      {
        source: "/discord",
        destination: "https://discord.gg/3YFcABF2Ts",
        permanent: true,
      },
      {
        source: "/roadmap",
        destination: "https://github.com/orgs/formbricks/projects/1",
        permanent: true,
      },
      {
        source: "/github",
        destination: "https://github.com/formbricks/formbricks",
        permanent: true,
      },
      {
        source: "/deal",
        destination: "/concierge",
        permanent: false,
      },
      {
        source: "/privacy",
        destination: "/privacy-policy",
        permanent: true,
      },
      {
        source: "/form-hq",
        destination: "/",
        permanent: true,
      },
      {
        source: "/docs",
        destination: "/docs/introduction/what-is-formbricks",
        permanent: true,
      },
      {
        source: "/docs/getting-started/nextjs",
        destination: "/docs/getting-started/nextjs-app",
        permanent: true,
      },
      {
        source: "/docs/formbricks-hq/self-hosting",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/react-form-library/getting-started",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/react-form-library/work-with-components",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/react-form-library/introduction",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/formbricks-hq/schema",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/events/why",
        destination: "/docs/actions/why",
        permanent: true,
      },
      {
        source: "/docs/events/code",
        destination: "/docs/actions/code",
        permanent: true,
      },
      {
        source: "/docs/events/code",
        destination: "/docs/actions/code",
        permanent: true,
      },

      {
        source: "/pmf",
        destination: "/",
        permanent: true,
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
