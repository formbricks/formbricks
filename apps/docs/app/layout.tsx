import { Providers } from "@/app/providers";
import { Layout } from "@/components/Layout";
import { type Section } from "@/components/SectionProvider";
import "@/styles/tailwind.css";
import glob from "fast-glob";
import { type Metadata } from "next";
import { Jost } from "next/font/google";

export const metadata: Metadata = {
  title: {
    template: "%s - Formbricks Docs",
    default: "Formbricks Documentation",
  },
};

const jost = Jost({ subsets: ["latin"] });

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  let pages = await glob("**/*.mdx", { cwd: "src/app" });
  let allSectionsEntries = (await Promise.all(
    pages.map(async (filename) => [
      "/" + filename.replace(/(^|\/)page\.mdx$/, ""),
      (await import(`./${filename}`)).sections,
    ])
  )) as Array<[string, Array<Section>]>;
  let allSections = Object.fromEntries(allSectionsEntries);

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`flex min-h-full bg-white antialiased dark:bg-zinc-900 ${jost.className}`}>
        <Providers>
          <div className="w-full">
            <Layout allSections={allSections}>{children}</Layout>
          </div>
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
