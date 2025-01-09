import { Providers } from "@/app/providers";
import { Layout } from "@/components/layout";
import { type Section } from "@/components/section-provider";
import "@/styles/tailwind.css";
import glob from "fast-glob";
import { type Metadata } from "next";
import { Jost } from "next/font/google";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    template: "%s - Formbricks Docs",
    default: "Formbricks Documentation",
  },
};

const jost = Jost({ subsets: ["latin"] });

async function RootLayout({ children }: { children: React.ReactNode }) {
  const pages = await glob("**/*.mdx", { cwd: "src/app" });
  const allSectionsEntries: [string, Section[]][] = (await Promise.all(
    pages.map(async (filename) => [
      `/${filename.replace(/(?:^|\/)page\.mdx$/, "")}`,
      (await import(`./${filename}`) as { sections: Section[] }).sections,
    ])
  ));
  const allSections = Object.fromEntries(allSectionsEntries);

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_LAYER_API_KEY ? <Script
          strategy="afterInteractive"
          src="https://storage.googleapis.com/generic-assets/buildwithlayer-widget-4.js"
          primary-color="#00C4B8"
          api-key={process.env.NEXT_PUBLIC_LAYER_API_KEY}
          walkthrough-enabled="false"
          design-style="copilot"
        /> : null}
      </head>
      <body className={`flex min-h-full bg-white antialiased dark:bg-zinc-900 ${jost.className}`}>
        <Providers>
          <div className="w-full">
            <Layout allSections={allSections}>{children}</Layout>
          </div>
        </Providers>
      </body>
    </html>
  );
}

export default RootLayout;
