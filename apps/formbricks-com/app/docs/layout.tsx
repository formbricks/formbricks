import glob from "fast-glob";

import { Providers } from "@/app/providers";
import { Layout } from "@/components/docs/Layout";

import { type Metadata } from "next";
import { type Section } from "@/components/docs/SectionProvider";

export const metadata: Metadata = {
  title: {
    template: "Formbricks – Experience Management for B2B SaaS",
    default: "Formbricks Docs",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let pages = await glob("**/*.mdx", { cwd: "src/app/docs" });
  let allSectionsEntries = (await Promise.all(
    pages.map(async (filename) => [
      "/" + filename.replace(/(^|\/)page\.mdx$/, ""),
      (await import(`./${filename}`)).sections,
    ])
  )) as Array<[string, Array<Section>]>;
  let allSections = Object.fromEntries(allSectionsEntries);

  return (
    <Providers>
      <div className="w-full">
        <Layout allSections={allSections}>{children}</Layout>
      </div>
    </Providers>
  );
}
