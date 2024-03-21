import Link from "next/link";
import { FaDiscord, FaGithub, FaXTwitter } from "react-icons/fa6";

import { FooterLogo } from "./Logo";

const navigation = {
  products: [
    { name: "Link Surveys", href: "/open-source-form-builder", status: true },
    { name: "Website Surveys", href: "/website-survey", status: true },
    { name: "In-app Surveys", href: "/in-app-survey", status: true },
  ],
  comparisons: [
    { name: "vs. Google Forms", href: "/vs-google-forms", status: true },
    { name: "vs. Formspree", href: "/vs-formspree", status: true },
    { name: "vs. OhMyForm", href: "/vs-ohmyform", status: true },
  ],
  footernav: [
    { name: "Community", href: "/community", status: true },
    { name: "Pricing", href: "/pricing", status: true },
    { name: "Blog", href: "/blog", status: true },
    { name: "Docs", href: "/docs/introduction/what-is-formbricks", status: true },
  ],
  legal: [
    { name: "Imprint", href: "/imprint", status: true },
    { name: "Privacy Policy", href: "/privacy", status: true },
    { name: "Terms", href: "/terms", status: true },
    { name: "GDPR FAQ", href: "/gdpr", status: true },
    { name: "GDPR Guide", href: "/gdpr-guide", status: true },
  ],
  bestPractices: [
    { name: "Interview Prompt", href: "/interview-prompt", status: true },
    { name: "PMF Survey", href: "/measure-product-market-fit", status: true },
    { name: "Onboarding Segments", href: "/onboarding-segmentation", status: true },
    { name: "Learn from Churn", href: "/learn-from-churn", status: true },
    { name: "Improve Trial CR", href: "/improve-trial-conversion", status: true },
    { name: "Docs Feedback", href: "/docs-feedback", status: true },
    { name: "Feature Chaser", href: "/feature-chaser", status: true },
    { name: "Feedback Box", href: "/feedback-box", status: true },
  ],
  social: [
    {
      name: "Twitter",
      href: "https://twitter.com/formbricks",
      icon: FaXTwitter,
    },
    {
      name: "GitHub",
      href: "https://github.com/formbricks/formbricks",
      icon: FaGithub,
    },
    {
      name: "Discord",
      href: "https://formbricks.com/discord",
      icon: FaDiscord,
    },
  ],
};
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="bg-gradient-to-b from-slate-50 to-slate-200 pt-32 dark:from-slate-900 dark:to-slate-800"
      aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto  grid max-w-7xl content-center gap-12 px-4 py-12 md:grid-cols-2 lg:grid-cols-3 lg:py-16">
        <div className="space-y-6">
          <Link href="/">
            <span className="sr-only">Formbricks</span>
            <FooterLogo className="h-8 w-auto sm:h-10" />
          </Link>
          <p className="text-base text-slate-500 dark:text-slate-400">Privacy-first Experience Management</p>
          <div className="border-slate-500">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Formbricks GmbH &copy; {currentYear}. All rights reserved.
              <br />
              <Link href="/imprint">Imprint</Link> | <Link href="/privacy">Privacy Policy</Link> |{" "}
              <Link href="/terms">Terms</Link> | <Link href="/oss-friends">OSS Friends</Link>
            </p>
          </div>
          <div className="flex space-x-6">
            {navigation.social.map((item) => (
              <Link key={item.name} href={item.href} className="text-slate-400 hover:text-slate-500">
                <span className="sr-only">{item.name}</span>
                <item.icon className="h-6 w-6" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 lg:col-span-2 lg:grid-cols-4">
          <div>
            <h4 className="mb-2 font-medium text-slate-700">Formbricks</h4>
            {navigation.footernav.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="my-1 block text-slate-500 hover:text-slate-600">
                {item.name}
              </Link>
            ))}
          </div>
          <div>
            <h4 className="mb-2 font-medium text-slate-700">Product</h4>
            {navigation.products.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="my-1 block text-slate-500 hover:text-slate-600">
                {item.name}
              </Link>
            ))}
            <h4 className="mb-2 mt-5 font-medium text-slate-700">Comparison</h4>
            {navigation.comparisons.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="my-1 block text-slate-500 hover:text-slate-600">
                {item.name}
              </Link>
            ))}
          </div>
          <div>
            <h4 className="mb-2 font-medium text-slate-700">Best Practices</h4>
            {navigation.bestPractices.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="my-1 block text-slate-500 hover:text-slate-600">
                {item.name}
              </Link>
            ))}
          </div>
          <div>
            <h4 className="mb-2 font-medium text-slate-700">Legal</h4>
            {navigation.legal.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="my-1 block text-slate-500 hover:text-slate-600">
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
