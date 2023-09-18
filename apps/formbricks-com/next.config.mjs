import nextMDX from "@next/mdx";

import { withPlausibleProxy } from "next-plausible";
import { recmaPlugins } from "./mdx/recma.mjs";
import { rehypePlugins } from "./mdx/rehype.mjs";
import { remarkPlugins } from "./mdx/remark.mjs";
import withSearch from "./mdx/search.mjs";

const withMDX = nextMDX({
  options: {
    remarkPlugins,
    rehypePlugins,
    recmaPlugins,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  transpilePackages: ["@formbricks/ui", "@formbricks/lib"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "seo-strapi-aws-s3.s3.eu-central-1.amazonaws.com",
        port: "",
      },
    ],
  },
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
        source: "/docs/quickstart",
        destination: "/docs/getting-started/quickstart-in-app-survey",
        permanent: true,
      },
      {
        source: "/docs/getting-started/nextjs",
        destination: "/docs/getting-started/framework-guides#next-js",
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
        source: "/docs/quickstart",
        destination: "/docs/quickstart-in-app-survey",
        permanent: true,
      },
      {
        source: "/pmf",
        destination: "/",
        permanent: true,
      },
      {
        source: "/blog/v1-and-how-we-got-here",
        destination: "/blog/experience-management-open-source",
        permanent: true,
      },
      // Below done for Docs update, 09-2023
      {
        source: "/docs/actions/why",
        destination: "/docs/concepts/actions",
        permanent: true,
      },
      {
        source: "/docs/actions/code",
        destination: "/docs/concepts/actions#code-actions",
        permanent: true,
      },
      {
        source: "/docs/actions/no-code",
        destination: "/docs/concepts/actions#no-code-actions",
        permanent: true,
      },
      {
        source: "/docs/attributes/why",
        destination: "/docs/concepts/attributes#what-are-actions",
        permanent: true,
      },
      {
        source: "/docs/attributes/custom-attributes",
        destination: "/docs/concepts/attributes#setting-attributes-with-code",
        permanent: true,
      },
      {
        source: "/docs/attributes/identify-users",
        destination: "/docs/concepts/attributes#identifying-users",
        permanent: true,
      },
      {
        source: "/docs/contributing/introduction",
        destination:"/docs/developer-resources/contributing",
        permanent: true,
      },
      {
        source: "/docs/contributing/setup",
        destination:"/docs/developer-resources/contributing#setup-dev-environment",
        permanent: true,
      },
      {
        source: "/docs/contributing/demo",
        destination:"/docs/developer-resources/contributing#demo-app",
        permanent: true,
      },
      {
        source: "/docs/contributing/troubleshooting",
        destination:"/docs/developer-resources/contributing#troubleshooting",
        permanent: true,
      },
      {
        source:"/docs/self-hosting/deployment",
        destination:"/docs/developer-resources/self-host",
        permanent: true,
      },
      {
        source:"/docs/self-hosting/production",
        destination:"/docs/developer-resources/self-host#with-shell-script",
        permanent: true,
      },      {
        source:"/docs/self-hosting/docker",
        destination:"/docs/developer-resources/self-host#with-docker",
        permanent: true,
      },      {
        source:"/docs/self-hosting/from-source",
        destination:"/docs/developer-resources/self-host#from-source",
        permanent: true,
      },

    ];
  },
  async rewrites() {
    return {
      fallback: [
        // These rewrites are checked after both pages/public files
        // and dynamic routes are checked
        {
          source: "/:path*",
          destination: `https://app.formbricks.com/s/:path*`,
        },
      ],
    };
  },
};

export default withPlausibleProxy({ customDomain: "https://plausible.formbricks.com" })(
  withSearch(withMDX(nextConfig))
);
