import nextMDX from "@next/mdx";

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
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/introduction/what-is-formbricks",
        permanent: true,
      },
      // Redirects for Docs 2.0
      // Self Hosting
      {
        source: "/self-hosting/deployment",
        destination: "/self-hosting/overview",
        permanent: true,
      },
      {
        source: "/self-hosting/production",
        destination: "/self-hosting/one-click",
        permanent: true,
      },
      {
        source: "/self-hosting/external-auth-providers",
        destination: "/self-hosting/configuration",
        permanent: true,
      },
      {
        source: "/self-hosting/enterprise",
        destination: "/self-hosting/license",
        permanent: true,
      },
      // Developer Docs
      {
        source: "/contributing/:path",
        destination: "/developer-docs/contributing",
        permanent: true,
      },
      {
        source: "/additional-features/api",
        destination: "/developer-docs/rest-api",
        permanent: true,
      },
      {
        source: "/in-app-surveys/developer-quickstart",
        destination: "/developer-docs/overview",
        permanent: true,
      },
      // Link Survey
      {
        source: "/link-surveys/embed-in-email",
        destination: "/link-surveys/embed-surveys",
        permanent: true,
      },
    ];
  },
};

export default withSearch(withMDX(nextConfig));
