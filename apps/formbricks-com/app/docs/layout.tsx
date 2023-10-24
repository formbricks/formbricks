import glob from "fast-glob";

import { Providers } from "@/app/providers";
import { Layout } from "@/components/docs/Layout";

import { type Section } from "@/components/docs/SectionProvider";


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let pages = await glob("**/*.mdx", { cwd: "app/docs" });
  let allSectionsEntries = (await Promise.all(
    pages.map(async (filename) => [
      "/docs/" + filename.replace(/(^|\/)page\.mdx$/, ""),
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
